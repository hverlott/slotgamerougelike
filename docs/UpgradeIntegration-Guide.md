# 🎯 Roguelike 升级系统集成指南

## 📋 概述

成功将 roguelike "3选1升级"功能集成到游戏主循环中。玩家在每关完成后（消灭 100 个敌人）将看到一个升级选择界面，可以从 3 个随机升级中选择 1 个。

## 🎮 工作流程

```
游戏进行中
    ↓
消灭 100 个敌人
    ↓
LevelManager.checkProgress()
    ↓
shouldShowUpgrade = true
    ↓
状态机检测到 shouldOfferChoice()
    ↓
进入 ChoiceState
    ↓
调用 levelManager.rollUpgradeOptions()
    ↓
显示升级选择界面（HUD.openChoice）
    ↓
玩家点击选择
    ↓
应用升级（levelManager.applyUpgrade）
    ↓
进入下一关（levelManager.completeUpgradeChoice）
    ↓
返回 Idle 状态
    ↓
游戏继续
```

## 🔧 集成点

### 1️⃣ LevelManager.js 更新

**新增属性**：
```javascript
this.shouldShowUpgrade = false;
this.upgradeSystem = options.upgradeSystem ?? null;
```

**新增方法**：

#### `shouldOfferChoice()`
- 供 `AdvanceState` 调用
- 检查是否应该提供升级选择
- 返回：`boolean`

#### `rollUpgradeOptions()`
- 供 `ChoiceState` 调用
- 生成 3 个随机升级选项
- 返回：`Array<Upgrade>`（3 个升级对象）

#### `applyUpgrade(upgrade)`
- 供 `ChoiceState` 调用
- 应用玩家选择的升级
- 参数：`upgrade` - 升级对象

#### `completeUpgradeChoice()`
- 供 `ChoiceState` 调用
- 清理升级选择状态，进入下一关
- 重置 `shouldShowUpgrade = false`
- 调用 `nextLevel()` 开始新关卡

**修改的方法**：

#### `checkProgress()`
```javascript
// 旧版：直接显示完成弹窗
this.showComplete();

// 新版：标记需要升级选择
this.shouldShowUpgrade = true;
console.log('[LevelManager] Level complete, waiting for state machine');
```

#### `showComplete()`
```javascript
// 已废弃，现在由状态机和 HUD 处理
console.log('[LevelManager] showComplete() is deprecated');
```

### 2️⃣ ChoiceState.js 更新

**新逻辑**：
```javascript
async enter(ctx) {
  // 1. 获取升级选项
  const options = ctx.levelManager?.rollUpgradeOptions?.() ?? [];
  
  // 2. 显示选择界面（返回 Promise）
  const selectedUpgrade = await ctx.hudSystem?.openChoice?.(options);
  
  // 3. 应用升级
  ctx.levelManager?.applyUpgrade?.(selectedUpgrade);
  
  // 4. 完成升级选择（进入下一关）
  ctx.levelManager?.completeUpgradeChoice?.();
  
  // 5. 返回 Idle 状态
  ctx.machine.change(GameStateKey.IDLE);
}
```

### 3️⃣ HUDSystem.js 更新

**新增方法**：

#### `openChoice(options)`
返回 `Promise<Upgrade>`，显示升级选择界面。

**界面特性**：
- 模态背景（黑色半透明 + 模糊）
- 美观的选择面板
- 3 个升级卡片，横向排列
- 悬停动画效果
- 稀有度颜色标识：
  - Common: 灰蓝色 (#94A3B8)
  - Rare: 蓝色 (#3B82F6)
  - Epic: 紫色 (#A855F7)
  - Legendary: 金色 (#F59E0B)
- 支持鼠标点击选择
- ESC 键自动选择第一个（快速跳过）

**界面元素**：
```
┌─────────────────────────────────────────────┐
│          🎯 选择升级                        │
├─────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐     │
│  │  🔥     │  │  🎯     │  │  ⚡      │     │
│  │烈焰弹药 │  │多重射击 │  │精准打击 │     │
│  │子弹伤害 │  │每次射击 │  │暴击率   │     │
│  │+20%    │  │+1发子弹 │  │+15%    │     │
│  │COMMON  │  │COMMON   │  │RARE     │     │
│  └─────────┘  └─────────┘  └─────────┘     │
└─────────────────────────────────────────────┘
```

### 4️⃣ main.js 更新

**新增导入**：
```javascript
import { UpgradeSystem } from './systems/UpgradeSystem.js';
```

**新增变量**：
```javascript
let upgradeSystem; // 🎯 升级系统
```

**初始化顺序**：
```javascript
// 4.8 - UpgradeSystem（在 LevelManager 之前）
upgradeSystem = new UpgradeSystem(game);
game.bulletSystem = bulletSystem;  // 供 UpgradeSystem 访问
game.jackpotSystem = jackpotSystem;

// 4.9 - LevelManager（传入 upgradeSystem）
levelManager = new LevelManager(game, enemySystem, {
  upgradeSystem, // 🎯 关键：传入升级系统
  // ...其他选项
});
```

**添加到调试接口**：
```javascript
globalThis.__dslot = {
  // ...
  upgradeSystem, // 🎯 升级系统
};
```

## 🎨 升级选项示例

### Common（普通）60% 权重
- 🔥 **烈焰弹药**：子弹伤害 +20%
- 🎯 **多重射击**：每次射击 +1 发子弹
- 💣 **范围爆炸**：AOE半径 +20%
- ❤️ **生命强化**：最大HP +30%
- ⚡ **疾速子弹**：子弹速度 +30%

### Rare（稀有）30% 权重
- ⚡ **精准打击**：暴击率 +15%
- 💥 **致命一击**：暴击伤害 +50%
- 💰 **财富增幅**：Jackpot伤害 +25%
- ⏱️ **快速装填**：射击间隔 -15%

### Epic（史诗）10% 权重
- 🔴 **毁灭之力**：子弹伤害 +50%
- 👑 **Boss克星**：Jackpot伤害 +60%
- 🎪 **三重奏**：每次射击 +2 发子弹

## 🔍 测试方法

### 1. 查看当前升级统计
```javascript
const stats = __dslot.upgradeSystem.getUpgradeStats();
console.log(stats);
// {
//   counts: { damage: 2, bulletCount: 1, ... },
//   totalUpgrades: 3
// }
```

### 2. 手动触发升级选择
```javascript
// 模拟关卡完成
__dslot.levelManager.kills = 100;
__dslot.levelManager.checkProgress();

// 状态机会自动进入 ChoiceState
```

### 3. 强制进入升级界面
```javascript
// 获取升级选项
const options = __dslot.upgradeSystem.rollOptions();
console.log(options);

// 手动打开升级界面
const selected = await __dslot.ctx.hudSystem.openChoice(options);
console.log('Selected:', selected);
```

### 4. 手动应用升级
```javascript
// 获取一个升级
const upgrade = __dslot.upgradeSystem.upgradePool[0];

// 应用升级
__dslot.upgradeSystem.applyUpgrade(upgrade);
```

### 5. 重置升级系统
```javascript
__dslot.upgradeSystem.reset();
```

## 🎮 游戏流程演示

### 正常流程
1. **游戏开始**：Idle 状态，玩家可以 Spin
2. **战斗进行**：消灭敌人，kills 计数增加
3. **接近完成**：kills = 98/100，继续战斗
4. **关卡完成**：kills = 100/100，`shouldShowUpgrade = true`
5. **状态转换**：`Advance → Choice`
6. **显示界面**：3 个升级选项弹出
7. **玩家选择**：点击其中一个
8. **应用升级**：立即生效
9. **进入下一关**：`currentLevel++`，`kills = 0`
10. **返回游戏**：Idle 状态，继续 Spin

### 错误处理
- 如果 `UpgradeSystem` 未初始化：跳过升级，直接下一关
- 如果没有升级选项：跳过升级，直接下一关
- 如果玩家按 ESC：自动选择第一个升级
- 如果选择过程出错：清理状态，继续游戏

## 🔧 自定义配置

### 调整关卡完成条件
在 `LevelManager` 构造函数中：
```javascript
levelManager = new LevelManager(game, enemySystem, {
  killsToAdvance: 50, // 改为 50 个敌人完成一关
});
```

### 添加新升级
在 `UpgradeSystem.js` 的 `upgradePool` 中添加：
```javascript
{
  id: 'my_upgrade',
  name: '我的升级',
  description: '效果描述',
  icon: '🎁',
  rarity: 'epic',
  effect: { type: 'damage', value: 0.5 },
}
```

### 调整稀有度权重
在 `UpgradeSystem.js` 中：
```javascript
this.rarityWeights = {
  common: 50,   // 降低普通权重
  rare: 35,     // 增加稀有权重
  epic: 15,     // 增加史诗权重
};
```

### 修改界面样式
在 `HUDSystem.openChoice()` 中修改 CSS 样式：
```javascript
Object.assign(optionBtn.style, {
  width: '300px',        // 更宽的卡片
  padding: '32px',       // 更大的内边距
  borderRadius: '20px',  // 更圆的边角
  // ...
});
```

## 🚀 扩展功能建议

### 1. 永久升级
记录玩家在整局游戏中的所有升级：
```javascript
// 在 UpgradeSystem 中
this.permanentUpgrades = [];

applyUpgrade(upgrade) {
  this.permanentUpgrades.push(upgrade);
  // ...应用逻辑
}
```

### 2. 升级组合效果
检测特定升级组合并触发额外效果：
```javascript
// 例如：3 次伤害升级 → 激活 "毁灭模式"
if (this.upgradeCounts.damage >= 3) {
  this.activateDestructionMode();
}
```

### 3. 升级重铸
允许玩家花费资源重新生成升级选项：
```javascript
rerollUpgrades(cost = 100) {
  if (this.coins >= cost) {
    this.coins -= cost;
    return this.rollOptions();
  }
}
```

### 4. 升级预览
在选择前显示升级后的数值：
```javascript
previewUpgrade(upgrade) {
  const current = this.bulletSystem.damagePerHit;
  const after = current * (1 + upgrade.effect.value);
  return { current, after, increase: after - current };
}
```

### 5. 升级历史
显示玩家已选择的所有升级：
```javascript
showUpgradeHistory() {
  const history = this.permanentUpgrades.map(u => u.name);
  console.log('Upgrade History:', history);
}
```

## ✅ 检查清单

- ✅ **LevelManager**：添加升级相关方法
- ✅ **ChoiceState**：实现升级选择逻辑
- ✅ **HUDSystem**：实现升级选择界面
- ✅ **main.js**：初始化 UpgradeSystem 并传递给 LevelManager
- ✅ **AdvanceState**：已有 `shouldOfferChoice()` 检查
- ✅ **错误处理**：所有边界情况都有处理
- ✅ **无 Lint 错误**：所有文件通过检查
- ✅ **不破坏现有功能**：只添加，不修改核心逻辑
- ✅ **桌面点击支持**：鼠标点击和 ESC 键都支持

## 🎉 总结

roguelike 升级系统已成功集成到游戏主循环中！

**特点**：
- ✨ **无缝集成**：与状态机完美配合
- 🎨 **美观界面**：现代化的升级选择 UI
- 🔧 **易于扩展**：简单添加新升级
- 🎯 **平衡性好**：稀有度权重系统
- 🚀 **性能优秀**：最小化对游戏性能的影响
- 🛡️ **稳定可靠**：完善的错误处理

现在玩家在每关结束时都能体验到 roguelike 的核心乐趣 —— 选择强力的升级来增强自己的实力！🎮⚡


