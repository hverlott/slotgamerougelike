import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { themeManager } from './ThemeManager.js';

const colorInt = (hex) => parseInt(hex.replace('#', '0x'), 16);
const PRIMARY = () => colorInt(themeManager.getColor('primary'));
const ENERGY = () => colorInt(themeManager.getColor('win'));
const LASER = () => colorInt(themeManager.getColor('grid') || '#ac5bff');

/**
 * 🚀 性能优化：预渲染纹理（使用正确的 PixiJS v7 API）
 */
const createParticleTexture = (renderer, size = 4, color = 0xffffff) => {
  const g = new Graphics();
  g.circle(size, size, size);
  g.fill({ color, alpha: 1 });
  
  // ✅ 使用 renderer.generateTexture（PixiJS v7 正确方式）
  const texture = renderer.generateTexture(g);
  
  // 清理临时 Graphics
  g.destroy();
  
  return texture;
};

// 全局缓存纹理（懒加载，需要 renderer）
let particleTexturesCache = null;
const getParticleTextures = (renderer) => {
  if (!particleTexturesCache && renderer) {
    particleTexturesCache = {
      small: createParticleTexture(renderer, 2, 0xffffff),
      medium: createParticleTexture(renderer, 3, 0xffffff),
      large: createParticleTexture(renderer, 4, 0xffffff),
    };
  }
  return particleTexturesCache;
};

// 共享 GlowFilter 实例（避免每次创建）
let sharedGlowFilter = null;
const getSharedGlowFilter = () => {
  if (!sharedGlowFilter) {
    sharedGlowFilter = new GlowFilter({
      distance: 10,
      outerStrength: 2,
      color: 0xffffff,
      quality: 0.15, // 降低质量以提升性能
    });
  }
  return sharedGlowFilter;
};

/**
 * 子弹系统 - 统一战斗事件处理（性能优化版）
 * 
 * 优化措施：
 * - 对象池复用（粒子、爆炸环、斩击效果）
 * - 使用 Sprite + 预渲染纹理代替 Graphics
 * - 共享 GlowFilter 实例
 * - 限制活跃特效数量
 * - 减少 GSAP tween 创建
 */
export class BulletSystem {
  constructor(app, enemySystem, options = {}) {
    this.app = app;
    this.ctx = { app, enemySystem };
    this.enemySystem = enemySystem;
    this.container = new Container();
    this.bullets = [];
    this.speed = 26;
    this.rotationSpeed = 0.15; // 🔄 旋转速度控制
    this.damagePerHit = options.damagePerHit ?? 10;
    this.onHit = options.onHit ?? null;
    this.floatingTextSystem = options.floatingTextSystem ?? null;
    this.fxSystem = options.fxSystem ?? null;
    this.audioSystem = options.audioSystem || null;

    // 🚀 性能优化：对象池
    this.particlePool = []; // Sprite 池
    this.explosionRingPool = []; // Graphics 环池
    this.slashHitPool = []; // Graphics 斩击池
    this.activeParticles = []; // 活跃粒子追踪
    this.activeExplosionRings = []; // 活跃爆炸环追踪
    this.activeSlashHits = []; // 活跃斩击追踪

    // 性能限制配置
    this.maxActiveHitFX = 6; // 最多同时 6 个击中特效
    this.maxParticlesPerExplosion = 12; // 每次爆炸最多 12 个粒子（从 22 减少）
    this.currentHitFXCount = 0;
    this.maxHitsPerFrame = 8; // 🚀 新增：每帧最多处理 8 个击中

    // 🚀 预加载粒子纹理（传入 renderer）
    if (this.app?.app?.renderer) {
      getParticleTextures(this.app.app.renderer);
    } else {
      console.warn('[BulletSystem] Renderer not available, textures will be created on first use');
    }

    // 🛠️ 调试模式
    this.debugMode = false;
    this.debugContainer = new Container();
    this.container.addChild(this.debugContainer);

    this.app.gameLayer.addChild(this.container);
    this.update = this.update.bind(this);
    this.app.ticker.add(this.update);
  }

  // ============ 对象池管理 ============

  /**
   * 从池中获取粒子 Sprite（确保完全重置）
   */
  getParticle() {
    if (this.particlePool.length > 0) {
      const p = this.particlePool.pop();
      // 🚀 确保完全重置对象状态
      p.alpha = 1;
      p.scale.set(1);
      p.rotation = 0;
      p.visible = true;
      p.tint = 0xFFFFFF;
      p.x = 0;
      p.y = 0;
      return p;
    }
    
    // 获取或创建纹理
    const textures = getParticleTextures(this.app?.app?.renderer);
    if (!textures) {
      console.warn('[BulletSystem] Particle textures not available, using placeholder');
      // 创建一个简单的占位 Sprite
      const p = new Sprite(Texture.WHITE);
      p.anchor.set(0.5);
      p.width = 6;
      p.height = 6;
      return p;
    }
    
    const p = new Sprite(textures.medium);
    p.anchor.set(0.5);
    return p;
  }

  /**
   * 回收粒子到池中
   */
  returnParticle(particle) {
    if (!particle || particle.destroyed) return;
    gsap.killTweensOf(particle);
    gsap.killTweensOf(particle.scale);
    particle.removeFromParent();
    if (this.particlePool.length < 50) {
      this.particlePool.push(particle);
    } else {
      particle.destroy();
    }
  }

  /**
   * 从池中获取爆炸环（确保完全重置）
   */
  getExplosionRing() {
    if (this.explosionRingPool.length > 0) {
      const ring = this.explosionRingPool.pop();
      ring.clear();
      // 🚀 确保完全重置对象状态
      ring.alpha = 1;
      ring.scale.set(1);
      ring.rotation = 0;
      ring.visible = true;
      ring.filters = [];
      ring.x = 0;
      ring.y = 0;
      return ring;
    }
    return new Graphics();
  }

  /**
   * 回收爆炸环到池中
   */
  returnExplosionRing(ring) {
    if (!ring || ring.destroyed) return;
    gsap.killTweensOf(ring);
    gsap.killTweensOf(ring.scale);
    ring.clear();
    ring.removeFromParent();
    if (this.explosionRingPool.length < 10) {
      this.explosionRingPool.push(ring);
    } else {
      ring.destroy();
    }
  }

  /**
   * 从池中获取斩击效果（确保完全重置）
   */
  getSlashHit() {
    if (this.slashHitPool.length > 0) {
      const slash = this.slashHitPool.pop();
      slash.clear();
      // 🚀 确保完全重置对象状态
      slash.alpha = 1;
      slash.scale.set(1);
      slash.rotation = 0;
      slash.visible = true;
      slash.filters = [];
      slash.x = 0;
      slash.y = 0;
      return slash;
    }
    return new Graphics();
  }

  /**
   * 回收斩击效果到池中
   */
  returnSlashHit(slash) {
    if (!slash || slash.destroyed) return;
    gsap.killTweensOf(slash);
    gsap.killTweensOf(slash.scale);
    slash.clear();
    slash.removeFromParent();
    if (this.slashHitPool.length < 10) {
      this.slashHitPool.push(slash);
    } else {
      slash.destroy();
    }
  }

  // ============ 调试与校验 ============
  
  setDebug(enabled) {
    this.debugMode = enabled;
    if (!enabled) this.debugContainer.removeChildren();
    console.log(`[BulletSystem] Debug mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
  }

  validateSpawnPoint(x, y) {
    const { width, height } = this.app.app.screen;
    // 允许一定的缓冲区 (例如屏幕外 100px)
    const padding = 100;
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
      console.warn(`[BulletSystem] Invalid spawn coordinates: (${x}, ${y})`);
      return false;
    }
    if (x < -padding || x > width + padding || y < -padding || y > height + padding) {
      console.warn(`[BulletSystem] Spawn point out of bounds: (${x?.toFixed(1)}, ${y?.toFixed(1)})`);
      // 仍然返回 true，因为有时候确实需要从屏幕外发射（比如支援打击），但打印警告以便排查
      return true; 
    }
    return true;
  }

  drawDebugMarker(x, y) {
    if (!this.debugMode) return;
    
    const marker = new Graphics();
    // 十字准星
    marker.moveTo(-10, 0).lineTo(10, 0);
    marker.moveTo(0, -10).lineTo(0, 10);
    marker.stroke({ width: 2, color: 0xff0000, alpha: 0.8 });
    // 圆圈
    marker.circle(0, 0, 15);
    marker.stroke({ width: 1, color: 0xff0000, alpha: 0.5 });
    
    marker.x = x;
    marker.y = y;
    this.debugContainer.addChild(marker);
    
    // 自动淡出
    gsap.to(marker, {
      alpha: 0,
      duration: 1.0,
      delay: 0.5,
      onComplete: () => marker.destroy()
    });
  }

  // 🎯 绘制锁定准星
  drawReticle(target) {
    if (!target || target.destroyed) return;
    
    // 如果已经有准星且目标相同，复用（或者简单的闪烁一下）
    if (this.currentReticle && this.currentReticle.target === target) {
      this.currentReticle.alpha = 1;
      return;
    }

    // 移除旧准星
    if (this.currentReticle) {
      this.currentReticle.destroy();
      this.currentReticle = null;
    }

    const size = 50;
    const reticle = new Container();
    
    // 旋转的括号 []
    const brackets = new Graphics();
    const len = 15;
    const thick = 3;
    const color = 0xFF4444; // 红色锁定

    // 左上
    brackets.moveTo(-size/2, -size/2 + len).lineTo(-size/2, -size/2).lineTo(-size/2 + len, -size/2);
    // 右上
    brackets.moveTo(size/2 - len, -size/2).lineTo(size/2, -size/2).lineTo(size/2, -size/2 + len);
    // 右下
    brackets.moveTo(size/2, size/2 - len).lineTo(size/2, size/2).lineTo(size/2 - len, size/2);
    // 左下
    brackets.moveTo(-size/2 + len, size/2).lineTo(-size/2, size/2).lineTo(-size/2, size/2 - len);
    
    brackets.stroke({ width: thick, color, alpha: 0.8 });
    reticle.addChild(brackets);

    // 中心点
    const center = new Graphics();
    center.circle(0, 0, 4);
    center.fill({ color, alpha: 0.9 });
    reticle.addChild(center);

    this.container.addChild(reticle);
    this.currentReticle = reticle;
    this.currentReticle.target = target;

    // 锁定动画
    gsap.to(brackets, { rotation: Math.PI / 2, duration: 0.5, ease: 'back.out' });
    gsap.fromTo(reticle.scale, { x: 2, y: 2 }, { x: 1, y: 1, duration: 0.3, ease: 'power2.out' });

    // 每一帧跟随目标
    const follow = () => {
      if (!target || target.destroyed || this.currentReticle !== reticle) {
        reticle.destroy();
        if (this.currentReticle === reticle) this.currentReticle = null;
        this.app.app.ticker.remove(follow);
        return;
      }
      
      const gpos = target.getGlobalPosition ? target.getGlobalPosition() : null;
      const pos = gpos ? this.container.toLocal(gpos) : target;
      reticle.x = pos.x;
      reticle.y = pos.y;
    };
    this.app.app.ticker.add(follow);
  }

  // ============ 统一战斗事件入口 ============
  async playCombatEvent(ev, modifiers = null) {
    this.currentModifiers = modifiers || {
      extraProjectiles: 0,
      pierce: 0,
      chain: 0,
      aoeScale: 1.0,
      critChance: 0,
      lifesteal: 0,
      overloadBonus: 0,
    };

    switch (ev.type) {
      case 'Shoot':
        return this.playShoot(ev);
      case 'Grenade':
        return this.playGrenade(ev);
      case 'Missile':
        return this.playMissile(ev);
      case 'Overload':
        return this.playOverload(ev);
      default:
        console.warn(`未知战斗事件类型: ${ev.type}`);
    }
  }

  setOnHit(fn) {
    this.onHit = fn;
  }

  // ============ 战斗事件实现 ============

  async playShoot(ev) {
    const mods = this.currentModifiers || {};
    const { count = 1, dmg = this.damagePerHit, bulletType = 1, startX, startY } = ev;
    
    this.audioSystem?.play('shoot', { volume: 0.6, pos: { x: (startX / this.app.app.screen.width) * 2 - 1, y: 0, z: 0 } });
    
    const totalCount = count + (mods.extraProjectiles || 0);
    
    for (let i = 0; i < totalCount; i++) {
      const target = this.enemySystem.pickTarget?.() ?? this.enemySystem.zombies[0];
      if (!target || target.destroyed) continue;

      await this.fireBulletTo(target, { 
        dmg, 
        bulletType, 
        startX, 
        startY 
      });

      if (i < totalCount - 1) {
        await this.delay(80);
      }
    }
  }

  async playGrenade(ev) {
    const { dmg = this.damagePerHit * 1.5, startX, startY } = ev;
    const target = this.enemySystem.pickTarget?.() ?? this.enemySystem.zombies[0];
    if (!target || target.destroyed) return;

    await this.fireBulletTo(target, { 
      dmg, 
      bulletType: 2, 
      startX, 
      startY 
    });
  }

  async playMissile(ev) {
    const { dmg = this.damagePerHit * 2.2, startX, startY } = ev;
    const target = this.enemySystem.pickTarget?.() ?? this.enemySystem.zombies[0];
    if (!target || target.destroyed) return;

    await this.fireBulletTo(target, { 
      dmg, 
      bulletType: 4, 
      startX, 
      startY 
    });
  }

  async playOverload(ev) {
    const { dmg = this.damagePerHit * 2, startX = 0, startY = this.app.app.screen.height / 2 } = ev;
    
    this.shootLaser(startX, startY, null);
    await this.delay(200);
  }

  fireBulletTo(target, { dmg, bulletType = 1, startX, startY }) {
    return new Promise((resolve) => {
      let sx = startX ?? 0;
      let sy = startY ?? this.app.app.screen.height / 2;

      // 🛠️ 坐标校验与修正
      if (!this.validateSpawnPoint(sx, sy)) {
        // 如果坐标无效，默认回退到屏幕中心下方
        sx = this.app.app.screen.width / 2;
        sy = this.app.app.screen.height * 0.8;
      }

      // 🛠️ 调试可视化
      if (this.debugMode) {
        this.drawDebugMarker(sx, sy);
      }

      const sprite =
        bulletType === 4 ? this.createType4() : bulletType === 2 ? this.createType2() : this.createType1();
      sprite.x = sx;
      sprite.y = sy;

      const targetGlobal =
        typeof target.getGlobalPosition === 'function' ? target.getGlobalPosition() : null;
      const targetPos = targetGlobal ? this.container.toLocal(targetGlobal) : target;
      const dx = targetPos.x - sx;
      const dy = targetPos.y - sy;
      const angle = Math.atan2(dy, dx);
      sprite.rotation = angle;

      const speed =
        bulletType === 4 ? this.speed * 0.85 : bulletType === 2 ? this.speed * 0.7 : this.speed * 1.1;
      const trail = bulletType === 2 || bulletType === 4;
      if (trail) {
        gsap.to(sprite.scale, { x: 1.1, y: 1.1, duration: 0.2, yoyo: true, repeat: -1 });
      }

      this.container.addChild(sprite);
      
      this.bullets.push({ 
        sprite, 
        target, 
        speed, 
        type: bulletType,
        dmg,
        onHit: (hitPos) => resolve(hitPos)
      });
    });
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  createType1() {
    const holder = new Container();
    const body = new Graphics();
    body.roundRect(-30, -3, 60, 6, 3);
    body.fill({ color: PRIMARY(), alpha: 1 });
    // 🚀 性能优化：移除每帧 Filter，改用 additive 混合模式
    holder.addChild(body);
    holder.blendMode = 'add'; 
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
    // 🚀 性能优化：移除 Filter
    holder.addChild(trail, orb);
    holder.blendMode = 'add';
    return holder;
  }

  createType4() {
    const holder = new Container();
    const body = new Graphics();
    body.roundRect(-10, -4, 22, 8, 4);
    body.fill({ color: ENERGY(), alpha: 1 });
    body.poly([12, 0, 20, 4, 20, -4]);
    body.fill({ color: 0xffffff, alpha: 0.8 });
    const flame = new Graphics();
    flame.circle(-16, 0, 5);
    flame.fill({ color: 0xff6633, alpha: 0.7 });
    // 🚀 性能优化：移除 Filter
    holder.addChild(flame, body);
    holder.blendMode = 'add';
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

    // 🚀 性能优化：限制每帧击中处理数量
    let hitsProcessedThisFrame = 0;

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
      
      // 🔄 自动旋转修复：重新校准角度并平滑过渡
      const targetAngle = Math.atan2(dy, dx);
      
      // 异常检测：如果角度无效，重置为 0
      if (!Number.isFinite(targetAngle)) {
        sprite.rotation = 0;
      } else {
        // 平滑旋转
        let diff = targetAngle - sprite.rotation;
        // 归一化到 -PI ~ PI
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        
        // 应用旋转速度
        const rotSpeed = this.rotationSpeed || 0.15;
        if (Math.abs(diff) > 0.01) {
           sprite.rotation += diff * rotSpeed;
        } else {
           sprite.rotation = targetAngle;
        }
      }

      const vx = (dx / dist) * speed;
      const vy = (dy / dist) * speed;

      sprite.x += vx;
      sprite.y += vy;

      if (dist < 20) {
        // 🚀 性能优化：如果本帧已处理太多击中，跳到下一帧
        if (hitsProcessedThisFrame >= this.maxHitsPerFrame) {
          continue; // 留到下一帧处理
        }
        hitsProcessedThisFrame++;

        const mods = this.currentModifiers || {};
        
        const baseCritChance = type === 3 ? 0.3 : 0.1;
        // ✅ 修复：计入全局暴击率（升级系统）
        const finalCritChance = baseCritChance + (this.critChance || 0) + (mods.critChance || 0);
        const isCrit = Math.random() < finalCritChance;
        
        const baseDmg = b.dmg ?? (this.damagePerHit * (type === 2 ? 1.5 : type === 4 ? 2.2 : 1));
        const critMul = this.critMultiplier || 2.0;
        const damage = (isCrit ? critMul : 1) * baseDmg;
        
        const impactX = targetPos?.x ?? sprite.x;
        const impactY = targetPos?.y ?? sprite.y;
        
        target.takeDamage?.(damage);
        this.floatingTextSystem?.showText(impactX, impactY, damage, isCrit);
        
        if (mods.lifesteal > 0) {
          const healAmount = damage * mods.lifesteal;
          this.ctx.playerSystem?.heal?.(healAmount);
          console.log(`[Lifesteal] +${healAmount.toFixed(1)} HP`);
        }
        
        this.onHit?.(damage, { isCrit, target, pos: { x: impactX, y: impactY } });

        // 🎯 击中特效逻辑重构 (区分普通/暴击/特殊)
        const isSpecial = type === 4; // 特殊子弹
        const isExplosive = type === 2; // 爆炸子弹

        if (isCrit || isSpecial) {
          // 💥 暴击/特殊：斩击 + 暴击火花
          const slashStrength = isSpecial ? 2.5 : 2.0;
          if (this.fxSystem?.slash) {
            this.fxSystem.slash(impactX, impactY, slashStrength);
          }
          
          if (damage > this.damagePerHit * 3) {
             this.fxSystem?.bigImpact?.(impactX, impactY);
          } else {
             this.fxSystem?.critSpark?.(impactX, impactY);
          }
        } else if (isExplosive) {
          // 💣 爆炸子弹：爆炸圈 + 火花
          this.fxSystem?.explosion?.(impactX, impactY, 1.2);
        } else {
          // ✨ 普通击中：只有火花 (去除多余的 slash)
          this.fxSystem?.hitSpark?.(impactX, impactY);
        }

        // 音效 (3D Spatial)
        const screenW = this.app.app.screen.width;
        const screenH = this.app.app.screen.height;
        const panX = (impactX / screenW) * 2 - 1; // -1 ~ 1
        const pos = { x: panX, y: 0, z: 0 }; // Simplified Z

        if (type === 2 || type === 4) {
          this.audioSystem?.play('explosion', { volume: type === 4 ? 1.0 : 0.7, pos });
        } else {
          // 随机化音调，避免单调
          const rate = 0.9 + Math.random() * 0.2;
          this.audioSystem?.play('hit', { volume: isCrit ? 0.8 : 0.5, rate, pos });
        }

        // 相机震动
        const shakeIntensity = type === 4 ? 15 : (isCrit ? 8 : 2); // 增加强度
        const shakeDuration = type === 4 ? 0.4 : (isCrit ? 0.3 : 0.15);
        
        if (type === 4 || (isCrit && damage > this.damagePerHit * 2)) {
             this.fxSystem?.screenShake?.(shakeIntensity, shakeDuration);
        } else {
             this.fxSystem?.cameraShake?.(shakeIntensity, shakeDuration);
        }

        const aoeScale = mods.aoeScale || 1.0;
        
        if (type === 2) {
          const aoeRadius = 60 * aoeScale;
          this.fxSystem?.shockwaveAOE?.(impactX, impactY, aoeRadius);
          
          const enemies = this.enemySystem.zombies.filter((z) => !z.destroyed);
          enemies.forEach((z) => {
            const gpos = z.getGlobalPosition ? z.getGlobalPosition() : null;
            const pos = gpos ? this.container.toLocal(gpos) : z;
            if (Math.hypot(pos.x - impactX, pos.y - impactY) < aoeRadius) {
              if (z !== target) {
                z.takeDamage?.(damage * 0.5);
              }
            }
          });
        }
        if (type === 4) {
          // 爆炸特效
          if (this.fxSystem?.explosion) {
             this.fxSystem.explosion(impactX, impactY, aoeScale);
          } else {
             this.spawnExplosion(impactX, impactY);
          }
          
          const innerRadius = 60 * aoeScale;
          const outerRadius = 110 * aoeScale;
          
          this.fxSystem?.shockwaveAOE?.(impactX, impactY, outerRadius);
          
          const enemies = this.enemySystem.zombies.filter((z) => !z.destroyed);
          enemies.forEach((z) => {
            const gpos = z.getGlobalPosition ? z.getGlobalPosition() : null;
            const pos = gpos ? this.container.toLocal(gpos) : z;
            const d = Math.hypot(pos.x - impactX, pos.y - impactY);
            if (d < outerRadius) {
              if (z !== target) {
                z.takeDamage?.(damage * (d < innerRadius ? 0.85 : 0.45));
              }
            }
          });
        }
        
        if (mods.pierce > 0 && type !== 2 && type !== 4) {
          this.applyPierce(impactX, impactY, target, damage * 0.6, mods.pierce);
        }
        
        if (mods.chain > 0 && type === 2) {
          this.applyChain(impactX, impactY, target, damage * 0.4, mods.chain);
        }

        b.onHit?.({ x: impactX, y: impactY });

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

  /**
   * 🚀 性能优化版：爆炸效果（使用对象池 + Sprite）
   */
  spawnExplosion(x, y) {
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
      console.warn('Invalid explosion coordinates:', x, y);
      return;
    }

    // 爆炸环
    const ring = this.getExplosionRing();
    ring.circle(0, 0, 14);
    ring.stroke({ width: 4, color: ENERGY(), alpha: 0.9 });
    ring.x = x;
    ring.y = y;
    this.container.addChild(ring);
    this.activeExplosionRings.push(ring);

    gsap.to(ring, {
      alpha: 0,
      duration: 0.35,
      onUpdate: () => {
        ring.scale.x += 0.18;
        ring.scale.y += 0.18;
      },
      onComplete: () => {
        const idx = this.activeExplosionRings.indexOf(ring);
        if (idx > -1) this.activeExplosionRings.splice(idx, 1);
        this.returnExplosionRing(ring);
      },
    });

    // 🚀 性能优化：减少粒子数量（22 -> 12）
    // 🚀 性能优化：跳过低帧率时的粒子生成
    const deltaMS = this.app.app.ticker.deltaMS || 16;
    const skipParticles = deltaMS > 33; // 如果帧率 < 30fps，跳过粒子
    
    const count = skipParticles ? 6 : this.maxParticlesPerExplosion;
    const colors = [ENERGY(), PRIMARY(), 0xff00ff];
    
    for (let i = 0; i < count; i += 1) {
      const p = this.getParticle();
      p.tint = colors[Math.floor(Math.random() * 3)];
      p.x = x;
      p.y = y;
      p.scale.set(0.5 + Math.random() * 0.5);
      this.container.addChild(p);
      this.activeParticles.push(p);
      
      const ang = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 70;
      
      gsap.to(p, {
        x: x + Math.cos(ang) * dist,
        y: y + Math.sin(ang) * dist,
        alpha: 0,
        duration: 0.55 + Math.random() * 0.25,
        ease: 'power2.out',
        onComplete: () => {
          const idx = this.activeParticles.indexOf(p);
          if (idx > -1) this.activeParticles.splice(idx, 1);
          this.returnParticle(p);
        },
      });
    }
  }

  /**
   * 🚀 性能优化版：斩击效果（使用对象池）
   */
  spawnSlashHit(x, y, { strong = false, color = 0xfff07a } = {}) {
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) {
      console.warn('Invalid slash hit coordinates:', x, y);
      return;
    }

    this.currentHitFXCount++;

    const g = this.getSlashHit();
    g.x = x;
    g.y = y;
    this.container.addChild(g);
    this.activeSlashHits.push(g);

    const count = strong ? 9 : 6;
    const lenBase = strong ? 56 : 40;
    for (let i = 0; i < count; i += 1) {
      const ang = Math.random() * Math.PI * 2;
      const len = lenBase + Math.random() * (strong ? 32 : 22);
      const w = strong ? 4 : 3;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
      g.stroke({ width: w, color, alpha: 0.95, cap: 'round' });
      g.moveTo(0, 0);
      g.lineTo(Math.cos(ang) * (len * 0.7), Math.sin(ang) * (len * 0.7));
      g.stroke({ width: Math.max(1, w - 2), color: 0xffffff, alpha: 0.9, cap: 'round' });
    }

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
      onComplete: () => {
        this.currentHitFXCount--;
        const idx = this.activeSlashHits.indexOf(g);
        if (idx > -1) this.activeSlashHits.splice(idx, 1);
        this.returnSlashHit(g);
      },
    });
  }

  /**
   * 穿透伤害（所有特效由 FXSystem 处理）
   */
  applyPierce(impactX, impactY, mainTarget, pierceDamage, pierceCount) {
    if (pierceCount <= 0) return;

    const enemies = this.enemySystem.zombies.filter(
      (z) => !z.destroyed && z !== mainTarget
    );

    const behindTargets = enemies
      .map((z) => {
        const gpos = z.getGlobalPosition ? z.getGlobalPosition() : null;
        const pos = gpos ? this.container.toLocal(gpos) : z;
        return { enemy: z, pos, dist: Math.hypot(pos.x - impactX, pos.y - impactY) };
      })
      .filter((t) => t.pos.x > impactX)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, pierceCount);

    behindTargets.forEach(({ enemy, pos }) => {
      enemy.takeDamage?.(pierceDamage);
      this.floatingTextSystem?.showText(pos.x, pos.y, pierceDamage, false);
      // 穿透斩击效果由 FXSystem 处理
      this.fxSystem?.slash?.(pos.x, pos.y, 0.8);
      this.fxSystem?.hitSpark?.(pos.x, pos.y);
    });

    if (behindTargets.length > 0) {
      console.log(`[Pierce] Hit ${behindTargets.length} targets`);
    }
  }

  /**
   * 连锁伤害（所有特效由 FXSystem 处理）
   */
  applyChain(impactX, impactY, mainTarget, chainDamage, chainCount) {
    if (chainCount <= 0) return;

    const enemies = this.enemySystem.zombies.filter(
      (z) => !z.destroyed && z !== mainTarget
    );

    let currentPos = { x: impactX, y: impactY };
    const chainedTargets = [];

    for (let i = 0; i < chainCount; i++) {
      const nextTarget = enemies
        .filter((z) => !chainedTargets.includes(z))
        .map((z) => {
          const gpos = z.getGlobalPosition ? z.getGlobalPosition() : null;
          const pos = gpos ? this.container.toLocal(gpos) : z;
          return { enemy: z, pos, dist: Math.hypot(pos.x - currentPos.x, pos.y - currentPos.y) };
        })
        .sort((a, b) => a.dist - b.dist)[0];

      if (!nextTarget || nextTarget.dist > 150) break;

      nextTarget.enemy.takeDamage?.(chainDamage * Math.pow(0.8, i));
      this.floatingTextSystem?.showText(
        nextTarget.pos.x, 
        nextTarget.pos.y, 
        chainDamage * Math.pow(0.8, i), 
        false
      );

      // 连锁闪电和斩击效果
      if (this.fxSystem?.chainLightning) {
        this.fxSystem.chainLightning(currentPos.x, currentPos.y, nextTarget.pos.x, nextTarget.pos.y);
      } else {
        this.spawnChainLightning(currentPos.x, currentPos.y, nextTarget.pos.x, nextTarget.pos.y);
      }
      
      if (this.fxSystem?.slash) {
        this.fxSystem.slash(nextTarget.pos.x, nextTarget.pos.y, 0.8);
      } else {
        this.spawnSlashHit(nextTarget.pos.x, nextTarget.pos.y, { strong: false });
      }

      this.fxSystem?.hitSpark?.(nextTarget.pos.x, nextTarget.pos.y);

      chainedTargets.push(nextTarget.enemy);
      currentPos = nextTarget.pos;
    }

    if (chainedTargets.length > 0) {
      console.log(`[Chain] Hit ${chainedTargets.length} targets`);
    }
  }

  /**
   * 🚀 性能优化版：闪电效果（使用对象池）
   */
  spawnChainLightning(x1, y1, x2, y2) {
    const line = this.getSlashHit(); // 复用斩击池
    
    const steps = 5;
    const dx = (x2 - x1) / steps;
    const dy = (y2 - y1) / steps;
    
    line.moveTo(x1, y1);
    for (let i = 1; i <= steps; i++) {
      const offsetX = (Math.random() - 0.5) * 20;
      const offsetY = (Math.random() - 0.5) * 20;
      line.lineTo(x1 + dx * i + offsetX, y1 + dy * i + offsetY);
    }
    
    line.stroke({ width: 3, color: 0xffff00, alpha: 0.9 });
    
    // 🚀 性能优化：复用共享的 GlowFilter
    const filter = getSharedGlowFilter();
    filter.color = 0xffff00;
    line.filters = [filter];
    
    this.container.addChild(line);
    this.activeSlashHits.push(line);

    gsap.to(line, {
      alpha: 0,
      duration: 0.2,
      onComplete: () => {
        line.filters = []; // 清除 filter 引用
        const idx = this.activeSlashHits.indexOf(line);
        if (idx > -1) this.activeSlashHits.splice(idx, 1);
        this.returnSlashHit(line);
      },
    });
  }
}
