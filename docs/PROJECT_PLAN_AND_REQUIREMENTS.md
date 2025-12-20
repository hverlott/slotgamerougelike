# Zombie Spin Defense - 项目综合需求文档与开发计划

## 1. 项目概述
本项目是一个融合了**老虎机（spin）**随机性与**塔防（Tower Defense）**策略性的混合休闲游戏（Hybrid Casual）。玩家通过旋转老虎机获取弹药、技能和增益，消灭不断逼近的僵尸大军，保护防线并击败 Boss。

---

## 2. 需求文档 (Requirements)

### 2.1 功能需求 (Functional Requirements)

#### 2.1.1 核心玩法 (Core Loop)
*   **旋转机制**：玩家消耗金币（Bet）进行 3x3 老虎机旋转。
*   **符号系统**：
    *   基础符号：子弹（单体伤害）、手雷（AOE）、导弹（高伤）。
    *   特殊符号：Wild（百搭）、Bonus（进入特殊模式/Boss战）。
*   **战斗转化**：
    *   中奖连线直接转化为攻击指令。
    *   连线越多/符号越高级，发射的子弹越强。
*   **敌人生成**：
    *   僵尸从网格顶部生成，沿直线/路径向下移动。
    *   包含多种类型：Walker（普通）、Runner（快）、Tank（肉盾）、Boss。
*   **资源循环**：
    *   击杀僵尸 -> 获得金币/经验 -> 升级属性 -> 挑战更高难度。

#### 2.1.2 经济与数值 (Economy & Math)
*   **RTP (Return to Player)**：控制长期回报率在 90%-98% 之间。
*   **ResultBank**：使用预计算的结果池来保证 RTP 的稳定性，避免纯随机带来的极端体验。
*   **数值成长**：敌人血量随关卡指数/线性增长；玩家通过升级系统提升攻击力、暴击率。

#### 2.1.3 UI/UX
*   **风格**：现代洁净科幻风（类似原神/崩铁 UI），玻璃拟态，高清晰度。
*   **HUD**：实时显示 FPS、RTP、命中率、连击数、Boss 血量。
*   **交互**：支持自动旋转、倍率调整（Max Bet）、快速停止。
*   **适配**：完全响应式，支持 PC（侧边栏）和 Mobile（底部抽屉）。

### 2.2 性能需求 (Performance Requirements)
*   **帧率**：在主流移动设备上保持稳定 60 FPS。
*   **对象管理**：
    *   子弹、特效、敌人必须使用**对象池 (Object Pooling)**。
    *   同屏渲染对象（Sprite/Graphics）限制在合理范围内（如 < 2000）。
*   **渲染优化**：
    *   减少 Draw Calls。
    *   避免高频创建滤镜（Filter），使用 `blendMode` 或 Tint 代替。
*   **加载**：首屏加载时间 < 3秒。

### 2.3 安全需求 (Security Requirements)
*   **防篡改**：虽然目前是纯前端项目，但需预留服务端验证接口。
*   **数值验证**：关键计算（RTP、伤害）逻辑需封装，避免被轻易修改 Console 变量。

---

## 3. 详细开发计划 (Development Plan)

### 3.1 功能开发清单与技术方案

| 模块 | 功能点 | 技术实现方案 | 接口规范/数据交互 | 优先级 |
| :--- | :--- | :--- | :--- | :--- |
| **Core** | **游戏主循环与状态机** | 使用 `GameLoop` 类驱动，结合 `Pixi.Ticker`。状态机管理 `IDLE`, `SPINNING`, `COMBAT`, `WIN`, `GAMEOVER` 状态。 | `GameContext` 对象在各系统间传递状态。 | P0 |
| **spin** | **转轮系统 (SlotSystem)** | 基于 `Container` 和 `Mask` 实现滚动。使用 `GSAP` 处理回弹动画。支持 `ResultBank` 注入结果。 | `playSpin(bet): Promise<SpinResult>` | P0 |
| **Combat** | **敌人系统 (EnemySystem)** | 网格化管理 (`GridSystem`)。基于时间轴的移动逻辑。支持击退、冻结效果。 | `spawnZombie(col, type)`, `takeDamage(id, amount)` | P0 |
| **Combat** | **子弹与打击 (BulletSystem)** | 对象池管理子弹。简单的 AABB 或距离碰撞检测。命中后触发 `FXSystem`。 | `fire(type, origin, target)` | P0 |
| **Math** | **RTP 控制 (RTPManager)** | `ResultBank` 预生成 10000+ 次结果。实时统计 `TotalBet` vs `TotalWin`，动态调整命中率。 | `getResult(level): SpinResult`, `recordHit(dmg)` | P1 |
| **UI** | **数据看板 (StatsPanel)** | 纯 HTML/CSS 覆盖层，通过 DOM 操作更新。解耦渲染与逻辑。 | `updateStats(data: Object)` | P1 |
| **Meta** | **关卡与升级 (Level/Upgrade)** | `LevelManager` 控制波次节奏。`UpgradeSystem` 管理属性修饰符（Modifier）。 | `levelUp()`, `applyUpgrade(type)` | P2 |
| **Visual** | **特效系统 (FXSystem)** | 粒子系统（ParticleContainer）。屏幕震动（GSAP）。光晕使用 `blendMode: ADD`。 | `playHit(x, y)`, `playWin(lines)` | P2 |
| **Audio** | **音频管理 (AudioSystem)** | `WebAudioAPI` 或 `Howler.js` (当前使用简单封装)。支持音量控制、并发限制。 | `play(key, options)`, `setVolume(v)` | P2 |

### 3.2 模块间交互图 (简述)
```mermaid
[Input] -> [GameLoop] -> [SlotSystem] -> (Spin Animation)
                            |
                            v
                       [ResultBank] -> (Data)
                            |
                            v
                       [TurnPlanner] -> (Combat Events)
                            |
                            v
[EnemySystem] <---- [BulletSystem] <---- (Fire)
      |
      v
(Damage/Kill) -> [RTPManager] -> [StatsPanel]
      |
      v
 [FXSystem]
```

---

## 4. 开发实施要求 (Implementation Requirements)

### 4.1 编码规范
*   **风格**：ES6+ Modules，使用 `async/await` 处理异步。
*   **命名**：类名 `PascalCase`，变量/方法 `camelCase`，常量 `UPPER_SNAKE_CASE`。
*   **注释**：关键逻辑必须包含 JSDoc 注释。
*   **架构**：ECS (Entity-Component-System) 的简化变体，逻辑与渲染分离。

### 4.2 错误处理与日志
*   **全局捕获**：`window.onerror` 和 `Promise.catch` 兜底。
*   **看门狗**：在 `GameLoop` 中实现 Watchdog，检测状态机死锁（如 Spin 超过 10秒未结束）。
*   **日志分级**：`console.debug` (开发), `console.info` (流程), `console.warn` (非致命), `console.error` (致命)。

### 4.3 测试策略
*   **单元测试**：针对 `ResultBank` (RTP计算) 和 `SlotSystem` (连线判定) 编写 Jest 测试。
*   **自动化测试**：Headless 模式下运行 1000 次 Spin，验证稳定性。
*   **性能测试**：使用 Chrome Performance 面板，确保 Scripting 时间 < 10ms/frame。

---

## 5. 交付物 (Deliverables)

1.  **源代码**：`src/` 目录下完整代码，无编译错误。
2.  **构建产物**：`dist/` 目录下经过 Minify/Tree-shaking 的生产环境代码。
3.  **API 文档**：主要 System 类的接口说明 (Markdown)。
4.  **测试报告**：RTP 模拟运行报告（胜率、回报率分布）。
5.  **部署说明**：简单的 `README.md`，包含 `npm install`, `npm run dev`, `npm run build`。

---

## 6. 质量保证与验收 (QA & Acceptance)

### 6.1 验收标准
1.  **功能完备**：
    *   [ ] 点击旋转能正常扣费、转动、停轮。
    *   [ ] 中奖连线能正确识别并高亮。
    *   [ ] 战斗逻辑闭环（子弹发射 -> 命中 -> 僵尸扣血 -> 死亡 -> 掉落）。
    *   [ ] 自动旋转功能稳定，可随时取消。
2.  **数值准确**：
    *   [ ] 1000 次模拟测试的 RTP 偏差不超过 ±5%。
    *   [ ] Boss 血量条与实际数值完全同步。
3.  **性能达标**：
    *   [ ] 满屏（50+ 僵尸）情况下 FPS >= 55。
    *   [ ] 无内存泄漏（堆快照对比）。
4.  **UI/UX**：
    *   [ ] 移动端布局无错位。
    *   [ ] 字体清晰，无模糊。

### 6.2 已知待修复问题 (Current Backlog)
*   *已修复*: RTP 0% 问题。
*   *已修复*: 严重卡顿 (FPS 3)。
*   *已修复*: UI 风格过时。
*   *待验证*: 长期运行下的内存稳定性。
*   *待开发*: 更多种类的技能/Bonus Game。

---
**版本**: 1.0.0
**日期**: 2025-12-20
**状态**: Draft

