/**
 * UpgradeSystem - Roguelike 升级系统
 * 
 * 职责：
 * 1. 定义升级选项池（伤害+、子弹数+、暴击+、AOE半径+、jackpot增益+）
 * 2. 每关完成后随机提供3个升级选项
 * 3. 应用选中的升级，修改全局参数
 * 4. 纯逻辑层，不处理UI渲染
 * 
 * 使用示例：
 *   const upgradeSystem = new UpgradeSystem(game);
 *   const options = upgradeSystem.rollOptions();
 *   upgradeSystem.applyUpgrade(options[0]);
 */

import { balanceManager } from './BalanceManager.js';

export class UpgradeSystem {
  constructor(game) {
    this.game = game;
    
    // 当前已应用的升级计数（用于叠加效果）
    this.upgradeCounts = {
      damage: 0,
      bulletCount: 0,
      crit: 0,
      aoe: 0,
      jackpotGain: 0,
      maxHP: 0,
      speed: 0,
      fireRate: 0,
    };

    // 升级选项池定义
    this.upgradePool = [
      {
        id: 'damage_boost',
        name: '烈焰弹药',
        description: '子弹伤害 +20%',
        icon: '🔥',
        rarity: 'common',
        effect: { type: 'damage', value: 0.2 },
      },
      {
        id: 'bullet_count',
        name: '多重射击',
        description: '每次射击 +1 发子弹',
        icon: '🎯',
        rarity: 'common',
        effect: { type: 'bulletCount', value: 1 },
      },
      {
        id: 'crit_chance',
        name: '精准打击',
        description: '暴击率 +15%',
        icon: '⚡',
        rarity: 'rare',
        effect: { type: 'crit', value: 0.15 },
      },
      {
        id: 'crit_damage',
        name: '致命一击',
        description: '暴击伤害 +50%',
        icon: '💥',
        rarity: 'rare',
        effect: { type: 'critDamage', value: 0.5 },
      },
      {
        id: 'aoe_radius',
        name: '范围爆炸',
        description: 'AOE半径 +20%',
        icon: '💣',
        rarity: 'common',
        effect: { type: 'aoe', value: 0.2 },
      },
      {
        id: 'jackpot_gain',
        name: '财富增幅',
        description: 'Jackpot伤害 +25%',
        icon: '💰',
        rarity: 'rare',
        effect: { type: 'jackpotGain', value: 0.25 },
      },
      {
        id: 'max_hp_boost',
        name: '生命强化',
        description: '最大HP +30%',
        icon: '❤️',
        rarity: 'common',
        effect: { type: 'maxHP', value: 0.3 },
      },
      {
        id: 'speed_boost',
        name: '疾速子弹',
        description: '子弹速度 +30%',
        icon: '⚡',
        rarity: 'common',
        effect: { type: 'speed', value: 0.3 },
      },
      {
        id: 'fire_rate',
        name: '快速装填',
        description: '射击间隔 -15%',
        icon: '⏱️',
        rarity: 'rare',
        effect: { type: 'fireRate', value: -0.15 },
      },
      {
        id: 'mega_damage',
        name: '毁灭之力',
        description: '子弹伤害 +50%',
        icon: '🔴',
        rarity: 'epic',
        effect: { type: 'damage', value: 0.5 },
      },
      {
        id: 'jackpot_mega',
        name: 'Boss克星',
        description: 'Jackpot伤害 +60%',
        icon: '👑',
        rarity: 'epic',
        effect: { type: 'jackpotGain', value: 0.6 },
      },
      {
        id: 'triple_shot',
        name: '三重奏',
        description: '每次射击 +2 发子弹',
        icon: '🎪',
        rarity: 'epic',
        effect: { type: 'bulletCount', value: 2 },
      },
    ];

    // 稀有度权重
    this.rarityWeights = {
      common: 60,
      rare: 30,
      epic: 10,
    };
  }

  /**
   * 随机生成3个升级选项
   * @returns {Array} 3个升级选项对象
   */
  rollOptions() {
    const options = [];
    const poolCopy = [...this.upgradePool];
    
    // 根据稀有度加权随机抽取
    for (let i = 0; i < 3 && poolCopy.length > 0; i++) {
      const selected = this._weightedRandom(poolCopy);
      options.push(selected);
      
      // 移除已选中的选项，避免重复
      const index = poolCopy.findIndex(u => u.id === selected.id);
      if (index !== -1) {
        poolCopy.splice(index, 1);
      }
    }
    
    return options;
  }

  /**
   * 应用选中的升级
   * @param {Object} upgrade - 升级对象
   */
  applyUpgrade(upgrade) {
    if (!upgrade || !upgrade.effect) {
      console.warn('[UpgradeSystem] 无效的升级对象:', upgrade);
      return;
    }

    const { type, value } = upgrade.effect;
    
    // 记录升级次数
    if (this.upgradeCounts.hasOwnProperty(type)) {
      this.upgradeCounts[type]++;
    }

    // 应用升级效果
    switch (type) {
      case 'damage':
        this._applyDamageBoost(value);
        break;
      
      case 'bulletCount':
        this._applyBulletCount(value);
        break;
      
      case 'crit':
        this._applyCritChance(value);
        break;
      
      case 'critDamage':
        this._applyCritDamage(value);
        break;
      
      case 'aoe':
        this._applyAOEBoost(value);
        break;
      
      case 'jackpotGain':
        this._applyJackpotGain(value);
        break;
      
      case 'maxHP':
        this._applyMaxHPBoost(value);
        break;
      
      case 'speed':
        this._applySpeedBoost(value);
        break;
      
      case 'fireRate':
        this._applyFireRateBoost(value);
        break;
      
      default:
        console.warn('[UpgradeSystem] 未知的升级类型:', type);
    }

    console.log(`[UpgradeSystem] 已应用升级: ${upgrade.name} (${upgrade.description})`);
  }

  /**
   * 获取当前所有升级的统计信息
   * @returns {Object} 升级统计
   */
  getUpgradeStats() {
    return {
      counts: { ...this.upgradeCounts },
      totalUpgrades: Object.values(this.upgradeCounts).reduce((sum, v) => sum + v, 0),
    };
  }

  /**
   * 重置所有升级（用于新游戏）
   */
  reset() {
    for (const key in this.upgradeCounts) {
      this.upgradeCounts[key] = 0;
    }
    console.log('[UpgradeSystem] 升级系统已重置');
  }

  // ============ 私有方法：升级应用逻辑 (使用 BalanceManager) ============

  _applyDamageBoost(value) {
    balanceManager.applyModifier('damage', value);
  }

  _applyBulletCount(value) {
    // 子弹数量是加法叠加
    // 注意：BulletSystem 需要从 balanceManager 读取 bulletCount
    if (this.game.bulletSystem) {
       this.game.bulletSystem.extraProjectiles = (this.game.bulletSystem.extraProjectiles || 0) + value;
    }
  }

  _applyCritChance(value) {
    balanceManager.applyModifier('critChance', value);
  }

  _applyCritDamage(value) {
    balanceManager.applyModifier('critMultiplier', value);
  }

  _applyAOEBoost(value) {
    balanceManager.applyModifier('aoeRadius', value);
  }

  _applyJackpotGain(value) {
    balanceManager.applyModifier('jackpotGain', value);
    // 同步到 JackpotSystem
    if (this.game.jackpotSystem) {
      this.game.jackpotSystem.damageMultiplier = balanceManager.modifiers.jackpotGain;
    }
  }

  _applyMaxHPBoost(value) {
    balanceManager.applyModifier('maxHP', value);
    if (this.game.jackpotSystem) {
      const oldMax = this.game.jackpotSystem.maxHP;
      const newMax = balanceManager.getStat('maxHP');
      this.game.jackpotSystem.maxHP = newMax;
      // 保持比例或增加差值
      this.game.jackpotSystem.hp += (newMax - oldMax);
      this.game.jackpotSystem.updateHPUI();
    }
  }

  _applySpeedBoost(value) {
    balanceManager.applyModifier('speed', value);
  }

  _applyFireRateBoost(value) {
    balanceManager.applyModifier('fireInterval', value);
  }

  // ============ 工具方法 ============

  /**
   * 根据稀有度权重进行加权随机
   * @param {Array} pool - 升级选项池
   * @returns {Object} 随机选中的升级
   */
  _weightedRandom(pool) {
    const totalWeight = pool.reduce((sum, upgrade) => {
      return sum + (this.rarityWeights[upgrade.rarity] || 10);
    }, 0);

    let random = Math.random() * totalWeight;

    for (const upgrade of pool) {
      const weight = this.rarityWeights[upgrade.rarity] || 10;
      random -= weight;
      if (random <= 0) {
        return upgrade;
      }
    }

    // 兜底：返回最后一个
    return pool[pool.length - 1];
  }
}


