import { Application, Container, Graphics, TilingSprite } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { themeManager } from '../systems/ThemeManager.js';

export class GameApp {
  constructor() {
    this.app = new Application();
    this.gameRoot = new Container(); // 🚀 新增：游戏根容器 (用于整体震动)
    this.gameLayer = new Container(); // 实体层
    this.fxLayer = new Container();   // 特效层
    this.uiLayer = new Container();
    
    // 组装游戏场景结构
    this.gameRoot.addChild(this.gameLayer);
    this.gameRoot.addChild(this.fxLayer); // 特效在实体之上
    this._shakeTween = null;
    this._level = 1;
    this._glowFilter = null;
    this._bgTween = null;
    // 需求：关掉全局抖动效果（只在击杀僵尸时做局部抖动）
    this.enableGlobalShake = false;
  }

  async init(options = {}) {
    const fallbackContainer = document.getElementById('game-stage');
    const resizeTo = options?.resizeTo ?? fallbackContainer;
    const container =
      typeof resizeTo === 'string' ? document.getElementById(resizeTo) : resizeTo;
    if (!container) {
      throw new Error('[GameApp.init] mount container not found');
    }
    await this.app.init({
      background: themeManager.getColor('background'),
      resizeTo: container,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
    });

    container.appendChild(this.app.canvas);

    this.createBackground();

    this.applyGlow(themeManager.getColor('primary'));

    this.app.stage.addChild(this.bgLayer);
    this.app.stage.addChild(this.gameLayer);
    this.app.stage.addChild(this.fxLayer); // 🚀 确保特效层在游戏层之上
    this.app.stage.addChild(this.uiLayer);

    themeManager.subscribe((theme) => this.updateTheme(theme));
  }

  createBackground() {
    this.bgLayer = new Container();

    // 1) 深色渐变底（更耐看，不那么“纯黑”）
    this.vignette = new Graphics();
    this.vignette.rect(0, 0, this.app.screen.width, this.app.screen.height);
    this.vignette.fill({ color: 0x000000, alpha: 0.35 });
    // 中心光晕
    this.vignette.circle(this.app.screen.width * 0.25, this.app.screen.height * 0.25, Math.min(this.app.screen.width, this.app.screen.height) * 0.55);
    this.vignette.fill({ color: 0x07111f, alpha: 0.22 });
    this.bgLayer.addChild(this.vignette);

    const g = new Graphics();
    const size = 64;
    // g.lineStyle({ width: 1, color: 0x0f172a, alpha: 0.6 }); // ❌ Pixi v8 Deprecated
    g.rect(0, 0, size, size);
    g.stroke({ width: 1, color: 0x0f172a, alpha: 0.6 }); // ✅ Pixi v8
    g.moveTo(0, size / 2);
    g.lineTo(size, size / 2);
    g.moveTo(size / 2, 0);
    g.lineTo(size / 2, size);
    g.alpha = 0.12;
    g.stroke({ width: 1, color: 0x0f172a, alpha: 0.6 }); // ✅ Pixi v8
    const tex = this.app.renderer.generateTexture(g);
    g.destroy(true);
    this.bgTile = new TilingSprite({
      texture: tex,
      width: this.app.screen.width,
      height: this.app.screen.height,
    });
    this.bgTile.alpha = 0.4;
    this.bgLayer.addChild(this.bgTile);

    // 2) 扫描线（赛博味更强）
    const scanG = new Graphics();
    const scanH = 8;
    scanG.rect(0, 0, size, scanH);
    scanG.fill({ color: 0xffffff, alpha: 0.06 });
    scanG.rect(0, scanH, size, scanH);
    scanG.fill({ color: 0x000000, alpha: 0 });
    const scanTex = this.app.renderer.generateTexture(scanG);
    scanG.destroy(true);
    this.scanlines = new TilingSprite({
      texture: scanTex,
      width: this.app.screen.width,
      height: this.app.screen.height,
    });
    this.scanlines.alpha = 0.55;
    this.bgLayer.addChild(this.scanlines);

    // 3) 微弱噪点（避免色块死板）
    const noise = new Graphics();
    const dots = 140;
    for (let i = 0; i < dots; i += 1) {
      noise.circle(Math.random() * size, Math.random() * size, Math.random() * 1.2 + 0.4);
      noise.fill({ color: 0xffffff, alpha: 0.04 });
    }
    const noiseTex = this.app.renderer.generateTexture(noise);
    noise.destroy(true);
    this.noiseTile = new TilingSprite({
      texture: noiseTex,
      width: this.app.screen.width,
      height: this.app.screen.height,
    });
    this.noiseTile.alpha = 0.28;
    this.bgLayer.addChild(this.noiseTile);

    // 慢速滚动模拟深空（保存 tween，便于按关卡调速）
    this._bgTween?.kill?.();
    this._bgTween = gsap.to(this.bgTile.tilePosition, {
      x: '+=32',
      y: '+=16',
      duration: 60,
      repeat: -1,
      ease: 'none',
    });

    // 扫描线慢速下移 + 噪点轻微漂移
    gsap.to(this.scanlines.tilePosition, { y: '+=64', duration: 8, repeat: -1, ease: 'none' });
    gsap.to(this.noiseTile.tilePosition, { x: '+=18', y: '+=10', duration: 12, repeat: -1, ease: 'none' });
  }

  applyGlow(color) {
    if (!this._glowFilter) {
      this._glowFilter = new GlowFilter({
        distance: 10,
        outerStrength: 2,
        innerStrength: 0,
        color,
        quality: 0.1,
      });
      this.gameLayer.filters = [this._glowFilter];
    }
    this._glowFilter.color = color;
    // 随关卡轻微增强霓虹强度
    this._glowFilter.outerStrength = Math.min(3.2, 1.9 + (this._level - 1) * 0.22);
  }

  updateTheme(theme) {
    if (!theme) return;
    this.app.renderer.background.color = parseInt(theme.background.replace('#', '0x'), 16);
    if (this.bgTile) {
      this.bgTile.tint = parseInt(theme.surface.replace('#', '0x'), 16);
    }
    // 扫描线/噪点跟随主题主色轻微偏色
    if (this.scanlines) {
      this.scanlines.tint = parseInt(theme.primary.replace('#', '0x'), 16);
    }
    if (this.noiseTile) {
      this.noiseTile.tint = parseInt(theme.text.replace('#', '0x'), 16);
    }
    this.applyGlow(parseInt(theme.primary.replace('#', '0x'), 16));
  }

  setLevelVisual(level = 1) {
    this._level = Math.max(1, level);
    if (this.bgTile) {
      this.bgTile.alpha = Math.min(0.55, 0.28 + (this._level - 1) * 0.05);
    }
    if (this.scanlines) {
      this.scanlines.alpha = Math.min(0.7, 0.48 + (this._level - 1) * 0.04);
    }
    if (this.noiseTile) {
      this.noiseTile.alpha = Math.min(0.42, 0.22 + (this._level - 1) * 0.03);
    }
    if (this._bgTween) {
      this._bgTween.timeScale(Math.min(2.2, 1 + (this._level - 1) * 0.18));
    }
    // 触发 glow 强度刷新
    const primary = themeManager.getColor('primary');
    if (primary) this.applyGlow(parseInt(primary.replace('#', '0x'), 16));
  }

  shake(intensity = 5) {
    if (!this.enableGlobalShake) return;
    if (!this.gameLayer) return;

    if (this._shakeTween) {
      this._shakeTween.kill();
    }

    const layer = this.gameLayer;
    const applyOffset = () => {
      const offsetX = (Math.random() - 0.5) * intensity * 2;
      const offsetY = (Math.random() - 0.5) * intensity * 2;
      layer.position.set(offsetX, offsetY);
    };

    this._shakeTween = gsap.to({}, {
      duration: 0.35,
      ease: 'power2.out',
      repeat: 1,
      onUpdate: applyOffset,
      onComplete: () => {
        layer.position.set(0, 0);
        this._shakeTween = null;
      },
    });

    applyOffset();
  }

  // 只抖指定容器（用于“中奖只抖僵尸区域 + boss 区域”）
  shakeTargets(targets = [], intensity = 5) {
    const list = (targets || []).filter(Boolean);
    if (!list.length) return;
    // 复用全局 tween（同一时刻只跑一次）
    if (this._shakeTween) this._shakeTween.kill();

    const originals = list.map((t) => ({ t, x: t.x, y: t.y }));
    const applyOffset = () => {
      originals.forEach(({ t, x, y }) => {
        const ox = (Math.random() - 0.5) * intensity * 2;
        const oy = (Math.random() - 0.5) * intensity * 2;
        t.position?.set?.(x + ox, y + oy);
      });
    };

    this._shakeTween = gsap.to({}, {
      duration: 0.28,
      ease: 'power2.out',
      repeat: 1,
      onUpdate: applyOffset,
      onComplete: () => {
        originals.forEach(({ t, x, y }) => t.position?.set?.(x, y));
        this._shakeTween = null;
      },
    });
    applyOffset();
  }

  get stage() {
    return this.app?.stage;
  }

  get ticker() {
    return this.app?.ticker;
  }
}

export const game = new GameApp();
