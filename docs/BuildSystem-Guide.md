# 🎯 BuildSystem - Roguelike 构建系统指南

## 📋 概述

BuildSystem 是一个轻量级的 roguelike 构建系统，它根据每回合的 spin 结果动态分析并生成战斗修饰符，为游戏增加策略深度和构建多样性。

## 🎮 核心概念

### 1. Archetype（原型系统）

每个回合根据中奖符号的分布自动判定一个原型：

| 原型 | 触发条件 | 特点 |
|------|---------|------|
| 🔫 **BULLET_FOCUS** | 子弹符号占比 ≥ 50% | 高射速、多弹幕、精准射击 |
| 💣 **GRENADE_FOCUS** | 手雷符号占比 ≥ 50% | 大范围AOE、连锁爆炸、生命偷取 |
| 🚀 **MISSILE_FOCUS** | 导弹符号占比 ≥ 50% | 高伤害、穿透、暴击 |
| ⚡ **WILD_OVERDRIVE** | Wild 数量 ≥ 3 | 全能加成、狂暴连锁、过载爆发 |
| ⚖️ **BALANCED** | 其他情况 | 中庸之道、稳定输出 |

### 2. TurnModifiers（回合修饰符）

每个原型对应一组修饰符，影响战斗表现：

```javascript
{
  archetype: "BULLET_FOCUS",  // 当前原型
  extraProjectiles: 2,         // 额外发射 2 发子弹
  pierce: 0,                   // 穿透层数（0 = 不穿透）
  chain: 0,                    // 连锁次数（0 = 不连锁）
  aoeScale: 0.8,               // AOE 范围倍率（0.8 = -20%）
  critChance: 0.15,            // 暴击率加成（0.15 = +15%）
  lifesteal: 0,                // 生命偷取率（0 = 无）
  overloadBonus: 0,            // 过载能量加成（0 = 无）
}
```

## 🔧 系统架构

### 数据流

```
SpinResult → BuildSystem.analyze() → TurnModifiers
    ↓
TurnPlanner.buildTurnPlan() → TurnPlan (含 modifiers)
    ↓
CombatState → BulletSystem.playCombatEvent(event, modifiers)
    ↓
应用修饰符 → 实际战斗效果
```

### 文件结构

```
src/
├── systems/
│   ├── BuildSystem.js       # 🆕 构建系统（核心分析逻辑）
│   └── BulletSystem.js      # 🔄 子弹系统（应用修饰符）
└── core/
    ├── TurnPlanner.js       # 🔄 回合计划器（调用 BuildSystem）
    └── states/
        └── CombatState.js   # 🔄 战斗状态（传递修饰符）
```

## 📊 原型详细说明

### 🔫 BULLET_FOCUS（子弹流）

**适合场景**：需要快速清理大量弱小敌人

**修饰符配置**：
```javascript
{
  extraProjectiles: 2,    // +2 发子弹（基础 + 额外）
  pierce: 0,              // 不穿透
  chain: 0,               // 不连锁
  aoeScale: 0.8,          // AOE -20%（精准射击）
  critChance: 0.15,       // +15% 暴击率
  lifesteal: 0,           // 无生命偷取
  overloadBonus: 0,       // 无过载加成
}
```

**额外加成**：每 5 个 bullet 符号额外 +1 弹幕（动态缩放）

**策略建议**：
- 优先升级射速和弹幕数量
- 配合多目标攻击效果
- 适合高密度敌人场景

---

### 💣 GRENADE_FOCUS（爆破流）

**适合场景**：敌人聚集时一网打尽

**修饰符配置**：
```javascript
{
  extraProjectiles: 0,
  pierce: 0,
  chain: 1,               // 连锁 1 次（手雷弹跳）
  aoeScale: 1.5,          // AOE +50%
  critChance: 0.1,        // +10% 暴击率
  lifesteal: 0.05,        // 5% 生命偷取
  overloadBonus: 0,
}
```

**特殊效果**：
- 连锁爆炸：手雷击中目标后会跳跃到附近敌人
- 生命偷取：每次爆炸伤害都会恢复生命值
- 范围加成：爆炸范围大幅提升

**策略建议**：
- 优先提升 AOE 范围和连锁次数
- 配合生存型装备
- 适合高风险高回报玩法

---

### 🚀 MISSILE_FOCUS（导弹流）

**适合场景**：对付高血量单体 Boss 或装甲单位

**修饰符配置**：
```javascript
{
  extraProjectiles: 0,
  pierce: 2,              // 穿透 2 个目标
  chain: 0,
  aoeScale: 1.2,          // AOE +20%
  critChance: 0.25,       // +25% 暴击率（精准打击）
  lifesteal: 0,
  overloadBonus: 0.2,     // +20% 过载能量
}
```

**特殊效果**：
- 穿透攻击：导弹穿透主目标后继续攻击后方敌人（60% 伤害）
- 高暴击率：接近 1/4 的暴击率
- 过载加速：更快充能 Jackpot 系统

**策略建议**：
- 优先提升单体伤害和暴击伤害
- 配合穿透增强效果
- 适合 Boss 战和精英怪

---

### ⚡ WILD_OVERDRIVE（狂野流）

**适合场景**：Wild 符号足够多时的超强爆发

**触发条件**：Wild 数量 ≥ 3

**修饰符配置**：
```javascript
{
  extraProjectiles: 1,
  pierce: 1,
  chain: 2,               // 连锁 2 次（狂野连锁）
  aoeScale: 1.3,          // AOE +30%
  critChance: 0.35,       // +35% 暴击率（狂暴）
  lifesteal: 0.1,         // 10% 生命偷取
  overloadBonus: 0.5,     // +50% 过载能量（爆发）
}
```

**额外加成**（每个 Wild 符号）：
- +5% 暴击率
- +10% 过载能量

**特殊效果**：
- 全能加成：同时拥有穿透、连锁、AOE
- 狂暴模式：超高暴击率 + 生命偷取
- 过载爆发：快速触发 Jackpot Boss 技能

**策略建议**：
- 尽可能多地获取 Wild 符号
- 这是最强原型，适合任何场景
- 配合 Wild 符号增幅效果

---

### ⚖️ BALANCED（平衡流）

**适合场景**：符号分布均衡时的基础配置

**修饰符配置**：
```javascript
{
  extraProjectiles: 0,
  pierce: 0,
  chain: 0,
  aoeScale: 1.0,          // 标准范围
  critChance: 0.05,       // +5% 暴击率
  lifesteal: 0,
  overloadBonus: 0,
}
```

**策略建议**：
- 等待更好的符号组合
- 稳定发展，避免风险
- 适合前期积累资源

## 🎨 修饰符效果详解

### 1. extraProjectiles（额外弹幕）

**效果**：在原有基础上额外发射 N 发子弹

**实现位置**：`BulletSystem.playShoot()`

```javascript
const totalCount = count + (mods.extraProjectiles || 0);
```

**可视效果**：更多的子弹同时飞向敌人

---

### 2. pierce（穿透）

**效果**：子弹穿过主目标后继续攻击后方敌人（60% 伤害）

**实现位置**：`BulletSystem.applyPierce()`

**触发条件**：非 AOE 武器（type !== 2 && type !== 4）

**穿透规则**：
- 只攻击主目标后方（x 坐标更大）的敌人
- 按距离排序，选择最近的 N 个目标
- 每次穿透造成 60% 伤害

**可视效果**：蓝色刀光斩击

---

### 3. chain（连锁）

**效果**：伤害跳跃到附近的其他敌人

**实现位置**：`BulletSystem.applyChain()`

**触发条件**：手雷武器（type === 2）

**连锁规则**：
- 从主目标开始，跳跃到最近的敌人
- 连锁距离限制：150 像素
- 每次连锁伤害衰减 20%（0.8^n）

**可视效果**：黄色闪电连接 + 黄色刀光斩击

---

### 4. aoeScale（AOE 范围缩放）

**效果**：影响爆炸和 AOE 技能的范围

**实现位置**：`BulletSystem.update()` 中的 type 2/4 判定

**缩放规则**：
```javascript
const aoeRadius = baseRadius * aoeScale;
// 例如：60 * 1.5 = 90（+50% 范围）
```

**影响武器**：
- 手雷（type 2）：基础范围 60
- 导弹（type 4）：内圈 60，外圈 110

---

### 5. critChance（暴击率加成）

**效果**：增加暴击概率，暴击伤害 x2

**实现位置**：`BulletSystem.update()` 伤害计算

**计算公式**：
```javascript
const baseCritChance = type === 3 ? 0.3 : 0.1;
const finalCritChance = baseCritChance + (mods.critChance || 0);
const isCrit = Math.random() < finalCritChance;
```

**可视效果**：暴击时显示橙色数字 + 更强的刀光斩击

---

### 6. lifesteal（生命偷取）

**效果**：造成伤害时恢复 X% 的生命值

**实现位置**：`BulletSystem.update()` 伤害触发后

**计算公式**：
```javascript
const healAmount = damage * mods.lifesteal;
ctx.playerSystem?.heal?.(healAmount);
```

**注意**：需要 PlayerSystem 支持 `heal()` 方法

**可视效果**：控制台日志 `[Lifesteal] +XX HP`

---

### 7. overloadBonus（过载能量加成）

**效果**：增加 Jackpot Boss 系统的能量积累速度

**实现位置**：（预留接口，需要在 JackpotSystem 中实现）

**建议实现**：
```javascript
// 在 JackpotSystem.applySpin() 中
const energyGain = baseEnergy * (1 + modifiers.overloadBonus);
```

## 🔧 参数调整指南

所有参数都集中在 `BuildSystem.js` 的 `CONFIG` 对象中，方便调整平衡性：

```javascript
const CONFIG = {
  // 原型判定阈值
  FOCUS_THRESHOLD: 0.5,        // 某类符号占比 >= 50% 即认定为专精
  WILD_OVERDRIVE_COUNT: 3,     // Wild 数量 >= 3 触发 Overdrive

  // 各原型的修饰符配置
  BULLET_FOCUS: { /* ... */ },
  GRENADE_FOCUS: { /* ... */ },
  // ...
};
```

### 调整建议

1. **降低难度**：
   - 提高各原型的 `extraProjectiles`
   - 提高 `critChance`
   - 降低 `FOCUS_THRESHOLD`（更容易触发专精）

2. **提高难度**：
   - 降低 `aoeScale`
   - 降低 `lifesteal`
   - 提高 `WILD_OVERDRIVE_COUNT`（需要更多 Wild）

3. **平衡调整**：
   - 根据玩家反馈调整各原型的强度
   - 观察原型分布是否均衡
   - 调整 Wild 符号的额外加成

## 🎮 使用示例

### 1. 查看当前回合的原型

在浏览器控制台中：

```javascript
// 查看最近一次回合的修饰符
console.log(__dslot.ctx.currentPlan.modifiers);

// 输出示例：
// {
//   archetype: "MISSILE_FOCUS",
//   extraProjectiles: 0,
//   pierce: 2,
//   chain: 0,
//   aoeScale: 1.2,
//   critChance: 0.3,  // 0.25 基础 + 0.05 (1个Wild)
//   lifesteal: 0,
//   overloadBonus: 0.3  // 0.2 基础 + 0.1 (1个Wild)
// }
```

### 2. 手动测试原型

```javascript
// 模拟一个 spin 结果
const testSpinResult = {
  grid: [[1,1,1], [2,2,3], [1,1,4]],
  wins: [
    { symbols: [1, 1, 1] },  // 3 个 bullet
    { symbols: [1, 1, 2] },  // 2 个 bullet, 1 个 grenade
  ],
  totalMul: 2.5
};

// 分析原型
const buildSystem = __dslot.ctx.buildSystem;
const modifiers = buildSystem.analyze(testSpinResult);
console.log(modifiers);
// 输出：{ archetype: "BULLET_FOCUS", ... }
```

### 3. 调整参数并观察效果

修改 `BuildSystem.js` 中的 `CONFIG` 对象，然后刷新页面：

```javascript
// 例如：让 BULLET_FOCUS 更强
CONFIG.BULLET_FOCUS.extraProjectiles = 5;  // 原来是 2
CONFIG.BULLET_FOCUS.critChance = 0.3;      // 原来是 0.15
```

## 🚀 未来扩展

### 1. 持久化构建系统

记录玩家在整局游戏中的构建选择：

```javascript
class PersistentBuild {
  constructor() {
    this.permanentModifiers = {
      extraProjectiles: 0,
      pierce: 0,
      // ...
    };
  }

  addPermanentModifier(key, value) {
    this.permanentModifiers[key] += value;
  }

  applyToTurnModifiers(turnMods) {
    return {
      extraProjectiles: turnMods.extraProjectiles + this.permanentModifiers.extraProjectiles,
      // ...
    };
  }
}
```

### 2. 构建树（技能树）

让玩家选择永久升级：

```
          [子弹流]
         /        \
    [多重射击]   [精准打击]
       |            |
   [子弹风暴]   [致命射手]
```

### 3. 词缀系统

为每次 spin 添加随机词缀：

```javascript
const affixes = [
  { name: "爆炸性", effect: { aoeScale: 1.5 } },
  { name: "穿刺", effect: { pierce: 2 } },
  { name: "吸血", effect: { lifesteal: 0.2 } },
];
```

### 4. 套装效果

收集同类型符号触发额外奖励：

```javascript
// 3个或以上 bullet → 激活"子弹时间"
if (bulletCount >= 3) {
  modifiers.bulletTimeActive = true;
  modifiers.extraProjectiles += 3;
}
```

### 5. 圣物/装备系统

永久装备影响所有回合：

```javascript
const relics = [
  { name: "狂战士之心", modifiers: { critChance: 0.1, lifesteal: 0.05 } },
  { name: "穿透之矛", modifiers: { pierce: 1 } },
];
```

## 📚 调试技巧

### 1. 强制指定原型

```javascript
// 在 BuildSystem.determineArchetype() 中添加
if (window.__DEBUG_FORCE_ARCHETYPE) {
  return window.__DEBUG_FORCE_ARCHETYPE;
}

// 控制台中
window.__DEBUG_FORCE_ARCHETYPE = "WILD_OVERDRIVE";
```

### 2. 查看修饰符应用情况

在 `BulletSystem.playCombatEvent()` 中：

```javascript
console.log('[BulletSystem] Applying modifiers:', this.currentModifiers);
```

### 3. 统计原型分布

```javascript
const archetypeStats = {};
// 在每次 buildTurnPlan 后记录
archetypeStats[archetype] = (archetypeStats[archetype] || 0) + 1;
console.table(archetypeStats);
```

## ✅ 检查清单

- ✅ **BuildSystem.js**：纯函数，无副作用，确定性
- ✅ **TurnPlanner.js**：调用 BuildSystem，附加修饰符到 TurnPlan
- ✅ **BulletSystem.js**：应用所有修饰符（extraProjectiles, pierce, chain, aoeScale, critChance, lifesteal）
- ✅ **CombatState.js**：传递修饰符到 BulletSystem
- ✅ **参数可调**：所有数值集中在 CONFIG 对象
- ✅ **可视化**：pierce（蓝光）、chain（黄色闪电）、暴击（强光）
- ✅ **调试友好**：控制台日志、全局调试接口

## 🎉 总结

BuildSystem 为游戏增加了：
- ✨ **策略深度**：不同符号组合产生不同玩法
- ✨ **构建多样性**：5 种原型，7 种修饰符，数十种组合
- ✨ **Roguelike 体验**：每回合都有独特的战斗风格
- ✨ **可扩展性**：易于添加新原型、新修饰符、新机制
- ✨ **平衡性**：参数集中管理，易于调整

现在您的 spin 游戏不仅是一个赌博游戏，更是一个充满策略和构建乐趣的 roguelike 战斗游戏！🎮

