import { GameStateKey } from './GameStates.js';

/**
 * 选择状态 - 玩家做出选择（升级、房间、奖励等）
 */
export class ChoiceState {
  async enter(ctx) {
    console.log('[State] -> CHOICE');
    
    try {
      // 🎯 获取升级选项（由 LevelManager 提供）
      const options = ctx.levelManager?.rollUpgradeOptions?.() ?? [];
      
      if (options.length === 0) {
        console.warn('[ChoiceState] No upgrade options available, skipping choice');
        ctx.machine.change(GameStateKey.IDLE);
        return;
      }

      console.log('[ChoiceState] Offering upgrades:', options);

      // 🎯 打开升级选择界面并等待玩家选择
      const selectedUpgrade = await ctx.hudSystem?.openChoice?.(options);
      
      if (selectedUpgrade) {
        console.log('[ChoiceState] Player selected:', selectedUpgrade.name);
        
        // 🎯 应用玩家选择的升级
        ctx.levelManager?.applyUpgrade?.(selectedUpgrade);
        
        // 🎯 完成升级选择（进入下一关）
        ctx.levelManager?.completeUpgradeChoice?.();
      } else {
        console.warn('[ChoiceState] No upgrade selected, proceeding anyway');
        ctx.levelManager?.completeUpgradeChoice?.();
      }

      // 选择完成后返回 Idle 状态
      ctx.machine.change(GameStateKey.IDLE);
      
    } catch (error) {
      console.error('[ChoiceState] Error:', error);
      // 即使出错也要清理状态并继续游戏
      ctx.levelManager?.completeUpgradeChoice?.();
      ctx.machine.change(GameStateKey.IDLE);
    }
  }

  update(dt, ctx) {
    // Choice 状态由用户交互驱动
  }

  exit(ctx) {
    // 清理
  }
}
