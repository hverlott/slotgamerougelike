import { Container, Graphics, Text } from 'pixi.js';
import gsap from 'gsap';
import { themeManager } from './ThemeManager.js';

const colorInt = (hex) => parseInt(String(hex ?? '#ffffff').replace('#', '0x'), 16);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// 顶部 HUD（参考效果图：顶部按钮 + 长条进度 + 右侧计数）
export class HUDSystem extends Container {
  constructor(game, options = {}) {
    super();
    this.game = game;
    this.opts = options;

    this.padding = options.padding ?? 14;
    this.height = options.height ?? 64;
    this.width = options.width ?? 720; // 实际会根据 screen 自适应

    this.barPct = 1;
    this._blinkTween = null;

    this.build();
    this.updateTheme(themeManager.currentTheme);
    themeManager.subscribe((theme) => this.updateTheme(theme));
  }

  build() {
    this.bg = new Graphics();
    this.addChild(this.bg);

    // 左侧按钮区
    this.btnLayer = new Container();
    this.addChild(this.btnLayer);
    this.btnPause = this.makeMiniBtn('⏸', 'PAUSE');
    this.btnPlay = this.makeMiniBtn('▶', 'PLAY');
    this.btnX2 = this.makeMiniBtn('x2', 'SPEED');
    this.btnPlay.x = 54;
    this.btnX2.x = 108;
    this.btnLayer.addChild(this.btnPause, this.btnPlay, this.btnX2);

    // 中央进度条（蓝色底条 + 填充）
    this.barBack = new Graphics();
    this.barFill = new Graphics();
    this.addChild(this.barBack, this.barFill);

    // 左侧小图标
    this.icon = new Text({
      text: '☠',
      style: {
        fontFamily: 'Segoe UI, Arial',
        fontSize: 22,
        fontWeight: '900',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      },
    });
    this.icon.anchor?.set?.(0.5);
    this.addChild(this.icon);

    // 右侧计数
    this.rightLayer = new Container();
    this.addChild(this.rightLayer);

    this.txtCoins = this.makeRightStat('💰', '0');
    this.txtKills = this.makeRightStat('⭐', '0/100');
    this.txtZ = this.makeRightStat('🧟', '0');
    this.rightLayer.addChild(this.txtCoins, this.txtKills, this.txtZ);
  }

  makeMiniBtn(label, hint) {
    const c = new Container();
    const g = new Graphics();
    const t = new Text({
      text: label,
      style: {
        fontFamily: 'Segoe UI, Arial',
        fontSize: 16,
        fontWeight: '900',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      },
    });
    t.anchor?.set?.(0.5);
    t.x = 18;
    t.y = 18;
    c.addChild(g, t);
    c.bg = g;
    c.label = t;
    c.hint = hint;
    return c;
  }

  makeRightStat(icon, value) {
    const c = new Container();
    const ic = new Text({
      text: icon,
      style: {
        fontFamily: 'Segoe UI, Arial',
        fontSize: 18,
        fontWeight: '900',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
      },
    });
    ic.anchor?.set?.(0.5);
    ic.x = 10;
    ic.y = 12;
    const v = new Text({
      text: String(value),
      style: {
        fontFamily: 'Roboto Mono, monospace',
        fontSize: 16,
        fontWeight: '900',
        fill: '#ffffff',
        stroke: '#000000',
        strokeThickness: 4,
        letterSpacing: 0.5,
      },
    });
    v.anchor?.set?.(0, 0.5);
    v.x = 24;
    v.y = 12;
    c.addChild(ic, v);
    c.value = v;
    return c;
  }

  updateTheme(theme) {
    if (!theme) return;
    this.theme = theme;
    this.primary = colorInt(theme.primary);
    this.win = colorInt(theme.win);
    this.text = theme.text ?? '#ffffff';
    this.bgTint = colorInt(theme.surface ?? theme.background);
    this.red = colorInt(theme.danger ?? '#ff003c');

    // 按钮样式
    const btns = [this.btnPause, this.btnPlay, this.btnX2];
    btns.forEach((b) => {
      b.bg.clear();
      b.bg.roundRect(0, 0, 44, 36, 10);
      b.bg.fill({ color: 0x000000, alpha: 0.25 });
      b.bg.stroke({ width: 2, color: this.primary, alpha: 0.55 });
    });

    this.layout();
  }

  layout() {
    const sw = this.game.app.screen.width;
    this.width = clamp(sw - 40, 520, 900);
    this.x = Math.max(18, (sw - this.width) / 2);
    this.y = 10;

    // 背景板（伪 3D：内高光 + 下压阴影）
    this.bg.clear();
    this.bg.roundRect(0, 0, this.width, this.height, 18);
    this.bg.fill({ color: this.bgTint, alpha: 0.22 });
    this.bg.stroke({ width: 2, color: this.primary, alpha: 0.22 });
    this.bg.roundRect(2, 2, this.width - 4, this.height - 4, 16);
    this.bg.stroke({ width: 2, color: 0xffffff, alpha: 0.05 });
    this.bg.roundRect(4, 10, this.width - 8, this.height - 14, 14);
    this.bg.stroke({ width: 10, color: 0x000000, alpha: 0.08 });

    this.btnLayer.x = 10;
    this.btnLayer.y = 14;

    // 进度条
    const barX = 160;
    const barY = 22;
    const barW = this.width - 160 - 170;
    const barH = 18;
    const pct = clamp(this.barPct ?? 1, 0, 1);

    this.barBack.clear();
    this.barBack.roundRect(barX, barY, barW, barH, 10);
    this.barBack.fill({ color: 0x0b1020, alpha: 0.65 });
    this.barBack.stroke({ width: 2, color: this.primary, alpha: 0.25 });

    this.barFill.clear();
    this.barFill.roundRect(barX + 2, barY + 2, (barW - 4) * pct, barH - 4, 8);
    this.barFill.fill({ color: this.primary, alpha: 0.65 });
    // 顶部高光
    this.barFill.roundRect(barX + 2, barY + 2, (barW - 4) * pct, 4, 6);
    this.barFill.fill({ color: 0xffffff, alpha: 0.15 });

    this.icon.x = barX - 20;
    this.icon.y = barY + barH / 2;

    // 右侧 stats
    this.rightLayer.x = this.width - 160;
    this.rightLayer.y = 16;
    this.txtCoins.y = 0;
    this.txtKills.y = 18;
    this.txtZ.y = 36;
  }

  setProgress(pct = 1) {
    const next = clamp(pct, 0, 1);
    this.barPct = next;
    this.layout();
    if (next < 0.18) {
      // 低血闪烁（类似效果图的紧张感）
      if (!this._blinkTween) {
        this._blinkTween = gsap.to(this.barFill, { alpha: 0.25, duration: 0.12, yoyo: true, repeat: -1, ease: 'steps(1)' });
      }
    } else {
      this._blinkTween?.kill?.();
      this._blinkTween = null;
      this.barFill.alpha = 1;
    }
  }

  setStats({ coins = 0, level = 1, kills = 0, target = 100, zombieAlive = 0, bossHPpct = null } = {}) {
    if (this.txtCoins?.value) this.txtCoins.value.text = `${Number(coins || 0).toFixed(0)}`;
    if (this.txtKills?.value) this.txtKills.value.text = `${Math.max(1, level)} ${kills}/${target}`;
    if (this.txtZ?.value) this.txtZ.value.text = `${zombieAlive}`;

    if (typeof bossHPpct === 'number') {
      this.setProgress(clamp(bossHPpct / 100, 0, 1));
      this.icon.text = '☠';
    } else {
      const pct = target > 0 ? kills / target : 0;
      this.setProgress(clamp(pct, 0, 1));
      this.icon.text = '⭐';
    }
  }
}


