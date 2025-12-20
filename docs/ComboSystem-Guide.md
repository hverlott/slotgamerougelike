# 🔥 ComboSystem - 连击/热度计量系统指南

## 📋 概述

ComboSystem 是一个动态的连击和热度追踪系统，通过奖励连续胜利和持续输出来增强战斗体验。系统包含三个核心机制：连击计数、热度计量和过载模式。

## 🎮 核心机制

### 1️⃣ 连击计数（Combo Count）

**追踪方式**：
- ✅ 每次 Spin 胜利（totalWin > 0）：`comboCount++`
- ❌ 每次 Spin 失败（totalWin = 0）：`comboCount = 0`

**连击阈值与增益**：

| 连击数 | 增益名称 | 效果 |
|--------|---------|------|
| **3** | 小火花 🔥 | +1 弹幕, +5% 暴击 |
| **6** | 火焰 🔥🔥 | +2 弹幕, +10% 暴击, +10% AOE |
| **10** | 爆燃 🔥🔥🔥 | +3 弹幕, +15% 暴击, +20% AOE, +1 穿透 |
| **15** | 烈焰 🔥🔥🔥🔥 | +4 弹幕, +20% 暴击, +30% AOE, +2 穿透, +5% 吸血 |
| **20** | 地狱火 🔥🔥🔥🔥🔥 | +5 弹幕, +30% 暴击, +50% AOE, +3 穿透, +10% 吸血, +1 连锁 |

### 2️⃣ 热度计量（Heat Meter 0-100）

**热度来源**：
- 🎰 **Spin 胜利**：+25 热度
- ⚔️ **造成伤害**：+0.05 热度/点伤害（100 伤害 = +5 热度）

**热度衰减**：
- 速度：8 热度/秒
- 延迟：战斗后 2 秒才开始衰减（`HEAT_DECAY_DELAY`）
- 作用：防止战斗中热度快速流失

**热度颜色**：
```javascript
0-20%:   绿色 (0x00ff88) - 冷却
20-40%:  黄色 (0xffcc00) - 升温
40-60%:  橙色 (0xff8800) - 热力
60-80%:  红色 (0xff3366) - 炽热
80-100%: 紫色 (0xff00ff) - 高热
100%:    白色 (0xffffff) - 过载！
```

### 3️⃣ 过载模式（Overdrive）

**触发条件**：
- 热度达到 100 时自动激活
- 持续时间：6 秒（`OVERDRIVE_DURATION`）

**过载效果**：
- ⚡ **Shoot 事件**：+1 额外弹幕
- 💥 **爆炸事件**（Grenade/Missile）：AOE 范围 x1.3

**可视化**：
- 连击计数显示为 `⚡x{count}` 而非 `x{count}`
- 连击文字颜色变为热度颜色（白色闪烁）
- 热度条充满并发光

## 🔧 系统架构

### 数据流

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ResolvingState                                 │
│     ↓                                           │
│  recordWin() / recordLoss()                     │
│     ↓                                           │
│  comboCount++  heat += 25                       │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                                                 │
│  BulletSystem → EnemySystem.takeDamage()        │
│                    ↓                            │
│                onDamageDealt(damage)            │
│                    ↓                            │
│                heat += damage * 0.05            │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                                                 │
│  TurnPlanner.buildTurnPlan()                    │
│     ↓                                           │
│  buildModifiers = BuildSystem.analyze()         │
│  comboModifiers = ComboSystem.getModifiers()    │
│     ↓                                           │
│  mergeModifiers() → finalModifiers              │
│     ↓                                           │
│  CombatState → BulletSystem (应用修饰符)         │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                                                 │
│  ComboSystem.update(deltaMS)                    │
│     ↓                                           │
│  热度衰减（战斗后 2 秒延迟）                      │
│  过载状态更新（6 秒后自动结束）                   │
│     ↓                                           │
│  HUDSystem.setComboState()                      │
│     ↓                                           │
│  显示连击数、热度条                              │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 文件结构

```
src/
├── systems/
│   ├── ComboSystem.js       # 🆕 连击/热度系统
│   ├── HUDSystem.js         # 🔄 添加连击/热度显示
│   └── EnemySystem.js       # 🔄 添加伤害回调
└── core/
    ├── TurnPlanner.js       # 🔄 合并 Combo 修饰符
    └── states/
        └── ResolvingState.js # 🔄 追踪胜负
```

## 📊 可调参数

所有参数集中在 `ComboSystem.js` 的 `CONFIG` 对象中：

```javascript
const CONFIG = {
  // 热度相关
  HEAT_MAX: 100,                    // 最大热度
  HEAT_PER_WIN: 25,                 // 每次胜利增加的热度
  HEAT_PER_DAMAGE: 0.05,            // 每点伤害增加的热度
  HEAT_DECAY_PER_SECOND: 8,         // 每秒衰减的热度
  HEAT_DECAY_DELAY: 2000,           // 热度衰减延迟（毫秒）

  // 过载相关
  OVERDRIVE_THRESHOLD: 100,         // 激活过载的热度阈值
  OVERDRIVE_DURATION: 6000,         // 过载持续时间（毫秒）
  OVERDRIVE_EXTRA_PROJECTILES: 1,   // 过载时额外弹幕
  OVERDRIVE_AOE_SCALE: 1.3,         // 过载时 AOE 范围倍率

  // 连击相关
  COMBO_THRESHOLDS: [3, 6, 10, 15, 20], // 连击阈值
  COMBO_BUFFS: {
    3:  { /* 小火花增益 */ },
    6:  { /* 火焰增益 */ },
    10: { /* 爆燃增益 */ },
    15: { /* 烈焰增益 */ },
    20: { /* 地狱火增益 */ },
  },
};
```

### 调整建议

#### 🔥 增加热度积累速度

```javascript
HEAT_PER_WIN: 35,           // 原来 25
HEAT_PER_DAMAGE: 0.08,      // 原来 0.05
```

#### ❄️ 减缓热度衰减

```javascript
HEAT_DECAY_PER_SECOND: 5,   // 原来 8（衰减更慢）
HEAT_DECAY_DELAY: 3000,     // 原来 2000（延迟更久）
```

#### ⚡ 延长过载时间

```javascript
OVERDRIVE_DURATION: 8000,   // 原来 6000（8 秒）
```

#### 🎯 调整连击阈值

```javascript
COMBO_THRESHOLDS: [2, 4, 7, 12, 18], // 降低门槛
```

#### 💪 增强连击增益

```javascript
COMBO_BUFFS: {
  3: { 
    extraProjectiles: 2,    // 原来 1
    critChance: 0.1,        // 原来 0.05
  },
  // ...
},
```

## 🎨 UI 显示

### 连击计数（右上角）

```
位置：右侧统计栏第 4 行
图标：🔥
格式：
  - 普通：x{comboCount}
  - 过载：⚡x{comboCount}（文字颜色 = 热度颜色）
```

### 热度条（顶部 HUD）

```
位置：主进度条下方
高度：6 像素
颜色：动态（根据热度百分比）
样式：
  - 背景：深色半透明
  - 填充：热度颜色 + 高光
  - 边框：热度颜色半透明
```

## 🚀 使用示例

### 1. 查看当前连击状态

```javascript
const state = __dslot.comboSystem.getState();
console.log(state);

// 输出：
// {
//   comboCount: 7,
//   heat: 68.5,
//   heatPercent: 68.5,
//   overdriveActive: false,
//   overdriveTimeLeft: 0,
//   currentBuff: { name: '火焰 🔥🔥', ... }
// }
```

### 2. 查看当前修饰符

```javascript
const modifiers = __dslot.comboSystem.getModifiers();
console.log(modifiers);

// 输出：
// {
//   extraProjectiles: 2,  // 连击 6 的增益
//   pierce: 0,
//   chain: 0,
//   aoeScale: 1.1,
//   critChance: 0.1,
//   lifesteal: 0,
//   overloadBonus: 0,
// }
```

### 3. 手动触发过载（测试）

```javascript
__dslot.comboSystem.heat = 100;
__dslot.comboSystem.activateOverdrive();
```

### 4. 重置系统

```javascript
__dslot.comboSystem.reset();
```

## 📈 策略指南

### 🎯 如何维持高连击

1. **优先选择稳定胜利的下注**
   - 小额多次胜利 > 大额偶尔胜利
   - 连击数比单次收益更重要

2. **避免激进的高风险策略**
   - 一次失败会清零所有连击
   - 连击 10+ 的增益非常强大

3. **利用连击增益构建循环**
   - 连击 6：AOE +10% → 更快清怪 → 更容易胜利
   - 连击 10：穿透 +1 → 更高效率 → 维持连击

### 🔥 如何快速积累热度

1. **造成大量伤害**
   - 优先攻击高血量目标
   - 使用 AOE 技能同时攻击多个敌人
   - 每 100 伤害 = +5 热度

2. **连续胜利**
   - 每次胜利 = +25 热度
   - 4 次连续胜利 = 100 热度 = 过载激活！

3. **合理利用衰减延迟**
   - 战斗后 2 秒内继续造成伤害
   - 延长热度高峰期

### ⚡ 如何利用过载模式

1. **过载期间疯狂输出**
   - +1 弹幕 + AOE x1.3 = 超高伤害
   - 持续 6 秒，足够完成一轮完整战斗

2. **叠加 BuildSystem 原型**
   - BULLET_FOCUS (2 弹幕) + Overdrive (1 弹幕) = 3 额外弹幕！
   - GRENADE_FOCUS (AOE x1.5) + Overdrive (AOE x1.3) = AOE x1.95！

3. **配合连击增益**
   - 连击 10 + 过载 = +4 弹幕, +1 穿透, AOE x1.56
   - 连击 20 + 过载 = +6 弹幕, +3 穿透, +1 连锁, AOE x1.95

## 🎮 游戏性影响

### 正面影响

1. **奖励连续胜利**
   - 玩家有动力维持连胜
   - 增加策略深度（风险管理）

2. **强化战斗节奏**
   - 热度系统鼓励持续战斗
   - 过载模式提供爆发期

3. **与 BuildSystem 协同**
   - 两套修饰符系统叠加
   - 创造独特的战斗组合

4. **可视化反馈强烈**
   - 热度条颜色变化
   - 过载模式闪烁特效
   - 连击数字不断攀升

### 平衡性考虑

1. **失败惩罚重**
   - 一次失败清零连击
   - 需要仔细权衡风险

2. **前期弱，后期强**
   - 需要时间积累连击
   - 连击 10+ 才开始显著

3. **热度需要持续维护**
   - 每秒衰减 8%
   - 需要不断造成伤害

## 🔧 调试工具

### 控制台命令

```javascript
// 查看状态
__dslot.comboSystem.getState()

// 查看修饰符
__dslot.comboSystem.getModifiers()

// 手动增加连击
__dslot.comboSystem.comboCount = 10
__dslot.comboSystem.updateComboBuff()

// 手动增加热度
__dslot.comboSystem.addHeat(50)

// 激活过载
__dslot.comboSystem.activateOverdrive()

// 重置系统
__dslot.comboSystem.reset()

// 查看热度颜色
__dslot.comboSystem.getHeatColor().toString(16)
```

### 调试模式

在 `ComboSystem.js` 中添加调试日志：

```javascript
update(deltaMS) {
  console.log(`[Debug] Heat: ${this.heat.toFixed(1)}, Combo: ${this.comboCount}, Overdrive: ${this.overdriveActive}`);
  // ...
}
```

## 🎉 总结

ComboSystem 为游戏增加了：

- ✨ **连击机制**：奖励连续胜利，惩罚失败
- 🔥 **热度系统**：追踪战斗强度，动态反馈
- ⚡ **过载模式**：提供短暂爆发期，高风险高回报
- 🎯 **策略深度**：玩家需要权衡风险与收益
- 🎨 **可视化反馈**：热度条颜色变化，连击数字攀升
- 🔗 **系统协同**：与 BuildSystem 完美叠加

现在您的游戏不仅有 roguelike 构建系统，还有动态的连击和热度追踪，大大增强了战斗的刺激感和策略性！🔥⚡


