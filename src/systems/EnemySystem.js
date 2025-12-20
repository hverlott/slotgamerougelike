import { Container, Graphics, ColorMatrixFilter, Sprite } from 'pixi.js';
import gsap from 'gsap';
import { themeManager } from './ThemeManager.js';

const colorInt = (hex) => parseInt(hex.replace('#', '0x'), 16);
const TYPES = () => ({
  walker: { emoji: '🧟', color: colorInt(themeManager.getColor('primary')), hp: 6, speed: 1, scale: 1 },
  runner: { emoji: '🐕', color: colorInt(themeManager.getColor('secondary')), hp: 3, speed: 2, scale: 0.75 },
  tank: { emoji: '👹', color: 0xac5bff, hp: 18, speed: 0.6, scale: 1.35 },
  spitter: { emoji: '🧪', color: 0x00ff88, hp: 5, speed: 1, scale: 0.9 },
  brute: { emoji: '🦾', color: 0xffb020, hp: 12, speed: 0.8, scale: 1.15 },
  glitch: { emoji: '🤖', color: 0x00f0ff, hp: 9, speed: 1.2, scale: 1.05 },
  bomber: { emoji: '💣', color: 0xff4444, hp: 4, speed: 1, scale: 0.9 },
  shield: { emoji: '🛡️', color: 0x4df3ff, hp: 14, speed: 0.9, scale: 1.15 },
  phantom: { emoji: '👻', color: 0xb388ff, hp: 7, speed: 1.1, scale: 1.0 },
  flyer: { emoji: '🦇', color: 0xff66cc, hp: 5, speed: 1.4, scale: 0.95 },
});

export class EnemySystem {
  constructor(app, options = {}) {
    this.app = app;
    this.container = new Container();
    this.zombies = [];
    this._t = 0;
    this.totalSpawned = 0;
    this.totalKilled = 0;
    // 数值放大：让飘字/血量更"爽"（默认 *100）
    this.combatScale = options.combatScale ?? 100;
    // 前进动画时长（越大越慢）
    this.moveTweenDuration = options.moveTweenDuration ?? 1.0;

    this.gridSize = options.gridSize ?? 10;
    this.cellSize = options.cellSize ?? 60;
    this.gridTop = options.gridTop ?? 100;

    // 伤害回调（用于 ComboSystem 追踪）
    this.onDamageDealt = options.onDamageDealt ?? null;

    this.app.gameLayer.addChild(this.container);

    // 统一呼吸动画：避免给 40-60 只敌人各自挂一个 GSAP tween（会卡）
    this.update = this.update.bind(this);
    this.app.ticker.add(this.update);
  }

  get startX() {
    return 0;
  }

  // 兼容你的“Step3”命名：把僵尸可视化独立成方法
  createZombieVisual(type = 'walker') {
    const cfg = TYPES()[type] ?? TYPES().walker;
    const container = new Container();

    // 1) Sprite 占位图
    const sprite = Sprite.from('z_walker');
    sprite.anchor?.set?.(0.5);
    sprite.width = 50;
    sprite.height = 50;

    // 2) Tint 分类型（未列出的类型，退回到 cfg.color 以保持区分度）
    const fixedTint =
      type === 'walker'
        ? 0xffffff
        : type === 'runner'
          ? 0xff8888
          : type === 'tank'
            ? 0x88ff88
            : type === 'boss'
              ? 0xffd700
              : null;
    sprite.tint = fixedTint ?? cfg.color ?? 0xffffff;

    container.addChild(sprite);
    container.bodyShape = sprite;

    container.meta = { ...cfg, type, color: sprite.tint };

    // 统一呼吸动画参数放在 bodyShape 上（避免缩放 container 影响血条/定位）
    // 注意：width/height 会通过 scale 来达成；这里记录 x/y 两个基准，避免呼吸动画把尺寸打回原始纹理大小
    sprite.baseScaleX = sprite.scale?.x ?? 1;
    sprite.baseScaleY = sprite.scale?.y ?? 1;
    sprite.breathPhase = Math.random() * Math.PI * 2;

    // 血条（保留）
    const hpBar = new Graphics();
    hpBar.y = -(this.cellSize * 0.5 + 6);
    container.hpBar = hpBar;
    container.addChild(hpBar);

    return container;
  }

  update(deltaOrTicker) {
    // Pixi v8 ticker callback 可能传入 ticker 对象而非纯数字 delta
    const delta =
      typeof deltaOrTicker === 'number'
        ? deltaOrTicker
        : (deltaOrTicker?.deltaTime ?? 1);
    this._t += delta;
    const alive = this.zombies.filter((z) => z && !z.destroyed);
    // 统一轻呼吸，避免视觉静止
    alive.forEach((z) => {
      const body = z.bodyShape ?? z;
      const baseX = body.baseScaleX ?? body.baseScale ?? 1;
      const baseY = body.baseScaleY ?? body.baseScale ?? 1;
      const phase = body.breathPhase ?? 0;
      const s = 1 + 0.045 * Math.sin(this._t * 0.08 + phase);
      body.scale?.set?.(baseX * s, baseY * s);
    });
  }

  spawnZombie(col, row, typeKey = 'walker') {
    // 兼容旧调用：spawnZombie(c,r,type) 或 spawnZombie(c,r,type,level)
    let level = 1;
    if (typeof arguments[3] === 'number') level = arguments[3];
    const enemy = this.createZombieVisual(typeKey);
    // “挤一挤”：同格多只通过轻微抖动区分
    const jitter = this.cellSize * 0.18;
    const jx = (Math.random() - 0.5) * jitter * 2;
    const jy = (Math.random() - 0.5) * jitter * 2;
    enemy.x = this.startX + col * this.cellSize + this.cellSize / 2 + jx;
    enemy.y = this.gridTop + row * this.cellSize + this.cellSize / 2 + jy;
    enemy.col = col;
    enemy.row = row;
    // 血量放大 + 随关卡加厚
    const baseHp = Number(enemy.meta?.hp ?? 1);
    const levelScale = Math.min(4, 1 + (Math.max(1, level) - 1) * 0.18);
    enemy.maxHp = Math.max(1, Math.round(baseHp * this.combatScale * levelScale));
    enemy.hp = enemy.maxHp;
    enemy.takeDamage = (amount = 1) => this.takeDamage(enemy, amount);
    this.updateHpBar(enemy);

    this.container.addChild(enemy);
    this.zombies.push(enemy);
    this.totalSpawned += 1;
    return enemy;
  }

  moveAllZombies() {
    let reachedBottom = false;
    const alive = this.zombies.filter((z) => z && !z.destroyed);

    alive.forEach((zombie) => {
      // 体验优先：避免一次跨多行导致秒失败；速度差异用动画/血量体现
      const step = 1;
      zombie.row = (zombie.row ?? 0) + step;
      const newY = this.gridTop + zombie.row * this.cellSize + this.cellSize / 2;

      if (zombie.row >= this.gridSize) {
        reachedBottom = true;
      }

      gsap.to(zombie, {
        y: newY,
        duration: this.moveTweenDuration,
        ease: 'back.out(1.2)',
        overwrite: true,
      });
    });

    return reachedBottom;
  }

  takeDamage(zombie, amount = 1) {
    if (!zombie || zombie.destroyed) return;
    zombie.hp = Math.max(0, (zombie.hp ?? 1) - amount);

    // 通知伤害回调（用于 ComboSystem）
    if (this.onDamageDealt && amount > 0) {
      this.onDamageDealt(amount);
    }

    // ⚡ 强力受击反馈：Tint 闪白/红
    const originalTint = zombie.meta?.color ?? 0xffffff;
    const body = zombie.bodyShape ?? zombie;
    
    // 性能优化：不再创建 ColorMatrixFilter，直接用 Tint 闪白
    if (body) {
      // 0xFFFFFF (纯白) 在默认 shader 下可能只是原色
      // 如果 body 是 Sprite，tint 会与纹理相乘。
      // 要实现“闪白”，通常需要 shader 或者 additive blend。
      // 这里使用简单的 tint 变红反馈，性能最高
      body.tint = 0xff0000; 
      
      // 0.08秒后恢复
      gsap.delayedCall(0.08, () => {
        if (!zombie || zombie.destroyed) return;
        body.tint = originalTint;
      });
    }

    // 💥 物理反馈：强力抖动
    const scaleX = body.scale?.x ?? 1;
    const scaleY = body.scale?.y ?? 1;
    
    // 避免重复创建 tween
    gsap.killTweensOf(body.scale);
    gsap.fromTo(
      body.scale,
      { x: scaleX * 0.8, y: scaleY * 1.2 }, // 被打扁
      { x: scaleX, y: scaleY, duration: 0.25, ease: 'elastic.out(1, 0.3)' }
    );

    this.updateHpBar(zombie);

    if (zombie.hp <= 0) {
      this.killZombie(zombie);
    }
  }

  killZombie(zombie) {
    if (!zombie || zombie.destroyed) return;
    // 需求：只有消灭僵尸才抖动（局部抖动敌人区域，不做全局震屏）
    this.app.shakeTargets?.([this.container], 4);
    gsap.killTweensOf(zombie);
    gsap.killTweensOf(zombie.scale);
    gsap.to(zombie, {
      alpha: 0,
      scale: 0.1,
      duration: 0.25,
      ease: 'power1.in',
      onComplete: () => {
        zombie.destroy({ children: true });
        this.zombies = this.zombies.filter((z) => z !== zombie);
        this.totalKilled += 1;
        this.onKilled?.(zombie);
      },
    });
  }

  getAliveCount() {
    return this.zombies.filter((z) => z && !z.destroyed).length;
  }

  // 🎯 目标选择逻辑：优先攻击最前方的僵尸 (FIFO)
  pickTarget() {
    const alive = this.zombies.filter((z) => z && !z.destroyed);
    if (alive.length === 0) return null;

    // 排序优先级：
    // 1. Row (行号大者优先，即最下方)
    // 2. Y 坐标 (Y 大者优先)
    // 3. Col (列号小者优先，从左到右)
    alive.sort((a, b) => {
      if (Math.abs(b.row - a.row) > 0.1) return b.row - a.row; // 行优先
      if (Math.abs(b.y - a.y) > 10) return b.y - a.y; // Y坐标优先
      return a.col - b.col; // 同行同高度，从左到右
    });

    return alive[0];
  }

  updateHpBar(enemy) {
    if (!enemy?.hpBar) return;
    const max = Number(enemy.maxHp ?? enemy.meta?.hp ?? 1) || 1;
    const ratio = Math.max(0, Math.min(1, (enemy.hp ?? 0) / max));
    enemy.hpBar.clear();
    enemy.hpBar.rect(-20, 0, 40, 4);
    enemy.hpBar.stroke({ width: 1, color: 0x000000, alpha: 0.6 });
    enemy.hpBar.fill({ color: enemy.meta?.color ?? 0x00ff88, alpha: 0.8 });
    enemy.hpBar.scale.x = ratio;
  }

  updateTheme(theme) {
    // Step3：主视觉由 tint 控制；主题变化时只需要刷新血条颜色即可
    this.zombies.forEach((z) => {
      const type = z.meta?.type ?? 'walker';
      const cfg = TYPES()[type] ?? TYPES().walker;
      const body = z.bodyShape ?? z;
      const fixedTint =
        type === 'walker'
          ? 0xffffff
          : type === 'runner'
            ? 0xff8888
            : type === 'tank'
              ? 0x88ff88
              : type === 'boss'
                ? 0xffd700
                : null;
      const tint = fixedTint ?? cfg.color ?? 0xffffff;
      if (body && 'tint' in body) body.tint = tint;
      z.meta = { ...(z.meta ?? {}), ...cfg, type, color: tint };
      this.updateHpBar(z);
    });
  }
}
