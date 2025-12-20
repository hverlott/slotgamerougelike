# 🎯 KPI Dashboard Design - 专业游戏分析 HUD

## 📊 布局设计

```
┌─────────────────────────────────────────┐
│  🎯 Primary KPIs (2x2 Grid)            │
│  ┌──────────┬──────────┐               │
│  │ Hit%     │ Combo    │               │
│  │  87.5%   │  x12     │               │
│  ├──────────┼──────────┤               │
│  │ Boss HP  │ RTP%     │               │
│  │ [████  ] │  96.42%  │               │
│  └──────────┴──────────┘               │
│                                         │
│  📋 Detailed Metrics (Table)           │
│  ┌─────────────────────────────────┐   │
│  │ 总局数       │         1,234 │   │
│  │ 当前Boss     │    CYBER-01 │   │
│  │ 当前僵尸     │            12 │   │
│  │ 总生成       │           456 │   │
│  │ 累计击杀     │           444 │   │
│  │ 关卡进度     │  Lv5 (89/100) │   │
│  │ Boss奖励累计 │     12,345.00 │   │
│  ├─────────────────────────────────┤   │
│  │ 总投入       │     50,000.00 │   │
│  │ 总回收       │     48,210.00 │   │
│  │ 净收益       │     -1,790.00 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [固定控件区: 主题+下注+SPIN]          │
└─────────────────────────────────────────┘
```

---

## 🎨 视觉规范

### KPI 卡片
- **大小**: 正方形或 4:3 比例
- **布局**: 2x2 网格（桌面）/ 1 列（移动）
- **内容**: 
  - 图标（小，顶部）
  - 数值（大，居中）
  - 标签（小，底部）
- **样式**: 
  - 渐变背景
  - 细边框（1px）
  - 微妙阴影
  - 数值变化动画

### 详细表格
- **布局**: 两列（标签 | 值）
- **样式**: 
  - 紧凑行间距
  - 细分隔线
  - 右对齐数值（等宽）
  - 分组（战斗 / 经济）

---

## 📝 数字格式化规则

```javascript
// 百分比
87.5%      // 1 位小数
0.0%       // 低值保留
100.0%     // 完整值保留

// 金额
1,234.56   // 千位分隔符 + 2 位小数
0.00       // 零值保留
-789.12    // 负值保留符号

// 整数
1,234      // 千位分隔符
0          // 零值
999,999    // 大数

// 进度
89/100 (89.0%)  // 当前/目标 (百分比)
Lv5            // 关卡
x12            // 连击倍数
```

---

## 🔧 实现细节

### HTML 结构
```html
<div class="stats-area">
  <!-- KPI 卡片区 -->
  <div class="kpi-grid">
    <div class="kpi-card" data-kpi="hit-rate">
      <div class="kpi-icon">🎯</div>
      <div class="kpi-value" data-field="hitRate">0.0%</div>
      <div class="kpi-label">命中率</div>
    </div>
    
    <div class="kpi-card" data-kpi="combo">
      <div class="kpi-icon">🔥</div>
      <div class="kpi-value" data-field="combo">x0</div>
      <div class="kpi-label">连击</div>
    </div>
    
    <div class="kpi-card boss-hp-kpi" data-kpi="boss-hp">
      <div class="kpi-icon">👾</div>
      <div class="kpi-value" data-field="bossHPpct">100%</div>
      <div class="kpi-label">Boss血量</div>
      <div class="kpi-hp-bar">
        <div class="kpi-hp-fill" style="width: 100%;"></div>
      </div>
    </div>
    
    <div class="kpi-card" data-kpi="rtp">
      <div class="kpi-icon">💰</div>
      <div class="kpi-value" data-field="rtp">0.0%</div>
      <div class="kpi-label">实时RTP</div>
    </div>
  </div>
  
  <!-- 详细指标表格 -->
  <div class="metrics-table">
    <div class="table-section">
      <div class="section-header">⚔️ 战斗统计</div>
      <div class="table-row">
        <span class="table-label">总局数</span>
        <span class="table-value" data-field="spins">0</span>
      </div>
      <div class="table-row">
        <span class="table-label">当前Boss</span>
        <span class="table-value" data-field="bossName">BOSS</span>
      </div>
      <!-- ... more rows ... -->
    </div>
    
    <div class="table-section">
      <div class="section-header">💰 经济统计</div>
      <div class="table-row">
        <span class="table-label">总投入</span>
        <span class="table-value" data-field="in">0.00</span>
      </div>
      <!-- ... more rows ... -->
    </div>
  </div>
  
  <!-- 系统状态（可折叠） -->
  <div class="info-section system-section">...</div>
</div>
```

---

## 🎨 CSS 关键样式

```css
/* KPI 网格 */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

/* KPI 卡片 */
.kpi-card {
  aspect-ratio: 4 / 3;
  padding: var(--space-3);
  
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  
  background: linear-gradient(135deg, 
    rgba(0, 0, 0, 0.6) 0%, 
    rgba(0, 20, 40, 0.4) 100%);
  
  border: 1px solid rgba(0, 240, 255, 0.3);
  border-radius: var(--radius-md);
  
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  
  transition: all var(--transition-base);
}

.kpi-card:hover {
  border-color: rgba(0, 240, 255, 0.5);
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.4),
    0 0 16px rgba(0, 240, 255, 0.2);
}

/* KPI 图标 */
.kpi-icon {
  font-size: 1.5rem;
  opacity: 0.8;
}

/* KPI 数值 */
.kpi-value {
  font-family: var(--font-mono);
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: var(--font-weight-black);
  color: var(--text-highlight);
  text-shadow: 0 0 8px currentColor;
  font-variant-numeric: tabular-nums;
}

/* KPI 标签 */
.kpi-label {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
}

/* Boss HP KPI 特殊样式 */
.boss-hp-kpi .kpi-hp-bar {
  width: 100%;
  height: 4px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 2px;
  overflow: hidden;
  margin-top: var(--space-1);
}

.boss-hp-kpi .kpi-hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #00FF88, #00F0FF);
  transition: width 0.5s ease-out;
}

/* 指标表格 */
.metrics-table {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-4);
}

.table-section {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 240, 255, 0.15);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.table-section .section-header {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--letter-spacing-wide);
  margin-bottom: var(--space-2);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid rgba(0, 240, 255, 0.1);
}

.table-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: var(--space-2) 0;
  gap: var(--space-3);
  font-size: var(--text-xs);
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.table-row:last-child {
  border-bottom: none;
}

.table-label {
  color: var(--text-tertiary);
  font-weight: var(--font-weight-medium);
}

.table-value {
  font-family: var(--font-mono);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .kpi-grid {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }
  
  .kpi-card {
    aspect-ratio: 16 / 5;
    flex-direction: row;
    justify-content: flex-start;
    padding: var(--space-2) var(--space-3);
  }
  
  .kpi-icon {
    font-size: 1.25rem;
  }
  
  .kpi-value {
    font-size: clamp(1.25rem, 4vw, 1.5rem);
    flex: 1;
    text-align: left;
  }
  
  .kpi-label {
    font-size: 10px;
  }
}
```

---

## 🔧 StatsPanel.js 更新

### 格式化函数增强

```javascript
/**
 * 格式化百分比（1 位小数）
 */
formatPercentage(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

/**
 * 格式化金额（千位分隔符 + 2 位小数）
 */
formatMoney(value) {
  const num = Number(value || 0);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * 格式化整数（千位分隔符）
 */
formatInteger(value) {
  return Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

/**
 * 格式化连击（带 x 前缀）
 */
formatCombo(value) {
  const num = Number(value || 0);
  return num > 0 ? `x${num}` : '--';
}

/**
 * 格式化关卡进度
 */
formatLevelProgress(level, kills, target) {
  const pct = target > 0 ? ((kills / target) * 100).toFixed(1) : 0;
  return `Lv${level} (${this.formatInteger(kills)}/${this.formatInteger(target)})`;
}
```

### 更新逻辑

```javascript
update(stats = {}) {
  // ... existing code ...
  
  // ===== 更新 KPI 卡片 =====
  
  // Hit Rate
  if (stats.hitRate !== undefined) {
    const formatted = this.formatPercentage(stats.hitRate);
    this.updateFieldWithAnimation('hitRate', formatted, stats.hitRate);
    
    // 颜色编码
    const color = stats.hitRate > 80 ? '#00FF88' : 
                  stats.hitRate > 50 ? '#00F0FF' : '#FF4444';
    safeSetStyle(this.fields.hitRate, 'color', color);
  }
  
  // Combo
  if (stats.combo !== undefined) {
    const formatted = this.formatCombo(stats.combo);
    this.updateFieldWithAnimation('combo', formatted, stats.combo);
    
    // 连击高亮
    if (stats.combo > 5) {
      this.fields.combo?.parentElement?.classList.add('combo-active');
    } else {
      this.fields.combo?.parentElement?.classList.remove('combo-active');
    }
  }
  
  // Boss HP
  if (stats.bossHPpct !== undefined) {
    const formatted = this.formatPercentage(stats.bossHPpct);
    this.updateFieldWithAnimation('bossHPpct', formatted, stats.bossHPpct);
    
    // 更新 HP 条
    const hpFill = document.querySelector('.kpi-hp-fill');
    if (hpFill) {
      hpFill.style.width = `${Math.max(0, Math.min(100, stats.bossHPpct))}%`;
    }
    
    // 颜色编码
    const color = stats.bossHPpct > 50 ? '#00FF88' : 
                  stats.bossHPpct > 20 ? '#FFA500' : '#FF4444';
    safeSetStyle(this.fields.bossHPpct, 'color', color);
  }
  
  // RTP
  if (stats.rtp !== undefined) {
    const formatted = this.formatPercentage(stats.rtp);
    this.updateFieldWithAnimation('rtp', formatted, stats.rtp);
    
    // 颜色编码
    const color = stats.rtp > 100 ? '#00FF88' : 
                  stats.rtp > 90 ? '#00F0FF' : '#FF4444';
    safeSetStyle(this.fields.rtp, 'color', color);
  }
  
  // ===== 更新详细表格 =====
  
  // 整数字段
  ['spins', 'zombieAlive', 'zombieSpawned', 'zombieKilled'].forEach(field => {
    if (stats[field] !== undefined) {
      const formatted = this.formatInteger(stats[field]);
      safeSetText(this.fields[field], formatted);
    }
  });
  
  // 金额字段
  ['totalBet', 'totalWin', 'net', 'bossBonusTotal'].forEach(field => {
    if (stats[field] !== undefined) {
      const formatted = this.formatMoney(stats[field]);
      safeSetText(this.fields[field], formatted);
      
      // 净收益颜色
      if (field === 'net') {
        const color = stats[field] > 0 ? '#00FF88' : 
                     stats[field] < 0 ? '#FF4444' : '#00F0FF';
        safeSetStyle(this.fields[field], 'color', color);
      }
    }
  });
  
  // 关卡进度
  if (stats.level && stats.levelKills !== undefined && stats.levelTarget) {
    const formatted = this.formatLevelProgress(
      stats.level, 
      stats.levelKills, 
      stats.levelTarget
    );
    safeSetText(this.fields.levelProgress, formatted);
  }
  
  // 其他字段...
}
```

---

## 🎯 KPI 卡片动画

```css
/* 数值变化脉冲 */
@keyframes kpiPulse {
  0%, 100% { 
    transform: scale(1); 
    text-shadow: 0 0 8px currentColor;
  }
  50% { 
    transform: scale(1.1); 
    text-shadow: 0 0 16px currentColor;
  }
}

.kpi-value.value-changed {
  animation: kpiPulse 0.3s ease-out;
}

/* 连击激活 */
.kpi-card.combo-active {
  border-color: #FF003C;
  box-shadow: 
    0 4px 16px rgba(255, 0, 60, 0.4),
    0 0 24px rgba(255, 0, 60, 0.3);
}

.kpi-card.combo-active .kpi-value {
  color: #FF003C;
  animation: kpiPulse 0.5s ease-in-out infinite;
}

/* Boss 警告 */
.boss-hp-kpi[data-warning="true"] {
  border-color: #FF4444;
  box-shadow: 
    0 4px 16px rgba(255, 68, 68, 0.4),
    0 0 24px rgba(255, 68, 68, 0.3);
}

.boss-hp-kpi[data-warning="true"] .kpi-hp-fill {
  background: linear-gradient(90deg, #FF4444, #FF0060);
}
```

---

## 📊 数据流

```
main.js (ticker)
    ↓ 每 200ms
statsData {
  hitRate: 87.5,
  combo: 12,
  bossHPpct: 45.2,
  rtp: 96.42,
  spins: 1234,
  // ... other fields
}
    ↓
StatsPanel.update(statsData)
    ↓
formatPercentage() → "87.5%"
formatCombo()      → "x12"
formatMoney()      → "1,234.56"
formatInteger()    → "1,234"
    ↓
updateFieldWithAnimation()
    ↓
DOM 更新 + CSS 动画
```

---

## ✅ 实现检查清单

### HTML
- [ ] 创建 `.kpi-grid` 容器
- [ ] 创建 4 个 `.kpi-card` (hitRate, combo, bossHP, rtp)
- [ ] 创建 `.metrics-table` 容器
- [ ] 创建 `.table-section` (战斗、经济)
- [ ] 添加所有 `data-field` 属性

### CSS
- [ ] `.kpi-grid` 2x2 网格样式
- [ ] `.kpi-card` 卡片样式
- [ ] `.kpi-value` 大数字样式
- [ ] `.kpi-hp-bar` HP 条样式
- [ ] `.metrics-table` 表格样式
- [ ] `.table-row` 行样式
- [ ] 响应式媒体查询（移动端 1 列）
- [ ] KPI 动画（pulse, combo, warning）

### StatsPanel.js
- [ ] `formatPercentage()`
- [ ] `formatMoney()`
- [ ] `formatInteger()`
- [ ] `formatCombo()`
- [ ] `formatLevelProgress()`
- [ ] 更新 `init()` 缓存 KPI 字段
- [ ] 更新 `update()` 填充 KPI 卡片
- [ ] 更新 `update()` 填充详细表格
- [ ] 颜色编码逻辑
- [ ] HP 条更新逻辑

---

**🎯 KPI Dashboard Design 完成！专业游戏分析 HUD 准备就绪！** ✨📊🎮


