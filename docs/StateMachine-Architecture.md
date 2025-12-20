# 🎮 游戏状态机架构说明

## 📋 概述

本项目实现了一个轻量级状态机来控制核心游戏循环，将复杂的游戏流程分解为清晰的状态转换。

## 🗂️ 文件结构

```
src/core/
├── StateMachine.js          # 状态机核心引擎
├── GameLoop.js              # 游戏主循环（管理状态机）
├── TurnPlanner.js           # 回合计划器
└── states/
    ├── GameStates.js        # 状态常量定义
    ├── IdleState.js         # 空闲状态
    ├── SpinningState.js     # 旋转状态
    ├── ResolvingState.js    # 结算状态
    ├── CombatState.js       # 战斗状态
    ├── AdvanceState.js      # 推进状态
    ├── ChoiceState.js       # 选择状态
    └── GameOverState.js     # 游戏结束状态
```

## 🔄 状态转换流程

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  ┌──────┐   用户按Spin    ┌──────────┐             │
│  │ IDLE │ ────────────▶   │ SPINNING │             │
│  └──────┘                 └──────────┘             │
│     ▲                          │                    │
│     │                          │ 动画结束            │
│     │                          ▼                    │
│     │                    ┌────────────┐             │
│     │                    │ RESOLVING  │             │
│     │                    └────────────┘             │
│     │                          │                    │
│     │                          │ 计算完成            │
│     │                          ▼                    │
│     │                    ┌──────────┐               │
│     │                    │  COMBAT  │               │
│     │                    └──────────┘               │
│     │                          │                    │
│     │                          │ 战斗结束            │
│     │                          ▼                    │
│     │                    ┌──────────┐               │
│     │                    │ ADVANCE  │               │
│     │                    └──────────┘               │
│     │                          │                    │
│     │           ┌──────────────┼──────────────┐     │
│     │           │              │              │     │
│     │      需要选择          游戏结束       直接返回 │
│     │           │              │              │     │
│     │           ▼              ▼              │     │
│     │     ┌────────┐    ┌──────────┐         │     │
│     │     │ CHOICE │    │ GAMEOVER │         │     │
│     │     └────────┘    └──────────┘         │     │
│     │           │                             │     │
│     └───────────┴─────────────────────────────┘     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 📝 各状态详细说明

### 1️⃣ IdleState（空闲状态）
- **职责**: 等待玩家输入
- **进入时**: 启用 Spin 按钮，重置旋转锁
- **退出时**: 禁用 Spin 按钮
- **转换到**: SPINNING（玩家点击 Spin 按钮）

### 2️⃣ SpinningState（旋转状态）
- **职责**: 执行转轮旋转动画
- **进入时**: 
  - 记录下注
  - 启动旋转动画
  - 获取结果数据
  - 停止旋转并等待动画完成
  - 刷怪（每次 spin）
- **转换到**: RESOLVING（动画完成）

### 3️⃣ ResolvingState（结算状态）
- **职责**: 计算中奖结果，构建回合计划
- **进入时**:
  - 构建回合计划（TurnPlanner）
  - 显示中奖结果（HUD）
  - 处理 Boss 系统伤害与奖励
  - 播放中奖线特效
  - 记录 RTP 数据
- **转换到**: COMBAT（结算完成）

### 4️⃣ CombatState（战斗状态）
- **职责**: 执行所有战斗事件（发射子弹、技能等）
- **进入时**:
  - 逐个执行回合计划中的战斗事件
  - 发射子弹攻击敌人
  - 检查敌人是否全部死亡
- **转换到**: ADVANCE（战斗结束）

### 5️⃣ AdvanceState（推进状态）
- **职责**: 敌人前进、波次刷新、关卡推进
- **进入时**:
  - 敌人前进
  - 更新 HUD 显示
  - 检查游戏是否结束
  - 检查是否需要提供选择
- **转换到**: 
  - GAMEOVER（游戏结束）
  - CHOICE（需要选择）
  - IDLE（正常继续）

### 6️⃣ ChoiceState（选择状态）
- **职责**: 玩家做出选择（房间、升级、奖励等）
- **进入时**:
  - 获取可选项
  - 打开选择界面并等待玩家选择
  - 应用玩家的选择
- **转换到**: IDLE（选择完成）

### 7️⃣ GameOverState（游戏结束状态）
- **职责**: 处理游戏失败逻辑
- **进入时**:
  - 暂停游戏
  - 禁用 Spin 按钮
  - 显示 GameOver UI
  - 触发游戏结束回调
- **转换到**: 无（游戏结束）

## 🔧 核心组件

### StateMachine.js
```javascript
// 提供三个核心方法：
register(key, state)  // 注册状态
change(key, payload)  // 切换状态（异步）
update(dt)            // 每帧更新当前状态
```

### GameLoop.js
```javascript
// 游戏主循环
constructor(ctx)      // 初始化状态机和回合计划器
registerStates()      // 注册所有游戏状态
update(dt)            // 每帧驱动状态机
```

## 🎯 集成要点

### 在 main.js 中的集成

1. **创建游戏上下文 (ctx)**：
```javascript
const ctx = {
  game,
  app,
  gridSystem,
  enemySystem,
  slotSystem,
  bulletSystem,
  levelManager,
  rtpManager,
  hudSystem,
  // ... 其他系统
};
```

2. **初始化 GameLoop**：
```javascript
const gameLoop = new GameLoop(ctx);
```

3. **Ticker 更新**：
```javascript
game.ticker.add((delta) => {
  const deltaMS = Math.min(delta * (1000 / 60), 50);
  gameLoop.update(deltaMS);
  // ... 其他系统更新
});
```

4. **Spin 按钮触发状态机**：
```javascript
spinButton.addEventListener('click', () => {
  ctx.machine.change(GameStateKey.SPINNING);
});
```

## ✅ 约束条件完成情况

- ✅ 不使用新库（纯 JavaScript 实现）
- ✅ 最小化差异（保持现有系统完整）
- ✅ 稳定运行时（异步状态转换，错误处理）
- ✅ 保持现有 ticker 更新逻辑
- ✅ 重新路由控制流（从直接调用改为状态机驱动）

## 🚀 未来扩展

1. **新增状态**：可以轻松添加新状态（如 ShopState、UpgradeState 等）
2. **状态数据持久化**：可以将 `ctx.currentPlan` 扩展为完整的状态存储
3. **状态转换动画**：在状态转换时添加过渡动画
4. **状态历史记录**：用于回放和调试
5. **条件转换**：更复杂的状态转换逻辑（如多个条件判断）

## 📚 调试技巧

1. **查看当前状态**：
```javascript
console.log(__dslot.gameLoop.machine.current);
```

2. **手动触发状态转换**：
```javascript
__dslot.ctx.machine.change(GameStateKey.IDLE);
```

3. **查看回合计划**：
```javascript
console.log(__dslot.ctx.currentPlan);
```

## 🎉 总结

这个轻量级状态机架构实现了：
- ✨ 清晰的职责分离（每个状态独立管理自己的逻辑）
- ✨ 可维护性强（新增状态只需创建新文件并注册）
- ✨ 易于调试（状态转换有明确的日志输出）
- ✨ 向后兼容（保持现有系统完整）
- ✨ 异步友好（支持 async/await）


