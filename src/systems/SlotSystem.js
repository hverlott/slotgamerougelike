import { Container, Graphics, Text, Point, Sprite, Texture } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';

import { themeManager } from './ThemeManager.js';
const colorInt = (hex) => parseInt(hex.replace('#', '0x'), 16);
const PRIMARY = () => colorInt(themeManager.getColor('primary'));
const ACCENT = () => colorInt(themeManager.getColor('accent'));
const ENERGY = () => colorInt(themeManager.getColor('win'));
const SECONDARY = () => colorInt(themeManager.getColor('secondary'));
const BACKGROUND = () => colorInt(themeManager.getColor('surface'));

// PAYTABLE 使用“倍率”而不是固定金币，真实赢分 = bet * multiplier
const PAYTABLE = { 0: 0, 1: 0.5, 2: 1, 3: 2, 4: 5 };
const MAX_PARTICLES = 50;
const SYMBOL_TYPES = [0, 1, 2, 3, 4];

export class SlotSystem extends Container {
  constructor(app, options = {}) {
    super();
    this.app = app;

    this.reelCount = 3;
    this.visibleCount = 3;
    this.symbolWidth = options.symbolWidth ?? 120;
    this.symbolHeight = options.symbolHeight ?? 110;
    this.reelSpacing = options.reelSpacing ?? 18;
    this.poolSize = this.visibleCount + 2; // 3 可见 + 2 缓冲
    this.spinSpeed = options.spinSpeed ?? 30; // 稍微调快一点

    this.reels = [];
    this.isSpinning = false;
    this.totalWidth =
      this.reelCount * (this.symbolWidth + this.reelSpacing) - this.reelSpacing;
    this.totalHeight = this.visibleCount * this.symbolHeight;

    this.payLines = [
      [{ c: 0, r: 0 }, { c: 1, r: 0 }, { c: 2, r: 0 }],
      [{ c: 0, r: 1 }, { c: 1, r: 1 }, { c: 2, r: 1 }],
      [{ c: 0, r: 2 }, { c: 1, r: 2 }, { c: 2, r: 2 }],
      [{ c: 0, r: 0 }, { c: 0, r: 1 }, { c: 0, r: 2 }],
      [{ c: 1, r: 0 }, { c: 1, r: 1 }, { c: 1, r: 2 }],
      [{ c: 2, r: 0 }, { c: 2, r: 1 }, { c: 2, r: 2 }],
      [{ c: 0, r: 0 }, { c: 1, r: 1 }, { c: 2, r: 2 }],
      [{ c: 0, r: 2 }, { c: 1, r: 1 }, { c: 2, r: 0 }],
      [{ c: 1, r: 0 }, { c: 0, r: 1 }, { c: 1, r: 2 }],
    ];

    this.onWin = null;
    // 关卡越高，派彩倍率越低（由 main 驱动设置）
    this.payoutScale = 1;
    // 中奖震动：由 main 注入（只抖僵尸区域 + boss 区域）
    this.onShake = null;
    this.activeTweens = [];
    this.particlePool = [];
    this.activeParticles = [];

    // --- 核心修复：容器层级重构 ---
    // 1. 创建滚轮容器 (被遮罩)
    this.reelContainer = new Container();
    this.addChild(this.reelContainer);

    // 2. 创建遮罩 (专门遮罩 reelContainer)
    this.createMask();

    // 3. 创建特效层 (在遮罩之上，防止特效被切掉，或者根据需求在下)
    // 这里我们把连线层放在上面，不遮罩，或者单独遮罩
    this.lineLayer = new Graphics();
    this.fxLayer = new Container();
    this.winText = new Text({
      text: '',
      style: {
        fill: ENERGY,
        fontSize: 52,
        fontWeight: '800',
        fontFamily: 'Orbitron, Roboto Mono, monospace',
        align: 'center',
      },
    });
    this.winText.anchor?.set?.(0.5);
    this.winText.visible = false;

    this.addChild(this.lineLayer);
    this.addChild(this.fxLayer);
    this.addChild(this.winText);
    
    // 初始化滚轮内容
    this.createReels();

    this.update = this.update.bind(this);
    this.app.app.ticker.add(this.update);

    themeManager.subscribe((theme) => this.updateTheme(theme));
  }

  createMask() {
    const mask = new Graphics();
    mask.rect(0, 0, this.totalWidth, this.totalHeight);
    mask.fill({ color: 0xffffff, alpha: 1 });
    this.addChild(mask); // 必须 add 才能生效
    this.reelContainer.mask = mask; // 仅 Mask 滚轮部分
    // 注意：特效层 fxLayer 如果不需要遮罩（比如烟花飞出），就不要设 mask
  }

  createReels() {
    for (let i = 0; i < this.reelCount; i += 1) {
      const singleReel = new Container();
      singleReel.x = i * (this.symbolWidth + this.reelSpacing);

      const symbols = [];
      for (let j = 0; j < this.poolSize; j += 1) {
        const symbol = this.createSymbol(this.randomSymbol());
        // j=0 -> y=-110 (缓冲), j=1 -> y=0 (可见), ...
        symbol.y = (j - 1) * this.symbolHeight; 
        singleReel.addChild(symbol);
        symbols.push(symbol);
      }

      this.reelContainer.addChild(singleReel); // 加到内部容器
      this.reels.push({
        container: singleReel,
        symbols,
        state: 'idle', // idle | pre-spin | spinning | stopping | aligning
        targetQueue: [],
        targetResults: null,
        alignPromise: null,
        alignResolve: null,
        alignPromiseStarted: false,
      });
    }
  }

  createSymbol(value) {
    const holder = new Container();
    const bg = new Graphics();
    const icon = new Sprite();
    icon.anchor?.set?.(0.5);
    icon.x = this.symbolWidth / 2;
    icon.y = this.symbolHeight / 2;
    icon.scale.set(0.6);

    holder.addChild(bg);
    holder.addChild(icon);
    holder.bg = bg;
    holder.icon = icon;

    this.updateSymbol(holder, value);
    return holder;
  }

  updateSymbol(symbol, value) {
    symbol.value = value;
    const borderColor = this.isSpinning ? PRIMARY() : SECONDARY();
    symbol.bg.clear();
    // 稍微缩小一点背景，留出间隙感
    symbol.bg.roundRect(2, 2, this.symbolWidth - 4, this.symbolHeight - 4, 14);
    symbol.bg.fill({ color: BACKGROUND(), alpha: 0.3 });
    symbol.bg.stroke({ width: 3, color: borderColor, alpha: 0.9 });
    this.drawSymbol(symbol.icon, value);
  }

  drawSymbol(icon, value) {
    // value -> texture alias（由 main.js 的 Assets.load 预加载）
    const tex =
      value === 1
        ? Texture.from('slot_low')
        : value === 2
          ? Texture.from('slot_mid')
          : value === 3
            ? Texture.from('slot_high')
            : value === 4
              ? Texture.from('slot_wild')
              : Texture.EMPTY;

    icon.texture = tex;
    icon.visible = value !== 0;
    icon.alpha = value === 0 ? 0 : 1;

    // 常驻高亮：High/Wild
    if (value === 4 || value === 3) {
      const color = value === 4 ? ACCENT() : ENERGY();
      icon.filters = [
        new GlowFilter({
          distance: 10,
          outerStrength: 2.4,
          color,
          quality: 0.12,
        }),
      ];
    } else {
      icon.filters = null;
    }
  }

  randomSymbol() {
    return SYMBOL_TYPES[Math.floor(Math.random() * SYMBOL_TYPES.length)];
  }

  normalizeResults(results) {
    const normalized = [];
    for (let i = 0; i < this.reelCount; i += 1) {
      const col = Array.isArray(results?.[i]) ? [...results[i]] : [];
      while (col.length < this.visibleCount) {
        col.push(this.randomSymbol());
      }
      normalized.push(col.slice(0, this.visibleCount));
    }
    return normalized;
  }

  clearEffects() {
    this.lineLayer.clear();
    this.lineLayer.alpha = 0;
    this.lineLayer.visible = false;
    this.lineLayer.filters = null;
    this.winText.visible = false;
    this.winText.text = '';
    // 若上一轮外部仍在 await fxDone，避免卡住
    this._winFxResolve?.();
    this._winFxResolve = null;
    this._winFxDone = null;
    this.activeParticles.slice().forEach((p) => this.recycleParticle(p));
    this.fxLayer.removeChildren();
    gsap.killTweensOf(this.lineLayer);
    gsap.killTweensOf(this.winText);
    gsap.killTweensOf(this.fxLayer.children);
    this.activeTweens.forEach((t) => t.kill());
    this.activeTweens = [];
    this.activeParticles = [];
  }

  startSpin() {
    if (this.isSpinning) return;
    this.clearEffects();
    this.isSpinning = true;

    this.reels.forEach((reel, i) => {
      reel.state = 'pre-spin'; // 关键：先进入准备状态，不让 update 跑逻辑
      reel.targetQueue = [];
      reel.targetResults = null;
      reel.alignPromise = null;
      reel.alignResolve = null;
      reel.alignPromiseStarted = false;
      
      // 重置图标（可选）
      // reel.symbols.forEach((s) => { ... });

      // 蓄力动画：错峰启动
      const delay = i * 0.05;
      // 保存 tween，stopSpin 时需要 kill，避免与 stopping 阶段的滚动/注入逻辑打架导致超时
      reel.preSpinTween?.kill?.();
      reel.preSpinTween = gsap.fromTo(
        reel.symbols,
        { y: (idx, sym) => sym.y }, // 从当前位置
        {
          y: (idx, sym) => sym.y - this.symbolHeight * 0.3, // 向上拉 30%
          duration: 0.3,
          ease: 'back.in(2)',
          delay: delay,
          onComplete: () => {
            // 动画结束后，正式开始滚动
            // 关键：如果外部已经触发 stopSpin 并将状态改为 stopping，不要覆盖
            if (reel.state === 'pre-spin') {
              reel.state = 'spinning';
            }
            reel.preSpinTween = null;
          },
        }
      );
    });
  }

  stopSpin(results, bet = 10) {
    const normalized = this.normalizeResults(results ?? []);
    this.currentBet = bet;
    const alignPromises = this.reels.map((reel, idx) => {
      // stopSpin 时必须干掉 pre-spin tween，否则 tween 会持续拉 y，导致 targetQueue 注入触发变慢甚至超时
      reel.preSpinTween?.kill?.();
      reel.preSpinTween = null;

      // 如果还在 pre-spin，强制切到 spinning 以便停止
      if (reel.state === 'pre-spin') reel.state = 'spinning';
      
      reel.state = 'stopping';
      reel.targetResults = normalized[idx];
      // 不再依赖“卷到顶端再注入目标”的队列机制（容易被 tween/帧抖动影响导致超时）
      // 真实体验：采用时间控制的减速/停轮，到点直接对齐并强制写入最终可见符号
      reel.targetQueue = [];
      reel.stopAt = performance.now() + 380 + idx * 140; // 依次停轮，整体约 0.7~1.0s
      reel.alignPromiseStarted = false;
      reel.stopStart = performance.now();
      
      reel.alignPromise = new Promise((res, rej) => {
        reel.alignResolve = res;
        reel.alignReject = rej;
      });
      return reel.alignPromise;
    });

    // 全局兜底：不提前 resolve（否则主逻辑会“结算完了但滚轮还在跑”）
    const hardTimeoutId = setTimeout(() => {
      this.reels.forEach((reel) => {
        if (reel.state === 'idle') return;
        if (!reel.alignPromiseStarted) reel.alignPromiseStarted = true;
        if (reel.state !== 'aligning') {
          try {
            this.alignReel(reel);
          } catch (e) {
            // ignore
          }
        }
        // 如果 gsap onComplete 未触发，再次强制释放
        setTimeout(() => reel.alignResolve?.(), 800);
      });
    }, 3000);

    return Promise.all(alignPromises)
      .then(() => {
        const actual = this.getVisibleGrid();
        console.log('Spin Complete.');
        return this.processWin(actual);
      })
      .catch((err) => {
        console.error('Slot realignment failed:', err);
        return { normalized, totalWin: 0, winLines: [] };
      })
      .finally(() => {
        clearTimeout(hardTimeoutId);
        this.isSpinning = false;
      });
  }

  update(delta) {
    const threshold = (this.visibleCount + 1) * this.symbolHeight; // 4 * 110 = 440
    const resetOffset = this.symbolHeight * this.poolSize; // 550

    this.reels.forEach((reel) => {
      // 只有 spinning 和 stopping 状态需要物理滚动
      if (reel.state !== 'spinning' && reel.state !== 'stopping') return;

      const dy = this.spinSpeed * delta;
      
      reel.symbols.forEach((symbol) => {
        symbol.y += dy;
        symbol.scale.y = 1.2; // 动态模糊拉伸

        // 循环逻辑：移出底部 -> 移回顶部
        if (symbol.y >= threshold) {
          symbol.y -= resetOffset;
          
          // 确保位置对齐，防止累计误差
          // 理想位置计算：基于当前索引重排（简化处理：只要保持间距即可）
          
          let nextVal = this.randomSymbol();
          // stopping 阶段保持随机，最终由 alignReel 强制对齐到 targetResults
          this.updateSymbol(symbol, nextVal);
        }
      });

      // 停止条件：到点直接对齐（更稳定、更像真实老虎机）
      if (reel.state === 'stopping' && !reel.alignPromiseStarted && reel.stopAt && performance.now() >= reel.stopAt) {
        reel.alignPromiseStarted = true;
        this.alignReel(reel);
      }
      // 强行超时保护 (防止死锁)
      else if (
        reel.state === 'stopping' &&
        !reel.alignPromiseStarted &&
        reel.stopStart &&
        performance.now() - reel.stopStart > 2000 // 2秒超时
      ) {
        reel.alignPromiseStarted = true;
        this.alignReel(reel);
      }
    });
  }

  alignReel(reel) {
    reel.state = 'aligning';
    // 按照 y 坐标排序，找到当前显示的图标顺序
    const sorted = [...reel.symbols].sort((a, b) => a.y - b.y);
    
    // 目标位置：-110, 0, 110, 220, 330
    const targets = [
      -this.symbolHeight,
      0,
      this.symbolHeight,
      2 * this.symbolHeight,
      3 * this.symbolHeight,
    ];

    let done = 0;
    const finishOne = () => {
      done += 1;
      if (done !== sorted.length) return;

      // 动画结束，最后一次强制校准数据
      // sorted[1], [2], [3] 是可见的 3 个
      if (reel.targetResults) {
        this.updateSymbol(sorted[1], reel.targetResults[0]);
        this.updateSymbol(sorted[2], reel.targetResults[1]);
        this.updateSymbol(sorted[3], reel.targetResults[2]);
      }
      // 边缘补丁
      this.updateSymbol(sorted[0], this.randomSymbol());
      this.updateSymbol(sorted[4], this.randomSymbol());

      reel.state = 'idle';
      reel.alignResolve?.();
    };

    sorted.forEach((sym, idx) => {
      gsap.to(sym, {
        y: targets[idx],
        // 直接恢复 Pixi 的 scale.y（不要用 scaleY，避免 GSAP 插件警告）
        duration: 0.5,
        ease: 'elastic.out(1, 0.5)',
        overwrite: true,
        onStart: () => {
          if (sym?.scale) sym.scale.y = 1;
        },
        onComplete: finishOne,
        onInterrupt: finishOne,
      });
    });
  }

  processWin(grid) {
    const winLines = this.checkWin(grid);
    const totalWin = winLines.reduce((sum, l) => sum + l.amount, 0);
    if (totalWin > 0) {
      this.showWinEffects(winLines, totalWin);
      this.onWin?.({ totalWin, winLines, grid });
    } else {
      // 没赢也给一个可 await 的 Promise，简化外部逻辑
      this._winFxDone = Promise.resolve();
    }
    return { normalized: grid, totalWin, winLines, fxDone: this._winFxDone };
  }

  checkWin(grid) {
    const lines = [];

    this.payLines.forEach((coords, idx) => {
      const symbols = coords.map(({ c, r }) => grid?.[c]?.[r]);
      if (symbols.some((v) => v === undefined)) return;

      const baseSymbol = symbols.find((v) => v !== 4);
      const target = baseSymbol ?? 4;

      const allMatch = symbols.every((v) => v === target || v === 4);
      if (!allMatch) return;

      const multiplier = PAYTABLE[target] ?? 0;
      if (multiplier <= 0) return;
      const bet = Number(this.currentBet ?? 10) || 10;
      const scale = Number(this.payoutScale ?? 1) || 1;
      const amount = multiplier * bet * scale;

      lines.push({
        index: idx,
        coords,
        symbol: target,
        multiplier,
        amount,
      });
    });

    return lines;
  }

  showWinEffects(winLines, totalWin) {
    this.drawWinLines(winLines);
    this.flashSymbols(winLines);
    this.showWinText(totalWin);
    this.spawnFireworks();
    this.onShake?.(totalWin >= 50 ? 20 : 5);
  }

  drawWinLines(winLines) {
    this.lineLayer.clear();
    this.lineLayer.alpha = 1;
    this.lineLayer.visible = true;
    // 使用 GlowFilter 时注意不要和 Mask 冲突，这里 fxLayer 没有 Mask 或者是独立的
    this.lineLayer.filters = [
      new GlowFilter({ distance: 10, outerStrength: 2, color: ENERGY(), quality: 0.1 }),
    ];

    winLines.forEach((line) => {
      const points = line.coords.map((coord) => this.getSymbolCenter(coord.c, coord.r));
      this.lineLayer.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        this.lineLayer.lineTo(points[i].x, points[i].y);
      }
      this.lineLayer.stroke({
        width: 6,
        color: 0xffffff,
        alpha: 1,
        cap: 'round',
        join: 'round'
      });
    });

    const flicker = gsap.to(this.lineLayer, {
      alpha: 0.2,
      duration: 0.1,
      yoyo: true,
      repeat: 5,
      ease: 'steps(1)',
    });
    this.activeTweens.push(flicker);
  }

  flashSymbols(winLines) {
    const flashed = new Set();
    const winningSymbols = [];
    const allSymbols = [];

    this.reels.forEach((reel, c) => {
      const sorted = [...reel.symbols].sort((a, b) => a.y - b.y);
      // 可见区域是索引 1, 2, 3
      sorted.slice(1, 4).forEach((s, idx) => allSymbols.push({ c, r: idx, symbol: s }));
    });

    winLines.forEach((line) => {
      line.coords.forEach(({ c, r }) => {
        const key = `${c}-${r}`;
        if (flashed.has(key)) return;
        flashed.add(key);
        const symbol = this.getSymbolFromGrid(c, r);
        if (!symbol) return;
        winningSymbols.push(symbol);
        
        // 闪烁特效
        symbol.icon.filters = [
          new GlowFilter({
            distance: 8,
            outerStrength: 2.5,
            color: ACCENT(),
            quality: 0.1,
          }),
        ];
        // 重要：不要 tween DisplayObject.scale（没有 PixiPlugin 会把 scale 覆盖成 number，导致 UI 变形）
        symbol.alpha = 1;
        const tween = gsap.to(symbol.scale, {
          x: 1.2,
          y: 1.2,
          duration: 0.2,
          yoyo: true,
          repeat: 3,
          onComplete: () => {
            symbol.scale.set(1);
            // 恢复常驻纹理/高亮（High/Wild）
            this.drawSymbol(symbol.icon, symbol.value);
          },
        });
        this.activeTweens.push(tween);
      });
    });

    // 非中奖压暗
    allSymbols.forEach(({ c, r, symbol }) => {
      const key = `${c}-${r}`;
      if (flashed.has(key)) return;
      const tween = gsap.to(symbol, {
        alpha: 0.3,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          symbol.alpha = 1;
        },
      });
      this.activeTweens.push(tween);
    });
  }

  showWinText(totalWin) {
    if (!this.winText) return;
    this.winText.visible = true;
    this.winText.text = `+${totalWin}`;
    this.winText.x = this.totalWidth / 2;
    this.winText.y = this.totalHeight / 2;
    this.winText.scale.set(0);
    this.winText.alpha = 1;

    // fxDone: 外部用它来等待“获奖金额展示完成”
    if (!this._winFxDone) {
      this._winFxDone = new Promise((resolve) => (this._winFxResolve = resolve));
    }

    // 同理：tween winText.scale.x/y
    const tween = gsap.to(this.winText.scale, {
      x: 1.2,
      y: 1.2,
      duration: 0.5,
      ease: 'back.out(1.7)',
      onComplete: () => {
        const fade = gsap.to(this.winText, {
          alpha: 0,
          duration: 0.3,
          delay: 0.5,
          onComplete: () => {
            this.winText.visible = false;
            this._winFxResolve?.();
            this._winFxResolve = null;
            this._winFxDone = null;
          },
        });
        this.activeTweens.push(fade);
      },
    });
    this.activeTweens.push(tween);
  }

  getPayoutOriginGlobal() {
    // 以 winText 为准（符合“中奖金额效果”的视觉来源）
    const local = new Point(this.totalWidth / 2, this.totalHeight / 2);
    if (this.winText?.visible) {
      local.x = this.winText.x;
      local.y = this.winText.y;
    }
    return this.toGlobal(local);
  }

  spawnFireworks() {
    const centerX = this.totalWidth / 2;
    const centerY = this.totalHeight / 2;
    const palette = [ACCENT(), ENERGY()];

    const batch = 15;
    for (let i = 0; i < batch; i += 1) {
      if (this.activeParticles.length >= MAX_PARTICLES) break;

      const particle = this.particlePool.pop() || new Graphics();
      particle.clear();
      const color = palette[Math.floor(Math.random() * palette.length)];
      particle.circle(0, 0, 4 + Math.random() * 4);
      particle.fill({ color, alpha: 1 });

      particle.x = centerX;
      particle.y = centerY;
      particle.alpha = 1;
      this.fxLayer.addChild(particle);
      this.activeParticles.push(particle);

      const angle = Math.random() * Math.PI * 2;
      const speed = 10 + Math.random() * 15;
      let vx = Math.cos(angle) * speed;
      let vy = Math.sin(angle) * speed;
      const gravity = 0.8;
      const friction = 0.92;

      const tween = gsap.to(particle, {
        duration: 1.0,
        ease: 'none',
        onUpdate: () => {
          vx *= friction;
          vy = vy * friction + gravity;
          particle.x += vx;
          particle.y += vy;
          particle.alpha -= 0.015;
        },
        onComplete: () => {
          this.recycleParticle(particle);
        },
      });
      this.activeTweens.push(tween);
    }
  }

  recycleParticle(particle) {
    const idx = this.activeParticles.indexOf(particle);
    if (idx >= 0) this.activeParticles.splice(idx, 1);
    particle.alpha = 0;
    particle.parent?.removeChild?.(particle);
    if (this.particlePool.length < MAX_PARTICLES) {
      this.particlePool.push(particle);
    }
  }

  getSymbol(col, row) {
    return this.reels?.[col]?.symbols?.[row];
  }

  getSymbolFromGrid(col, row) {
    const reel = this.reels[col];
    if (!reel) return null;
    const sorted = [...reel.symbols].sort((a, b) => a.y - b.y);
    return sorted[row + 1] ?? null; 
  }

  getSymbolCenter(col, row) {
    const symbol = this.getSymbolFromGrid(col, row);
    if (!symbol) return { x: 0, y: 0 };
    const reel = this.reels[col];
    // reel.container.x 是相对 reelContainer 的，reelContainer 相对 SlotSystem 是 (0,0)
    const x = reel.container.x + this.symbolWidth / 2;
    const y = symbol.y + this.symbolHeight / 2;
    return { x, y };
  }

  getVisibleGrid() {
    const grid = [];
    for (let c = 0; c < this.reelCount; c += 1) {
      const sorted = [...this.reels[c].symbols].sort((a, b) => a.y - b.y);
      grid[c] = [sorted[1].value, sorted[2].value, sorted[3].value];
    }
    return grid;
  }

  updateTheme(theme) {
    this.reels.forEach((reel) => {
      reel.symbols.forEach((symbol) => this.updateSymbol(symbol, symbol.value));
    });
    if (this.winText) this.winText.style.fill = theme.win;
    if (this.lineLayer) this.lineLayer.tint = colorInt(theme.win.replace('#', '0x'));
  }
}