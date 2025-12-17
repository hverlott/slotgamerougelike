import { GameStateKey } from './GameStates.js';
import { withTimeout, allWithTimeout } from '../../utils/Async.js';

/**
 * 结算状态 - 计算中奖结果并构建回合计划
 */
export class ResolvingState {
  async enter(ctx) {
    console.log('[State] -> RESOLVING');
    
    const spinResult = ctx.lastSpinResult;
    if (!spinResult) {
      console.warn('[ResolvingState] No spin result found');
      ctx.machine.change(GameStateKey.COMBAT);
      return;
    }

    try {
      let totalWin = spinResult.totalWin ?? 0;
      const winLines = spinResult.winLines ?? [];
      const currentBet = ctx.hudSystem?.getBet?.() ?? ctx.player?.bet ?? 10;

      // 构建回合计划
      const planInput = {
        grid: spinResult.reels,
        wins: winLines,
        totalMul: totalWin / (currentBet || 1)
      };
      
      ctx.currentPlan = ctx.turnPlanner?.buildTurnPlan?.(planInput) ?? { 
        spin: planInput, 
        events: [] 
      };

      // 显示中奖结果（HUD）
      if (ctx.hudSystem?.showSpinResult) {
        ctx.hudSystem.showSpinResult(ctx.currentPlan.spin);
      }

      // Boss 系统伤害与奖励
      if (ctx.jackpotSystem?.applySpin) {
        const { bonus = 0, fxDone: bossFxDone } = 
          ctx.jackpotSystem.applySpin(currentBet, totalWin);
        
        if (bonus > 0) {
          totalWin += bonus;
          if (ctx.bossBonusTotal !== undefined) {
            ctx.bossBonusTotal += bonus;
          }
        }

        // 🔍 调试跟踪
        if (window.__TRACE__) {
          console.log(`⏱️ [ResolvingState] Awaiting FX completion... (${Date.now()})`);
        }
        ctx.machine.lastAwaitLabel = 'fxDone+bossFxDone';
        
        // 🛡️ 等待 Boss 特效和中奖特效完成（带超时保护）
        await allWithTimeout([
          spinResult.fxDone ?? Promise.resolve(),
          bossFxDone ?? Promise.resolve()
        ], 1000, 'ResolvingFX');
      } else {
        // 🛡️ 等待中奖特效完成（带超时保护）
        await withTimeout(
          spinResult.fxDone ?? Promise.resolve(),
          1000,
          'spinResult.fxDone',
          null
        );
      }

      // 🔍 调试跟踪
      if (window.__TRACE__) {
        console.log(`⏱️ [ResolvingState] Awaiting playWinLines... (${Date.now()})`);
      }
      ctx.machine.lastAwaitLabel = 'playWinLines';
      
      // 🛡️ 播放中奖线特效（赛博朋克霓虹光束，带超时保护）
      if (ctx.fxSystem?.playWinLines && ctx.slotSystem) {
        await withTimeout(
          ctx.fxSystem.playWinLines(ctx.currentPlan.spin, ctx.slotSystem),
          1500,
          'FXSystem.playWinLines',
          null
        );
      }
      
      // 🔍 调试跟踪
      if (window.__TRACE__) {
        console.log(`✅ [ResolvingState] All FX completed (${Date.now()})`);
      }

      // 记录最终收益
      if (ctx.rtpManager?.finishRound) {
        ctx.rtpManager.finishRound(totalWin);
      }

      // 存储最终赢得金额，供 Combat 状态使用
      ctx.currentPlan.finalWin = totalWin;

      // 🔥 更新连击系统
      if (ctx.comboSystem) {
        if (totalWin > 0) {
          ctx.comboSystem.recordWin(totalWin);
        } else {
          ctx.comboSystem.recordLoss();
        }
      }

      // 🔊 播放中奖音效
      if (ctx.audioSystem) {
        const winMultiplier = totalWin / (currentBet || 1);
        if (winMultiplier >= 5) {
          ctx.audioSystem.play('win_big');
        } else if (totalWin > 0) {
          ctx.audioSystem.play('win_small');
        }
      }

      // 转到 Combat 状态
      ctx.machine.change(GameStateKey.COMBAT);
      
    } catch (error) {
      console.error('[ResolvingState] Error:', error);
      ctx.machine.change(GameStateKey.IDLE);
    }
  }

  update(dt, ctx) {
    // Resolving 状态主要是异步等待
  }

  exit(ctx) {
    // 清理临时数据
  }
}

