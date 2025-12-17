/**
 * 空闲状态 - 等待玩家按下 Spin 按钮
 */
export class IdleState {
  async enter(ctx) {
    console.log('[State] -> IDLE');
    
    // 启用 Spin 按钮
    if (ctx.hudSystem?.setSpinEnabled) {
      ctx.hudSystem.setSpinEnabled(true);
    }
    
    // 重置旋转锁
    if (ctx.slotSystem) {
      ctx.slotSystem.isSpinning = false;
    }
  }

  update(dt, ctx) {
    // Idle 状态通常不需要每帧更新
  }

  exit(ctx) {
    // 退出时禁用 Spin 按钮
    if (ctx.hudSystem?.setSpinEnabled) {
      ctx.hudSystem.setSpinEnabled(false);
    }
  }
}

