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
    this.txtCombo = this.makeRightStat('🔥', 'x0');
    this.rightLayer.addChild(this.txtCoins, this.txtKills, this.txtZ, this.txtCombo);

    // 热度条（在进度条下方）
    this.heatBarBack = new Graphics();
    this.heatBarFill = new Graphics();
    this.addChild(this.heatBarBack, this.heatBarFill);
    
    this.heatPercent = 0;
    this.heatColor = 0x00ff88;
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

    // 热度条（在主进度条下方）
    const heatBarX = barX;
    const heatBarY = barY + barH + 4;
    const heatBarW = barW;
    const heatBarH = 6;
    const heatPct = Math.min(1, Math.max(0, this.heatPercent));

    this.heatBarBack.clear();
    this.heatBarBack.roundRect(heatBarX, heatBarY, heatBarW, heatBarH, 3);
    this.heatBarBack.fill({ color: 0x0b1020, alpha: 0.65 });
    this.heatBarBack.stroke({ width: 1, color: this.heatColor, alpha: 0.3 });

    this.heatBarFill.clear();
    if (heatPct > 0) {
      this.heatBarFill.roundRect(heatBarX + 1, heatBarY + 1, (heatBarW - 2) * heatPct, heatBarH - 2, 2);
      this.heatBarFill.fill({ color: this.heatColor, alpha: 0.85 });
      // 高光
      this.heatBarFill.roundRect(heatBarX + 1, heatBarY + 1, (heatBarW - 2) * heatPct, 2, 2);
      this.heatBarFill.fill({ color: 0xffffff, alpha: 0.25 });
    }

    // 右侧 stats
    this.rightLayer.x = this.width - 160;
    this.rightLayer.y = 12;
    this.txtCoins.y = 0;
    this.txtKills.y = 16;
    this.txtZ.y = 32;
    this.txtCombo.y = 48;
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

  /**
   * 🔥 更新连击/热度显示
   */
  setComboState({ comboCount = 0, heatPercent = 0, heatColor = 0x00ff88, overdriveActive = false } = {}) {
    // 更新连击计数
    if (this.txtCombo?.value) {
      const comboText = overdriveActive ? `⚡x${comboCount}` : `x${comboCount}`;
      this.txtCombo.value.text = comboText;
      
      // 过载时文字闪烁
      if (overdriveActive) {
        this.txtCombo.value.style.fill = heatColor;
      } else {
        this.txtCombo.value.style.fill = '#ffffff';
      }
    }

    // 更新热度条
    this.heatPercent = heatPercent / 100;
    this.heatColor = heatColor;
    this.layout();
  }

  /**
   * 🎯 打开升级选择界面（返回 Promise）
   */
  openChoice(options = []) {
    return new Promise((resolve) => {
      if (options.length === 0) {
        resolve(null);
        return;
      }

      // 创建模态背景
      const modal = document.createElement('div');
      Object.assign(modal.style, {
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.85)',
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
      });

      // 创建选择面板
      const panel = document.createElement('div');
      Object.assign(panel.style, {
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '900px',
        width: '90%',
        border: '2px solid rgba(0,240,255,0.3)',
        boxShadow: '0 0 40px rgba(0,240,255,0.2), inset 0 0 20px rgba(0,240,255,0.05)',
      });

      // 标题
      const title = document.createElement('div');
      title.textContent = '🎯 选择升级';
      Object.assign(title.style, {
        fontSize: '32px',
        fontWeight: '900',
        color: '#00F0FF',
        textAlign: 'center',
        marginBottom: '30px',
        textShadow: '0 0 20px rgba(0,240,255,0.6)',
      });

      // 选项容器
      const optionsContainer = document.createElement('div');
      Object.assign(optionsContainer.style, {
        display: 'flex',
        gap: '20px',
        justifyContent: 'center',
        flexWrap: 'wrap',
      });

      // 稀有度颜色映射
      const rarityColors = {
        common: '#94A3B8',
        rare: '#3B82F6',
        epic: '#A855F7',
        legendary: '#F59E0B',
      };

      // 创建选项按钮
      options.forEach((upgrade, index) => {
        const optionBtn = document.createElement('button');
        const color = rarityColors[upgrade.rarity] || '#94A3B8';
        
        Object.assign(optionBtn.style, {
          background: 'rgba(15,23,42,0.8)',
          border: `2px solid ${color}`,
          borderRadius: '16px',
          padding: '24px',
          width: '260px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          color: '#E2E8F0',
          textAlign: 'center',
          boxShadow: `0 0 20px ${color}33`,
        });

        // 图标
        const icon = document.createElement('div');
        icon.textContent = upgrade.icon || '⭐';
        Object.assign(icon.style, {
          fontSize: '48px',
          marginBottom: '12px',
        });

        // 名称
        const name = document.createElement('div');
        name.textContent = upgrade.name;
        Object.assign(name.style, {
          fontSize: '20px',
          fontWeight: '800',
          color: color,
          marginBottom: '8px',
        });

        // 描述
        const desc = document.createElement('div');
        desc.textContent = upgrade.description;
        Object.assign(desc.style, {
          fontSize: '14px',
          color: '#94A3B8',
          lineHeight: '1.5',
        });

        // 稀有度标签
        const rarity = document.createElement('div');
        rarity.textContent = upgrade.rarity?.toUpperCase() || 'COMMON';
        Object.assign(rarity.style, {
          fontSize: '11px',
          fontWeight: '700',
          color: color,
          marginTop: '12px',
          letterSpacing: '1px',
        });

        optionBtn.appendChild(icon);
        optionBtn.appendChild(name);
        optionBtn.appendChild(desc);
        optionBtn.appendChild(rarity);

        // 悬停效果
        optionBtn.addEventListener('mouseenter', () => {
          optionBtn.style.transform = 'translateY(-8px) scale(1.05)';
          optionBtn.style.boxShadow = `0 8px 30px ${color}66`;
          optionBtn.style.background = 'rgba(30,41,59,0.9)';
        });

        optionBtn.addEventListener('mouseleave', () => {
          optionBtn.style.transform = 'translateY(0) scale(1)';
          optionBtn.style.boxShadow = `0 0 20px ${color}33`;
          optionBtn.style.background = 'rgba(15,23,42,0.8)';
        });

        // 点击事件
        optionBtn.addEventListener('click', () => {
          document.body.removeChild(modal);
          resolve(upgrade);
        });

        optionsContainer.appendChild(optionBtn);
      });

      panel.appendChild(title);
      panel.appendChild(optionsContainer);
      modal.appendChild(panel);
      document.body.appendChild(modal);

      // ESC 键取消（选择第一个作为默认）
      const handleEsc = (e) => {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', handleEsc);
          document.body.removeChild(modal);
          resolve(options[0]);
        }
      };
      document.addEventListener('keydown', handleEsc);
    });
  }
}



