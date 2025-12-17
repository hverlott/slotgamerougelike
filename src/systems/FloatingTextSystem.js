import { Container, Text } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { themeManager } from './ThemeManager.js';

const colorInt = (hex) => parseInt(hex.replace('#', '0x'), 16);
const PRIMARY = () => colorInt(themeManager.getColor('primary'));
const ENERGY = () => colorInt(themeManager.getColor('win'));

export class FloatingTextSystem {
  constructor(app) {
    this.app = app;
    this.container = new Container();
    this.app.gameLayer.addChild(this.container);
    this.level = 1;
    this.combatScale = 100; // 仅用于兼容：如果外部仍传小数值，这里会做放大显示
    themeManager.subscribe((theme) => this.updateTheme(theme));
  }

  showText(x, y, text, isCrit = false) {
    // 参考效果图：粗描边、弹跳、轻微旋转抖动（更“战斗手游”）
    const fill = isCrit ? ENERGY() : PRIMARY();
    const levelScale = 1 + Math.min(0.35, (Math.max(1, this.level) - 1) * 0.08);
    const size = (isCrit ? 54 : 34) * levelScale;
    const weight = '900';

    const n = Number(text);
    const display = Number.isFinite(n) ? Math.round(n) : String(text);

    const label = new Text({
      text: String(display),
      style: {
        fill,
        fontSize: size,
        fontWeight: weight,
        fontFamily: 'Roboto Mono, Segoe UI, Arial',
        align: 'center',
        stroke: '#000000',
        strokeThickness: (isCrit ? 9 : 8) * levelScale,
        dropShadow: true,
        dropShadowColor: '#000000',
        dropShadowAlpha: 0.7,
        dropShadowBlur: 10,
        dropShadowDistance: 4,
      },
    });
    label.anchor.set(0.5);
    // 轻微散开，避免叠字完全重合
    label.x = x + (Math.random() - 0.5) * 18;
    label.y = y + (Math.random() - 0.5) * 10;
    label.rotation = (Math.random() - 0.5) * (isCrit ? 0.22 : 0.14);

    if (isCrit) {
      label.filters = [
        new GlowFilter({
          distance: 12,
          outerStrength: 2.4,
          color: ENERGY(),
          quality: 0.12,
        }),
      ];
    }

    this.container.addChild(label);

    // 弹跳 pop
    gsap.fromTo(
      label.scale,
      { x: 0.35, y: 0.35 },
      { x: isCrit ? 1.25 : 1.1, y: isCrit ? 1.25 : 1.1, duration: 0.22, ease: 'back.out(3)' },
    );
    gsap.to(label.scale, { x: 1, y: 1, duration: 0.28, delay: 0.18, ease: 'expo.out' });

    // 上飘 + 左右摆动
    const driftY = 74 + Math.random() * 26;
    gsap.to(label, { y: label.y - driftY, duration: 0.95, ease: 'sine.out' });
    gsap.to(label, {
      x: label.x + (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 12),
      duration: 0.95,
      ease: 'sine.inOut',
    });
    gsap.to(label, { rotation: label.rotation + (Math.random() - 0.5) * 0.22, duration: 0.95, ease: 'sine.inOut' });

    // 末尾淡出
    gsap.to(label, {
      alpha: 0,
      duration: 0.34,
      delay: 0.78,
      ease: 'sine.in',
      onComplete: () => label.destroy({ children: true }),
    });
  }

  updateTheme() {
    // dynamic colors are resolved per-showText via PRIMARY/ENERGY getters
  }

  setLevel(level = 1) {
    this.level = Math.max(1, Number(level) || 1);
  }
}
