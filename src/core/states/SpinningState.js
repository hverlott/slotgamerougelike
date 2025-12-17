import { GameStateKey } from './GameStates.js';
import { withTimeout } from '../../utils/Async.js';

/**
 * 旋转状态 - 播放转轮动画
 */
export class SpinningState {
  async enter(ctx) {
    console.log('[State] -> SPINNING');
    
    const slotSystem = ctx.slotSystem;
    if (!slotSystem) {
      console.error('SlotSystem not found in context');
      ctx.machine.change(GameStateKey.IDLE);
      return;
    }

    // 标记正在旋转
    slotSystem.isSpinning = true;

    try {
      // 获取当前下注
      const currentBet = ctx.hudSystem?.getBet?.() ?? ctx.player?.bet ?? 10;
      
      // 记录下注
      if (ctx.rtpManager) {
        if (typeof ctx.rtpManager.recordBet === 'function') {
          ctx.rtpManager.recordBet(currentBet);
        } else {
          ctx.rtpManager.startRound(currentBet);
        }
      }

      // 开始旋转动画
      slotSystem.startSpin();
      
      // 获取结果数据
      const level = (ctx.levelManager?.currentLevel ?? 0) + 1;
      if (slotSystem.payoutScale !== undefined) {
        slotSystem.payoutScale = Math.max(0.35, 1 - (level - 1) * 0.06);
      }
      
      const { reels } = ctx.resultBank?.getResult?.(level) ?? { reels: [] };
      
      // 🔍 调试跟踪
      if (window.__TRACE__) {
        console.log(`⏱️ [SpinningState] Awaiting stopSpin... (${Date.now()})`);
      }
      ctx.machine.lastAwaitLabel = 'stopSpin';
      
      // 🛡️ 停止旋转并等待动画完成（带超时保护）
      const result = await withTimeout(
        slotSystem.stopSpin(reels, currentBet),
        2500,
        'SlotSystem.stopSpin',
        { 
          totalWin: 0, 
          winLines: [], 
          fxDone: Promise.resolve(), 
          reels 
        }
      );
      
      // 🔍 调试跟踪
      if (window.__TRACE__) {
        console.log(`✅ [SpinningState] stopSpin completed (${Date.now()})`);
      }
      
      // 存储结果到上下文
      ctx.lastSpinResult = {
        totalWin: result.totalWin ?? 0,
        winLines: result.winLines ?? [],
        fxDone: result.fxDone ?? Promise.resolve(),
        reels
      };

      // 刷怪（每次 spin）
      ctx.levelManager?.onSpin?.();

      // 转到 Resolving 状态
      ctx.machine.change(GameStateKey.RESOLVING);
      
    } catch (error) {
      console.error('[SpinningState] Error:', error);
      slotSystem.isSpinning = false;
      ctx.machine.change(GameStateKey.IDLE);
    }
  }

  update(dt, ctx) {
    // 旋转状态由动画系统驱动，不需要每帧逻辑
  }

  exit(ctx) {
    // 清理工作在 enter 的 finally 或后续状态处理
  }
}

