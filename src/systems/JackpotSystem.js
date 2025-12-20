import { Container, Graphics, Text } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { themeManager } from './ThemeManager.js';

const colorInt = (hex) => parseInt(hex.replace('#', '0x'), 16);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Jackpot 重构为“右侧超级大BOSS”：
// - HP 从 100% 下降到 0%
// - 每次 spin 造成伤害（与 bet 有缓释系数，避免高 bet 秒清空）
// - HP=0 触发爆炸与奖励
export class JackpotSystem extends Container {
  constructor(game, options = {}) {
    super();
    this.game = game;

    this.level = 1;
    this.maxHP = 220;
    this.hp = this.maxHP;
    this.displayHP = this.hp;
    this._hpTween = null;
    this.bossName = 'BOSS';

    this.targetX = options.x ?? this.game.app.screen.width - 110;
    this.targetY = options.y ?? this.game.app.screen.height * 0.35;
    this.scale.set(options.scale ?? 1);
    this.position.set(this.targetX, this.targetY);

    this._fxDone = Promise.resolve();
    this._fxResolve = null;

    this.buildBoss();
    themeManager.subscribe((theme) => this.updateTheme(theme));
    this.updateHPUI();
    this.applyIdle();
  }

  buildBoss() {
    this.bossLayer = new Container();
    this.addChild(this.bossLayer);

    // 伪3D底座（让Boss更“重量感”）
    this.basePlate = new Graphics();
    this.basePlate.y = 118;
    this.bossLayer.addChild(this.basePlate);

    // 背后能量圈
    this.aura = new Graphics();
    this.bossLayer.addChild(this.aura);

    // BOSS 本体
    this.bossEmoji = new Text({
      text: '👹',
      style: {
        fontSize: 132, // 更大的体型（中置Boss更显眼）
        fontWeight: '900',
        fill: '#ffffff',
      },
    });
    this.bossEmoji.anchor?.set?.(0.5);
    this.bossEmoji.y = -10;
    this.bossLayer.addChild(this.bossEmoji);

    // 标题
    this.title = new Text({
      text: 'JACKPOT BOSS',
      style: {
        fontSize: 16,
        fontWeight: '900',
        fill: '#ffffff',
        letterSpacing: 1,
      },
    });
    this.title.anchor?.set?.(0.5);
    this.title.y = -112;
    this.bossLayer.addChild(this.title);

    // HP 条
    this.hpBarBack = new Graphics();
    this.hpBarFill = new Graphics();
    this.hpText = new Text({
      text: 'HP 100%',
      style: {
        fontSize: 13,
        fontWeight: '800',
        fill: '#ffffff',
        stroke: { width: 4, color: '#000000' }, // ✅ PixiJS v8 语法修复
      },
    });
    this.hpText.anchor?.set?.(0.5);
    this.hpText.y = 88;
    this.hpBarBack.y = 64;
    this.hpBarFill.y = 64;
    this.bossLayer.addChild(this.hpBarBack, this.hpBarFill, this.hpText);

    // 命中粒子层
    this.fxLayer = new Container();
    this.addChild(this.fxLayer);
  }

  updateTheme(theme) {
    if (!theme) return;
    const primary = colorInt(theme.primary);
    const win = colorInt(theme.win);
    const danger = colorInt(theme.danger);

    // 底座
    if (this.basePlate) {
      this.basePlate.clear();
      this.basePlate.ellipse(0, 0, 110, 22);
      this.basePlate.fill({ color: 0x000000, alpha: 0.35 });
      this.basePlate.ellipse(0, -3, 96, 16);
      this.basePlate.stroke({ width: 2, color: primary, alpha: 0.18 });
      this.basePlate.ellipse(0, -3, 96, 16);
      this.basePlate.stroke({ width: 1, color: 0xffffff, alpha: 0.06 });
    }

    // 光晕 + 线框
    this.aura.clear();
    this.aura.circle(0, 0, 74);
    this.aura.stroke({ width: 2, color: primary, alpha: 0.35 });
    this.aura.circle(0, 0, 92);
    this.aura.stroke({ width: 1, color: win, alpha: 0.25 });

    // 🚀 性能优化：移除 Boss 常驻 GlowFilter
    // this.bossLayer.filters = [ ... ];
    this.bossLayer.filters = null;
    // 使用 blendMode 模拟发光
    this.aura.blendMode = 'add';

    this.title.style.fill = theme.text;
    this._hpColor = win;
    this._dangerColor = danger;

    this.updateHPUI();
  }

  setLevel(level = 1) {
    // 需求：每个关卡一个 Boss（形象可变），血量更厚
    this.level = Math.max(1, level);
    const variants = [
      { name: '街区暴君', emoji: '👹' },
      { name: '机械巨像', emoji: '🤖' },
      { name: '幽灵领主', emoji: '👻' },
      { name: '生化犬王', emoji: '🐕' },
      { name: '钢铁狂徒', emoji: '🦾' },
      { name: '爆破核心', emoji: '💣' },
      { name: '暗影蝠王', emoji: '🦇' },
      { name: '护盾执政', emoji: '🛡️' },
    ];
    const v = variants[(this.level - 1) % variants.length];
    this.bossName = `Lv${this.level} ${v.name}`;
    if (this.title) this.title.text = this.bossName;
    if (this.bossEmoji) this.bossEmoji.text = v.emoji;

    // 血量厚度随关卡递增（不会无限爆炸，带上限）
    const base = 260;
    const per = 110;
    this.maxHP = clamp(base + (this.level - 1) * per, 260, 1600);
    this.hp = this.maxHP;
    this.displayHP = this.hp;
    this.updateHPUI();
  }

  get hpPercent() {
    return clamp((this.displayHP / this.maxHP) * 100, 0, 100);
  }

  applyIdle() {
    gsap.to(this.bossLayer.scale, {
      x: 1.03,
      y: 1.03,
      duration: 1.2,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
    gsap.to(this.aura, { rotation: Math.PI * 2, duration: 14, repeat: -1, ease: 'none' });
  }

  calcDamage(bet = 10, winAmount = 0) {
    // 缓释：sqrt(bet) + 小基准，避免 bet 大时血条秒空
    const base = 1.9 + Math.sqrt(Math.max(1, bet)) * 0.16;
    const winBoost = winAmount > 0 ? 0.6 : 0;
    return clamp(base + winBoost, 0.9, 5.5);
  }

  calcBonus(bet = 10) {
    // 奖励：与 bet 挂钩，但做缓释，避免大 bet 奖励失控
    const base = 60 + bet * 4;
    return Math.round(base);
  }

  updateHPUI() {
    const pct = clamp((this.displayHP / this.maxHP) * 100, 0, 100);
    // 更厚的血条（符合“大Boss”）
    const w = 220;
    const h = 14;
    const left = -w / 2;
    const top = 0;

    this.hpBarBack.clear();
    this.hpBarBack.roundRect(left, top, w, h, 8);
    this.hpBarBack.fill({ color: 0x000000, alpha: 0.55 });
    this.hpBarBack.stroke({ width: 2, color: 0xffffff, alpha: 0.18 });

    this.hpBarFill.clear();
    this.hpBarFill.roundRect(left + 2, top + 2, (w - 4) * (pct / 100), h - 4, 7);
    const fillColor = pct < 25 ? (this._dangerColor ?? 0xff3366) : (this._hpColor ?? 0xffe600);
    this.hpBarFill.fill({ color: fillColor, alpha: 0.9 });

    if (this.hpText) this.hpText.text = `HP ${pct.toFixed(0)}%`;
  }

  update(deltaMS = 0) {
    // 目前 idle 由 GSAP 负责，这里预留接口
  }

  applySpin(bet, winAmount) {
    // 每次 spin 对 BOSS 造成“血量消耗”
    const dmg = this.calcDamage(bet, winAmount);
    this.hp = clamp(this.hp - dmg, 0, this.maxHP);

    // 掉血表现：缓动扣血 + HP条闪红/放大 + 伤害跳字
    this._hpTween?.kill?.();
    this._hpTween = gsap.to(this, {
      displayHP: this.hp,
      duration: 0.28,
      ease: 'power2.out',
      onUpdate: () => this.updateHPUI(),
      onComplete: () => (this._hpTween = null),
    });

    // HP条冲击感
    gsap.fromTo(this.hpBarFill.scale, { x: 1, y: 1 }, { x: 1.12, y: 1.35, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' });
    gsap.fromTo(this.hpBarFill, { alpha: 1 }, { alpha: 0.35, duration: 0.08, yoyo: true, repeat: 3, ease: 'steps(1)' });
    if (this._dangerColor) this.hpBarFill.tint = this._dangerColor;
    gsap.delayedCall(0.3, () => { this.hpBarFill.tint = 0xffffff; });

    const dmgText = new Text({
      text: `-${dmg.toFixed(1)}`,
      style: {
        fontSize: 16,
        fontWeight: '900',
        fill: themeManager.getColor('danger') ?? '#FF003C',
        stroke: { width: 4, color: '#000000' },
      },
    });
    dmgText.anchor?.set?.(0.5);
    dmgText.x = 0;
    dmgText.y = 40;
    this.fxLayer.addChild(dmgText);
    gsap.fromTo(dmgText, { alpha: 0, y: 46 }, { alpha: 1, y: 36, duration: 0.18, ease: 'power2.out' });
    gsap.to(dmgText, { alpha: 0, y: 18, duration: 0.45, delay: 0.2, ease: 'power2.in', onComplete: () => dmgText.destroy({ children: true }) });

    // 受击反馈
    gsap.fromTo(this.bossLayer, { x: 0 }, { x: (Math.random() - 0.5) * 10, duration: 0.08, yoyo: true, repeat: 1 });
    gsap.fromTo(this.bossEmoji, { rotation: -0.08 }, { rotation: 0.08, duration: 0.08, yoyo: true, repeat: 1 });

    // 小粒子（吸到 BOSS）
    this.spawnHitParticles(6);

    if (this.hp > 0) {
      return { bonus: 0, fxDone: Promise.resolve() };
    }

    const bonus = this.calcBonus(bet);
    const fxDone = this.triggerDeath(bonus);
    return { bonus, fxDone };
  }

  spawnHitParticles(count = 6) {
    const theme = themeManager.getColor('primary') || '#00F0FF';
    const c = colorInt(theme);
    for (let i = 0; i < count; i += 1) {
      const p = new Graphics();
      p.circle(0, 0, 2 + Math.random() * 2);
      p.fill({ color: c, alpha: 0.9 });
      p.x = (Math.random() - 0.5) * 140;
      p.y = 120 + (Math.random() - 0.5) * 40;
      this.fxLayer.addChild(p);
      gsap.to(p, {
        x: 0,
        y: 0,
        alpha: 0,
        duration: 0.5 + Math.random() * 0.2,
        ease: 'power2.in',
        onComplete: () => p.destroy({ children: true }),
      });
    }
  }

  triggerDeath(bonus) {
    if (this._fxResolve) this._fxResolve();
    this._fxDone = new Promise((resolve) => (this._fxResolve = resolve));

    // 爆炸：不做全局震屏（需求：仅击杀僵尸时抖动）

    const boom = new Text({
      text: `JACKPOT +${bonus}`,
      style: {
        fontSize: 22,
        fontWeight: '900',
        fill: themeManager.getColor('win') ?? '#FFE600',
        stroke: { width: 4, color: '#000000' },
        align: 'center',
      },
    });
    boom.anchor?.set?.(0.5);
    boom.x = 0;
    boom.y = -120;
    this.addChild(boom);

    gsap.fromTo(boom.scale, { x: 0.2, y: 0.2 }, { x: 1.2, y: 1.2, duration: 0.45, ease: 'back.out(2)' });
    gsap.to(boom, { alpha: 0, y: boom.y - 40, duration: 1.1, delay: 0.7, ease: 'power2.out', onComplete: () => boom.destroy({ children: true }) });

    // 粒子爆散
    const particleCount = 40;
    const palette = [
      colorInt(themeManager.getColor('primary') ?? '#00F0FF'),
      colorInt(themeManager.getColor('win') ?? '#FFE600'),
      colorInt(themeManager.getColor('danger') ?? '#FF003C'),
    ];
    for (let i = 0; i < particleCount; i += 1) {
      const p = new Graphics();
      p.circle(0, 0, 3 + Math.random() * 3);
      p.fill({ color: palette[Math.floor(Math.random() * palette.length)], alpha: 1 });
      p.x = 0;
      p.y = 0;
      this.fxLayer.addChild(p);

      const a = Math.random() * Math.PI * 2;
      const sp = 8 + Math.random() * 16;
      let vx = Math.cos(a) * sp;
      let vy = Math.sin(a) * sp;
      const gravity = 0.7;
      const friction = 0.92;

      gsap.to(p, {
        duration: 1.2,
        ease: 'none',
        onUpdate: () => {
          vx *= friction;
          vy = vy * friction + gravity;
          p.x += vx;
          p.y += vy;
          p.alpha -= 0.012;
        },
        onComplete: () => p.destroy({ children: true }),
      });
    }

    // 重置新 BOSS（稍微延迟，给爆炸留空间）
    gsap.delayedCall(1.0, () => {
      this.hp = this.maxHP;
      this.updateHPUI();
      this._fxResolve?.();
      this._fxResolve = null;
      this._fxDone = Promise.resolve();
    });

    return this._fxDone;
  }
}

