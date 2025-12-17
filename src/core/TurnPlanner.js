import { buildSystem } from '../systems/BuildSystem.js';

// 符号 ID 到名称的映射
const SYMBOL_MAP = {
  0: "EMPTY",
  1: "BULLET",   // 低级符号 (0.5x)
  2: "GRENADE",  // 中级符号 (1x)
  3: "MISSILE",  // 高级符号 (2x)
  4: "WILD",     // 万能符号 (5x)
};

export class TurnPlanner {
    constructor(ctx) {
      this.ctx = ctx;
    }
  
    /**
     * ⚔️ 根据 SpinResult 构建回合计划（战斗事件列表）
     * 
     * @param {SpinResult} spinResult - 统一格式的转轮结果
     *   {
     *     grid: Array<Array<number>>,  // 3x3 符号网格（用于显示）
     *     wins: Array<WinLine>,         // 中奖线数组 [{ lineIndex, symbols, payoutMul }]
     *     totalMul: number              // 总倍率（用于计算总收益）
     *   }
     * 
     * @returns {TurnPlan} 回合计划
     *   {
     *     spin: SpinResult,            // 原始转轮结果
     *     events: Array<CombatEvent>,  // 战斗事件列表（按顺序执行）
     *     modifiers: TurnModifiers      // 回合修饰符（影响战斗表现）
     *   }
     * 
     * 📌 核心逻辑：遍历 spinResult.wins，根据 symbols 生成对应的战斗事件
     *    - BULLET  (1) → Shoot 事件
     *    - GRENADE (2) → Grenade 事件
     *    - MISSILE (3) → Missile 事件
     *    - WILD    (4) → WildBonus 事件
     * 
     * 🔮 扩展点：
     *    - BuildSystem：分析原型（archetype）并生成修饰符
     *    - 词缀系统：修改 events 的 dmg、count 等参数
     *    - 套装效果：添加额外的 events（如"连击"、"护盾"）
     *    - 圣物效果：修改 events 的触发条件或效果
     */
    buildTurnPlan(spinResult) {
      const bet = this.ctx.hudSystem?.getBet?.() ?? this.ctx.player?.bet ?? 1;
  
      const events = [];
      
      // 🎯 Step 1: 分析构建（BuildSystem）
      const buildModifiers = buildSystem.analyze(spinResult);
      console.log(`[TurnPlanner] Archetype: ${buildModifiers.archetype}`, buildModifiers);
      
      // 🔥 Step 2: 获取连击加成（ComboSystem）
      const comboModifiers = this.ctx.comboSystem?.getModifiers?.() ?? {};
      console.log(`[TurnPlanner] Combo modifiers:`, comboModifiers);
      
      // 🎯 Step 3: 合并修饰符（ComboSystem 叠加在 BuildSystem 之上）
      const modifiers = this.mergeModifiers(buildModifiers, comboModifiers);
      
      // 遍历所有中奖线，提取符号并生成战斗事件
      for (const w of spinResult.wins || []) {
        const symbols = w.symbols || [];
        
        // 统计各类符号数量（符号可能是数字或字符串）
        const bulletCount = symbols.filter(s => s === 1 || s === "BULLET").length;
        const grenadeCount = symbols.filter(s => s === 2 || s === "GRENADE").length;
        const missileCount = symbols.filter(s => s === 3 || s === "MISSILE").length;
        const wildCount = symbols.filter(s => s === 4 || s === "WILD").length;
  
        // Wild 符号增强倍率（每个 Wild +50% 伤害）
        const wildMultiplier = 1 + wildCount * 0.5;
  
        // 根据符号类型生成对应的战斗事件（Wild 增强伤害）
        if (bulletCount > 0) {
          events.push({ 
            type: "Shoot", 
            dmg: bet * 1 * wildMultiplier, 
            count: bulletCount 
          });
        }
        
        if (grenadeCount > 0) {
          events.push({ 
            type: "Grenade", 
            dmg: bet * 2 * wildMultiplier, 
            radius: 90 
          });
        }
        
        if (missileCount > 0) {
          events.push({ 
            type: "Missile", 
            dmg: bet * 3 * wildMultiplier, 
            splash: 120 
          });
        }
      }
  
      // Jackpot/Overload 示例：检查特殊系统状态
      if (this.ctx.jackpotSystem?.isOverloadReady?.()) {
        events.push({
          type: "Overload",
          power: this.ctx.jackpotSystem.getPower()
        });
      }
  
      return { 
        spin: spinResult, 
        events,
        modifiers  // 🎯 附加修饰符到回合计划
      };
    }
  
    /**
     * 🔄 合并修饰符（ComboSystem 叠加在 BuildSystem 之上）
     */
    mergeModifiers(build, combo) {
      return {
        archetype: build.archetype,
        extraProjectiles: (build.extraProjectiles || 0) + (combo.extraProjectiles || 0),
        pierce: Math.max(build.pierce || 0, combo.pierce || 0), // 取最大值
        chain: Math.max(build.chain || 0, combo.chain || 0),
        aoeScale: (build.aoeScale || 1.0) * (combo.aoeScale || 1.0), // 相乘
        critChance: (build.critChance || 0) + (combo.critChance || 0),
        lifesteal: (build.lifesteal || 0) + (combo.lifesteal || 0),
        overloadBonus: (build.overloadBonus || 0) + (combo.overloadBonus || 0),
      };
    }
  }
