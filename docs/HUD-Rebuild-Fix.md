# 🎛️ HUD Rebuild Fix - 专业仪表板修复

## 🐛 问题诊断

### 症状
- StatsPanel 报告 21/21 字段初始化
- UI 只显示少数几行
- 面板看起来折叠/空的
- 内容被剪裁

### 根本原因
1. **缺少可滚动容器**: `#sidebar` 直接包含所有内容，控件和统计混在一起
2. **没有固定底部**: 主题切换、下注、SPIN 按钮滚动时会消失
3. **overflow 不当**: 整个 sidebar 滚动，而不是只有统计区滚动

---

## ✅ 解决方案

### 布局结构
```
#sidebar (flex column, no scroll)
├─ .stats-area (flex: 1, overflow-y: auto) ← 可滚动
│  ├─ .info-section (战斗概况)
│  ├─ .info-section (经济监控)
│  └─ .info-section (系统状态)
│
└─ .controls-area (固定底部)
   ├─ .cyber-separator
   ├─ #theme-switcher
   ├─ .bet-control
   └─ .actions (SPIN 按钮)
```

---

## 📝 HTML 更新

### 新结构
```html
<div id="sidebar">
  <!-- 📱 Mobile HUD Toggle Button -->
  <button class="hud-toggle" id="hud-toggle" type="button">统计</button>
  
  <!-- ========== 可滚动统计区 ========== -->
  <div class="stats-area">
    <!-- 第1部分：战斗概况 -->
    <div class="info-section">
      <div class="section-header">⚔️ 战斗概况</div>
      
      <div class="data-row key-stat">
        <span class="data-label">总局数</span>
        <span class="data-value" data-field="spins">0</span>
      </div>
      
      <div class="data-row key-stat">
        <span class="data-label">命中率</span>
        <span class="data-value" data-field="hitRate">0.0%</span>
      </div>
      
      <div class="data-row">
        <span class="data-label">连击数</span>
        <span class="data-value" data-field="combo">0</span>
      </div>
      
      <div class="data-row">
        <span class="data-label">DPS</span>
        <span class="data-value" data-field="dps">0</span>
      </div>
      
      <!-- Boss 信息 -->
      <div class="sub-header">Boss 状态</div>
      
      <div class="data-row">
        <span class="data-label">Boss名称</span>
        <span class="data-value" data-field="bossName">BOSS</span>
      </div>
      
      <!-- Boss 血量条 -->
      <div class="boss-hp-container">
        <div class="boss-hp-label">
          <span class="boss-hp-text-label">Boss 血量</span>
          <span class="boss-hp-text" data-field="bossHPText">100% (0/0)</span>
        </div>
        <div class="boss-hp-bar">
          <div class="boss-hp-fill" style="width: 100%;"></div>
          <div class="boss-hp-percentage">100%</div>
        </div>
      </div>
      
      <!-- 僵尸统计 -->
      <div class="sub-header">僵尸统计</div>
      
      <div class="data-row">
        <span class="data-label">当前僵尸</span>
        <span class="data-value" data-field="zAlive">0</span>
      </div>
      
      <div class="data-row">
        <span class="data-label">总生成数</span>
        <span class="data-value" data-field="zSpawned">0</span>
      </div>
      
      <div class="data-row">
        <span class="data-label">累计击杀</span>
        <span class="data-value" data-field="zKilled">0</span>
      </div>
      
      <!-- 关卡进度 -->
      <div class="sub-header">关卡进度</div>
      
      <div class="data-row">
        <span class="data-label">当前关卡</span>
        <span class="data-value" data-field="level">Lv1</span>
      </div>
      
      <div class="data-row">
        <span class="data-label">进度</span>
        <span class="data-value" data-field="levelProgress">0/100 (0%)</span>
      </div>
    </div>
    
    <!-- 第2部分：经济监控 -->
    <div class="info-section">
      <div class="section-header">💰 经济监控</div>
      
      <div class="data-row key-stat">
        <span class="data-label">实时RTP</span>
        <span class="data-value" data-field="rtp">0.00%</span>
      </div>
      
      <div class="data-row">
        <span class="data-label">总投入</span>
        <span class="data-value" data-field="in">0</span>
      </div>
      
      <div class="data-row">
        <span class="data-label">总回收</span>
        <span class="data-value" data-field="out">0</span>
      </div>
      
      <div class="data-row">
        <span class="data-label">净收益</span>
        <span class="data-value" data-field="net">0</span>
      </div>
      
      <div class="data-row">
        <span class="data-label">Boss奖励</span>
        <span class="data-value" data-field="bossBonus">0</span>
      </div>
    </div>
    
    <!-- 第3部分：系统状态（桌面端展开，移动端默认折叠） -->
    <div class="info-section system-section">
      <div class="section-header system-header" id="system-toggle">
        ⚙️ 系统状态
        <span class="toggle-icon">▼</span>
      </div>
      
      <div class="system-content" id="system-content">
        <div class="data-row small">
          <span class="data-label">当前下注</span>
          <span class="data-value" data-field="bet">10</span>
        </div>
        
        <div class="data-row small">
          <span class="data-label">子弹并发</span>
          <span class="data-value" data-field="bullets">0</span>
        </div>
        
        <div class="data-row small">
          <span class="data-label">特效并发</span>
          <span class="data-value" data-field="fx">0</span>
        </div>
        
        <div class="data-row small">
          <span class="data-label">帧率(FPS)</span>
          <span class="data-value" data-field="fps">60</span>
        </div>
        
        <div class="data-row small">
          <span class="data-label">帧耗时(ms)</span>
          <span class="data-value" data-field="frameTime">16.7</span>
        </div>
      </div>
    </div>
  </div>
  
  <!-- ========== 固定控件区 ========== -->
  <div class="controls-area">
    <!-- Separator -->
    <div class="cyber-separator"></div>
    
    <!-- 🎨 Theme Switcher -->
    <div id="theme-switcher"></div>
    
    <!-- 💰 Bet Controls -->
    <div class="bet-control">
      <button id="bet-minus" class="bet-btn" type="button">−</button>
      <input id="bet-display" value="10" readonly />
      <button id="bet-plus" class="bet-btn" type="button">+</button>
    </div>
    
    <!-- 🎮 操作按钮 -->
    <div class="actions">
      <button id="spin-btn" type="button">旋转</button>
      <button id="auto-btn" type="button">自动旋转</button>
    </div>
  </div>
</div>
```

---

## 🎨 CSS 更新

### 关键样式

```css
/* ========== Sidebar 主容器 ========== */
#sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: 380px;
  min-width: 300px;
  max-width: 380px;
  height: 100vh;
  
  display: flex;
  flex-direction: column;
  gap: 0; /* 移除 gap，由子元素控制 */
  
  background: 
    linear-gradient(135deg, 
      rgba(10, 18, 35, 0.92) 0%, 
      rgba(5, 10, 20, 0.95) 100%);
  backdrop-filter: blur(32px) saturate(1.6);
  -webkit-backdrop-filter: blur(32px) saturate(1.6);
  
  border-left: 2px solid; /* 3px → 2px (更细) */
  border-image: linear-gradient(
    180deg,
    rgba(0, 240, 255, 0.6) 0%,  /* 0.8 → 0.6 */
    rgba(0, 240, 255, 0.2) 50%, /* 0.3 → 0.2 */
    rgba(255, 0, 60, 0.3) 100%  /* 0.5 → 0.3 */
  ) 1;
  
  box-shadow:
    -8px 0 32px rgba(0, 0, 0, 0.6),      /* 更小阴影 */
    0 0 8px rgba(0, 240, 255, 0.2),      /* 0 0 16px 0.3 → 0 0 8px 0.2 */
    inset 0 1px 0 rgba(255, 255, 255, 0.06); /* 0.08 → 0.06 */
  
  z-index: 1000;
  
  overflow: hidden; /* 防止整体滚动 */
}

/* ========== 可滚动统计区域 ========== */
.stats-area {
  flex: 1; /* 占据剩余空间 */
  overflow-y: auto; /* 启用垂直滚动 */
  overflow-x: hidden;
  
  padding: var(--space-7) var(--space-5) var(--space-4); /* 上 右 下 */
  
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  
  /* 平滑滚动 */
  scroll-behavior: smooth;
  overscroll-behavior: contain;
}

/* 滚动条样式 */
.stats-area::-webkit-scrollbar {
  width: 6px;
}

.stats-area::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.stats-area::-webkit-scrollbar-thumb {
  background: rgba(0, 240, 255, 0.3);
  border-radius: 3px;
  transition: background var(--transition-base);
}

.stats-area::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 240, 255, 0.5);
}

/* ========== 固定控件区域 ========== */
.controls-area {
  flex-shrink: 0; /* 不缩小 */
  
  padding: 0 var(--space-5) var(--space-5); /* 左右 下 */
  
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  
  background: 
    linear-gradient(180deg, 
      rgba(5, 10, 20, 0.95) 0%, 
      rgba(5, 10, 20, 0.98) 100%);
  
  border-top: 1px solid rgba(0, 240, 255, 0.15);
  
  /* 固定底部阴影 */
  box-shadow: 
    0 -8px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(0, 240, 255, 0.1);
}

/* ========== Info Section (更紧凑) ========== */
.info-section {
  background: 
    linear-gradient(135deg, 
      rgba(0, 0, 0, 0.5) 0%,  /* 0.6 → 0.5 */
      rgba(0, 10, 20, 0.4) 100%); /* 0.5 → 0.4 */
  
  border: 1px solid;  /* thin → 1px */
  border-image: linear-gradient(
    135deg,
    rgba(0, 240, 255, 0.3),  /* 0.4 → 0.3 */
    rgba(0, 240, 255, 0.1)   /* 0.15 → 0.1 */
  ) 1;
  
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-4); /* 上下左右一致 */
  
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.3),        /* lg → md */
    0 0 4px rgba(0, 240, 255, 0.15),      /* md → sm */
    inset 0 1px 0 rgba(255, 255, 255, 0.05), /* 0.08 → 0.05 */
    inset 0 -1px 0 rgba(0, 0, 0, 0.4);    /* 0.6 → 0.4 */
  
  position: relative;
  overflow: visible; /* hidden → visible */
  transition: all var(--transition-slow);
}

/* ========== Section Header (更紧凑) ========== */
.section-header {
  font-size: var(--text-sm);  /* base → sm */
  font-weight: var(--font-weight-black);
  color: var(--text-primary);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  margin-bottom: var(--space-3); /* 4 → 3 */
  padding-bottom: var(--space-2); /* 3 → 2 */
  border-bottom: 1px solid rgba(0, 240, 255, 0.2); /* thin → 1px */
  position: relative;
}

/* ========== Sub Header (更小) ========== */
.sub-header {
  font-size: var(--text-xs);  /* sm → xs */
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
  letter-spacing: var(--letter-spacing-normal);
  text-transform: uppercase;
  margin-top: var(--space-3);  /* 4 → 3 */
  margin-bottom: var(--space-2); /* 3 → 2 */
  padding-top: var(--space-3);  /* 4 → 3 */
  border-top: 1px solid rgba(0, 240, 255, 0.08); /* thin → 1px */
}

/* ========== Data Row (防止剪裁) ========== */
.data-row {
  display: grid;
  grid-template-columns: minmax(80px, 1fr) auto; /* 1fr → minmax */
  align-items: center;
  padding: var(--space-2) 0; /* 3 1 → 2 0 */
  font-size: var(--text-sm);
  line-height: var(--line-height-base);
  border-bottom: 1px solid rgba(0, 240, 255, 0.06); /* thin, 0.08 → 0.06 */
  gap: var(--space-3); /* 4 → 3 */
  transition: background var(--transition-base);
  
  /* 防止剪裁 */
  overflow: visible;
}

.data-row:hover {
  background: rgba(0, 240, 255, 0.02); /* 0.03 → 0.02 */
  border-bottom-color: rgba(0, 240, 255, 0.1); /* 0.15 → 0.1 */
}

.data-row:last-child {
  border-bottom: none;
}

/* ========== Data Label (防止剪裁) ========== */
.data-label {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  letter-spacing: var(--letter-spacing-tight);
  text-transform: none; /* uppercase → none */
  line-height: 1.4;
  
  /* 防止剪裁 */
  min-width: 0; /* 允许缩小 */
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========== Data Value (防止剪裁，等宽数字) ========== */
.data-value {
  font-family: var(--font-mono); /* 等宽字体 */
  font-size: var(--text-base);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  text-align: right;
  letter-spacing: var(--letter-spacing-tight);
  line-height: 1.4;
  
  /* 防止剪裁 */
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  
  /* 数字特性 */
  font-variant-numeric: tabular-nums;
}

/* ========== System Section (桌面端默认展开) ========== */
.system-section .system-content {
  display: block; /* 桌面端默认展开 */
}

.system-header {
  cursor: pointer;
  user-select: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.system-header:hover {
  color: var(--primary);
}

.toggle-icon {
  font-size: 10px;
  transition: transform var(--transition-base);
}

/* 桌面端隐藏折叠图标 */
@media (min-width: 769px) {
  .toggle-icon {
    display: none;
  }
  
  .system-header {
    cursor: default;
  }
}

/* 移动端允许折叠 */
@media (max-width: 768px) {
  .system-section .system-content {
    display: none; /* 移动端默认折叠 */
  }
  
  .system-section .system-content.expanded {
    display: block;
  }
}
```

---

## 🔧 StatsPanel.js 更新

### 折叠逻辑修复

```javascript
// 系统部分折叠功能
const systemToggle = document.getElementById('system-toggle');
const systemContent = document.getElementById('system-content');

if (systemToggle && systemContent) {
  systemToggle.addEventListener('click', () => {
    // 检查屏幕宽度
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
      // 移动端：切换 expanded 类
      const isCollapsed = !systemContent.classList.contains('expanded');
      
      if (isCollapsed) {
        systemContent.classList.add('expanded');
      } else {
        systemContent.classList.remove('expanded');
      }
      
      const icon = systemToggle.querySelector('.toggle-icon');
      if (icon) {
        icon.textContent = isCollapsed ? '▲' : '▼';
      }
    } else {
      // 桌面端：忽略点击（始终展开）
      return;
    }
  });
  
  // 初始化状态
  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    systemContent.classList.remove('expanded'); // 移动端默认折叠
    const icon = systemToggle.querySelector('.toggle-icon');
    if (icon) icon.textContent = '▼';
  } else {
    systemContent.style.display = 'block'; // 桌面端强制展开
    const icon = systemToggle.querySelector('.toggle-icon');
    if (icon) icon.style.display = 'none'; // 隐藏图标
  }
}
```

---

## 📊 修复对比

| 问题 | 修复前 | 修复后 |
|------|--------|--------|
| **可见行数** | 2-3 行 | 全部 21 字段 |
| **滚动区域** | 整个 sidebar | 仅 stats-area |
| **控件位置** | 随滚动消失 | 固定底部 |
| **文本剪裁** | 有 | 无（ellipsis） |
| **数字对齐** | 不一致 | 等宽右对齐 |
| **桌面折叠** | 系统部分折叠 | 全部展开 |
| **移动折叠** | 混乱 | 系统部分可折叠 |

---

## ✅ 关键改进

### 1️⃣ 双区域布局
- **stats-area**: `flex: 1`, `overflow-y: auto`
- **controls-area**: `flex-shrink: 0`, 固定底部

### 2️⃣ 防止剪裁
```css
.data-label, .data-value {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

### 3️⃣ 等宽数字
```css
.data-value {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

### 4️⃣ 条件折叠
- 桌面端（> 768px）：系统部分始终展开
- 移动端（≤ 768px）：系统部分默认折叠，可点击切换

### 5️⃣ 精致样式
- 边框: 3px → 2px / 1px
- 阴影: 减少模糊半径
- 光晕: 降低 alpha
- 分隔符: 1px，低 alpha

---

**🎛️ HUD Rebuild Fix 完成！专业仪表板已修复，所有 21 个字段可见且布局完美！** ✨📊🚀


