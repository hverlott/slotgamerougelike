const LEVELS = [
  // 关卡可无限循环：配置只决定“敌人类型池/波次间隔”的梯度
  { waveInterval: 2600, enemyTypes: ['walker', 'runner'] },
  { waveInterval: 2300, enemyTypes: ['walker', 'runner', 'spitter'] },
  { waveInterval: 2000, enemyTypes: ['walker', 'runner', 'spitter', 'brute'] },
  { waveInterval: 1750, enemyTypes: ['runner', 'spitter', 'brute', 'tank', 'glitch'] },
];

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const sampleUniqueCols = (gridSize, count) => {
  const cols = Array.from({ length: gridSize }, (_, i) => i);
  // Fisher-Yates
  for (let i = cols.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cols[i], cols[j]] = [cols[j], cols[i]];
  }
  return cols.slice(0, Math.min(gridSize, count));
};

const sampleUniquePositions = (gridSize, rowsMax, count) => {
  const maxRow = clamp(rowsMax, 0, gridSize - 1);
  const cells = [];
  for (let r = 0; r <= maxRow; r += 1) {
    for (let c = 0; c < gridSize; c += 1) {
      cells.push({ c, r });
    }
  }
  // Fisher-Yates shuffle
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  return cells.slice(0, Math.min(cells.length, count));
};

// “挤一挤”的聚簇采样：选择 2-3 个中心点，优先在中心附近生成（允许同格最多 3 只，靠 jitter 视觉区分）
const sampleClusteredPositions = (gridSize, rowsMax, count) => {
  const maxRow = clamp(rowsMax, 0, gridSize - 1);
  const centers = Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
    c: Math.floor(Math.random() * gridSize),
    r: Math.floor(Math.random() * (maxRow + 1)),
  }));

  const capPerCell = 3;
  const cellCounts = new Map();
  const out = [];
  const pickAround = (center) => {
    const dc = [0, 0, 0, 1, -1, 1, -1, 2, -2][Math.floor(Math.random() * 9)];
    const dr = [0, 0, 1, -1, 2, -2][Math.floor(Math.random() * 6)];
    return {
      c: clamp(center.c + dc, 0, gridSize - 1),
      r: clamp(center.r + dr, 0, maxRow),
    };
  };

  let guard = 0;
  while (out.length < count && guard++ < count * 20) {
    const center = centers[Math.floor(Math.random() * centers.length)];
    const p = pickAround(center);
    const key = `${p.c}-${p.r}`;
    const used = cellCounts.get(key) ?? 0;
    if (used >= capPerCell) continue;
    cellCounts.set(key, used + 1);
    out.push(p);
  }
  return out;
};

const getEnemyPoolForLevel = (level) => {
  const lv = Math.max(1, Number(level) || 1);
  const pool = ['walker', 'runner'];
  if (lv >= 2) pool.push('spitter');
  if (lv >= 3) pool.push('brute');
  if (lv >= 4) pool.push('tank');
  if (lv >= 5) pool.push('glitch');
  if (lv >= 6) pool.push('bomber');
  if (lv >= 7) pool.push('shield');
  if (lv >= 8) pool.push('phantom');
  if (lv >= 9) pool.push('flyer');
  return pool;
};

const getWaveIntervalForLevel = (level) => {
  const lv = Math.max(1, Number(level) || 1);
  return clamp(2600 - (lv - 1) * 90, 900, 2600);
};

const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

export class LevelManager {
  constructor(game, enemySystem, options = {}) {
    this.game = game;
    this.enemySystem = enemySystem;

    this.currentLevel = 0;
    this.waveTimer = 0;
    this.kills = 0;
    this.paused = false;
    this.elapsedMS = 0;
    // 模式：默认仍保留 ticker 逻辑，但可切换为"每次 spin 刷怪"
    this.spawnOnSpinOnly = options.spawnOnSpinOnly ?? false;
    // spin 刷怪节奏：每 3-5 次 spin 刷一批
    this.spawnBatchEveryMin = options.spawnBatchEveryMin ?? 3;
    this.spawnBatchEveryMax = options.spawnBatchEveryMax ?? 5;
    this._spinsUntilBatch = randInt(this.spawnBatchEveryMin, this.spawnBatchEveryMax);
    // 前进节奏：减慢一倍（每 2 次 spin 前进一步）
    this.moveEverySpins = options.moveEverySpins ?? 2;
    this._spinCount = 0;
    // 开局安全期：避免初始 40-60 只僵尸时，第一波推进直接秒失败
    this.graceMS = options.graceMS ?? 6000;
    // 固定规则：每关消灭 100 个僵尸才能进入下一关
    this.killsToAdvance = options.killsToAdvance ?? 100;
    
    // 🎯 升级系统相关
    this.shouldShowUpgrade = false;
    this.upgradeSystem = options.upgradeSystem ?? null;

    this.overlay = this.createOverlay();

    this.enemySystem.onKilled = () => {
      this.kills += 1;
      this.checkProgress();
    };

    // hooks（可从 options 注入，保证构造期就能响应）
    this.onComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
    this.onFail = typeof options.onFail === 'function' ? options.onFail : null;
    this.onLevelChange = typeof options.onLevelChange === 'function' ? options.onLevelChange : null;

    // 初始僵尸数量：40-60 只（按格子上方区域铺开，避免瞬间 GameOver）
    const minCount = options.initialCountMin ?? 40;
    const maxCount = options.initialCountMax ?? 60;
    const initialCount = clamp(
      Math.floor(minCount + Math.random() * (maxCount - minCount + 1)),
      1,
      this.enemySystem.gridSize * this.enemySystem.gridSize,
    );
    const rowsMax = options.initialRowsMax ?? 5; // 0~5 行（最多 60 格）
    this.spawnInitial(initialCount, rowsMax);
    this.onLevelChange?.({ level: this.currentLevel + 1 });
  }

  spawnInitial(count = 40, rowsMax = 5) {
    const level = this.currentLevel + 1;
    const levelCfg = { enemyTypes: getEnemyPoolForLevel(level) };
    const poses = sampleClusteredPositions(this.enemySystem.gridSize, rowsMax, count);
    poses.forEach(({ c, r }) => {
      const type = levelCfg.enemyTypes[Math.floor(Math.random() * levelCfg.enemyTypes.length)];
      this.enemySystem.spawnZombie(c, r, type, level);
    });
  }

  createOverlay() {
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      zIndex: 200,
    });
    const box = document.createElement('div');
    Object.assign(box.style, {
      padding: '20px 28px',
      borderRadius: '12px',
      color: '#E2E8F0',
      background: 'rgba(15,23,42,0.7)',
      border: '1px solid rgba(0,240,255,0.4)',
      boxShadow: '0 0 20px rgba(0,240,255,0.25)',
      minWidth: '260px',
      textAlign: 'center',
      pointerEvents: 'auto',
      display: 'none',
      backdropFilter: 'blur(10px)',
    });
    const title = document.createElement('div');
    title.style.fontSize = '20px';
    title.style.fontWeight = '800';
    const info = document.createElement('div');
    info.style.margin = '8px 0 16px';
    const btn = document.createElement('button');
    btn.textContent = 'NEXT WAVE';
    Object.assign(btn.style, {
      padding: '10px 16px',
      borderRadius: '10px',
      border: '1px solid rgba(0,240,255,0.4)',
      background: 'rgba(0,0,0,0.6)',
      color: '#00F0FF',
      fontWeight: '700',
      cursor: 'pointer',
    });
    btn.onclick = () => {
      box.style.display = 'none';
      this.nextLevel();
    };
    box.append(title, info, btn);
    panel.appendChild(box);
    document.body.appendChild(panel);
    return { panel, box, title, info, btn };
  }

  setPaused(paused) {
    this.paused = paused;
  }

  update(deltaMS = 0) {
    // 即使 paused（例如 spin 期间暂停关卡推进），也要累计 elapsedMS，避免安全期被无限拉长
    this.elapsedMS += deltaMS;
    if (this.paused) return;
    if (this.spawnOnSpinOnly) return;
    if (this.elapsedMS < this.graceMS) return;
    const level = this.currentLevel + 1;
    const levelCfg = {
      waveInterval: getWaveIntervalForLevel(level),
      enemyTypes: getEnemyPoolForLevel(level),
    };

    this.waveTimer += deltaMS;
    if (this.waveTimer < levelCfg.waveInterval) return;

    this.waveTimer -= levelCfg.waveInterval;
    this.spawnWave(levelCfg);
  }

  spawnWave(cfg) {
    // 先推进已有僵尸，再生成新一波（避免“新刷出来立刻前进一步”的违和感）
    const reachedBottom = this.enemySystem.moveAllZombies();
    if (reachedBottom) {
      this.showFail();
      this.game.onGameOver?.();
      return;
    }

    const level = this.currentLevel + 1;
    const base = 2 + Math.floor(level / 3);
    const count = clamp(base + Math.floor(Math.random() * 3), 2, 7);
    const { gridSize } = this.enemySystem;
    for (let i = 0; i < count; i += 1) {
      const col = Math.floor(Math.random() * gridSize);
      const type = cfg.enemyTypes[Math.floor(Math.random() * cfg.enemyTypes.length)];
      const row = Math.random() < 0.6 ? 0 : 1;
      this.enemySystem.spawnZombie(col, row, type, this.currentLevel + 1);
    }
  }

  // 需求：每次 spin 随机刷怪，且不低于 8 只；关卡越高数量略增，血量更厚（在 EnemySystem.spawnZombie 内处理）
  onSpin() {
    // spin 期间 LevelManager 会被 setPaused(true)，但“按 spin 刷怪”属于事件逻辑，不应被暂停挡住
    // 只有在关卡完成/失败弹窗打开时才停止刷怪
    if (this.isOverlayOpen?.()) return;
    this._spinCount += 1;
    const level = this.currentLevel + 1;
    const enemyTypes = getEnemyPoolForLevel(level);

    // 先推进（减慢一倍：每 N 次 spin 才推进一格；安全期内不推进）
    if (this.elapsedMS >= this.graceMS && this._spinCount % this.moveEverySpins === 0) {
      const reachedBottom = this.enemySystem.moveAllZombies();
      if (reachedBottom) {
        this.showFail();
        this.game.onGameOver?.();
        return;
      }
    }

    // 刷怪节奏：每 3-5 次 spin 刷一批（每批 >=8）
    this._spinsUntilBatch -= 1;
    if (this._spinsUntilBatch > 0) return;
    this._spinsUntilBatch = randInt(this.spawnBatchEveryMin, this.spawnBatchEveryMax);

    const min = 8;
    const bonus = Math.min(10, Math.floor((level - 1) * 0.9));
    const count = clamp(min + bonus + Math.floor(Math.random() * 5), min, 26);

    // 更“挤”的波次：在 0~2 行聚簇生成
    const poses = sampleClusteredPositions(this.enemySystem.gridSize, 2, count);
    poses.forEach(({ c, r }) => {
      const type = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
      this.enemySystem.spawnZombie(c, r, type, level);
    });
  }

  checkProgress() {
    if (this.kills >= this.killsToAdvance) {
      this.paused = true;
      this.shouldShowUpgrade = true;
      // 不再直接显示完成弹窗，而是标记需要进入升级选择
      console.log('[LevelManager] Level complete, waiting for state machine to offer upgrades');
    }
  }

  /**
   * 🎯 检查是否应该提供升级选择（供 AdvanceState 调用）
   */
  shouldOfferChoice() {
    return this.shouldShowUpgrade;
  }

  /**
   * 🎯 获取升级选项（供 ChoiceState 调用）
   */
  rollUpgradeOptions() {
    if (!this.upgradeSystem) {
      console.warn('[LevelManager] UpgradeSystem not initialized');
      return [];
    }
    return this.upgradeSystem.rollOptions();
  }

  /**
   * 🎯 应用升级（供 ChoiceState 调用）
   */
  applyUpgrade(upgrade) {
    if (!this.upgradeSystem) {
      console.warn('[LevelManager] UpgradeSystem not initialized');
      return;
    }
    this.upgradeSystem.applyUpgrade(upgrade);
  }

  /**
   * 🎯 完成升级选择后的清理（供 ChoiceState 调用）
   */
  completeUpgradeChoice() {
    this.shouldShowUpgrade = false;
    this.nextLevel();
  }

  showComplete() {
    // 🎯 已废弃：现在由状态机和 HUD 的升级界面处理
    // 保留方法以防旧代码调用
    console.log('[LevelManager] showComplete() is deprecated, use state machine instead');
  }

  showFail() {
    const { box, title, info, btn } = this.overlay;
    title.textContent = 'MISSION FAILED';
    info.textContent = 'Try again?';
    btn.textContent = 'RETRY';
    btn.onclick = () => {
      window.location.reload();
    };
    box.style.display = 'block';
    // 不要 stop Pixi ticker（避免冻结动画/Promise）
    this.paused = true;
    this.onFail?.();
  }

  isOverlayOpen() {
    return this.overlay?.box?.style?.display === 'block';
  }

  nextLevel() {
    // 不封顶：持续循环关卡
    this.currentLevel += 1;
    this.kills = 0;
    this.waveTimer = 0;
    this.elapsedMS = 0;
    this.paused = false;
    this.game.ticker?.start();
    this.onLevelChange?.({ level: this.currentLevel + 1 });
  }
}

