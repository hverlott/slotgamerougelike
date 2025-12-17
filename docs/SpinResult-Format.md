# 🎰 SpinResult 统一格式说明

## 📋 核心数据结构

所有转轮结果统一使用以下格式：

```javascript
SpinResult {
  grid: Array<Array<number>>,   // 3x3 符号网格
  wins: Array<WinLine>,          // 中奖线数组
  totalMul: number               // 总倍率
}

WinLine {
  lineIndex: number,             // 中奖线索引 (0-8)
  symbols: Array<number>,        // 该线上的符号 ID
  payoutMul: number              // 该线的倍率
}
```

### 符号映射表

| ID | 名称    | 倍率 | 说明           |
|----|---------|------|----------------|
| 0  | EMPTY   | 0x   | 不支付         |
| 1  | BULLET  | 0.5x | 低级符号       |
| 2  | GRENADE | 1x   | 中级符号       |
| 3  | MISSILE | 2x   | 高级符号       |
| 4  | WILD    | 5x   | 万能符号       |

---

## 🔄 数据流向

```
┌─────────────────┐
│  ResultBank     │  生成盘面结果
│  getResult()    │  - 控制命中率
└────────┬────────┘  - 避免超大赢分
         │
         │ SpinResult { grid, wins, totalMul }
         ↓
┌─────────────────┐
│  SlotSystem     │  渲染转轮动画
│  playSpin()     │  - 播放动画
└────────┬────────┘  - 内部结算
         │
         │ SpinResult (+ bet, totalWin, timestamp)
         ↓
┌─────────────────┐
│  GameLoop       │  协调流程
│  RESOLVING 状态 │  - 获取 lastResult
└────────┬────────┘  - 显示结果
         │
         │ SpinResult
         ↓
┌─────────────────┐
│  TurnPlanner    │  构建战斗计划
│  buildTurnPlan()│  - 遍历 wins
└────────┬────────┘  - 生成 events
         │
         │ TurnPlan { spin, events }
         ↓
┌─────────────────┐
│  GameLoop       │  执行战斗
│  COMBAT 状态    │  - 逐个执行 events
└─────────────────┘  - 更新游戏状态
```

---

## 📝 使用示例

### 1. ResultBank 生成结果

```javascript
// src/systems/ResultBank.js
const spinResult = resultBank.getResult(level);
// {
//   grid: [[1,1,0], [1,2,0], [4,2,1]],
//   wins: [
//     { lineIndex: 0, symbols: [1,1,4], payoutMul: 0.5 }
//   ],
//   totalMul: 0.5
// }
```

### 2. SlotSystem 播放动画

```javascript
// src/systems/SlotSystem.js
const result = await slotSystem.playSpin(bet);
// {
//   grid: [[1,1,0], [1,2,0], [4,2,1]],
//   wins: [
//     { lineIndex: 0, symbols: [1,1,4], payoutMul: 0.5 }
//   ],
//   totalMul: 0.5,
//   bet: 10,
//   totalWin: 5,  // 0.5 * 10 * payoutScale
//   timestamp: 1702345678901
// }
```

### 3. TurnPlanner 构建战斗计划

```javascript
// src/core/TurnPlanner.js
const plan = turnPlanner.buildTurnPlan(spinResult);
// {
//   spin: { grid, wins, totalMul },
//   events: [
//     { type: "Shoot", dmg: 10, count: 2 },      // 2个 BULLET
//     { type: "WildBonus", multiplier: 1.5, count: 1 }  // 1个 WILD
//   ]
// }
```

### 4. GameLoop 执行战斗

```javascript
// src/core/GameLoop.js
const events = ctx.currentPlan?.events || [];
for (const ev of events) {
  await ctx.bulletSystem.playCombatEvent(ev);
  if (ctx.enemySystem.isAllDead?.()) break;
}
```

---

## 🔮 未来扩展点

### 词缀系统
修改 `TurnPlanner.buildTurnPlan()` 中的事件参数：

```javascript
// 例如："爆炸专家" 词缀
if (player.hasAffix("Demolition Expert")) {
  grenadeEvent.dmg *= 1.5;
  grenadeEvent.radius *= 1.2;
}
```

### 套装效果
在 `buildTurnPlan()` 中添加额外事件：

```javascript
// 例如："连击套装"
if (player.hasSet("Combo Set") && events.length >= 3) {
  events.push({ 
    type: "ComboBonus", 
    dmg: events.length * 5 
  });
}
```

### 圣物系统
在 `buildTurnPlan()` 中修改触发条件：

```javascript
// 例如："幸运硬币" 圣物
if (player.hasRelic("Lucky Coin") && totalMul === 0) {
  events.push({ 
    type: "LuckySalvage", 
    coins: 5 
  });
}
```

---

## ✅ 关键优势

1. **格式统一**：所有系统使用同一个 SpinResult 格式
2. **解耦设计**：ResultBank 只管数学，SlotSystem 只管渲染，TurnPlanner 只管战斗
3. **易于扩展**：新增词缀、套装、圣物只需修改 TurnPlanner
4. **易于测试**：可以直接构造 SpinResult 测试 TurnPlanner
5. **易于调试**：可以在任何阶段打印 SpinResult 查看数据

---

## 🎯 核心原则

> **"只要 SpinResult 格式稳定，TurnPlanner 就能稳定工作"**

- ResultBank 和 SlotSystem 负责生成正确的 SpinResult
- TurnPlanner 负责将 SpinResult 转换为战斗事件
- GameLoop 负责协调整个流程

**所有扩展都在 TurnPlanner 中进行，不修改 SpinResult 格式！**
