/**
 * 🎯 BuildSystem - Roguelike 构建系统
 * 
 * 职责：
 * 1. 分析当前回合的 spin 结果
 * 2. 确定原型（archetype）：BULLET_FOCUS, GRENADE_FOCUS, MISSILE_FOCUS, WILD_OVERDRIVE, BALANCED
 * 3. 输出 TurnModifiers 对象，影响战斗表现
 * 
 * 设计原则：
 * - 无副作用（pure function）
 * - 确定性（相同输入产生相同输出）
 * - 易于调整参数
 */

// ========== 原型定义 ==========
export const Archetype = {
  BULLET_FOCUS: "BULLET_FOCUS",       // 子弹流：高射速、多弹幕
  GRENADE_FOCUS: "GRENADE_FOCUS",     // 手雷流：AOE 伤害、范围控制
  MISSILE_FOCUS: "MISSILE_FOCUS",     // 导弹流：高伤害、穿透
  WILD_OVERDRIVE: "WILD_OVERDRIVE",   // 万能流：暴击、连锁、过载
  BALANCED: "BALANCED",               // 平衡流：中庸之道
};

// ========== 可调参数 ==========
const CONFIG = {
  // 原型判定阈值
  FOCUS_THRESHOLD: 0.5,        // 某类符号占比 >= 50% 即认定为专精
  WILD_OVERDRIVE_COUNT: 3,     // Wild 数量 >= 3 触发 Overdrive

  // 基础修饰符数值（可根据平衡性调整）
  BULLET_FOCUS: {
    extraProjectiles: 2,         // 额外发射 2 发子弹
    pierce: 0,                   // 不穿透
    chain: 0,                    // 不连锁
    aoeScale: 0.8,               // AOE 范围 -20%（精准射击）
    critChance: 0.15,            // +15% 暴击率
    lifesteal: 0,                // 无生命偷取
    overloadBonus: 0,            // 无过载加成
  },

  GRENADE_FOCUS: {
    extraProjectiles: 0,
    pierce: 0,
    chain: 1,                    // 连锁 1 次（手雷弹跳）
    aoeScale: 1.5,               // AOE 范围 +50%
    critChance: 0.1,             // +10% 暴击率
    lifesteal: 0.05,             // 5% 生命偷取（爆炸吸血）
    overloadBonus: 0,
  },

  MISSILE_FOCUS: {
    extraProjectiles: 0,
    pierce: 2,                   // 穿透 2 个目标
    chain: 0,
    aoeScale: 1.2,               // AOE 范围 +20%
    critChance: 0.25,            // +25% 暴击率（精准打击）
    lifesteal: 0,
    overloadBonus: 0.2,          // +20% 过载能量
  },

  WILD_OVERDRIVE: {
    extraProjectiles: 1,
    pierce: 1,
    chain: 2,                    // 连锁 2 次（狂野连锁）
    aoeScale: 1.3,               // AOE 范围 +30%
    critChance: 0.35,            // +35% 暴击率（狂暴）
    lifesteal: 0.1,              // 10% 生命偷取
    overloadBonus: 0.5,          // +50% 过载能量（爆发）
  },

  BALANCED: {
    extraProjectiles: 0,
    pierce: 0,
    chain: 0,
    aoeScale: 1.0,               // 标准范围
    critChance: 0.05,            // +5% 暴击率
    lifesteal: 0,
    overloadBonus: 0,
  },
};

// ========== 符号类型映射 ==========
const SYMBOL_TYPE = {
  BULLET: 1,
  GRENADE: 2,
  MISSILE: 3,
  WILD: 4,
};

/**
 * 🏗️ BuildSystem 主类
 */
export class BuildSystem {
  constructor() {
    // 无状态，纯函数式
  }

  /**
   * 📊 分析 spin 结果，确定原型并生成修饰符
   * 
   * @param {SpinResult} spinResult - 转轮结果
   *   {
   *     grid: Array<Array<number>>,  // 3x3 符号网格
   *     wins: Array<WinLine>,         // 中奖线 [{ symbols: [1,1,2], ... }]
   *     totalMul: number              // 总倍率
   *   }
   * 
   * @returns {TurnModifiers} 回合修饰符
   *   {
   *     archetype: string,            // 当前原型
   *     extraProjectiles: number,     // 额外弹幕
   *     pierce: number,               // 穿透层数
   *     chain: number,                // 连锁次数
   *     aoeScale: number,             // AOE 范围倍率
   *     critChance: number,           // 暴击率加成 (0-1)
   *     lifesteal: number,            // 生命偷取率 (0-1)
   *     overloadBonus: number,        // 过载能量加成 (0-1)
   *   }
   */
  analyze(spinResult) {
    // 1. 统计所有中奖线的符号
    const symbolCounts = this.countSymbols(spinResult);
    
    // 2. 确定原型
    const archetype = this.determineArchetype(symbolCounts);
    
    // 3. 生成修饰符
    const modifiers = this.buildModifiers(archetype, symbolCounts);
    
    return {
      archetype,
      ...modifiers,
    };
  }

  /**
   * 统计符号数量
   */
  countSymbols(spinResult) {
    const counts = {
      bullet: 0,
      grenade: 0,
      missile: 0,
      wild: 0,
      total: 0,
    };

    const wins = spinResult.wins || [];
    for (const win of wins) {
      const symbols = win.symbols || [];
      for (const sym of symbols) {
        counts.total++;
        
        if (sym === SYMBOL_TYPE.BULLET || sym === "BULLET") {
          counts.bullet++;
        } else if (sym === SYMBOL_TYPE.GRENADE || sym === "GRENADE") {
          counts.grenade++;
        } else if (sym === SYMBOL_TYPE.MISSILE || sym === "MISSILE") {
          counts.missile++;
        } else if (sym === SYMBOL_TYPE.WILD || sym === "WILD") {
          counts.wild++;
        }
      }
    }

    return counts;
  }

  /**
   * 确定原型
   */
  determineArchetype(counts) {
    const { bullet, grenade, missile, wild, total } = counts;
    
    // 如果没有任何中奖符号，返回 BALANCED
    if (total === 0) {
      return Archetype.BALANCED;
    }

    // 优先判断 WILD_OVERDRIVE（Wild 数量达到阈值）
    if (wild >= CONFIG.WILD_OVERDRIVE_COUNT) {
      return Archetype.WILD_OVERDRIVE;
    }

    // 计算各类符号占比
    const bulletRatio = bullet / total;
    const grenadeRatio = grenade / total;
    const missileRatio = missile / total;

    // 判断专精类型（占比超过阈值）
    if (bulletRatio >= CONFIG.FOCUS_THRESHOLD) {
      return Archetype.BULLET_FOCUS;
    }
    if (grenadeRatio >= CONFIG.FOCUS_THRESHOLD) {
      return Archetype.GRENADE_FOCUS;
    }
    if (missileRatio >= CONFIG.FOCUS_THRESHOLD) {
      return Archetype.MISSILE_FOCUS;
    }

    // 默认返回 BALANCED
    return Archetype.BALANCED;
  }

  /**
   * 根据原型构建修饰符
   */
  buildModifiers(archetype, counts) {
    // 获取基础修饰符
    const base = { ...CONFIG[archetype] };

    // 可选：根据 counts 进行微调（高级特性）
    // 例如：bullet 数量越多，extraProjectiles 越多
    if (archetype === Archetype.BULLET_FOCUS) {
      base.extraProjectiles += Math.floor(counts.bullet / 5); // 每 5 个 bullet +1 弹幕
    }

    // Wild 符号额外加成（适用于所有原型）
    if (counts.wild > 0) {
      base.critChance += counts.wild * 0.05;  // 每个 Wild +5% 暴击
      base.overloadBonus += counts.wild * 0.1; // 每个 Wild +10% 过载
    }

    return base;
  }

  /**
   * 🎨 获取原型的显示名称（用于 UI）
   */
  getArchetypeName(archetype) {
    const names = {
      [Archetype.BULLET_FOCUS]: "子弹风暴 🔫",
      [Archetype.GRENADE_FOCUS]: "爆破专家 💣",
      [Archetype.MISSILE_FOCUS]: "精准打击 🚀",
      [Archetype.WILD_OVERDRIVE]: "狂野过载 ⚡",
      [Archetype.BALANCED]: "平衡发展 ⚖️",
    };
    return names[archetype] || archetype;
  }

  /**
   * 🎨 获取原型的描述（用于 UI）
   */
  getArchetypeDescription(archetype) {
    const descriptions = {
      [Archetype.BULLET_FOCUS]: "高射速、多弹幕、精准射击",
      [Archetype.GRENADE_FOCUS]: "大范围AOE、连锁爆炸、生命偷取",
      [Archetype.MISSILE_FOCUS]: "高伤害、穿透、暴击",
      [Archetype.WILD_OVERDRIVE]: "全能加成、狂暴连锁、过载爆发",
      [Archetype.BALANCED]: "中庸之道、稳定输出",
    };
    return descriptions[archetype] || "";
  }
}

// ========== 导出单例（可选）==========
export const buildSystem = new BuildSystem();


