import { GameStateKey } from './GameStates.js';
import { withTimeout } from '../../utils/Async.js';

/**
 * 战斗状态 - 执行所有战斗事件（发射子弹、技能等）
 */
export class CombatState {
  async enter(ctx) {
    console.log('[State] -> COMBAT');
    
    try {
      const plan = ctx.currentPlan;
      if (!plan) {
        console.warn('[CombatState] No turn plan found');
        ctx.machine.change(GameStateKey.ADVANCE);
        return;
      }

      const events = plan.events ?? [];
      const modifiers = plan.modifiers ?? null; // 🎯 获取回合修饰符
      const winAmount = plan.finalWin ?? 0;
      const currentBet = ctx.hudSystem?.getBet?.() ?? ctx.player?.bet ?? 10;

      // 🔍 调试跟踪
      if (window.__TRACE__) {
        console.log(`⏱️ [CombatState] Starting ${events.length} combat events... (${Date.now()})`);
      }

      // 如果有战斗事件，逐个执行（传递修饰符，带超时保护）
      if (events.length > 0 && ctx.bulletSystem?.playCombatEvent) {
        for (let i = 0; i < events.length; i++) {
          const event = events[i];
          
          // 🎯 注入发射源坐标 (从 SlotSystem 获取中心点)
          if (ctx.slotSystem?.getPayoutOriginGlobal) {
            const origin = ctx.slotSystem.getPayoutOriginGlobal();
            if (origin && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
              event.startX = origin.x;
              event.startY = origin.y;
            }
          }

          ctx.machine.lastAwaitLabel = `playCombatEvent[${i}/${events.length}]`;
          
          // 🛡️ 每个战斗事件添加超时保护
          await withTimeout(
            ctx.bulletSystem.playCombatEvent(event, modifiers),
            1600,
            `CombatEvent[${i}]`,
            null
          );
          
          // 如果所有敌人已死，提前退出
          if (ctx.enemySystem?.isAllDead?.()) {
            break;
          }
        }
      }
      
      // 如果没有战斗事件系统，使用原始子弹发射逻辑
      else if (winAmount > 0 && ctx.bulletSystem) {
        ctx.machine.lastAwaitLabel = 'fireBulletsLegacy';
        await this.fireBulletsLegacy(ctx, winAmount, currentBet);
      }
      
      // 🔍 调试跟踪
      if (window.__TRACE__) {
        console.log(`✅ [CombatState] All combat events completed (${Date.now()})`);
      }

      // 转到 Advance 状态
      ctx.machine.change(GameStateKey.ADVANCE);
      
    } catch (error) {
      console.error('[CombatState] Error:', error);
      ctx.machine.change(GameStateKey.ADVANCE);
    }
  }

  /**
   * 旧版子弹发射逻辑（向后兼容）
   */
  async fireBulletsLegacy(ctx, winAmount, currentBet) {
    const MAX_CONCURRENT_BULLETS = 40;
    const BASE_DAMAGE = 10 * 100; // COMBAT_SCALE = 100
    const winLines = ctx.currentPlan?.spin?.wins ?? [];

    const shots = Math.max(1, Math.min(18, Math.ceil(winAmount / 10)));
    ctx.bulletSystem.damagePerHit = BASE_DAMAGE * (currentBet / 10);

    const winSymbols = (winLines || []).map((l) => l?.symbol).filter((v) => typeof v === 'number');
    const symbolTypeFor = (sym) => {
      if (sym === 4) return 4; // 爆炸弹
      if (sym === 3) return 3; // 激光
      if (sym === 2) return 2; // 能量弹
      return 1; // 基础弹
    };

    // 获取发射原点
    const globalOrigin = ctx.slotSystem?.getPayoutOriginGlobal?.() ?? { 
      x: ctx.app?.screen?.width / 2 ?? 400, 
      y: ctx.app?.screen?.height * 0.8 ?? 600 
    };
    const localOrigin = ctx.bulletSystem.container?.toLocal
      ? ctx.bulletSystem.container.toLocal(globalOrigin)
      : globalOrigin;

    for (let i = 0; i < shots; i += 1) {
      if (ctx.bulletSystem.bullets?.length >= MAX_CONCURRENT_BULLETS) break;
      
      const alive = ctx.enemySystem?.zombies?.filter((z) => z && !z.destroyed) ?? [];
      if (!alive.length) break;

      // 优先消灭最下面的敌人
      const sorted = alive.slice().sort((a, b) => {
        const ar = Number.isFinite(a.row) ? a.row : 0;
        const br = Number.isFinite(b.row) ? b.row : 0;
        if (br !== ar) return br - ar;
        const ay = Number.isFinite(a.y) ? a.y : 0;
        const by = Number.isFinite(b.y) ? b.y : 0;
        return by - ay;
      });

      const topRow = Number.isFinite(sorted[0].row) ? sorted[0].row : 0;
      const candidates = sorted.filter((z) => (Number.isFinite(z.row) ? z.row : 0) === topRow);
      const target = candidates[Math.floor(Math.random() * candidates.length)];

      // 根据符号选择子弹类型
      const sym = winSymbols.length ? winSymbols[i % winSymbols.length] : 1;
      let bulletType = symbolTypeFor(sym);
      if (winAmount >= currentBet * 10) bulletType = 4;
      else if (winAmount >= currentBet * 5) bulletType = 3;
      else if (winAmount >= currentBet * 2) bulletType = Math.max(bulletType, 2);

      ctx.bulletSystem.shoot(localOrigin.x, localOrigin.y, target, bulletType);
    }

    // 等待一小段时间让子弹飞行
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  update(dt, ctx) {
    // Combat 状态由异步事件驱动
  }

  exit(ctx) {
    // 清理
  }
}

