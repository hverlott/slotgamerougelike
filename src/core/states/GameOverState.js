/**
 * 游戏结束状态 - 处理游戏失败逻辑
 */
export class GameOverState {
  async enter(ctx) {
    console.log('[State] -> GAMEOVER');
    
    // 暂停游戏
    if (ctx.levelManager?.setPaused) {
      ctx.levelManager.setPaused(true);
    }
    
    // 禁用 Spin 按钮
    if (ctx.hudSystem?.setSpinEnabled) {
      ctx.hudSystem.setSpinEnabled(false);
    }
    
    // 显示 GameOver UI（如果存在）
    if (ctx.hudSystem?.showGameOver) {
      ctx.hudSystem.showGameOver();
    }
    
    // 触发游戏结束回调
    if (ctx.game?.onGameOver) {
      ctx.game.onGameOver();
    }
  }

  update(dt, ctx) {
    // GameOver 状态不需要更新，游戏已停止
  }

  exit(ctx) {
    // 如果需要重新开始游戏，可以在这里清理
  }
}

