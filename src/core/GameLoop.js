import { StateMachine } from "./StateMachine.js";
import { GameStateKey } from "./states/GameStates.js";
import { TurnPlanner } from "./TurnPlanner.js";
import { IdleState } from "./states/IdleState.js";
import { SpinningState } from "./states/SpinningState.js";
import { ResolvingState } from "./states/ResolvingState.js";
import { CombatState } from "./states/CombatState.js";
import { AdvanceState } from "./states/AdvanceState.js";
import { ChoiceState } from "./states/ChoiceState.js";
import { GameOverState } from "./states/GameOverState.js";

/**
 * 游戏主循环 - 管理状态机和回合计划
 */
export class GameLoop {
  constructor(ctx) {
    this.ctx = ctx;

    // 注入回合计划器
    this.ctx.turnPlanner = new TurnPlanner(ctx);

    // 初始化状态机
    this.machine = new StateMachine(ctx);
    this.ctx.machine = this.machine;

    // 注册所有游戏状态
    this.registerStates();
    
    // 初始状态为 IDLE
    this.machine.change(GameStateKey.IDLE);
  }

  /**
   * 注册所有游戏状态
   */
  registerStates() {
    // 注册各个独立状态类
    this.machine.register(GameStateKey.IDLE, new IdleState());
    this.machine.register(GameStateKey.SPINNING, new SpinningState());
    this.machine.register(GameStateKey.RESOLVING, new ResolvingState());
    this.machine.register(GameStateKey.COMBAT, new CombatState());
    this.machine.register(GameStateKey.ADVANCE, new AdvanceState());
    this.machine.register(GameStateKey.CHOICE, new ChoiceState());
    this.machine.register(GameStateKey.GAMEOVER, new GameOverState());
  }

  /**
   * 每帧更新 - 驱动状态机
   */
  update(dt) {
    this.machine.update(dt);
  }
}
