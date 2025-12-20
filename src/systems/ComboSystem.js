/**
 * 🔥 ComboSystem - 连击/热度计量系统
 * 
 * 职责：
 * 1. 追踪连击数（comboCount）：胜利时增加，失败时重置
 * 2. 追踪热度（heat 0-100）：胜利和造成伤害时增加，随时间衰减
 * 3. 追踪过载状态（overdriveActive）：热度达到 100 时激活
 * 
 * 效果：
 * - overdriveActive 时：Shoot 事件 +1 额外弹幕，爆炸事件 +aoeScale
 * - comboCount 达到阈值时：临时增益
 * 
 * 设计原则：
 * - 只追踪状态，不直接修改其他系统
 * - 提供查询接口供其他系统使用
 * - 时间驱动的衰减（需要 update 调用）
 */

// ========== 可调参数 ==========
const CONFIG = {
  // 热度相关
  HEAT_MAX: 100,                    // 最大热度
  HEAT_PER_WIN: 25,                 // 每次胜利增加的热度
  HEAT_PER_DAMAGE: 0.05,            // 每点伤害增加的热度（0.05 = 100伤害 +5热度）
  HEAT_DECAY_PER_SECOND: 8,         // 每秒衰减的热度
  HEAT_DECAY_DELAY: 2000,           // 热度衰减延迟（毫秒，防止战斗中衰减）

  // 过载相关
  OVERDRIVE_THRESHOLD: 100,         // 激活过载的热度阈值
  OVERDRIVE_DURATION: 6000,         // 过载持续时间（毫秒）
  OVERDRIVE_EXTRA_PROJECTILES: 1,   // 过载时额外弹幕
  OVERDRIVE_AOE_SCALE: 1.3,         // 过载时 AOE 范围倍率

  // 连击相关
  COMBO_THRESHOLDS: [3, 6, 10, 15, 20], // 连击阈值
  COMBO_BUFFS: {
    3: { name: '小火花 🔥', extraProjectiles: 1, critChance: 0.05 },
    6: { name: '火焰 🔥🔥', extraProjectiles: 2, critChance: 0.1, aoeScale: 1.1 },
    10: { name: '爆燃 🔥🔥🔥', extraProjectiles: 3, critChance: 0.15, aoeScale: 1.2, pierce: 1 },
    15: { name: '烈焰 🔥🔥🔥🔥', extraProjectiles: 4, critChance: 0.2, aoeScale: 1.3, pierce: 2, lifesteal: 0.05 },
    20: { name: '地狱火 🔥🔥🔥🔥🔥', extraProjectiles: 5, critChance: 0.3, aoeScale: 1.5, pierce: 3, lifesteal: 0.1, chain: 1 },
  },
};

export class ComboSystem {
  constructor() {
    // 连击计数
    this.comboCount = 0;
    
    // 热度系统
    this.heat = 0;
    this.lastHeatUpdateTime = Date.now();
    this.lastDamageTime = 0;
    
    // 过载状态
    this.overdriveActive = false;
    this.overdriveEndTime = 0;
    
    // 连击增益缓存
    this.currentComboBuff = null;
  }

  /**
   * 🎯 每帧更新（处理热度衰减和过载状态）
   */
  update(deltaMS) {
    const now = Date.now();
    const deltaSeconds = deltaMS / 1000;

    // 热度衰减（战斗后延迟衰减）
    if (now - this.lastDamageTime > CONFIG.HEAT_DECAY_DELAY) {
      const decay = CONFIG.HEAT_DECAY_PER_SECOND * deltaSeconds;
      this.heat = Math.max(0, this.heat - decay);
    }

    // 过载状态更新
    if (this.overdriveActive && now >= this.overdriveEndTime) {
      this.overdriveActive = false;
      console.log('[ComboSystem] ⚡ Overdrive ended');
    }

    this.lastHeatUpdateTime = now;
  }

  /**
   * 📊 记录 Spin 胜利
   */
  recordWin(winAmount = 0) {
    // 增加连击
    this.comboCount++;
    
    // 增加热度
    this.addHeat(CONFIG.HEAT_PER_WIN);
    
    // 更新连击增益
    this.updateComboBuff();
    
    console.log(`[ComboSystem] 🔥 Combo: ${this.comboCount} | Heat: ${this.heat.toFixed(1)}%`);
  }

  /**
   * 📊 记录 Spin 失败
   */
  recordLoss() {
    if (this.comboCount > 0) {
      console.log(`[ComboSystem] 💔 Combo broken at ${this.comboCount}`);
      this.comboCount = 0;
      this.currentComboBuff = null;
    }
  }

  /**
   * ⚔️ 记录造成的伤害
   */
  recordDamage(damage) {
    const heatGain = damage * CONFIG.HEAT_PER_DAMAGE;
    this.addHeat(heatGain);
    this.lastDamageTime = Date.now();
  }

  /**
   * 🔥 增加热度
   */
  addHeat(amount) {
    const prevHeat = this.heat;
    this.heat = Math.min(CONFIG.HEAT_MAX, this.heat + amount);

    // 检查是否达到过载阈值
    if (prevHeat < CONFIG.OVERDRIVE_THRESHOLD && this.heat >= CONFIG.OVERDRIVE_THRESHOLD) {
      this.activateOverdrive();
    }
  }

  /**
   * ⚡ 激活过载
   */
  activateOverdrive() {
    this.overdriveActive = true;
    this.overdriveEndTime = Date.now() + CONFIG.OVERDRIVE_DURATION;
    
    console.log(`[ComboSystem] ⚡⚡⚡ OVERDRIVE ACTIVATED! Duration: ${CONFIG.OVERDRIVE_DURATION / 1000}s`);
    
    // 过载时热度不会立即清零，而是缓慢消耗
    // 这样可以延长过载时间，如果继续造成伤害的话
  }

  /**
   * 🎁 更新连击增益
   */
  updateComboBuff() {
    // 找到当前连击对应的最高增益
    let bestBuff = null;
    for (const threshold of CONFIG.COMBO_THRESHOLDS) {
      if (this.comboCount >= threshold) {
        bestBuff = CONFIG.COMBO_BUFFS[threshold];
      }
    }
    
    if (bestBuff && bestBuff !== this.currentComboBuff) {
      this.currentComboBuff = bestBuff;
      console.log(`[ComboSystem] 🎁 Combo buff unlocked: ${bestBuff.name}`);
    }
  }

  /**
   * 📊 获取当前修饰符（供战斗系统使用）
   */
  getModifiers() {
    const mods = {
      extraProjectiles: 0,
      pierce: 0,
      chain: 0,
      aoeScale: 1.0,
      critChance: 0,
      lifesteal: 0,
      overloadBonus: 0,
    };

    // 应用过载效果
    if (this.overdriveActive) {
      mods.extraProjectiles += CONFIG.OVERDRIVE_EXTRA_PROJECTILES;
      mods.aoeScale *= CONFIG.OVERDRIVE_AOE_SCALE;
    }

    // 应用连击增益
    if (this.currentComboBuff) {
      const buff = this.currentComboBuff;
      mods.extraProjectiles += buff.extraProjectiles || 0;
      mods.pierce += buff.pierce || 0;
      mods.chain += buff.chain || 0;
      mods.aoeScale *= buff.aoeScale || 1.0;
      mods.critChance += buff.critChance || 0;
      mods.lifesteal += buff.lifesteal || 0;
      mods.overloadBonus += buff.overloadBonus || 0;
    }

    return mods;
  }

  /**
   * 📊 获取当前状态（供 UI 显示）
   */
  getState() {
    return {
      comboCount: this.comboCount,
      heat: this.heat,
      heatPercent: (this.heat / CONFIG.HEAT_MAX) * 100,
      overdriveActive: this.overdriveActive,
      overdriveTimeLeft: this.overdriveActive ? Math.max(0, this.overdriveEndTime - Date.now()) / 1000 : 0,
      currentBuff: this.currentComboBuff,
    };
  }

  /**
   * 🎨 获取热度的颜色（用于 UI）
   */
  getHeatColor() {
    const pct = this.heat / CONFIG.HEAT_MAX;
    
    if (pct >= 1.0) return 0xffffff; // 白色（过载）
    if (pct >= 0.8) return 0xff00ff; // 紫色（高热）
    if (pct >= 0.6) return 0xff3366; // 红色
    if (pct >= 0.4) return 0xff8800; // 橙色
    if (pct >= 0.2) return 0xffcc00; // 黄色
    return 0x00ff88;                 // 绿色（冷却）
  }

  /**
   * 🔄 重置系统（用于新游戏或关卡切换）
   */
  reset() {
    this.comboCount = 0;
    this.heat = 0;
    this.overdriveActive = false;
    this.overdriveEndTime = 0;
    this.currentComboBuff = null;
    this.lastDamageTime = 0;
    console.log('[ComboSystem] System reset');
  }
}

// ========== 导出单例 ==========
export const comboSystem = new ComboSystem();

// ========== 导出配置（供调试/调整）==========
export { CONFIG as ComboConfig };


