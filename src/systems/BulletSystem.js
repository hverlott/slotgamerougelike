import { Container, Graphics } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { themeManager } from './ThemeManager.js';

const colorInt = (hex) => parseInt(hex.replace('#', '0x'), 16);
const PRIMARY = () => colorInt(themeManager.getColor('primary'));
const ENERGY = () => colorInt(themeManager.getColor('win'));
const LASER = () => colorInt(themeManager.getColor('grid') || '#ac5bff');

export class BulletSystem {
  constructor(app, enemySystem, options = {}) {
    this.app = app;
    this.enemySystem = enemySystem;
    this.container = new Container();
    this.bullets = [];
    this.speed = 26;
    this.damagePerHit = options.damagePerHit ?? 10;
    this.onHit = options.onHit ?? null;
    this.floatingTextSystem = options.floatingTextSystem ?? null;

    this.app.gameLayer.addChild(this.container);
    this.update = this.update.bind(this);
    this.app.ticker.add(this.update);
  }

  setOnHit(fn) {
    this.onHit = fn;
  }

  createType1() {
    const holder = new Container();
    const body = new Graphics();
    body.roundRect(-30, -3, 60, 6, 3);
    body.fill({ color: PRIMARY(), alpha: 1 });
    const glow = new GlowFilter({
      distance: 8,
      outerStrength: 1.5,
      color: PRIMARY(),
      quality: 0.2,
    });
    holder.filters = [glow];
    holder.addChild(body);
    return holder;
  }

  createType2() {
    const holder = new Container();
    const orb = new Graphics();
    orb.circle(0, 0, 10);
    orb.fill({ color: ENERGY(), alpha: 1 });
    const trail = new Graphics();
    trail.circle(-18, 0, 6);
    trail.fill({ color: ENERGY(), alpha: 0.5 });
    const glow = new GlowFilter({
      distance: 10,
      outerStrength: 2,
      color: ENERGY(),
      quality: 0.2,
    });
    holder.filters = [glow];
    holder.addChild(trail, orb);
    return holder;
  }

  createType4() {
    // 爆炸弹（火箭/榴弹）
    const holder = new Container();
    const body = new Graphics();
    body.roundRect(-10, -4, 22, 8, 4);
    body.fill({ color: ENERGY(), alpha: 1 });
    // 头部
    body.poly([12, 0, 20, 4, 20, -4]);
    body.fill({ color: 0xffffff, alpha: 0.8 });
    // 尾焰
    const flame = new Graphics();
    flame.circle(-16, 0, 5);
    flame.fill({ color: 0xff6633, alpha: 0.7 });
    const glow = new GlowFilter({
      distance: 12,
      outerStrength: 2.6,
      color: ENERGY(),
      quality: 0.12,
    });
    holder.filters = [glow];
    holder.addChild(flame, body);
    // 尾焰闪烁
    gsap.to(flame, { alpha: 0.2, duration: 0.08, yoyo: true, repeat: -1, ease: 'steps(1)' });
    return holder;
  }

  shootLaser(startX, startY, target) {
    const line = new Graphics();
    const endX = this.app.app.screen.width;
    const targetGlobal =
      target && typeof target.getGlobalPosition === 'function'
        ? target.getGlobalPosition()
        : null;
    const targetLocal = targetGlobal ? this.container.toLocal(targetGlobal) : null;
    const endY = targetLocal?.y ?? startY;
    line.moveTo(startX, startY);
    line.lineTo(endX, endY);
    line.stroke({ width: 6, color: LASER(), alpha: 0.9 });
    line.filters = [
      new GlowFilter({ distance: 14, outerStrength: 3, color: LASER(), quality: 0.2 }),
    ];
    this.container.addChild(line);

    // 伤害所有在射线附近的敌人
    const enemies = this.enemySystem.zombies.filter((z) => !z.destroyed);
    enemies.forEach((z) => {
      const gpos = z.getGlobalPosition ? z.getGlobalPosition() : null;
      const pos = gpos ? this.container.toLocal(gpos) : z;
      const dist = Math.abs(pos.y - startY);
      if (dist < 40) {
        const dmg = this.damagePerHit * 2;
        z.takeDamage?.(dmg);
        this.floatingTextSystem?.showText(pos.x, pos.y, dmg, true);
        this.onHit?.(dmg, { isCrit: true, target: z, pos });
      }
    });

    gsap.to(line, {
      alpha: 0,
      duration: 0.15,
      onComplete: () => line.destroy({ children: true }),
    });
  }

  shoot(startX, startY, target, bulletType = 1) {
    if (bulletType === 3) {
      this.shootLaser(startX, startY, target);
      return;
    }
    if (!target || target.destroyed) return;
    const sprite =
      bulletType === 4 ? this.createType4() : bulletType === 2 ? this.createType2() : this.createType1();
    sprite.x = startX;
    sprite.y = startY;

    const targetGlobal =
      typeof target.getGlobalPosition === 'function' ? target.getGlobalPosition() : null;
    const targetPos = targetGlobal ? this.container.toLocal(targetGlobal) : target;
    const dx = targetPos.x - startX;
    const dy = targetPos.y - startY;
    const angle = Math.atan2(dy, dx);
    sprite.rotation = angle;

    const speed =
      bulletType === 4 ? this.speed * 0.85 : bulletType === 2 ? this.speed * 0.7 : this.speed * 1.1;
    const trail = bulletType === 2 || bulletType === 4;
    if (trail) {
      gsap.to(sprite.scale, { x: 1.1, y: 1.1, duration: 0.2, yoyo: true, repeat: -1 });
    }

    this.container.addChild(sprite);
    this.bullets.push({ sprite, target, speed, type: bulletType });
  }

  update() {
    if (!this.bullets.length) return;

    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const b = this.bullets[i];
      const { sprite, target, speed, type } = b;

      if (!target || target.destroyed) {
        this.destroyBullet(i);
        continue;
      }

      const targetGlobal =
        typeof target.getGlobalPosition === 'function' ? target.getGlobalPosition() : null;
      const targetPos = targetGlobal ? this.container.toLocal(targetGlobal) : target;

      const dx = targetPos.x - sprite.x;
      const dy = targetPos.y - sprite.y;
      const dist = Math.hypot(dx, dy) || 1;
      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;

      sprite.x += vx;
      sprite.y += vy;

      if (dist < 20) {
        const isCrit = type === 3 || Math.random() < 0.1;
        const baseDmg = this.damagePerHit * (type === 2 ? 1.5 : type === 4 ? 2.2 : 1);
        const damage = (isCrit ? 2 : 1) * baseDmg;
        target.takeDamage?.(damage);
        this.floatingTextSystem?.showText(targetPos.x, targetPos.y, damage, isCrit);
        this.onHit?.(damage, { isCrit, target, pos: targetPos });

        // 命中“斩击/星芒”特效（参考效果图的黄光刀痕）
        this.spawnSlashHit(targetPos.x, targetPos.y, {
          strong: type === 4 || isCrit,
          color: type === 4 ? ENERGY() : 0xfff07a,
        });

        if (type === 2) {
          // 小范围 AOE
          const enemies = this.enemySystem.zombies.filter((z) => !z.destroyed);
          enemies.forEach((z) => {
            const gpos = z.getGlobalPosition ? z.getGlobalPosition() : null;
            const pos = gpos ? this.container.toLocal(gpos) : z;
            if (Math.hypot(pos.x - targetPos.x, pos.y - targetPos.y) < 60) {
              if (z !== target) {
                z.takeDamage?.(damage * 0.5);
              }
            }
          });
        }
        if (type === 4) {
          // 大范围爆炸 + 视觉
          this.spawnExplosion(targetPos.x, targetPos.y);
          const enemies = this.enemySystem.zombies.filter((z) => !z.destroyed);
          enemies.forEach((z) => {
            const gpos = z.getGlobalPosition ? z.getGlobalPosition() : null;
            const pos = gpos ? this.container.toLocal(gpos) : z;
            const d = Math.hypot(pos.x - targetPos.x, pos.y - targetPos.y);
            if (d < 110) {
              if (z !== target) {
                z.takeDamage?.(damage * (d < 60 ? 0.85 : 0.45));
              }
            }
          });
        }

        this.destroyBullet(i);
        continue;
      }

      const { width, height } = this.app.app.screen;
      if (
        sprite.x < -100 ||
        sprite.x > width + 100 ||
        sprite.y < -100 ||
        sprite.y > height + 100
      ) {
        this.destroyBullet(i);
      }
    }
  }

  destroyBullet(index) {
    const b = this.bullets[index];
    if (!b) return;
    gsap.killTweensOf(b.sprite);
    b.sprite.destroy({ children: true });
    this.bullets.splice(index, 1);
  }

  spawnExplosion(x, y) {
    const ring = new Graphics();
    ring.circle(0, 0, 14);
    ring.stroke({ width: 4, color: ENERGY(), alpha: 0.9 });
    ring.x = x;
    ring.y = y;
    this.container.addChild(ring);
    gsap.to(ring, {
      alpha: 0,
      duration: 0.35,
      onUpdate: () => {
        ring.scale.x += 0.18;
        ring.scale.y += 0.18;
      },
      onComplete: () => ring.destroy({ children: true }),
    });

    const count = 22;
    for (let i = 0; i < count; i += 1) {
      const p = new Graphics();
      p.circle(0, 0, 2 + Math.random() * 2);
      p.fill({ color: [ENERGY(), PRIMARY(), 0xff00ff][Math.floor(Math.random() * 3)], alpha: 1 });
      p.x = x;
      p.y = y;
      this.container.addChild(p);
      const ang = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 70;
      gsap.to(p, {
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        duration: 0.55 + Math.random() * 0.25,
        ease: 'power2.out',
        onComplete: () => p.destroy({ children: true }),
      });
    }
  }

  spawnSlashHit(x, y, { strong = false, color = 0xfff07a } = {}) {
    // 尽量轻量：不做对象池，但数量很少，且只在命中触发
    const g = new Graphics();
    g.x = x;
    g.y = y;
    this.container.addChild(g);

    const count = strong ? 9 : 6;
    const lenBase = strong ? 56 : 40;
    for (let i = 0; i < count; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const len = lenBase + Math.random() * (strong ? 32 : 22);
      const w = strong ? 4 : 3;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
      g.stroke({ width: w, color, alpha: 0.95, cap: 'round' });
      // 白色核心
      g.moveTo(0, 0);
      g.lineTo(Math.cos(ang) * (len * 0.7), Math.sin(ang) * (len * 0.7));
      g.stroke({ width: Math.max(1, w - 2), color: 0xffffff, alpha: 0.9, cap: 'round' });
    }

    // 轻微缩放/旋转模拟“刀光扫过”
    g.rotation = (Math.random() - 0.5) * 0.6;
    g.alpha = 1;
    gsap.to(g, {
      alpha: 0,
      duration: strong ? 0.28 : 0.22,
      ease: 'power2.out',
      onUpdate: () => {
        g.scale.x += strong ? 0.06 : 0.05;
        g.scale.y += strong ? 0.06 : 0.05;
        g.rotation += (strong ? 0.08 : 0.06) * (Math.random() < 0.5 ? -1 : 1);
      },
      onComplete: () => g.destroy({ children: true }),
    });
  }
}
