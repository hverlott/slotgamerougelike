
import { logger } from '../utils/Logger.js';

export const BALANCE_CONFIG = {
  base: {
    damage: 1000, // x100 scale
    critChance: 0.05,
    critMultiplier: 2.0,
    speed: 26,
    aoeRadius: 80,
    pierceCount: 0,
    chainCount: 0,
    maxHP: 220,
    fireInterval: 1.0,
  },
  limits: {
    maxCritChance: 1.0,
    minFireInterval: 0.1,
    maxSpeed: 50,
  },
  scaling: {
    damagePerLevel: 0.1, // +10% per level
    hpPerLevel: 100,
  }
};

export class BalanceManager {
  constructor() {
    this.modifiers = {
      damage: 1.0,
      critChance: 0.0,
      critMultiplier: 0.0,
      speed: 1.0,
      aoeRadius: 1.0,
      pierceCount: 0,
      chainCount: 0,
      maxHP: 1.0,
      fireInterval: 1.0,
      jackpotGain: 1.0,
    };
    this.additives = {
      damage: 0,
      bulletCount: 0,
    };
    this.level = 1;
    logger.info('[BalanceManager] Initialized');
  }

  setLevel(level) {
    this.level = level;
  }

  applyModifier(type, value, isAdditive = false) {
    if (isAdditive) {
      if (this.additives[type] !== undefined) {
        this.additives[type] += value;
      }
    } else {
      if (this.modifiers[type] !== undefined) {
        // Multipliers are usually additive to the base multiplier (1.0 + 0.2 + 0.3 = 1.5)
        // or multiplicative (1.0 * 1.2 * 1.3).
        // Let's use additive percentage for simplicity: 1.0 + value
        this.modifiers[type] += value;
      }
    }
    logger.info(`[Balance] Applied ${type} ${value > 0 ? '+' : ''}${value} (${isAdditive ? 'flat' : 'mult'})`);
  }

  getStat(statName) {
    const base = BALANCE_CONFIG.base[statName];
    if (base === undefined) return 0;

    let val = base;
    
    // Apply Level Scaling
    if (statName === 'damage') {
      val *= (1 + (this.level - 1) * BALANCE_CONFIG.scaling.damagePerLevel);
    }

    // Apply Multipliers
    if (this.modifiers[statName]) {
        // Special case for fireInterval (lower is better)
        if (statName === 'fireInterval') {
             val *= this.modifiers[statName]; 
        } else {
             val *= this.modifiers[statName];
        }
    }
    
    // Apply Additives
    if (this.additives[statName]) {
      val += this.additives[statName];
    }

    // Limits
    if (statName === 'critChance') return Math.min(BALANCE_CONFIG.limits.maxCritChance, val);
    if (statName === 'speed') return Math.min(BALANCE_CONFIG.limits.maxSpeed, val);

    return val;
  }

  // Helper for BulletSystem
  getDamage(bet = 10) {
    // Damage scales with Bet
    const baseDmg = this.getStat('damage');
    return baseDmg * (bet / 10);
  }

  // Debug Report
  getReport() {
    return Object.keys(BALANCE_CONFIG.base).map(k => ({
      stat: k,
      base: BALANCE_CONFIG.base[k],
      current: this.getStat(k).toFixed(2),
      modifier: this.modifiers[k]?.toFixed(2) || '1.00'
    }));
  }
}

export const balanceManager = new BalanceManager();
