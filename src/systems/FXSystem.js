import { Container, Graphics, Sprite } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { themeManager } from './ThemeManager.js';

const colorInt = (hex) => parseInt(hex.replace('#', '0x'), 16);
const PRIMARY = () => colorInt(themeManager.getColor('primary'));
const ACCENT = () => colorInt(themeManager.getColor('accent'));
const ENERGY = () => colorInt(themeManager.getColor('win'));

/**
 * 🚀 FXSystem - 高性能赛博朋克特效系统（优化版）
 * 
 * 核心特性：
 * - 对象池复用（避免频繁 new/destroy）
 * - 分层管理（线条层、光晕层、粒子层）
 * - 动画驱动（GSAP timeline）
 * - 硬限制并发特效数量（防止性能峰值）
 * - 自动清理（timeline 完成后回收）
 */
export class FXSystem {
  constructor(app) {
    this.app = app;
    
    // 容器层级
    this.lineContainer = new Container();      // 中奖线层
    this.glowContainer = new Container();      // 光晕层
    this.scanContainer = new Container();      // 扫描高光层
    this.symbolContainer = new Container();    // 符号高亮层
    
    // 添加到游戏层
    if (this.app.gameLayer) {
      this.app.gameLayer.addChild(this.lineContainer);
      this.app.gameLayer.addChild(this.glowContainer);
      this.app.gameLayer.addChild(this.scanContainer);
      this.app.gameLayer.addChild(this.symbolContainer);
    }
    
    // 对象池
    this.linePool = [];         // Graphics 池
    this.glowPool = [];         // 光晕 Graphics 池
    this.scanPool = [];         // 扫描点 Graphics 池
    this.symbolGlowPool = [];   // 符号光晕 Graphics 池
    this.sparkPool = [];        // 🚀 新增：火花 Graphics 池
    this.ringPool = [];         // 🚀 新增：环 Graphics 池
    
    // 活跃对象
    this.activeLines = [];
    this.activeGlows = [];
    this.activeScans = [];
    this.activeSymbolGlows = [];
    this.activeSparks = [];     // 🚀 新增：活跃火花
    this.activeRings = [];      // 🚀 新增：活跃环
    
    // 活跃动画
    this.activeTimelines = [];
    
    // 🚀 性能限制：并发特效数量
    this.maxConcurrentFX = 30;  // 最多 30 个并发特效
    
    // 性能计数器
    this.frameCount = 0;
  }

  /**
   * 每帧更新
   */
  update(delta) {
    this.frameCount++;
  }

  /**
   * 🎯 播放中奖线特效（主入口）
   */
  async playWinLines(spinResult, slotSystem) {
    if (!spinResult || !spinResult.wins || spinResult.wins.length === 0) {
      return Promise.resolve();
    }

    this.cleanup();

    const winLines = spinResult.wins;
    
    return new Promise((resolve) => {
      const timeline = gsap.timeline({
        onComplete: () => {
          this.cleanup();
          resolve();
        }
      });

      winLines.forEach((winLine, index) => {
        const delay = index * 0.1;
        this.createWinLineEffect(winLine, slotSystem, timeline, delay);
      });

      this.highlightWinningSymbols(winLines, slotSystem, timeline);

      this.activeTimelines.push(timeline);
    });
  }

  /**
   * 🌈 创建单条中奖线特效
   */
  createWinLineEffect(winLine, slotSystem, timeline, delay) {
    const payLine = slotSystem.payLines[winLine.lineIndex];
    if (!payLine) return;

    const points = [];
    payLine.forEach(({ c, r }) => {
      const symbol = slotSystem.getSymbolFromGrid(c, r);
      if (symbol) {
        const globalPos = symbol.getGlobalPosition();
        const localPos = this.lineContainer.toLocal(globalPos);
        points.push({ x: localPos.x, y: localPos.y });
      }
    });

    if (points.length < 2) return;

    const coreLine = this.getLineGraphics();
    this.drawNeonLine(coreLine, points, ENERGY(), 2, 1.0); // 4px → 2px 细线
    coreLine.alpha = 0;
    this.lineContainer.addChild(coreLine);
    this.activeLines.push(coreLine);

    const glowLine = this.getGlowGraphics();
    this.drawNeonLine(glowLine, points, ENERGY(), 6, 0.25); // 12px → 6px，0.4 → 0.25
    glowLine.alpha = 0;
    glowLine.filters = [
      new GlowFilter({
        distance: 8,           // 20 → 8 (精致光晕)
        outerStrength: 1.2,    // 3 → 1.2 (降低强度)
        color: ENERGY(),
        quality: 0.2,          // 0.3 → 0.2 (降低质量以提升性能)
      })
    ];
    this.glowContainer.addChild(glowLine);
    this.activeGlows.push(glowLine);

    const scanDot = this.getScanGraphics();
    scanDot.clear();
    scanDot.circle(0, 0, 5); // 8 → 5 (更小的扫描点)
    scanDot.fill({ color: 0xFFFFFF, alpha: 0.9 }); // 1 → 0.9
    scanDot.filters = [
      new GlowFilter({
        distance: 8,           // 15 → 8 (精致光晕)
        outerStrength: 2,      // 4 → 2 (降低强度)
        color: 0xFFFFFF,
        quality: 0.4,
      })
    ];
    scanDot.alpha = 0;
    scanDot.x = points[0].x;
    scanDot.y = points[0].y;
    this.scanContainer.addChild(scanDot);
    this.activeScans.push(scanDot);

    timeline.to(coreLine, { alpha: 1, duration: 0.15 }, delay);
    timeline.to(glowLine, { alpha: 1, duration: 0.2 }, delay);
    timeline.to(scanDot, { alpha: 1, duration: 0.1 }, delay + 0.2);

    const totalDistance = this.calculatePathLength(points);
    const scanDuration = 0.8;
    
    timeline.to(scanDot, {
      duration: scanDuration,
      ease: 'power1.inOut',
      onUpdate: function() {
        const progress = this.progress();
        const pos = getPointOnPath(points, progress);
        scanDot.x = pos.x;
        scanDot.y = pos.y;
      }
    }, delay + 0.3);

    timeline.to(coreLine, { alpha: 0.3, duration: 0.5 }, delay + 1.2);
    timeline.to(glowLine, { alpha: 0.2, duration: 0.5 }, delay + 1.2);
    timeline.to(scanDot, { alpha: 0, duration: 0.3 }, delay + 1.2);

    timeline.to(coreLine, { alpha: 0, duration: 0.4 }, delay + 1.7);
    timeline.to(glowLine, { alpha: 0, duration: 0.4 }, delay + 1.7);
  }

  /**
   * ✨ 高亮中奖符号
   */
  highlightWinningSymbols(winLines, slotSystem, timeline) {
    const highlighted = new Set();

    winLines.forEach((winLine) => {
      const payLine = slotSystem.payLines[winLine.lineIndex];
      if (!payLine) return;

      payLine.forEach(({ c, r }) => {
        const key = `${c}-${r}`;
        if (highlighted.has(key)) return;
        highlighted.add(key);

        const symbol = slotSystem.getSymbolFromGrid(c, r);
        if (!symbol) return;

        const glow = this.getSymbolGlowGraphics();
        const globalPos = symbol.getGlobalPosition();
        const localPos = this.symbolContainer.toLocal(globalPos);
        
        glow.clear();
        glow.roundRect(
          -slotSystem.symbolWidth / 2,
          -slotSystem.symbolHeight / 2,
          slotSystem.symbolWidth,
          slotSystem.symbolHeight,
          10
        );
        glow.fill({ color: ENERGY(), alpha: 0.2 });
        glow.x = localPos.x;
        glow.y = localPos.y;
        glow.alpha = 0;
        
        glow.filters = [
          new GlowFilter({
            distance: 10,           // 15 → 10 (精致光晕)
            outerStrength: 1.5,     // 2.5 → 1.5 (降低强度)
            color: ENERGY(),
            quality: 0.2,           // 0.3 → 0.2 (降低质量)
          })
        ];

        this.symbolContainer.addChild(glow);
        this.activeSymbolGlows.push(glow);

        timeline.to(glow, { alpha: 0.4, duration: 0.3 }, 0); // 0.6 → 0.4 (更微妙)
        timeline.to(glow, { 
          alpha: 0.2,  // 0.3 → 0.2 (更微妙)
          duration: 0.4, 
          yoyo: true, 
          repeat: 3,
          ease: 'sine.inOut'
        }, 0.3);
        timeline.to(glow, { alpha: 0, duration: 0.4 }, 1.7);

        const originalScale = { x: symbol.scale.x, y: symbol.scale.y };
        timeline.to(symbol.scale, {
          x: originalScale.x * 1.08, // 1.15 → 1.08 (更微妙的脉动)
          y: originalScale.y * 1.08,
          duration: 0.25,
          yoyo: true,
          repeat: 5,
          ease: 'sine.inOut',
          onComplete: () => {
            symbol.scale.set(originalScale.x, originalScale.y);
          }
        }, 0.2);
      });
    });
  }

  /**
   * 🎨 绘制霓虹线条
   */
  drawNeonLine(graphics, points, color, width, alpha) {
    if (points.length < 2) return;

    graphics.clear();
    graphics.moveTo(points[0].x, points[0].y);
    
    if (points.length === 2) {
      graphics.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        
        if (i === points.length - 1) {
          graphics.lineTo(curr.x, curr.y);
        } else {
          const next = points[i + 1];
          const cpx = curr.x;
          const cpy = curr.y;
          const endx = (curr.x + next.x) / 2;
          const endy = (curr.y + next.y) / 2;
          graphics.quadraticCurveTo(cpx, cpy, endx, endy);
        }
      }
    }

    graphics.stroke({ 
      width, 
      color, 
      alpha,
      cap: 'round',
      join: 'round'
    });
  }

  /**
   * 📏 计算路径总长度
   */
  calculatePathLength(points) {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  /**
   * ♻️ 对象池管理（获取）
   */
  getLineGraphics() {
    return this.getFromPool(this.linePool);
  }

  getGlowGraphics() {
    return this.getFromPool(this.glowPool);
  }

  getScanGraphics() {
    return this.getFromPool(this.scanPool);
  }

  getSymbolGlowGraphics() {
    return this.getFromPool(this.symbolGlowPool);
  }

  getSparkGraphics() {
    return this.getFromPool(this.sparkPool);
  }

  getRingGraphics() {
    return this.getFromPool(this.ringPool);
  }

  /**
   * 🔄 通用池获取逻辑
   */
  getFromPool(pool) {
    if (pool.length > 0) {
      const g = pool.pop();
      g.clear();
      g.alpha = 1;
      g.scale.set(1);
      g.rotation = 0;
      g.visible = true;
      g.filters = [];
      return g;
    }
    return new Graphics();
  }

  /**
   * ♻️ 对象池管理（回收）
   */
  returnLineGraphics(g) {
    this.returnToPool(g, this.linePool, 20);
  }

  returnGlowGraphics(g) {
    this.returnToPool(g, this.glowPool, 20);
  }

  returnScanGraphics(g) {
    this.returnToPool(g, this.scanPool, 20);
  }

  returnSymbolGlowGraphics(g) {
    this.returnToPool(g, this.symbolGlowPool, 50);
  }

  returnSparkGraphics(g) {
    this.returnToPool(g, this.sparkPool, 30);
  }

  returnRingGraphics(g) {
    this.returnToPool(g, this.ringPool, 20);
  }

  /**
   * 🔄 通用池回收逻辑
   */
  returnToPool(g, pool, maxSize) {
    if (!g || g.destroyed) return;
    
    gsap.killTweensOf(g);
    gsap.killTweensOf(g.scale);
    
    if (g.parent) g.parent.removeChild(g);
    g.clear();
    g.alpha = 1;
    g.scale.set(1);
    g.rotation = 0;
    g.visible = true;
    g.filters = [];
    
    if (pool.length < maxSize) {
      pool.push(g);
    } else {
      g.destroy();
    }
  }

  /**
   * 📹 相机震动（精致微抖版）
   */
  cameraShake(intensity = 5, duration = 0.2) {
    const target = this.app.gameLayer || this.app.stage;
    if (!target) return;

    const originalX = target.x;
    const originalY = target.y;

    // 减少震动强度 50%（更微妙）
    const reducedIntensity = intensity * 0.5;
    const shakeX = (Math.random() - 0.5) * reducedIntensity * 2;
    const shakeY = (Math.random() - 0.5) * reducedIntensity * 2;

    // 更短更快的震动
    gsap.to(target, {
      x: originalX + shakeX,
      y: originalY + shakeY,
      duration: duration * 0.4,  // 更快的抖动
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        gsap.to(target, {
          x: originalX,
          y: originalY,
          duration: 0.03,          // 0.05 → 0.03 (更快恢复)
          ease: 'power1.out'
        });
      }
    });
  }

  /**
   * ✨ 击中火花（普通）- 精致锐利版
   */
  hitSpark(x, y) {
    // 🚀 限制并发特效
    if (this.activeSparks.length >= this.maxConcurrentFX) {
      return; // 跳过新特效
    }

    const sparkCount = 4; // 5 → 4 (更少粒子)
    const color = PRIMARY();

    for (let i = 0; i < sparkCount; i++) {
      const spark = this.getSparkGraphics();
      spark.clear();
      
      // 小型锐利火花（细线而非圆点）
      const length = 6 + Math.random() * 6; // 短而锐利
      const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.4;
      
      spark.moveTo(0, 0);
      spark.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      spark.stroke({ 
        width: 1.5, // 细线条
        color, 
        alpha: 0.85, // 1 → 0.85
        cap: 'round' 
      });
      
      spark.x = x;
      spark.y = y;
      
      // 极微妙的光晕（减少 60%）
      spark.filters = [
        new GlowFilter({
          distance: 3,           // 8 → 3 (-62.5%)
          outerStrength: 0.8,    // 2 → 0.8 (-60%)
          color,
          quality: 0.1,          // 0.2 → 0.1 (更低质量)
        })
      ];

      this.scanContainer.addChild(spark);
      this.activeSparks.push(spark);

      const distance = 18 + Math.random() * 10; // 25+20 → 18+10 (更短距离)
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;

      gsap.to(spark, {
        x: targetX,
        y: targetY,
        duration: 0.25 + Math.random() * 0.15, // 0.3+0.2 → 0.25+0.15 (更快)
        ease: 'power2.out'
      });

      gsap.to(spark, {
        alpha: 0,
        duration: 0.2,          // 0.25 → 0.2 (更快淡出)
        delay: 0.08,            // 0.1 → 0.08
        ease: 'power1.in',
        onComplete: () => {
          const idx = this.activeSparks.indexOf(spark);
          if (idx > -1) this.activeSparks.splice(idx, 1);
          this.returnSparkGraphics(spark);
        }
      });
    }
  }

  /**
   * 💥 暴击火花（加强版）- 精致锐利版
   */
  critSpark(x, y) {
    // 🚀 限制并发特效
    if (this.activeSparks.length >= this.maxConcurrentFX) {
      return;
    }

    const sparkCount = 8; // 12 → 8 (更少粒子)
    const color = ENERGY();

    // 内圈闪光（更小更锐利）
    const flash = this.getRingGraphics();
    flash.clear();
    flash.circle(0, 0, 12); // 20 → 12 (更小)
    flash.fill({ color: 0xFFFFFF, alpha: 0.6 }); // 0.8 → 0.6
    flash.x = x;
    flash.y = y;
    flash.filters = [
      new GlowFilter({
        distance: 6,           // 12 → 6 (-50%)
        outerStrength: 1.0,    // 2 → 1.0 (-50%)
        color: 0xFFFFFF,
        quality: 0.1,          // 0.2 → 0.1
      })
    ];
    this.glowContainer.addChild(flash);
    this.activeRings.push(flash);

    gsap.to(flash.scale, {
      x: 1.6,                  // 2 → 1.6 (更小扩散)
      y: 1.6,
      duration: 0.15,          // 0.2 → 0.15 (更快)
      ease: 'power2.out'
    });

    gsap.to(flash, {
      alpha: 0,
      duration: 0.25,          // 0.3 → 0.25 (更快)
      ease: 'power2.in',
      onComplete: () => {
        const idx = this.activeRings.indexOf(flash);
        if (idx > -1) this.activeRings.splice(idx, 1);
        this.returnRingGraphics(flash);
      },
    });

    // 外圈粒子（细线条而非圆点）
    for (let i = 0; i < sparkCount; i++) {
      const spark = this.getSparkGraphics();
      spark.clear();
      
      // 锐利线条火花
      const length = 8 + Math.random() * 8;
      const angle = (Math.PI * 2 * i) / sparkCount + (Math.random() - 0.5) * 0.3;
      
      spark.moveTo(0, 0);
      spark.lineTo(length, 0);
      spark.stroke({ 
        width: 2,              // 细线条
        color, 
        alpha: 0.9,
        cap: 'round' 
      });
      
      spark.x = x;
      spark.y = y;
      spark.rotation = angle;
      
      // 微妙光晕（减少 60%）
      spark.filters = [
        new GlowFilter({
          distance: 4,           // 10 → 4 (-60%)
          outerStrength: 0.8,    // 2 → 0.8 (-60%)
          color,
          quality: 0.1,          // 0.2 → 0.1
        })
      ];

      this.scanContainer.addChild(spark);
      this.activeSparks.push(spark);

      const distance = 35 + Math.random() * 25; // 40+35 → 35+25
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;

      gsap.to(spark, {
        x: targetX,
        y: targetY,
        duration: 0.35 + Math.random() * 0.2, // 0.4+0.25 → 0.35+0.2 (更快)
        ease: 'power3.out'
      });

      gsap.to(spark.scale, {
        x: 1.3,                // 1.5 → 1.3
        y: 1.3,
        duration: 0.12,        // 0.15 → 0.12
        ease: 'power2.out'
      });

      gsap.to(spark, {
        alpha: 0,
        duration: 0.3,         // 0.35 → 0.3
        delay: 0.12,           // 0.15 → 0.12
        ease: 'power2.in',
        onComplete: () => {
          const idx = this.activeSparks.indexOf(spark);
          if (idx > -1) this.activeSparks.splice(idx, 1);
          this.returnSparkGraphics(spark);
        }
      });
    }
  }

  /**
   * 🌀 冲击波 AOE 效果 - 精致薄环版
   */
  shockwaveAOE(x, y, radius) {
    // 🚀 限制并发特效
    if (this.activeRings.length >= this.maxConcurrentFX) {
      return;
    }

    // 创建 2 层冲击波环（减少层数）
    for (let layer = 0; layer < 2; layer++) { // 3 → 2
      const wave = this.getRingGraphics();
      wave.clear();
      wave.circle(0, 0, radius * 0.3);
      wave.stroke({ 
        width: 2,              // 8-layer*2 → 2 (细线条)
        color: layer === 0 ? 0xFFFFFF : ENERGY(), 
        alpha: 0.6             // 0.8 → 0.6 (-25%)
      });
      wave.x = x;
      wave.y = y;
      wave.scale.set(0.1);

      // 极微妙的光晕（减少 60%）
      wave.filters = [
        new GlowFilter({
          distance: 4,                     // 10 → 4 (-60%)
          outerStrength: Math.max(0.5, 1.0 - layer * 0.3), // 2.5-layer*0.5 → 1.0-layer*0.3
          color: ENERGY(),
          quality: 0.1,                    // 0.2 → 0.1
        })
      ];

      this.glowContainer.addChild(wave);
      this.activeRings.push(wave);

      const delay = layer * 0.04;          // 0.05 → 0.04
      const duration = 0.4 + layer * 0.08; // 0.5+layer*0.1 → 0.4+layer*0.08 (更快)

      gsap.to(wave.scale, {
        x: radius / (radius * 0.3),
        y: radius / (radius * 0.3),
        duration,
        delay,
        ease: 'power2.out'
      });

      gsap.to(wave, {
        alpha: 0,
        duration: duration * 0.7,
        delay: delay + duration * 0.3,
        ease: 'power2.in',
        onComplete: () => {
          const idx = this.activeRings.indexOf(wave);
          if (idx > -1) this.activeRings.splice(idx, 1);
          this.returnRingGraphics(wave);
        }
      });
    }

    // 中心闪光（更小更微妙）
    const centerFlash = this.getRingGraphics();
    centerFlash.clear();
    centerFlash.circle(0, 0, radius * 0.4); // 0.5 → 0.4 (更小)
    centerFlash.fill({ color: 0xFFFFFF, alpha: 0.4 }); // 0.6 → 0.4 (更微妙)
    centerFlash.x = x;
    centerFlash.y = y;
    centerFlash.scale.set(0);

    this.lineContainer.addChild(centerFlash);
    this.activeRings.push(centerFlash);

    gsap.to(centerFlash.scale, {
      x: 1.0,                  // 1.2 → 1.0 (更小)
      y: 1.0,
      duration: 0.15,          // 0.2 → 0.15 (更快)
      ease: 'back.out(2)'
    });

    gsap.to(centerFlash, {
      alpha: 0,
      duration: 0.25,          // 0.3 → 0.25 (更快)
      delay: 0.08,             // 0.1 → 0.08
      ease: 'power2.in',
      onComplete: () => {
        const idx = this.activeRings.indexOf(centerFlash);
        if (idx > -1) this.activeRings.splice(idx, 1);
        this.returnRingGraphics(centerFlash);
      }
    });
  }

  /**
   * 🧹 清理所有活跃特效
   */
  cleanup() {
    this.activeTimelines.forEach(timeline => {
      timeline.kill();
    });
    this.activeTimelines = [];

    this.activeLines.forEach(g => this.returnLineGraphics(g));
    this.activeGlows.forEach(g => this.returnGlowGraphics(g));
    this.activeScans.forEach(g => this.returnScanGraphics(g));
    this.activeSymbolGlows.forEach(g => this.returnSymbolGlowGraphics(g));
    this.activeSparks.forEach(g => this.returnSparkGraphics(g));
    this.activeRings.forEach(g => this.returnRingGraphics(g));

    this.activeLines = [];
    this.activeGlows = [];
    this.activeScans = [];
    this.activeSymbolGlows = [];
    this.activeSparks = [];
    this.activeRings = [];
  }

  /**
   * 💥 爆炸效果 - 精致薄环版
   */
  explosion(x, y, scale = 1.0) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      console.warn('[FXSystem] Invalid explosion coordinates:', x, y);
      return;
    }

    // 🚀 限制并发特效
    if (this.activeRings.length >= this.maxConcurrentFX) {
      return;
    }

    // 主爆炸环（细线条）
    const ring = this.getRingGraphics();
    ring.x = x;
    ring.y = y;
    ring.scale.set(0.4 * scale); // 0.3 → 0.4 (起始稍大)
    ring.circle(0, 0, 32);       // 40 → 32 (更小半径)
    ring.stroke({
      width: 2,                  // 6 → 2 (细线条，与 UI 一致)
      color: ENERGY(),
      alpha: 0.7,                // 0.9 → 0.7 (-22%)
    });

    this.glowContainer.addChild(ring);
    this.activeRings.push(ring);

    gsap.to(ring.scale, {
      x: 1.8 * scale,            // 2.2 → 1.8 (更小扩散)
      y: 1.8 * scale,
      duration: 0.4,             // 0.5 → 0.4 (更快)
      ease: 'power2.out',
    });

    gsap.to(ring, {
      alpha: 0,
      duration: 0.35,            // 0.4 → 0.35 (更快淡出)
      delay: 0.08,               // 0.1 → 0.08
      ease: 'power2.in',
      onComplete: () => {
        const idx = this.activeRings.indexOf(ring);
        if (idx > -1) this.activeRings.splice(idx, 1);
        this.returnRingGraphics(ring);
      },
    });

    // 锐利粒子爆发（线条而非圆，更少数量）
    const particleCount = Math.min(6, Math.floor(6 * scale)); // 12 → 6 (-50%)
    const colors = [ENERGY(), PRIMARY(), ACCENT()];

    for (let i = 0; i < particleCount; i++) {
      const spark = this.getSparkGraphics();
      const colorIdx = Math.floor(Math.random() * colors.length);
      
      // 小型锐利粒子（线条而非圆）
      const length = 4 + Math.random() * 4;
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      
      spark.moveTo(0, 0);
      spark.lineTo(length, 0);
      spark.stroke({ 
        width: 1.5, 
        color: colors[colorIdx], 
        alpha: 0.8,
        cap: 'round'
      });
      
      spark.x = x;
      spark.y = y;
      spark.rotation = angle;
      spark.scale.set(0.8 + Math.random() * 0.4);

      this.scanContainer.addChild(spark);
      this.activeSparks.push(spark);

      const distance = (45 + Math.random() * 40) * scale; // 60+70 → 45+40 (更短距离)
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;

      gsap.to(spark, {
        x: targetX,
        y: targetY,
        alpha: 0,
        duration: 0.4 + Math.random() * 0.2, // 0.55+0.25 → 0.4+0.2 (更快)
        ease: 'power2.out',
        onComplete: () => {
          const idx = this.activeSparks.indexOf(spark);
          if (idx > -1) this.activeSparks.splice(idx, 1);
          this.returnSparkGraphics(spark);
        },
      });
    }
  }

  /**
   * ⚔️ 斩击效果 - 精致细线版
   */
  slash(x, y, strength = 1.0) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      console.warn('[FXSystem] Invalid slash coordinates:', x, y);
      return;
    }

    // 🚀 限制并发特效
    if (this.activeSparks.length >= this.maxConcurrentFX) {
      return;
    }

    const slashGraphic = this.getSparkGraphics();
    slashGraphic.x = x;
    slashGraphic.y = y;
    slashGraphic.rotation = (Math.random() - 0.5) * 0.6;

    // 根据强度调整参数（更少线条，更细）
    const isStrong = strength > 1.5;
    const count = isStrong ? 6 : 4;       // 9/6 → 6/4 (更少线条)
    const lenBase = isStrong ? 48 : 32;   // 56/40 → 48/32 (更短)
    const lineWidth = isStrong ? 2 : 1.5; // 4/3 → 2/1.5 (更细，与 UI 一致)
    const color = isStrong ? ENERGY() : 0xfff07a;

    // 绘制斩击线条（更锐利）
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const length = lenBase + Math.random() * (isStrong ? 24 : 16); // 32/22 → 24/16

      // 外层线条
      slashGraphic.moveTo(0, 0);
      slashGraphic.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
      slashGraphic.stroke({ 
        width: lineWidth, 
        color, 
        alpha: 0.85,         // 0.95 → 0.85 (更微妙)
        cap: 'round' 
      });

      // 内层高光（更细更短）
      slashGraphic.moveTo(0, 0);
      slashGraphic.lineTo(
        Math.cos(angle) * (length * 0.6), // 0.7 → 0.6
        Math.sin(angle) * (length * 0.6)
      );
      slashGraphic.stroke({ 
        width: Math.max(0.5, lineWidth - 1), // 更细的内层
        color: 0xffffff, 
        alpha: 0.75,         // 0.9 → 0.75
        cap: 'round' 
      });
    }

    this.scanContainer.addChild(slashGraphic);
    this.activeSparks.push(slashGraphic);

    // 动画：扩大 + 旋转 + 淡出（更快更微妙）
    const duration = isStrong ? 0.24 : 0.18;            // 0.28/0.22 → 0.24/0.18
    const scaleIncrement = isStrong ? 0.04 : 0.03;      // 0.06/0.05 → 0.04/0.03 (更微妙)
    const rotationIncrement = isStrong ? 0.06 : 0.04;   // 0.08/0.06 → 0.06/0.04

    gsap.to(slashGraphic, {
      alpha: 0,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        slashGraphic.scale.x += scaleIncrement;
        slashGraphic.scale.y += scaleIncrement;
        slashGraphic.rotation += rotationIncrement * (Math.random() < 0.5 ? -1 : 1);
      },
      onComplete: () => {
        const idx = this.activeSparks.indexOf(slashGraphic);
        if (idx > -1) this.activeSparks.splice(idx, 1);
        this.returnSparkGraphics(slashGraphic);
      },
    });
  }

  /**
   * ⚡ 连锁闪电效果 - 优化版（从 BulletSystem 移至此处）
   */
  chainLightning(x1, y1, x2, y2) {
    if (!Number.isFinite(x1) || !Number.isFinite(y1) || 
        !Number.isFinite(x2) || !Number.isFinite(y2)) {
      console.warn('[FXSystem] Invalid chain lightning coordinates');
      return;
    }

    // 🚀 限制并发特效
    if (this.activeSparks.length >= this.maxConcurrentFX) {
      return;
    }

    const bolt = this.getSparkGraphics();
    const dx = x2 - x1;
    const dy = y2 - y1;
    const segments = 8;

    bolt.moveTo(x1, y1);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const midX = x1 + dx * t + (Math.random() - 0.5) * 20;
      const midY = y1 + dy * t + (Math.random() - 0.5) * 20;
      bolt.lineTo(midX, midY);
    }

    bolt.stroke({ 
      width: 3, 
      color: 0xffff00, 
      alpha: 1, 
      cap: 'round', 
      join: 'round' 
    });

    // 外层光晕
    bolt.moveTo(x1, y1);
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const midX = x1 + dx * t + (Math.random() - 0.5) * 20;
      const midY = y1 + dy * t + (Math.random() - 0.5) * 20;
      bolt.lineTo(midX, midY);
    }

    bolt.stroke({ 
      width: 6, 
      color: 0xffff00, 
      alpha: 0.4, 
      cap: 'round', 
      join: 'round' 
    });

    this.scanContainer.addChild(bolt);
    this.activeSparks.push(bolt);

    gsap.to(bolt, {
      alpha: 0,
      duration: 0.3,
      ease: 'power2.out',
      onComplete: () => {
        const idx = this.activeSparks.indexOf(bolt);
        if (idx > -1) this.activeSparks.splice(idx, 1);
        this.returnSparkGraphics(bolt);
      },
    });
  }

  /**
   * 🗑️ 销毁系统
   */
  destroy() {
    this.cleanup();

    [...this.linePool, ...this.glowPool, ...this.scanPool, ...this.symbolGlowPool, ...this.sparkPool, ...this.ringPool]
      .forEach(g => g.destroy());

    this.linePool = [];
    this.glowPool = [];
    this.scanPool = [];
    this.symbolGlowPool = [];
    this.sparkPool = [];
    this.ringPool = [];

    this.lineContainer.destroy({ children: true });
    this.glowContainer.destroy({ children: true });
    this.scanContainer.destroy({ children: true });
    this.symbolContainer.destroy({ children: true });
  }
}

/**
 * 🔧 辅助函数：沿路径获取点
 */
function getPointOnPath(points, progress) {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  
  const segments = [];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const length = Math.sqrt(dx * dx + dy * dy);
    segments.push({ start: points[i - 1], end: points[i], length });
    totalLength += length;
  }

  const targetLength = progress * totalLength;
  let accumulatedLength = 0;
  
  for (const segment of segments) {
    if (accumulatedLength + segment.length >= targetLength) {
      const segmentProgress = (targetLength - accumulatedLength) / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * segmentProgress,
        y: segment.start.y + (segment.end.y - segment.start.y) * segmentProgress,
      };
    }
    accumulatedLength += segment.length;
  }

  return points[points.length - 1];
}
