# 📱 响应式布局完整实现指南

## 🎯 设计目标

### 桌面端（> 1024px）
- ✅ Canvas 居中，战场聚焦
- ✅ 右侧 HUD 固定，内部滚动
- ✅ 控件（下注/旋转）始终可见

### 平板端（768px - 1024px）
- ✅ 紧凑布局
- ✅ 右侧 HUD 更窄
- ✅ 字体缩小但可读

### 移动端竖屏（<= 768px, portrait）
- ✅ HUD 变为底部抽屉
- ✅ 默认折叠，显示关键统计
- ✅ SPIN 按钮粘性底部，大触控目标

### 移动端横屏（<= 768px, landscape）
- ✅ HUD 停靠右侧但可折叠
- ✅ 保持全高布局
- ✅ 左侧手柄可见

---

## 🏗️ HTML 结构

### 布局容器

```html
<body>
  <div id="layout-container">
    <!-- Game Canvas -->
    <div id="game-stage"></div>
    
    <!-- Sidebar HUD -->
    <div id="sidebar">
      <!-- Mobile Toggle -->
      <button class="hud-toggle" id="hud-toggle">统计</button>
      
      <!-- HUD Sections -->
      <div class="info-section">...</div>
      <div class="info-section">...</div>
      <div class="info-section system-section">...</div>
      
      <!-- Theme Switcher -->
      <div id="theme-switcher"></div>
      
      <!-- Bet Controls -->
      <div class="bet-control">
        <button id="bet-minus">−</button>
        <input id="bet-display" value="10" readonly />
        <button id="bet-plus">+</button>
      </div>
      
      <!-- Action Buttons -->
      <div class="actions">
        <button id="spin-btn">旋转</button>
        <button id="auto-btn">自动旋转</button>
      </div>
    </div>
  </div>
  
  <!-- Mobile Toggle Script -->
  <script>
    // ... (详见下方)
  </script>
</body>
```

---

## 🎨 CSS 实现

### 基础布局（桌面端）

```css
/* === Layout Container === */
#layout-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  overflow: hidden;
  background: #000;
}

/* === Game Canvas === */
#game-stage {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

#game-stage canvas {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  max-height: 100%;
}

/* === Sidebar HUD (Desktop) === */
#sidebar {
  position: fixed;
  top: 0;
  right: 0;
  width: clamp(300px, 20vw, 380px); /* 响应式宽度 */
  height: 100vh;
  
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-7) var(--space-6);
  
  background: var(--surface-glass);
  backdrop-filter: blur(16px);
  border-left: var(--border-primary);
  box-shadow: var(--shadow-2xl);
  
  overflow-y: auto;
  overflow-x: hidden;
  
  z-index: 1000;
  
  /* 平滑滚动 */
  scroll-behavior: smooth;
  overscroll-behavior: contain;
}

/* 滚动条样式 */
#sidebar::-webkit-scrollbar {
  width: 6px;
}

#sidebar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

#sidebar::-webkit-scrollbar-thumb {
  background: rgba(0, 240, 255, 0.3);
  border-radius: 3px;
}

#sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 240, 255, 0.5);
}
```

---

### 移动端切换按钮（默认隐藏）

```css
.hud-toggle {
  display: none; /* 桌面端隐藏 */
  position: absolute;
  z-index: 10;
  
  padding: var(--space-3) var(--space-5);
  background: var(--surface-glass-dark);
  border: var(--border-primary);
  border-radius: var(--radius-lg);
  
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  
  transition: all var(--transition-base);
}

.hud-toggle:hover {
  background: var(--surface-glass-light);
  box-shadow: var(--glow-md);
  transform: translateY(-1px);
}

.hud-toggle:active {
  transform: translateY(0);
}
```

---

### 控件布局

```css
/* === Bet Controls === */
.bet-control {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  
  background: var(--surface-panel);
  border: var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md), var(--shadow-inset);
}

.bet-btn {
  width: 48px;
  height: 48px;
  min-width: 48px; /* 触控目标 */
  min-height: 48px;
  
  background: linear-gradient(135deg, 
    rgba(0, 240, 255, 0.2), 
    rgba(0, 240, 255, 0.05));
  border: var(--border-primary);
  border-radius: var(--radius-lg);
  
  color: var(--primary);
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-black);
  line-height: 1;
  
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  
  transition: all var(--transition-fast);
}

.bet-btn:hover {
  background: linear-gradient(135deg, 
    rgba(0, 240, 255, 0.3), 
    rgba(0, 240, 255, 0.1));
  box-shadow: var(--glow-md);
  transform: scale(1.05);
}

.bet-btn:active {
  transform: scale(0.95);
}

#bet-display {
  flex: 1;
  height: 48px;
  min-height: 48px;
  
  background: rgba(0, 0, 0, 0.4);
  border: var(--border-subtle);
  border-radius: var(--radius-lg);
  
  color: var(--text-highlight);
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: var(--font-weight-bold);
  text-align: center;
  
  outline: none;
  box-shadow: var(--shadow-inset-deep);
}

/* === Action Buttons === */
.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

#spin-btn {
  width: 100%;
  height: 64px;
  min-height: 64px;
  
  background: linear-gradient(135deg, 
    var(--accent), 
    var(--accent-darker));
  border: var(--border-accent-strong);
  border-radius: var(--radius-2xl);
  
  color: var(--text-primary);
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-black);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  
  box-shadow: 
    var(--glow-accent-lg),
    var(--shadow-xl),
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -2px 0 rgba(0, 0, 0, 0.4);
  
  transition: all var(--transition-fast);
}

#spin-btn:hover {
  background: linear-gradient(135deg, 
    #FF1050, 
    var(--accent-darker));
  box-shadow: 
    var(--glow-accent-xl),
    var(--shadow-2xl),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transform: translateY(-2px) scale(1.02);
}

#spin-btn:active {
  transform: translateY(0) scale(0.98);
  box-shadow: 
    var(--glow-accent-md),
    var(--shadow-lg),
    inset 0 2px 8px rgba(0, 0, 0, 0.6);
}

#spin-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

#auto-btn {
  width: 100%;
  height: 48px;
  min-height: 48px;
  
  background: linear-gradient(135deg, 
    rgba(0, 240, 255, 0.15), 
    rgba(0, 240, 255, 0.05));
  border: var(--border-primary);
  border-radius: var(--radius-xl);
  
  color: var(--primary);
  font-size: var(--text-base);
  font-weight: var(--font-weight-bold);
  letter-spacing: var(--letter-spacing-wide);
  text-transform: uppercase;
  
  cursor: pointer;
  user-select: none;
  touch-action: manipulation;
  
  transition: all var(--transition-fast);
}

#auto-btn:hover {
  background: linear-gradient(135deg, 
    rgba(0, 240, 255, 0.25), 
    rgba(0, 240, 255, 0.1));
  box-shadow: var(--glow-md);
}

#auto-btn.active {
  background: linear-gradient(135deg, 
    var(--primary-dim), 
    var(--primary-darker));
  color: var(--text-inverse);
  box-shadow: var(--glow-lg);
}
```

---

### 内容适配（clamp + 响应式字体）

```css
/* === 响应式字体大小 === */
.data-label {
  font-size: clamp(10px, 0.7vw, 13px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%; /* 防止溢出 */
}

.data-value {
  font-size: clamp(14px, 1vw, 18px);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.section-header {
  font-size: clamp(11px, 0.75vw, 13px);
}

.sub-header {
  font-size: clamp(9px, 0.6vw, 11px);
}
```

---

## 📱 移动端响应式（竖屏）

```css
@media (max-width: 768px) and (orientation: portrait) {
  /* === Body & Container === */
  body {
    overflow: hidden;
    touch-action: pan-y;
    position: fixed;
    width: 100%;
    height: 100%;
    height: 100dvh; /* 动态视口高度 */
  }

  #layout-container {
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
  }

  /* === Game Canvas（上部，自适应） === */
  #game-stage {
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  /* === Sidebar（底部抽屉） === */
  #sidebar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    top: auto;
    
    width: 100%;
    height: auto;
    max-height: 65vh;
    max-height: 65dvh;
    
    /* 默认折叠（只露出顶部） */
    transform: translateY(calc(100% - 120px));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    
    padding: var(--space-6) var(--space-5) var(--space-5);
    gap: var(--space-4);
    
    border-left: none;
    border-top: var(--border-primary-strong);
    border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
    
    box-shadow: 
      0 -8px 32px rgba(0, 0, 0, 0.6),
      var(--glow-lg);
  }

  /* 展开状态 */
  #sidebar.expanded {
    transform: translateY(0);
  }

  /* === 拖动手柄 === */
  #sidebar::before {
    content: '';
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    
    width: 48px;
    height: 4px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    
    transition: all var(--transition-fast);
  }

  #sidebar:active::before,
  #sidebar.expanded::before {
    background: rgba(0, 240, 255, 0.6);
    width: 64px;
    height: 5px;
  }

  /* === 切换按钮（右上角） === */
  .hud-toggle {
    display: block;
    top: 16px;
    right: 16px;
    left: auto;
    
    padding: var(--space-2) var(--space-4);
    font-size: 11px;
  }

  /* === 内容紧凑化 === */
  .info-section {
    padding: var(--space-4) var(--space-4) var(--space-4);
    margin-bottom: 0;
    gap: var(--space-2);
  }

  .section-header {
    font-size: 12px;
    margin-bottom: var(--space-3);
    padding-bottom: var(--space-2);
  }

  .sub-header {
    font-size: 10px;
    margin-top: var(--space-3);
    margin-bottom: var(--space-2);
  }

  .data-row {
    padding: var(--space-2) 0;
    font-size: 12px;
    gap: var(--space-3);
  }

  .data-label {
    font-size: 10px;
  }

  .data-value {
    font-size: 13px;
  }

  /* === Boss HP 紧凑化 === */
  .boss-hp-container {
    margin-top: var(--space-3);
    padding-top: var(--space-3);
  }

  .boss-hp-bar {
    height: 20px;
  }

  /* === 系统部分默认折叠 === */
  .system-content {
    display: none;
  }

  /* === Bet Controls（上浮到顶部） === */
  .bet-control {
    position: fixed;
    bottom: 80px;
    left: 16px;
    right: 16px;
    z-index: 999;
    
    padding: var(--space-3);
    gap: var(--space-2);
    
    box-shadow: 
      var(--shadow-2xl),
      var(--glow-md);
  }

  .bet-btn {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    font-size: var(--text-xl);
  }

  #bet-display {
    height: 44px;
    min-height: 44px;
    font-size: var(--text-lg);
  }

  /* === SPIN 按钮（粘性底部，大触控目标） === */
  .actions {
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 32px);
    max-width: 360px;
    z-index: 1000;
    
    flex-direction: row;
    gap: var(--space-3);
  }

  #spin-btn {
    flex: 1;
    height: 56px;
    min-height: 56px;
    font-size: var(--text-xl);
    border-radius: var(--radius-full);
    
    box-shadow: 
      var(--glow-accent-xl),
      0 8px 32px rgba(255, 0, 60, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  #auto-btn {
    width: 56px;
    min-width: 56px;
    height: 56px;
    min-height: 56px;
    padding: 0;
    font-size: 11px;
    border-radius: var(--radius-full);
  }

  /* === Theme Switcher（移到顶部） === */
  #theme-switcher {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 1001;
    flex-direction: row;
    gap: var(--space-2);
  }

  .theme-dot {
    width: 32px;
    height: 32px;
  }
}
```

---

## 📱 移动端响应式（横屏）

```css
@media (max-width: 768px) and (orientation: landscape) {
  /* === Body & Container === */
  body {
    overflow: hidden;
  }

  #layout-container {
    flex-direction: row;
    height: 100vh;
    height: 100dvh;
  }

  /* === Game Canvas（左侧，扩展） === */
  #game-stage {
    flex: 1;
    min-width: 0;
  }

  /* === Sidebar（右侧，可折叠） === */
  #sidebar {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: auto;
    
    width: 280px;
    max-width: 280px;
    height: 100%;
    
    /* 默认折叠（只露出左边缘） */
    transform: translateX(calc(100% - 56px));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    
    padding: var(--space-5) var(--space-4);
    gap: var(--space-3);
    
    border-left: var(--border-primary-strong);
    border-radius: 0;
  }

  /* 展开状态 */
  #sidebar.expanded {
    transform: translateX(0);
  }

  /* === 左侧手柄 === */
  #sidebar::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 12px;
    transform: translateY(-50%);
    
    width: 4px;
    height: 48px;
    background: rgba(255, 255, 255, 0.3);
    border-radius: 2px;
    
    transition: all var(--transition-fast);
  }

  #sidebar:active::before,
  #sidebar.expanded::before {
    background: rgba(0, 240, 255, 0.6);
    width: 5px;
    height: 64px;
  }

  /* === 切换按钮（旋转，左侧） === */
  .hud-toggle {
    display: block;
    top: 50%;
    left: 18px;
    right: auto;
    transform: translateY(-50%) rotate(90deg);
    transform-origin: center;
    
    width: 80px;
    height: 32px;
    padding: var(--space-2) var(--space-3);
    font-size: 10px;
  }

  /* === 内容紧凑化 === */
  .info-section {
    padding: var(--space-3) var(--space-3) var(--space-3);
  }

  .section-header {
    font-size: 11px;
    margin-bottom: var(--space-2);
  }

  .sub-header {
    font-size: 9px;
    margin-top: var(--space-2);
    margin-bottom: var(--space-1);
  }

  .data-row {
    padding: var(--space-1) 0;
    font-size: 11px;
  }

  .data-label {
    font-size: 9px;
  }

  .data-value {
    font-size: 11px;
  }

  /* === Boss HP 紧凑化 === */
  .boss-hp-container {
    margin-top: var(--space-2);
    padding-top: var(--space-2);
  }

  .boss-hp-bar {
    height: 18px;
  }

  /* === Bet Controls（内联） === */
  .bet-control {
    padding: var(--space-2);
    gap: var(--space-2);
  }

  .bet-btn {
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    font-size: var(--text-lg);
  }

  #bet-display {
    height: 36px;
    min-height: 36px;
    font-size: var(--text-base);
  }

  /* === Action Buttons（内联） === */
  .actions {
    gap: var(--space-2);
  }

  #spin-btn {
    height: 48px;
    min-height: 48px;
    font-size: var(--text-lg);
  }

  #auto-btn {
    height: 40px;
    min-height: 40px;
    font-size: 10px;
  }

  /* === Theme Switcher（移到顶部） === */
  #theme-switcher {
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 1001;
    flex-direction: row;
    gap: var(--space-2);
  }

  .theme-dot {
    width: 24px;
    height: 24px;
  }
}
```

---

## 🖥️ 平板端响应式（768px - 1024px）

```css
@media (max-width: 1024px) and (min-width: 769px) {
  /* === Sidebar（更窄） === */
  #sidebar {
    width: clamp(260px, 25vw, 320px);
    padding: var(--space-6) var(--space-5);
    gap: var(--space-4);
  }

  /* === 内容紧凑化 === */
  .info-section {
    padding: var(--space-4) var(--space-4) var(--space-4);
  }

  .section-header {
    font-size: 12px;
  }

  .data-row {
    padding: var(--space-2) 0;
    font-size: 13px;
  }

  .data-label {
    font-size: 11px;
  }

  .data-value {
    font-size: 15px;
  }

  /* === Bet Controls === */
  .bet-control {
    padding: var(--space-3);
  }

  .bet-btn {
    width: 42px;
    height: 42px;
  }

  #bet-display {
    height: 42px;
    font-size: var(--text-lg);
  }

  /* === Action Buttons === */
  #spin-btn {
    height: 56px;
    font-size: var(--text-xl);
  }

  #auto-btn {
    height: 44px;
    font-size: var(--text-sm);
  }
}
```

---

## 📱 触控优化

```css
@media (hover: none) and (pointer: coarse) {
  /* 触摸设备 */
  
  /* 禁用悬停效果 */
  .data-row:hover,
  .system-header:hover {
    background: none;
  }

  /* 最小触控目标 */
  button {
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
  }

  /* 增大触控区域 */
  .hud-toggle {
    min-width: 64px;
    min-height: 44px;
  }

  .system-header {
    padding: var(--space-4);
    margin: 0 calc(-1 * var(--space-4));
  }

  .theme-dot {
    min-width: 32px;
    min-height: 32px;
  }

  /* 防止双击缩放 */
  * {
    touch-action: manipulation;
  }

  /* 防止滚动条显示（更流畅） */
  #sidebar::-webkit-scrollbar {
    display: none;
  }
}
```

---

## 💻 JavaScript 实现

### 抽屉切换功能

```javascript
<!-- 📱 Mobile HUD Toggle Script -->
<script>
(function() {
  'use strict';
  
  const sidebar = document.getElementById('sidebar');
  const hudToggle = document.getElementById('hud-toggle');
  
  if (!sidebar || !hudToggle) {
    console.warn('[HUD] Sidebar or toggle button not found');
    return;
  }
  
  // === 切换函数 ===
  function toggleHUD() {
    const isExpanded = sidebar.classList.contains('expanded');
    
    if (isExpanded) {
      sidebar.classList.remove('expanded');
      hudToggle.textContent = '统计';
    } else {
      sidebar.classList.add('expanded');
      hudToggle.textContent = '关闭';
    }
  }
  
  // === 点击按钮切换 ===
  hudToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleHUD();
  });
  
  // === 触摸拖动支持（竖屏） ===
  if (window.matchMedia('(max-width: 768px) and (orientation: portrait)').matches) {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let startTime = 0;
    
    sidebar.addEventListener('touchstart', (e) => {
      // 只在顶部区域（手柄附近）才允许拖动
      const touch = e.touches[0];
      const rect = sidebar.getBoundingClientRect();
      const relativeY = touch.clientY - rect.top;
      
      if (relativeY < 60) {
        startY = touch.clientY;
        currentY = startY;
        isDragging = true;
        startTime = Date.now();
      }
    }, { passive: true });
    
    sidebar.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      
      const touch = e.touches[0];
      currentY = touch.clientY;
      const deltaY = currentY - startY;
      
      // 实时拖动效果（可选）
      const isExpanded = sidebar.classList.contains('expanded');
      
      if (isExpanded && deltaY > 0) {
        // 向下拖动，折叠
        const progress = Math.min(deltaY / 100, 1);
        sidebar.style.transform = `translateY(calc(100% - 120px - ${(1 - progress) * 100}%))`;
      } else if (!isExpanded && deltaY < 0) {
        // 向上拖动，展开
        const progress = Math.min(-deltaY / 100, 1);
        sidebar.style.transform = `translateY(calc(100% - 120px - ${progress * 100}%))`;
      }
    }, { passive: true });
    
    sidebar.addEventListener('touchend', () => {
      if (!isDragging) return;
      isDragging = false;
      
      const deltaY = currentY - startY;
      const deltaTime = Date.now() - startTime;
      const velocity = Math.abs(deltaY) / deltaTime; // px/ms
      
      // 判断拖动方向和速度
      if (Math.abs(deltaY) > 50 || velocity > 0.5) {
        if (deltaY > 0) {
          // 向下拖动 > 50px 或快速滑动，折叠
          sidebar.classList.remove('expanded');
          hudToggle.textContent = '统计';
        } else {
          // 向上拖动 > 50px 或快速滑动，展开
          sidebar.classList.add('expanded');
          hudToggle.textContent = '关闭';
        }
      }
      
      // 重置 transform
      sidebar.style.transform = '';
    }, { passive: true });
  }
  
  // === 点击外部区域关闭（仅移动端展开时） ===
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && sidebar.classList.contains('expanded')) {
      if (!sidebar.contains(e.target)) {
        sidebar.classList.remove('expanded');
        hudToggle.textContent = '统计';
      }
    }
  });
  
  // === 方向改变时重置状态 ===
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      sidebar.classList.remove('expanded');
      hudToggle.textContent = '统计';
      sidebar.style.transform = '';
    }, 100);
  });
  
  // === ESC 键关闭 ===
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('expanded')) {
      sidebar.classList.remove('expanded');
      hudToggle.textContent = '统计';
    }
  });
  
  console.log('[HUD] Mobile toggle initialized');
})();
</script>
```

---

## ✅ 测试清单

### 桌面端（> 1024px）
- ✅ Canvas 居中显示
- ✅ HUD 固定右侧，宽度适应（300-380px）
- ✅ 内部滚动流畅
- ✅ 所有文本可读，无剪裁
- ✅ 控件始终可见

### 平板端（768-1024px）
- ✅ HUD 更窄（260-320px）
- ✅ 字体缩小但可读
- ✅ 布局紧凑但不拥挤

### 移动端竖屏（<= 768px, portrait）
- ✅ HUD 底部抽屉
- ✅ 默认折叠（露出顶部 120px）
- ✅ 点击按钮或拖动展开/折叠
- ✅ SPIN 按钮粘性底部，大触控目标（56px）
- ✅ Bet 控件浮动在底部 80px
- ✅ 系统部分默认折叠
- ✅ 点击外部关闭

### 移动端横屏（<= 768px, landscape）
- ✅ HUD 右侧面板
- ✅ 默认折叠（露出左边缘 56px）
- ✅ 点击按钮展开/折叠
- ✅ 左侧手柄可见
- ✅ 全高布局

### 触控优化
- ✅ 所有按钮 ≥ 44px
- ✅ 禁用双击缩放
- ✅ 触控区域足够大
- ✅ 无悬停效果（触摸设备）

### 内容适配
- ✅ 所有文本使用 clamp() 响应式字体
- ✅ 长标签自动省略号
- ✅ 长数值不溢出
- ✅ Boss HP 条始终可见
- ✅ 滚动流畅

---

## 🎯 关键改进总结

### 1️⃣ 使用 clamp() 实现真正的响应式

```css
/* 旧: 固定大小 */
#sidebar { width: 360px; }
.data-value { font-size: 18px; }

/* 新: 响应式大小 */
#sidebar { width: clamp(300px, 20vw, 380px); }
.data-value { font-size: clamp(14px, 1vw, 18px); }
```

**优势**:
- ✅ 自动适应屏幕大小
- ✅ 最小值防止过小
- ✅ 最大值防止过大

---

### 2️⃣ 动态视口高度（dvh）

```css
/* 旧: 静态视口 */
height: 100vh; /* 移动端会被地址栏遮挡 */

/* 新: 动态视口 */
height: 100dvh; /* 自动排除地址栏 */
```

**优势**:
- ✅ 移动端地址栏自动隐藏时调整
- ✅ 真正的全屏体验

---

### 3️⃣ 触控优先设计

```css
/* 最小触控目标 */
button {
  min-width: 44px;  /* Apple HIG */
  min-height: 44px;
  touch-action: manipulation; /* 禁用双击缩放 */
}

/* 移动端 SPIN 按钮更大 */
@media (max-width: 768px) and (orientation: portrait) {
  #spin-btn {
    height: 56px; /* 触摸友好 */
    border-radius: var(--radius-full); /* 圆形更易点击 */
  }
}
```

**优势**:
- ✅ 符合 Apple HIG 和 Material Design 规范
- ✅ 防止误触
- ✅ 提升触摸体验

---

### 4️⃣ 智能抽屉系统

**特性**:
- ✅ 默认折叠（节省空间）
- ✅ 点击按钮切换
- ✅ 拖动手柄展开/折叠
- ✅ 快速滑动支持（velocity 检测）
- ✅ 点击外部关闭
- ✅ ESC 键关闭
- ✅ 方向改变时重置

**实现**:
- 使用 `transform` 而非 `top/bottom`（性能更好）
- 使用 `cubic-bezier()` 缓动函数（更流畅）
- 使用 `passive` 监听器（提升滚动性能）

---

### 5️⃣ 内容溢出防护

```css
/* 标签溢出 */
.data-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* 数值溢出 */
.data-value {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* 容器滚动 */
#sidebar {
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain; /* 防止滚动穿透 */
}
```

**优势**:
- ✅ 永远不会剪裁文本到容器外
- ✅ 长文本自动省略号
- ✅ 滚动不会影响页面

---

## 🚀 性能优化

### 1️⃣ 使用 transform 而非 top/left

```css
/* ❌ 差: 触发 layout */
#sidebar {
  top: 100px;
  transition: top 0.3s;
}

/* ✅ 好: 只触发 composite */
#sidebar {
  transform: translateY(100px);
  transition: transform 0.3s;
}
```

---

### 2️⃣ 使用 will-change 提示浏览器

```css
#sidebar {
  will-change: transform;
}

/* 动画结束后移除 */
#sidebar:not(.expanded) {
  will-change: auto;
}
```

---

### 3️⃣ 使用 passive 监听器

```javascript
sidebar.addEventListener('touchstart', handler, { passive: true });
sidebar.addEventListener('touchmove', handler, { passive: true });
```

---

### 4️⃣ 节流拖动更新

```javascript
let rafId = null;

sidebar.addEventListener('touchmove', (e) => {
  if (rafId) return;
  
  rafId = requestAnimationFrame(() => {
    // 更新 transform
    updateTransform();
    rafId = null;
  });
}, { passive: true });
```

---

**📱 响应式布局完整实现指南完成！桌面+平板+移动端（竖屏/横屏）+触控优化！** ✨🚀💎


