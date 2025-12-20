
import { logger } from '../utils/Logger.js';
import { GameStateKey } from '../core/states/GameStates.js';

export class AutoRepairSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.repairStrategies = [
      {
        pattern: /Slot realignment failed/i,
        action: () => this.fixSlotRealignment(),
        cooldown: 5000,
        lastRun: 0
      },
      {
        pattern: /Spin timeout/i,
        action: () => this.fixSpinTimeout(),
        cooldown: 5000,
        lastRun: 0
      },
      {
        pattern: /AudioContext/i,
        action: () => this.fixAudioContext(),
        cooldown: 10000,
        lastRun: 0
      }
    ];

    logger.onLog(this.handleLog.bind(this));
    logger.info('[AutoRepairSystem] Initialized monitoring');
  }

  handleLog(entry) {
    if (entry.level !== 'error' && entry.level !== 'warn') return;

    const msg = entry.message + (entry.data?.message || '');
    
    for (const strategy of this.repairStrategies) {
      if (strategy.pattern.test(msg)) {
        const now = Date.now();
        if (now - strategy.lastRun > strategy.cooldown) {
          logger.warn(`[AutoRepair] Triggering repair for: ${msg}`);
          strategy.action();
          strategy.lastRun = now;
        }
        break;
      }
    }
  }

  fixSlotRealignment() {
    logger.info('[AutoRepair] Resetting SlotSystem state...');
    if (this.ctx.slotSystem) {
      this.ctx.slotSystem.isSpinning = false;
      this.ctx.slotSystem.reels.forEach(reel => {
        reel.state = 'idle';
        if (reel.alignResolve) reel.alignResolve();
      });
      // Force state machine back to IDLE if stuck
      if (this.ctx.machine) {
        this.ctx.machine.change(GameStateKey.IDLE);
      }
    }
  }

  fixSpinTimeout() {
    logger.info('[AutoRepair] Force stopping spin...');
    if (this.ctx.slotSystem) {
        this.ctx.slotSystem.stopSpin([], 0).catch(() => {});
    }
  }

  fixAudioContext() {
    logger.info('[AutoRepair] Attempting to resume AudioContext...');
    if (this.ctx.audioSystem?.context?.state === 'suspended') {
        this.ctx.audioSystem.context.resume();
    }
  }
}
