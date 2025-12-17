import { GameStateKey } from './GameStates.js';

/**
 * 推进状态 - 敌人前进、波次刷新、关卡推进
 */
export class AdvanceState {
  async enter(ctx) {
    console.log('[State] -> ADVANCE');
    
    try {
      // 敌人前进 / 波次刷新
      if (ctx.levelManager?.advance) {
        ctx.levelManager.advance();
      }

      // 更新 HUD 显示
      if (ctx.hudSystem?.update) {
        ctx.hudSystem.update();
      }

      // 检查游戏是否结束
      if (ctx.levelManager?.isGameOver?.() || ctx.enemySystem?.hasReachedBottom?.()) {
        ctx.machine.change(GameStateKey.GAMEOVER);
        return;
      }

      // 检查是否需要提供选择（如房间选择、升级选择等）
      if (ctx.levelManager?.shouldOfferChoice?.()) {
        ctx.machine.change(GameStateKey.CHOICE);
      } else {
        // 直接返回 Idle 状态
        ctx.machine.change(GameStateKey.IDLE);
      }
      
    } catch (error) {
      console.error('[AdvanceState] Error:', error);
      ctx.machine.change(GameStateKey.IDLE);
    }
  }

  update(dt, ctx) {
    // Advance 状态通常是瞬时的
  }

  exit(ctx) {
    // 清理
  }
}

