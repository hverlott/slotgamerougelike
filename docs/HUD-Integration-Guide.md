# 🎛️ HUD 集成指南 - 更新 Boss HP 条

## 📋 概述

新的 HUD 设计包含一个视觉化的 Boss HP 条，需要在统计更新时同步更新进度条宽度和百分比文本。

---

## 🔧 集成步骤

### 1. 在 `src/main.js` 中添加 Boss HP 条更新逻辑

在现有的统计更新代码中（约 342-368 行），添加以下代码来更新 Boss HP 条：

```javascript
// 在 statsTimer 计时器中，更新 RTP 统计后添加：

// 🎯 更新 Boss HP 条可视化
const bossHPBar = document.querySelector('.boss-hp-fill');
const bossHPPercentageText = document.querySelector('.boss-hp-percentage');

if (bossHPBar && bossHPPercentageText && typeof bossPct === 'number') {
  const hpPercent = Math.max(0, Math.min(100, bossPct));
  bossHPBar.style.width = `${hpPercent}%`;
  bossHPPercentageText.textContent = `${Math.round(hpPercent)}%`;
}
```

### 完整示例（替换现有的 statsTimer 部分）

```javascript
// 战况统计（节流）
statsTimer += deltaMS;
if (statsTimer >= 200) {
  statsTimer = 0;
  const bossPct = typeof jackpotSystem.hpPercent === 'number' ? jackpotSystem.hpPercent : null;
  rtpManager.setExternalStats?.({
    zombieAlive: enemySystem.getAliveCount?.() ?? enemySystem.zombies.filter((z) => z && !z.destroyed).length,
    zombieSpawned: enemySystem.totalSpawned ?? 0,
    zombieKilled: enemySystem.totalKilled ?? 0,
    bossBonusTotal: ctx.bossBonusTotal,
    bossName: jackpotSystem.bossName ?? 'BOSS',
    bossHPpct: typeof bossPct === 'number' ? bossPct : 100,
    bossHP: jackpotSystem.hp ?? 0,
    bossHPMax: jackpotSystem.maxHP ?? 0,
    level: levelManager.currentLevel + 1,
    levelKills: levelManager.kills ?? 0,
    levelTarget: levelManager.killsToAdvance ?? 100,
  });

  // 🔥 更新连击/热度 UI
  const comboState = comboSystem.getState();
  ctx.hudSystem?.setComboState?.({
    comboCount: comboState.comboCount,
    heatPercent: comboState.heatPercent,
    heatColor: comboSystem.getHeatColor(),
    overdriveActive: comboState.overdriveActive,
  });

  // 🎯 更新 Boss HP 条可视化
  const bossHPBar = document.querySelector('.boss-hp-fill');
  const bossHPPercentageText = document.querySelector('.boss-hp-percentage');
  
  if (bossHPBar && bossHPPercentageText && typeof bossPct === 'number') {
    const hpPercent = Math.max(0, Math.min(100, bossPct));
    bossHPBar.style.width = `${hpPercent}%`;
    bossHPPercentageText.textContent = `${Math.round(hpPercent)}%`;
  }
}
```

---

## 🎨 新 HUD 设计特性

### 1️⃣ 双面板布局

**BATTLE 面板**
- 命中率（关键指标 - 大字体高亮）
- 总局数
- 连击数
- 僵尸存活/生成/击杀
- 关卡进度
- Boss HP 条（可视化进度条）

**ECONOMY 面板**
- 实时 RTP（关键指标 - 大字体高亮）
- 总投入
- 总回报
- 净收益
- Boss 奖励

### 2️⃣ Boss HP 条结构

```html
<div class="boss-hp-container">
  <div class="boss-hp-label">
    <span class="boss-name" data-field="bossName">BOSS</span>
    <span class="boss-hp-text" data-field="bossHP">100%</span>
  </div>
  <div class="boss-hp-bar">
    <div class="boss-hp-fill" style="width: 100%;"></div>
    <div class="boss-hp-percentage">100%</div>
  </div>
</div>
```

**关键类名**：
- `.boss-hp-fill` - 进度条填充（动态宽度）
- `.boss-hp-percentage` - 百分比文本覆盖层

### 3️⃣ 按钮改进

**SPIN 按钮**
- 大型主要 CTA（90px 高）
- 黄橙色渐变 + 赛博朋克切角
- 悬停光晕效果
- 按下状态反馈

**AUTO SPIN 按钮**
- 次要样式（58px 高）
- 透明 + 主色边框
- 激活时红色脉冲动画

**下注控件**
- 紧凑布局（56px 按钮）
- 清晰的悬停/按下状态
- 单色系主题

---

## 🔍 数据字段映射

以下是 HTML `data-field` 属性与数据源的映射：

| data-field | 数据源 | 格式 |
|------------|--------|------|
| `spins` | RTPManager | 整数 |
| `hitRate` | RTPManager | "XX%" |
| `combo` | ComboSystem | 整数 |
| `zAlive` | EnemySystem | 整数 |
| `zSpawned` | EnemySystem.totalSpawned | 整数 |
| `zKilled` | EnemySystem.totalKilled | 整数 |
| `levelProgress` | LevelManager | "LvX Y/Z" |
| `bossName` | JackpotSystem.bossName | 字符串 |
| `bossHP` | JackpotSystem.hpPercent | "XX%" |
| `in` | RTPManager | "X.XX" |
| `out` | RTPManager | "X.XX" |
| `rtp` | RTPManager | "XX%" |
| `net` | RTPManager | "X.XX" |
| `bossBonus` | ctx.bossBonusTotal | "X.XX" |

---

## 🎯 样式变量

在 `:root` 中定义的 CSS 变量可用于动态主题：

```css
:root {
  --primary: #00F0FF;          /* 主色（青色） */
  --primary-dim: #0099AA;      /* 主色暗调 */
  --accent: #FF003C;           /* 强调色（红色） */
  --accent-dim: #AA0028;       /* 强调色暗调 */
  --success: #00FF88;          /* 成功色（绿色） */
  --warning: #FFB800;          /* 警告色（橙色） */
  
  --text-primary: #E8F2FF;     /* 主要文字 */
  --text-secondary: #94A9C9;   /* 次要文字 */
  --text-dim: #5A6B85;         /* 暗淡文字 */
  --text-highlight: #7CFFB8;   /* 高亮文字 */
}
```

这些变量会随主题切换自动更新（通过 ThemeManager）。

---

## 🧪 测试建议

### 浏览器控制台测试

```javascript
// 测试 Boss HP 条更新
const hpBar = document.querySelector('.boss-hp-fill');
const hpText = document.querySelector('.boss-hp-percentage');

// 模拟 HP 下降
let hp = 100;
const interval = setInterval(() => {
  hp -= 5;
  if (hp < 0) {
    clearInterval(interval);
    hp = 0;
  }
  hpBar.style.width = `${hp}%`;
  hpText.textContent = `${hp}%`;
}, 200);
```

### 响应式测试

测试以下分辨率：
- 1366x768（最小支持）
- 1920x1080（主要）
- 2560x1440（4K 缩放）

---

## ✅ 集成检查清单

- ✅ 更新 `main.js` 统计更新逻辑
- ✅ 添加 Boss HP 条更新代码
- ✅ 测试 Boss HP 条动画
- ✅ 验证所有 `data-field` 正确更新
- ✅ 测试按钮交互（SPIN、AUTO、+/-）
- ✅ 测试主题切换
- ✅ 验证响应式布局
- ✅ 检查浏览器兼容性

---

## 🐛 常见问题

### 问题 1: Boss HP 条不更新

**原因**: 未添加 DOM 更新代码

**解决**:
```javascript
const bossHPBar = document.querySelector('.boss-hp-fill');
const bossHPPercentageText = document.querySelector('.boss-hp-percentage');

if (bossHPBar && typeof bossPct === 'number') {
  bossHPBar.style.width = `${Math.max(0, Math.min(100, bossPct))}%`;
  bossHPPercentageText.textContent = `${Math.round(bossPct)}%`;
}
```

### 问题 2: 文字过长溢出

**原因**: 面板宽度不足

**解决**:
```css
.data-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### 问题 3: 按钮点击无响应

**原因**: z-index 冲突或 canvas 覆盖

**解决**:
```css
#sidebar {
  position: relative;
  z-index: 100; /* 确保高于 canvas */
}
```

---

## 📊 性能提示

1. **节流更新**: 统计更新已节流到 200ms 间隔，足够流畅且不会影响性能
2. **DOM 查询缓存**: 如果频繁更新，考虑缓存 DOM 引用：
   ```javascript
   // 在初始化时缓存
   const elements = {
     bossHPBar: document.querySelector('.boss-hp-fill'),
     bossHPText: document.querySelector('.boss-hp-percentage'),
   };
   
   // 更新时直接使用
   if (elements.bossHPBar) {
     elements.bossHPBar.style.width = `${hp}%`;
   }
   ```
3. **CSS 动画**: HP 条使用 CSS transition，性能优于 JS 动画

---

**🎛️ 高端赛博朋克 HUD 已就绪！享受全新的视觉体验！** ✨🚀

