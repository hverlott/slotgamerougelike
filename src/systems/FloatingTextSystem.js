import { Container, Text } from 'pixi.js';
import { GlowFilter } from 'pixi-filters';
import gsap from 'gsap';
import { themeManager } from './ThemeManager.js';

const colorInt = (hex) => parseInt(hex.replace('#', '0x'), 16);
const PRIMARY = () => colorInt(themeManager.getColor('primary'));
const ENERGY = () => colorInt(themeManager.getColor('win'));

/**
 * 🚀 FloatingTextSystem - 性能优化版
 * 
 * 优化措施：
 * - 对象池复用 Text 对象
 * - 硬限制活跃文字数量（40 个）
 * - 达到上限时复用最旧的文字
 * - 正确重置对象状态
 */
export class FloatingTextSystem {
  constructor(app) {
    this.app = app;
    this.container = new Container();
    this.app.gameLayer.addChild(this.container);
    this.level = 1;
    this.combatScale = 100;
    
    // 🚀 性能优化：对象池
    this.textPool = [];           // Text 对象池
    this.activeTexts = [];        // 活跃的文字（追踪用于复用）
    this.maxActiveTexts = 40;     // 硬限制：最多 40 个活跃文字
    
    // 共享 GlowFilter（暴击用）
    this.critGlowFilter = new GlowFilter({
      distance: 12,
      outerStrength: 2.4,
      color: ENERGY(),
      quality: 0.12,
    });
    
    themeManager.subscribe((theme) => this.updateTheme(theme));
  }

  /**
   * 🔄 从池中获取 Text 对象
   */
  getText() {
    if (this.textPool.length > 0) {
      const text = this.textPool.pop();
      // 重置状态
      text.alpha = 1;
      text.scale.set(1);
      text.rotation = 0;
      text.visible = true;
      text.filters = [];
      return text;
    }
    // 池空时创建新对象
    const text = new Text();
    text.anchor.set(0.5);
    return text;
  }

  /**
   * ♻️ 回收 Text 对象到池中
   */
  returnText(text) {
    if (!text || text.destroyed) return;
    
    // 清理所有 tween
    gsap.killTweensOf(text);
    gsap.killTweensOf(text.scale);
    
    // 从容器中移除
    text.removeFromParent();
    
    // 重置状态
    text.alpha = 1;
    text.scale.set(1);
    text.rotation = 0;
    text.visible = true;
    text.filters = [];
    
    // 回收到池（限制池大小）
    if (this.textPool.length < 50) {
      this.textPool.push(text);
    } else {
      text.destroy({ children: true });
    }
  }

  /**
   * 显示浮动文字
   */
  showText(x, y, text, isCrit = false) {
    // 🚀 性能优化：达到上限时复用最旧的文字
    if (this.activeTexts.length >= this.maxActiveTexts) {
      const oldest = this.activeTexts.shift(); // 移除最旧的
      if (oldest) {
        gsap.killTweensOf(oldest);
        gsap.killTweensOf(oldest.scale);
        this.returnText(oldest);
      }
    }

    const fill = isCrit ? ENERGY() : PRIMARY();
    const levelScale = 1 + Math.min(0.35, (Math.max(1, this.level) - 1) * 0.08);
    const size = (isCrit ? 54 : 34) * levelScale;
    const weight = '900';

    const n = Number(text);
    const display = Number.isFinite(n) ? Math.round(n) : String(text);

    // 从池中获取 Text 对象
    const label = this.getText();
    
    // 更新文字样式
    label.text = String(display);
    label.style = {
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
    };

    // 轻微散开，避免叠字完全重合
    label.x = x + (Math.random() - 0.5) * 18;
    label.y = y + (Math.random() - 0.5) * 10;
    label.rotation = (Math.random() - 0.5) * (isCrit ? 0.22 : 0.14);

    if (isCrit) {
      // 🚀 性能优化：复用共享的 GlowFilter
      this.critGlowFilter.color = ENERGY();
      label.filters = [this.critGlowFilter];
    }

    this.container.addChild(label);
    this.activeTexts.push(label); // 追踪活跃文字

    // 弹跳 pop（暴击更大、更快）
    const popScale = isCrit ? 1.45 : 1.1;
    const popDuration = isCrit ? 0.18 : 0.22;
    const popEase = isCrit ? 'back.out(4)' : 'back.out(3)';
    
    gsap.fromTo(
      label.scale,
      { x: 0.35, y: 0.35 },
      { x: popScale, y: popScale, duration: popDuration, ease: popEase },
    );
    gsap.to(label.scale, { x: 1, y: 1, duration: 0.28, delay: isCrit ? 0.14 : 0.18, ease: 'expo.out' });

    // 上飘 + 左右摆动（暴击更快更高）
    const driftY = isCrit ? 100 + Math.random() * 30 : 74 + Math.random() * 26;
    const driftDuration = isCrit ? 0.85 : 0.95;
    const rotationAmount = isCrit ? 0.35 : 0.22;
    
    gsap.to(label, { y: label.y - driftY, duration: driftDuration, ease: 'sine.out' });
    gsap.to(label, {
      x: label.x + (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 12),
      duration: driftDuration,
      ease: 'sine.inOut',
    });
    gsap.to(label, { 
      rotation: label.rotation + (Math.random() - 0.5) * rotationAmount, 
      duration: driftDuration, 
      ease: 'sine.inOut' 
    });

    // 末尾淡出（暴击稍快）
    const fadeDelay = isCrit ? 0.7 : 0.78;
    const fadeDuration = isCrit ? 0.3 : 0.34;
    
    gsap.to(label, {
      alpha: 0,
      duration: fadeDuration,
      delay: fadeDelay,
      ease: 'sine.in',
      onComplete: () => {
        // 从活跃列表移除
        const idx = this.activeTexts.indexOf(label);
        if (idx > -1) this.activeTexts.splice(idx, 1);
        
        // 回收到池中
        this.returnText(label);
      },
    });
  }

  updateTheme() {
    // dynamic colors are resolved per-showText via PRIMARY/ENERGY getters
    if (this.critGlowFilter) {
      this.critGlowFilter.color = ENERGY();
    }
  }

  setLevel(level = 1) {
    this.level = Math.max(1, Number(level) || 1);
  }

  /**
   * 清理所有活跃文字（用于重置）
   */
  cleanup() {
    this.activeTexts.forEach(text => {
      gsap.killTweensOf(text);
      gsap.killTweensOf(text.scale);
      this.returnText(text);
    });
    this.activeTexts = [];
  }

  /**
   * 销毁系统
   */
  destroy() {
    this.cleanup();
    
    // 销毁所有池对象
    this.textPool.forEach(text => text.destroy({ children: true }));
    this.textPool = [];
    
    // 销毁容器
    this.container.destroy({ children: true });
  }
}
