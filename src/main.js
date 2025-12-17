import { game } from './core/GameApp.js';
import { Assets, Sprite, Texture } from 'pixi.js';
import { GridSystem } from './systems/GridSystem.js';
import { SlotSystem } from './systems/SlotSystem.js';
import { EnemySystem } from './systems/EnemySystem.js';
import { BulletSystem } from './systems/BulletSystem.js';
import { FloatingTextSystem } from './systems/FloatingTextSystem.js';
import { rtpManager } from './systems/RTPManager.js';
import { LevelManager } from './systems/LevelManager.js';
import { resultBank } from './systems/ResultBank.js';
import { themeManager, UIThemes } from './systems/ThemeManager.js';
import { JackpotSystem } from './systems/JackpotSystem.js';

const GRID_SIZE = 10;
const CELL_SIZE = 60;
const GRID_TOP = 80;
// 数值放大（僵尸血量与伤害同倍率，观感更爽）
const COMBAT_SCALE = 100;
const BASE_DAMAGE = 10 * COMBAT_SCALE;
const GAME_CENTER_X = (app) => app.screen.width * 0.35;
const UI_CENTER_X = (app) => app.screen.width * 0.85;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- 资源清单（网络占位图，先保证图片可用） ---
const ASSET_MANIFEST = {
  slot_low: '/assets/2001.png', // 低级图标
  slot_mid: '/assets/2002.png', // 中级图标
  slot_high: '/assets/2003.png', // 高级图标
  slot_wild: 'https://pixijs.com/assets/skully.png', // Wild/Boss图标
  z_walker: '/assets/character_zombie_attack0.png', // 僵尸占位图
  bg_city: '/assets/bacmgrond.png', // 背景图
};

// Vite HMR 会重复执行入口文件，导致 ticker / 事件监听叠加，从而出现：
// - 一次点击统计 +2/+3
// - 波次推进加速，极快 GAME OVER
// 这里用全局锁防止重复初始化（需要应用最新改动时请手动刷新页面）。
const BOOT_KEY = '__D_SLOTGAME_BOOTSTRAPPED__';
if (globalThis[BOOT_KEY]) {
  console.warn('[main] 已初始化，跳过重复启动（HMR保护）。请刷新页面应用最新改动。');
} else {
  globalThis[BOOT_KEY] = true;

const DEBUG_SPAWN_DUMMIES = false;
const createZombies = (enemySystem) => {
  // 调试用：预置靶子
  const cols = [2, 5, 8];
  cols.forEach((c, idx) => enemySystem.spawnZombie(c, idx % 2));
};

const MAX_CONCURRENT_BULLETS = 40;
const fireBulletsFrom = (enemySystem, bulletSystem, originLocal, winAmount, currentBet, baseDamage, winLines = []) => {
  if (winAmount <= 0) return;
  const shots = Math.max(1, Math.min(18, Math.ceil(winAmount / 10)));
  bulletSystem.damagePerHit = baseDamage * (currentBet / 10);
  const winSymbols = (winLines || []).map((l) => l?.symbol).filter((v) => typeof v === 'number');
  const symbolTypeFor = (sym) => {
    // 1: Low(🍒/🍋) 2: Mid(⚡) 3: High(💎) 4: Wild(👹/7️⃣)
    if (sym === 4) return 4; // 爆炸弹
    if (sym === 3) return 3; // 激光
    if (sym === 2) return 2; // 能量弹
    return 1; // 基础弹
  };

  for (let i = 0; i < shots; i += 1) {
    if (bulletSystem.bullets.length >= MAX_CONCURRENT_BULLETS) break;
    const alive = enemySystem.zombies.filter((z) => z && !z.destroyed);
    if (!alive.length) break;
    // 优先消灭最下面的（row 越大越危险），防止过快 Game Over
    const sorted = alive
      .slice()
      .sort((a, b) => {
        const ar = Number.isFinite(a.row) ? a.row : 0;
        const br = Number.isFinite(b.row) ? b.row : 0;
        if (br !== ar) return br - ar;
        // row 相同按 y 越大越优先
        const ay = Number.isFinite(a.y) ? a.y : 0;
        const by = Number.isFinite(b.y) ? b.y : 0;
        return by - ay;
      });
    const topRow = Number.isFinite(sorted[0].row) ? sorted[0].row : 0;
    const candidates = sorted.filter((z) => (Number.isFinite(z.row) ? z.row : 0) === topRow);
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    // 不同中奖类型用不同子弹；金额越高整体升级
    const sym = winSymbols.length ? winSymbols[i % winSymbols.length] : 1;
    let bulletType = symbolTypeFor(sym);
    if (winAmount >= currentBet * 10) bulletType = 4;
    else if (winAmount >= currentBet * 5) bulletType = 3;
    else if (winAmount >= currentBet * 2) bulletType = Math.max(bulletType, 2);
    bulletSystem.shoot(originLocal.x, originLocal.y, target, bulletType);
  }
};

(async () => {
  try {
    // 先初始化 Pixi（并绑定到 game-stage）
    await game.init({ resizeTo: document.getElementById('game-stage') });

    // 加载资源（网络占位图）
    await Assets.load(
      Object.keys(ASSET_MANIFEST).map((key) => ({ alias: key, src: ASSET_MANIFEST[key] }))
    );

    // 添加城市背景（最底层）
    const bg = new Sprite(Texture.from('bg_city'));
    bg.anchor.set(0.5);
    bg.alpha = 0.4;
    const fitBg = () => {
      const sw = game.app.screen.width;
      const sh = game.app.screen.height;
      const tw = bg.texture?.orig?.width || bg.texture?.width || 1;
      const th = bg.texture?.orig?.height || bg.texture?.height || 1;
      const s = Math.max(sw / tw, sh / th);
      bg.scale.set(s);
      bg.position.set(sw / 2, sh / 2);
    };
    fitBg();
    window.addEventListener('resize', fitBg, { passive: true });
    game.app.stage.addChildAt(bg, 0);

    // grid on top (base layer)
    const width = game.app.screen.width;
    const height = game.app.screen.height;

    const gridSystem = new GridSystem(game, GRID_SIZE, CELL_SIZE);
    gridSystem.container.x = width / 2 - (GRID_SIZE * CELL_SIZE) / 2;
    gridSystem.container.y = GRID_TOP;

    // enemies (middle layer)
    const enemySystem = new EnemySystem(game, {
      gridSize: GRID_SIZE,
      cellSize: CELL_SIZE,
      gridTop: 0,
      combatScale: COMBAT_SCALE,
      moveTweenDuration: 1.0,
    });
    enemySystem.container.x = gridSystem.container.x;
    enemySystem.container.y = GRID_TOP;
    if (DEBUG_SPAWN_DUMMIES) createZombies(enemySystem);

    // jackpot（需要在 LevelManager 之前创建：LevelManager 构造期会触发一次 onLevelChange）
    const jackpotSystem = new JackpotSystem(game, {
      // 每关 Boss：放在战场中间（更大体型/更厚血量在 setLevel 内控制）
      x: width / 2,
      y: GRID_TOP + CELL_SIZE * 1.2,
      scale: 1.05,
    });
    // Boss 放在战斗区域：避免 UI 层遮挡
    game.gameLayer.addChild(jackpotSystem);
    // 根据战场位置精确对齐（居中于路面区域）
    jackpotSystem.x = gridSystem.container.x + (GRID_SIZE * CELL_SIZE) / 2;
    jackpotSystem.y = GRID_TOP + CELL_SIZE * 1.15;

    // 关卡 -> 主题/视觉自动升级
    const levelThemeOrder = ['cyberA', 'cyberB', 'cyberC', 'cyberD', 'cyberE'];
    const applyCssTheme = (theme) => {
      if (!theme) return;
      const root = document.documentElement;
      root.style.setProperty('--bg', theme.background);
      root.style.setProperty('--panel', theme.surface);
      root.style.setProperty('--primary', theme.primary);
      root.style.setProperty('--win', theme.win);
      root.style.setProperty('--danger', theme.danger);
      root.style.setProperty('--text', theme.text);
      root.style.setProperty('--grid', theme.grid ?? theme.primary);
    };

    // floating text（提前创建，便于 onLevelChange 调整“飘字表现”）
    const floatingTextSystem = new FloatingTextSystem(game);
    // ensure floating text is top-most within game layer
    game.gameLayer.addChild(floatingTextSystem.container);

    const levelManager = new LevelManager(game, enemySystem, {
      initialDensity: 0.4 + Math.random() * 0.2,
      spawnOnSpinOnly: true, // 需求：每次 spin 刷怪（>=8）
      onLevelChange: ({ level }) => {
        const themeName = levelThemeOrder[(Math.max(1, level) - 1) % levelThemeOrder.length];
        themeManager.setTheme(themeName);
        game.setLevelVisual?.(level);
        jackpotSystem.setLevel?.(level);
        floatingTextSystem.setLevel?.(level);
        // UI 细节随关卡增强（仅 CSS 变量，简单但有效）
        const glow = Math.min(0.42, 0.18 + (level - 1) * 0.06);
        document.documentElement.style.setProperty('--uiGlow', `${glow}`);
      },
    });

    // bullets above enemies
    const bulletSystem = new BulletSystem(game, enemySystem, {
      damagePerHit: BASE_DAMAGE,
      floatingTextSystem,
    });

    // slot in front
    const slotSystem = new SlotSystem(game);
    slotSystem.scale.set(0.9);
    slotSystem.x = width / 2 - (slotSystem.totalWidth * slotSystem.scale.x) / 2;
    slotSystem.y = GRID_TOP + GRID_SIZE * CELL_SIZE + 20;
    game.gameLayer.addChild(slotSystem);

    // 中奖震动：仅抖僵尸区域 + Boss 区域
    // 需求：关掉“全局/中奖抖动”，只保留“击杀僵尸抖动”（见 EnemySystem.killZombie）
    slotSystem.onShake = null;

    // 初始化时同步一次 level（避免第一关用默认值）
    floatingTextSystem.setLevel?.((levelManager?.currentLevel ?? 0) + 1);

    // Debug handles（方便在控制台快速确认敌人是否生成/坐标是否正确）
    globalThis.__dslot = {
      game,
      gridSystem,
      enemySystem,
      levelManager,
      bulletSystem,
      slotSystem,
      jackpotSystem,
    };

    const themeSwitcher = document.getElementById('theme-switcher');
    const spinButton = document.getElementById('spin-btn');
    const betMinus = document.getElementById('bet-minus');
    const betPlus = document.getElementById('bet-plus');
    const betDisplay = document.getElementById('bet-display');
    const autoBtn = document.getElementById('auto-btn');
    if (!spinButton || !betMinus || !betPlus || !betDisplay || !autoBtn) {
      console.error('Control panel elements missing');
      return;
    }
    spinButton.textContent = 'SPIN';

    game.onGameOver = () => {
      // 不要 stop ticker（否则滚轮/子弹/Promise 会冻结，导致 stopSpin 只能靠超时兜底）
      setAutoActive(false);
      spinButton.disabled = true;
      spinButton.textContent = 'GAME OVER';
      levelManager.setPaused(true);
    };

    // 额外战况统计
    let bossBonusTotal = 0;
    let statsTimer = 0;

    const tickerHandler = (delta) => {
      // 防止页面卡顿/切后台导致 deltaMS 激增，从而“关卡瞬移/秒失败”
      const raw = game.app?.ticker?.deltaMS ?? delta * (1000 / 60);
      const deltaMS = Math.min(raw, 50);
      levelManager.setPaused(slotSystem.isSpinning);
      levelManager.update(deltaMS);
      jackpotSystem.update(deltaMS);
      // 右侧战况补充：僵尸数/累计/进度/boss奖励（节流刷新）
      statsTimer += deltaMS;
      if (statsTimer >= 200) {
        statsTimer = 0;
        const bossPct = typeof jackpotSystem.hpPercent === 'number' ? jackpotSystem.hpPercent : null;
        rtpManager.setExternalStats?.({
          zombieAlive: enemySystem.getAliveCount?.() ?? enemySystem.zombies.filter((z) => z && !z.destroyed).length,
          zombieSpawned: enemySystem.totalSpawned ?? 0,
          zombieKilled: enemySystem.totalKilled ?? 0,
          bossBonusTotal,
          bossName: jackpotSystem.bossName ?? 'BOSS',
          bossHPpct: typeof bossPct === 'number' ? bossPct : 100,
          bossHP: jackpotSystem.hp ?? 0,
          bossHPMax: jackpotSystem.maxHP ?? 0,
          level: levelManager.currentLevel + 1,
          levelKills: levelManager.kills ?? 0,
          levelTarget: levelManager.killsToAdvance ?? 100,
        });
      }
    };
    game.ticker.add(tickerHandler);

    let currentBet = 10;
    const minBet = 1;
    const maxBet = 500;
    let isAutoSpin = false;

    const updateBetDisplay = () => {
      betDisplay.value = currentBet.toFixed(0);
    };

    const setAutoActive = (active) => {
      isAutoSpin = active;
      autoBtn.classList.toggle('active', active);
    };

    updateBetDisplay();

    betMinus.addEventListener('click', () => {
      if (slotSystem.isSpinning) return;
      currentBet = Math.max(minBet, currentBet - 10);
      updateBetDisplay();
    });

    betPlus.addEventListener('click', () => {
      if (slotSystem.isSpinning) return;
      currentBet = Math.min(maxBet, currentBet + 10);
      updateBetDisplay();
    });

    autoBtn.addEventListener('click', () => {
      if (slotSystem.isSpinning) return;
      setAutoActive(!isAutoSpin);
      if (isAutoSpin) {
        triggerSpin();
      }
    });

    slotSystem.onWin = ({ totalWin, winLines }) => {
      console.log('Win lines:', winLines);
      if (totalWin > currentBet * 10) {
        // 大奖，自动停自动转
        setAutoActive(false);
      }
    };

    const triggerSpin = async () => {
      const SPIN_LOCK_KEY = '__D_SLOTGAME_SPIN_LOCK__';
      if (globalThis[SPIN_LOCK_KEY]) return;
      if (slotSystem.isSpinning) return;
      console.log('Spin Clicked');
      // 强锁：防止重复事件监听/连点导致一次点击触发多次 spin
      slotSystem.isSpinning = true;
      globalThis[SPIN_LOCK_KEY] = true;
      spinButton.disabled = true;
      spinButton.textContent = 'SPINNING...';

      try {
        // 下注记录
        if (typeof rtpManager.recordBet === 'function') {
          rtpManager.recordBet(currentBet);
        } else {
          rtpManager.startRound(currentBet);
        }

        slotSystem.startSpin();
        const level = (levelManager?.currentLevel ?? 0) + 1;
        // 关卡越高：派彩越低（RTP/赢分都下降）
        slotSystem.payoutScale = Math.max(0.35, 1 - (level - 1) * 0.06);
        const { reels } = resultBank.getResult(level);

        // 真实体验：以滚轮实际盘面计算的中奖为准（并按下注倍率结算）
        const { totalWin, winLines, fxDone } = await slotSystem.stopSpin(reels, currentBet);
        let winAmount = totalWin ?? 0;

        console.log('Win lines:', winLines);
        // Jackpot 现在是 BOSS：每次 spin 对 BOSS 造成伤害，击杀触发奖励
        const { bonus = 0, fxDone: bossFxDone } =
          typeof jackpotSystem.applySpin === 'function'
            ? jackpotSystem.applySpin(currentBet, winAmount)
            : { bonus: 0, fxDone: Promise.resolve() };
        if (bonus > 0) bossBonusTotal += bonus;
        winAmount += bonus;

        // 每次 spin 结束刷怪（>=8，血量随关卡提升）
        levelManager.onSpin?.();

        // 子弹：必须等“中奖金额展示完成”后，从中奖位置发射（不阻塞下一次 spin）
        Promise.all([fxDone ?? Promise.resolve(), bossFxDone ?? Promise.resolve()]).then(() => {
          // 重要：在真正发射时再计算 origin（避免震屏/动画导致看起来像随机出生）
          const globalOrigin =
            slotSystem.getPayoutOriginGlobal?.() ?? { x: game.app.screen.width / 2, y: game.app.screen.height * 0.8 };
          const localOrigin = bulletSystem.container?.toLocal
            ? bulletSystem.container.toLocal(globalOrigin)
            : globalOrigin;
          if (winAmount > 0) {
            fireBulletsFrom(enemySystem, bulletSystem, localOrigin, winAmount, currentBet, BASE_DAMAGE, winLines);
          }
        });

        rtpManager.finishRound(winAmount);
      } catch (e) {
        console.error('Spin Error:', e);
      } finally {
        spinButton.disabled = false;
        spinButton.textContent = 'SPIN';
        slotSystem.isSpinning = false;
        globalThis[SPIN_LOCK_KEY] = false;
        if (isAutoSpin) {
          setTimeout(() => {
            if (isAutoSpin) triggerSpin();
          }, 260);
        }
      }
    };

    spinButton.addEventListener('click', () => {
      setAutoActive(false);
      triggerSpin();
    });

    // Theme switcher buttons
    if (themeSwitcher) {
      const themes = Object.entries(UIThemes);
      themeSwitcher.innerHTML = '';
      themes.forEach(([key, cfg]) => {
        const btn = document.createElement('button');
        btn.className = 'theme-dot';
        btn.style.background = cfg.primary;
        btn.title = cfg.name;
        btn.addEventListener('click', () => {
          document.querySelectorAll('.theme-dot').forEach((n) => n.classList.remove('active'));
          btn.classList.add('active');
          themeManager.setTheme(key);
        });
        themeSwitcher.appendChild(btn);
        if (key === themeManager.currentTheme) btn.classList.add('active');
      });

      themeManager.subscribe((theme) => {
        document.querySelectorAll('.theme-dot').forEach((n) => {
          n.classList.toggle('active', n.style.background.toLowerCase() === theme.primary.toLowerCase());
        });
      });
    }

    // Theme propagation
    themeManager.subscribe((theme) => {
      applyCssTheme(theme);
      gridSystem.updateTheme?.(theme);
      slotSystem.updateTheme?.(theme);
      enemySystem.updateTheme?.(theme);
      floatingTextSystem.updateTheme?.(theme);
      rtpManager.updateTheme?.(theme);
      game.updateTheme?.(theme);
    });

    // 初始化默认主题
    themeManager.setTheme(themeManager.currentTheme);

    // 关卡晋级逻辑已在 LevelManager options.onLevelChange 里处理，避免重复覆盖造成叠加
  } catch (err) {
    console.error('Failed to init game', err);
  }
})();
}
