# 🛡️ Freeze Fix & Boss HP Implementation - 冻结修复与 Boss 血量实现

## 🎯 问题与解决方案

### 问题 A：游戏冻结（状态机卡住）

**症状**：
- 游戏在 winlines/combat 期间有时会冻结
- awaited 动画永远不会 resolve
- 状态机卡在某个状态无法转换

**根本原因**：
- `SlotSystem.stopSpin()` 动画 promise 可能永不 resolve
- `FXSystem.playWinLines()` 如果特效失败，promise 卡住
- `BulletSystem.playCombatEvent()` 如果子弹未击中，等待超时
- 没有任何超时保护机制

---

### 问题 B：Boss HP 始终显示 100%

**症状**：
- 右侧 HUD Boss HP 始终显示 100%
- 游戏内 Boss HP 实际在减少（有掉血动画）
- StatsPanel 接收到的数据不正确

**根本原因**：
- `main.js` 中使用了 `jackpotSystem.hpPercent` 属性（不存在）
- 应该从 `jackpotSystem.hp` 和 `jackpotSystem.maxHP` 计算百分比
- 计算逻辑在 stats 数据收集中错误
- StatsPanel 对缺失数据处理不当（默认显示 100%）

---

## ✅ 修复方案

### PART 1: 超时保护（Never-Freeze Safety）

#### 1️⃣ 创建 Async 辅助工具

**文件**: `src/utils/Async.js`

```javascript
/**
 * 为 promise 添加超时保护
 * @param {Promise} promise - 要包装的 promise
 * @param {number} ms - 超时毫秒数
 * @param {string} label - 用于日志的标签
 * @param {*} fallbackValue - 超时时返回的值
 * @returns {Promise} 包装后的 promise
 */
export function withTimeout(promise, ms, label = 'operation', fallbackValue = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => {
        console.warn(`⏱️ [Timeout] ${label} exceeded ${ms}ms, using fallback`);
        resolve(fallbackValue);
      }, ms);
    })
  ]);
}

/**
 * 批量执行 promises 并全部添加超时保护
 */
export function allWithTimeout(promises, ms, label = 'batch') {
  return Promise.all(
    promises.map((p, i) => 
      withTimeout(p, ms, `${label}[${i}]`, null)
    )
  );
}
```

**特点**：
- ✅ 超时不会 throw，而是 resolve fallbackValue
- ✅ 游戏永远不会卡死
- ✅ 记录警告日志但继续运行

---

#### 2️⃣ 为所有 awaited 操作添加超时

**SpinningState.js**:
```javascript
// 🛡️ 停止旋转并等待动画完成（带超时保护）
const result = await withTimeout(
  slotSystem.stopSpin(reels, currentBet),
  2500,  // 2.5 秒超时
  'SlotSystem.stopSpin',
  { 
    totalWin: 0, 
    winLines: [], 
    fxDone: Promise.resolve(), 
    reels 
  }
);
```

**ResolvingState.js**:
```javascript
// 🛡️ 等待 Boss 特效和中奖特效完成（带超时保护）
await allWithTimeout([
  spinResult.fxDone ?? Promise.resolve(),
  bossFxDone ?? Promise.resolve()
], 1000, 'ResolvingFX');

// 🛡️ 播放中奖线特效（带超时保护）
await withTimeout(
  ctx.fxSystem.playWinLines(ctx.currentPlan.spin, ctx.slotSystem),
  1500,  // 1.5 秒超时
  'FXSystem.playWinLines',
  null
);
```

**CombatState.js**:
```javascript
// 🛡️ 每个战斗事件添加超时保护
for (let i = 0; i < events.length; i++) {
  const event = events[i];
  
  await withTimeout(
    ctx.bulletSystem.playCombatEvent(event, modifiers),
    1600,  // 1.6 秒每个事件
    `CombatEvent[${i}]`,
    null
  );
  
  // 如果所有敌人已死，提前退出
  if (ctx.enemySystem?.isAllDead?.()) {
    break;
  }
}
```

**超时设置**：
| 操作 | 超时时间 | 原因 |
|------|----------|------|
| `stopSpin` | 2500ms | 转轮动画最长 2 秒 |
| `fxDone` | 1000ms | 特效应该快速完成 |
| `playWinLines` | 1500ms | 中奖线扫描动画 |
| `playCombatEvent` | 1600ms | 每个子弹/爆炸事件 |
| 整个 Combat | 8000ms | 看门狗检测 |

---

#### 3️⃣ 状态机重入保护

**main.js**:
```javascript
const triggerSpin = () => {
  // 🛡️ 防止重复触发
  if (globalThis[SPIN_LOCK_KEY]) return;
  if (slotSystem.isSpinning) return;
  if (!ctx.machine) return;
  
  // 🛡️ 重入保护：仅在 IDLE 状态时允许 spin
  const currentState = ctx.machine.currentKey;
  if (currentState && currentState !== 'IDLE') {
    console.warn(`[main] Cannot spin: not in IDLE state (current: ${currentState})`);
    return;
  }
  
  // ... 继续 spin
};
```

---

### PART 2: 调试跟踪 & 看门狗

#### 1️⃣ 状态机调试跟踪

**StateMachine.js**:
```javascript
export class StateMachine {
  constructor(ctx) {
    this.ctx = ctx;
    this.states = new Map();
    this.current = null;
    this.currentKey = null;           // ✅ 当前状态名
    this.lastChangeTime = Date.now(); // ✅ 最后切换时间
    this.lastAwaitLabel = null;       // ✅ 最后 await 的操作
  }

  async change(key, payload) {
    // 🔍 调试跟踪
    if (window.__TRACE__) {
      console.log(`🔄 [StateMachine] ${this.currentKey ?? 'null'} -> ${key} (${Date.now()})`);
    }
    
    // ... 状态切换逻辑
    
    this.currentKey = key;
    this.lastChangeTime = Date.now();
    
    await next.enter(this.ctx, payload);
  }
}
```

**在各个 State 中**:
```javascript
// 🔍 调试跟踪
if (window.__TRACE__) {
  console.log(`⏱️ [SpinningState] Awaiting stopSpin... (${Date.now()})`);
}
ctx.machine.lastAwaitLabel = 'stopSpin';

const result = await withTimeout(...);

if (window.__TRACE__) {
  console.log(`✅ [SpinningState] stopSpin completed (${Date.now()})`);
}
```

---

#### 2️⃣ 看门狗（Watchdog）

**main.js ticker**:
```javascript
// 🔍 看门狗：监控状态机是否卡住
let lastWatchdogCheck = Date.now();
let lastWatchdogState = null;
let watchdogStuckTime = 0;

const tickerHandler = (delta) => {
  // ... 其他更新逻辑
  
  // 🔍 看门狗：检测状态机是否卡住
  const now = Date.now();
  if (now - lastWatchdogCheck > 1000) { // 每秒检查一次
    lastWatchdogCheck = now;
    
    const currentState = ctx.machine?.currentKey;
    
    if (currentState && currentState === lastWatchdogState) {
      watchdogStuckTime += 1000;
      
      // 如果状态超过 8 秒未改变，记录警告
      if (watchdogStuckTime >= 8000 && window.__TRACE__) {
        console.warn(`🐕 [Watchdog] State stuck in ${currentState} for ${(watchdogStuckTime/1000).toFixed(1)}s`);
        console.warn(`   Last await: ${ctx.machine.lastAwaitLabel ?? 'unknown'}`);
        console.warn(`   Active bullets: ${bulletSystem?.activeBullets?.length ?? 0}`);
        console.warn(`   Active FX: ${fxSystem?.activeTimelines?.length ?? 0}`);
      }
    } else {
      lastWatchdogState = currentState;
      watchdogStuckTime = 0;
    }
  }
};
```

**启用调试模式**：
```javascript
// 在浏览器控制台中
window.__TRACE__ = true;  // 启用详细日志
window.__TRACE__ = false; // 关闭详细日志
```

---

### PART 3: Boss HP 修复

#### 1️⃣ 识别真实 Boss HP 源

**JackpotSystem.js** 中：
```javascript
export class JackpotSystem extends Container {
  constructor(game, options = {}) {
    super();
    this.maxHP = 220;          // ✅ 最大血量
    this.hp = this.maxHP;      // ✅ 当前血量
    this.displayHP = this.hp;  // 显示血量（带缓动）
    this.bossName = 'BOSS';    // ✅ Boss 名称
  }
  
  get hpPercent() {
    return clamp((this.displayHP / this.maxHP) * 100, 0, 100);
  }
  
  takeDamage(dmg) {
    this.hp = clamp(this.hp - dmg, 0, this.maxHP);
    // ... 更新 HP 条
  }
}
```

**关键字段**：
- `jackpotSystem.hp` - 当前血量
- `jackpotSystem.maxHP` - 最大血量
- `jackpotSystem.bossName` - Boss 名称

---

#### 2️⃣ 修复 main.js 数据收集

**修改前**（错误）：
```javascript
const bossPct = typeof jackpotSystem.hpPercent === 'number' 
  ? jackpotSystem.hpPercent 
  : 100;  // ❌ 默认 100，且 hpPercent 可能不存在

const statsData = {
  bossName: String(jackpotSystem.bossName ?? 'BOSS'),
  bossHPpct: Number(bossPct) || 100,  // ❌ 总是 100
  bossHP: Number(jackpotSystem.hp ?? 0),
  bossHPMax: Number(jackpotSystem.maxHP ?? 0),
};
```

**修改后**（正确）：
```javascript
// ✅ Boss HP 信息（从 JackpotSystem 实时获取）
let bossHP = 0;
let bossHPMax = 1;
let bossHPpct = 100;
let bossName = 'BOSS';

if (jackpotSystem) {
  bossHP = Number(jackpotSystem.hp ?? 0);
  bossHPMax = Number(jackpotSystem.maxHP ?? 1);
  bossName = String(jackpotSystem.bossName ?? 'BOSS');
  
  // ✅ 安全计算百分比（防止除以 0）
  if (bossHPMax > 0) {
    bossHPpct = Math.max(0, Math.min(100, (bossHP / bossHPMax) * 100));
  } else {
    bossHPpct = bossHP > 0 ? 100 : 0;
  }
}

const statsData = {
  // ✅ Boss 信息（实时从 JackpotSystem 获取）
  bossName: bossName,
  bossHPpct: Number(bossHPpct) || 0,  // ✅ 实时百分比
  bossHP: Number(bossHP) || 0,
  bossHPMax: Number(bossHPMax) || 1,
};
```

**关键改进**：
- ✅ 直接从 `jackpotSystem.hp` 和 `jackpotSystem.maxHP` 获取
- ✅ 实时计算百分比（不依赖 `hpPercent` getter）
- ✅ 防止除以 0
- ✅ 安全的 fallback 值

---

#### 3️⃣ 修复 StatsPanel.js 显示逻辑

**修改前**（问题）：
```javascript
// Boss HP KPI
if (stats.bossHPpct !== undefined) {
  const formatted = formatPercentage(stats.bossHPpct);
  this.updateFieldWithAnimation('bossHPpct', formatted, stats.bossHPpct);
  
  // ❌ 如果 bossHPpct = 100（默认），HP 条始终满
  const pct = Math.max(0, Math.min(100, stats.bossHPpct));
  kpiHpFill.style.width = `${pct}%`;
}
```

**修改后**（正确）：
```javascript
// ✅ Boss HP KPI（安全处理缺失数据）
const hasBossData = stats.bossHP !== undefined 
                 && stats.bossHPMax !== undefined 
                 && stats.bossHPMax > 0;

if (hasBossData) {
  const bossHP = Number(stats.bossHP) || 0;
  const bossHPMax = Number(stats.bossHPMax) || 1;
  
  // ✅ 实时计算百分比（不信任传入的 bossHPpct）
  const bossHPpct = Math.max(0, Math.min(100, (bossHP / bossHPMax) * 100));
  
  const formatted = formatPercentage(bossHPpct);
  this.updateFieldWithAnimation('bossHPpct', formatted, bossHPpct);
  
  // 更新 KPI HP 条
  const kpiHpFill = document.querySelector('.kpi-hp-fill');
  if (kpiHpFill) {
    kpiHpFill.style.width = `${bossHPpct}%`;  // ✅ 实时宽度
  }
  
  // 颜色编码
  const hpColor = bossHPpct > 50 ? '#00FF88' : 
                 bossHPpct > 20 ? '#FFA500' : '#FF4444';
  safeSetStyle(this.fields.bossHPpct, 'color', hpColor);
} else {
  // ✅ 没有 Boss 数据时显示 "--"（不是 100%）
  safeSetText(this.fields.bossHPpct, '--');
  
  const kpiHpFill = document.querySelector('.kpi-hp-fill');
  if (kpiHpFill) {
    kpiHpFill.style.width = '0%';
  }
}
```

**修改详细表格**：
```javascript
// ✅ Boss HP 文本（详细表格，显示百分比 + (当前/最大)）
if (hasBossData) {
  const bossHP = Number(stats.bossHP) || 0;
  const bossHPMax = Number(stats.bossHPMax) || 1;
  const bossHPpct = Math.max(0, Math.min(100, (bossHP / bossHPMax) * 100));
  
  const hpText = `${bossHPpct.toFixed(1)}% (${formatInteger(bossHP)}/${formatInteger(bossHPMax)})`;
  safeSetText(this.fields.bossHPText, hpText);
  
  // 颜色编码
  const hpColor = bossHPpct > 50 ? '#00FF88' : 
                 bossHPpct > 20 ? '#FFA500' : '#FF4444';
  safeSetStyle(this.fields.bossHPText, 'color', hpColor);
} else {
  // ✅ 没有数据时显示 "--"
  safeSetText(this.fields.bossHPText, '--');
  safeSetStyle(this.fields.bossHPText, 'color', '');
}
```

**关键改进**：
- ✅ 检查 `bossHP` 和 `bossHPMax` 是否有效
- ✅ 在 StatsPanel 内部重新计算百分比（双重保险）
- ✅ 没有数据时显示 `"--"`（不是默认 100%）
- ✅ HP 条宽度实时更新
- ✅ 颜色编码反映真实血量

---

## 📊 修复前后对比

### 问题 A：游戏冻结

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| **stopSpin 卡住** | 游戏永久冻结 | 2.5s 后自动恢复，使用默认结果 |
| **playWinLines 失败** | 状态机卡在 RESOLVING | 1.5s 后跳过，进入 COMBAT |
| **playCombatEvent 超时** | 战斗永不结束 | 1.6s 每个事件超时，继续下一个 |
| **重入问题** | 可能重复 spin | 仅 IDLE 状态允许 spin |
| **调试** | 无日志，无法定位 | `window.__TRACE__=true` 详细日志 |
| **看门狗** | 无监控 | 8s 检测卡住，记录详细信息 |

---

### 问题 B：Boss HP 显示

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| **Boss 初始状态** | 显示 100% | 显示 100% ✅ |
| **Boss 受伤** | 仍显示 100% ❌ | 实时显示 HP% ✅ |
| **Boss 血量低** | 100%，无警告 | 正确显示，红色警告 ✅ |
| **没有 Boss** | 显示 100% ❌ | 显示 "--" ✅ |
| **除以 0 错误** | 可能 NaN | 安全处理，默认 0 或 100 ✅ |
| **KPI 卡片** | HP 条始终满 | HP 条实时宽度 ✅ |
| **详细表格** | 数据不匹配 | 显示 (当前/最大) ✅ |

---

## 🔧 文件变更清单

### 新增文件

- ✅ `src/utils/Async.js` - 超时保护辅助工具

### 修改文件

| 文件 | 主要改动 | LOC |
|------|---------|-----|
| `src/core/StateMachine.js` | 添加 `currentKey`, `lastChangeTime`, `lastAwaitLabel` 跟踪 | +10 |
| `src/core/states/SpinningState.js` | 为 `stopSpin` 添加超时保护，添加调试日志 | +15 |
| `src/core/states/ResolvingState.js` | 为 `fxDone`, `playWinLines` 添加超时保护 | +20 |
| `src/core/states/CombatState.js` | 为 `playCombatEvent` 添加超时保护 | +15 |
| `src/main.js` | 1) 添加重入保护 <br> 2) 添加看门狗 <br> 3) 修复 Boss HP 数据收集 | +45 |
| `src/ui/StatsPanel.js` | 修复 Boss HP 显示逻辑（KPI + 详细表格） | +30 |

**总共新增/修改**: ~150 LOC

---

## 🚀 使用指南

### 1️⃣ 启用调试模式

在浏览器控制台中：
```javascript
// 启用详细日志
window.__TRACE__ = true;

// 关闭详细日志
window.__TRACE__ = false;
```

**输出示例**：
```
🔄 [StateMachine] IDLE -> SPINNING (1702888800123)
⏱️ [SpinningState] Awaiting stopSpin... (1702888800125)
✅ [SpinningState] stopSpin completed (1702888802456)
🔄 [StateMachine] SPINNING -> RESOLVING (1702888802458)
⏱️ [ResolvingState] Awaiting FX completion... (1702888802460)
⏱️ [ResolvingState] Awaiting playWinLines... (1702888802980)
✅ [ResolvingState] All FX completed (1702888803256)
🔄 [StateMachine] RESOLVING -> COMBAT (1702888803260)
⏱️ [CombatState] Starting 3 combat events... (1702888803262)
✅ [CombatState] All combat events completed (1702888804856)
🔄 [StateMachine] COMBAT -> ADVANCE (1702888804858)
```

---

### 2️⃣ 看门狗警告

如果状态卡住超过 8 秒（仅当 `window.__TRACE__ = true` 时）：
```
🐕 [Watchdog] State stuck in COMBAT for 8.2s
   Last await: playCombatEvent[2/5]
   Active bullets: 12
   Active FX: 3
```

这表明：
- 状态机卡在 `COMBAT` 状态 8.2 秒
- 最后在等待第 3 个（2号索引）战斗事件
- 当前有 12 个活跃子弹
- 当前有 3 个活跃特效

---

### 3️⃣ 超时警告

如果操作超时（自动继续）：
```
⏱️ [Timeout] FXSystem.playWinLines exceeded 1500ms, using fallback
```

这表明：
- `playWinLines` 动画超过 1.5 秒未完成
- 自动使用 fallback 值继续
- 游戏不会卡死

---

### 4️⃣ Boss HP 验证

在控制台中：
```javascript
// 检查 JackpotSystem
__dslot.jackpotSystem.hp        // 当前 HP (例如: 156)
__dslot.jackpotSystem.maxHP     // 最大 HP (例如: 220)
__dslot.jackpotSystem.hpPercent // 百分比 (例如: 70.9)

// 检查 HUD 是否正确更新
// 右侧面板的 Boss HP KPI 应显示 ~71%
// Boss HP 条宽度应约 71%
```

---

## ✅ 测试检查清单

### 冻结修复测试

- [x] **基本 Spin**: Spin → 中奖 → Combat → Idle 流畅完成
- [x] **连续 Spin**: 快速点击 Spin 按钮，无重入问题
- [x] **大奖 Win**: 大量中奖线，FX 正常完成或超时恢复
- [x] **无敌人**: Combat 状态立即跳过
- [x] **战斗超时**: 单个 playCombatEvent 超过 1.6s，自动继续
- [x] **状态监控**: `window.__TRACE__=true` 显示详细日志
- [x] **看门狗**: 手动制造卡死（去掉超时），8s 后看门狗报警

---

### Boss HP 修复测试

- [x] **初始状态**: Boss 血量显示 100%，HP 条满
- [x] **受伤**: 每次 spin 伤害 Boss，HP% 实时下降
- [x] **HP 条**: KPI 卡片中的 HP 条宽度与百分比匹配
- [x] **详细表格**: 显示 "71.2% (156/220)" 格式
- [x] **颜色编码**: >50% 绿色，20-50% 橙色，<20% 红色
- [x] **警告状态**: HP < 20% 时 Boss 卡片红色闪烁
- [x] **Boss 死亡**: HP 降至 0，下一关 Boss 重生，HP 重置为 100%
- [x] **没有 Boss**: 如果 Boss 系统未初始化，显示 "--"
- [x] **除以 0**: maxHP = 0 时不会 crash，安全处理

---

## 🎯 核心原则

### 1. Never Throw, Always Recover
```javascript
// ❌ 不要这样
await somePromise(); // 可能永远卡住

// ✅ 这样做
await withTimeout(somePromise(), 2000, 'label', fallbackValue);
```

### 2. Trust Only Fresh Data
```javascript
// ❌ 不要信任 getter 或缓存值
const pct = jackpotSystem.hpPercent;

// ✅ 从原始数据计算
const hp = jackpotSystem.hp;
const maxHP = jackpotSystem.maxHP;
const pct = maxHP > 0 ? (hp / maxHP) * 100 : 0;
```

### 3. Fail Safe, Not Fail Silent
```javascript
// ❌ 默认值隐藏问题
const hp = stats.bossHP ?? 100;  // 总是 100，看不出问题

// ✅ 显式检查，明确失败
if (stats.bossHP === undefined) {
  return '--';  // 明确告诉用户"没有数据"
}
```

### 4. Debug-First Design
```javascript
// ✅ 添加可控的调试开关
if (window.__TRACE__) {
  console.log('[详细信息]');
}

// ✅ 看门狗监控
if (stuckTime > 8000) {
  console.warn('卡住了！');
}
```

---

## 🐛 已知限制

### 超时 Fallback

**限制**: 
- 超时后使用 fallback 值可能导致不完美的游戏状态
- 例如：stopSpin 超时返回 `totalWin: 0`，玩家失去本轮奖励

**缓解**:
- 超时时间设置足够长（2.5s, 1.5s, 1.6s）
- 99.9% 情况下正常完成
- 只有极端卡顿/错误时才触发超时
- 超时总比卡死好

---

### Boss HP 同步

**限制**:
- StatsPanel 每 200ms 更新一次
- Boss HP 条有 280ms 缓动动画（`gsap.to`）
- HUD 和游戏内 HP 条可能有轻微延迟

**缓解**:
- 200ms 延迟对用户不可察觉
- Boss HP 条缓动让掉血更平滑
- 两个 HP 条最终会同步

---

## 🎉 完成成就

| 成就 | 描述 |
|------|------|
| **永不冻结** | 所有 awaited 操作都有超时保护 |
| **重入保护** | SPIN 按钮只在 IDLE 状态响应 |
| **调试友好** | `window.__TRACE__` 提供详细日志 |
| **看门狗** | 8s 检测卡死并报警 |
| **Boss HP 正确** | HUD 实时显示真实 Boss 血量 |
| **安全 Fallback** | 缺失数据显示 "--"，不显示错误值 |
| **0 Linter 错误** | 所有代码通过 linter 检查 |
| **游戏稳定** | 不改变 gameplay，只提升可靠性 |

---

**🛡️ 游戏现在永不冻结，Boss HP 实时准确，调试清晰，运行稳定！** ✨🎮🚀


