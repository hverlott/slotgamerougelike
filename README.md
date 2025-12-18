Zombie Slot Defense Pro - 产品需求文档 (PRD)
项目
内容
项目名称
Zombie Slot Defense Pro (僵尸防线：幸运一击)
版本号
v2.0.0 (Release Candidate)
文档状态
已冻结 (Final)
更新日期
2025-12-16
核心技术
Pixi.js v8, Vite, GSAP, Pixi-Filters

1. 产品概述 (Overview)
1.1 产品定位
一款融合了 老虎机 (Slot) 随机性与 塔防 (Tower Defense) 策略性的休闲网页游戏。
核心体验：通过 Slot 转出武器组合，消灭不断逼近的赛博僵尸。
美术风格：Cyberpunk Neon Noir（赛博朋克/霓虹暗黑），采用 Q 版怪物与扁平化武器 UI，配合玻璃拟态（Glassmorphism）操作界面。
1.2 核心玩法循环
下注 (Bet)：玩家设置单局消耗的金币。
旋转 (Spin)：转动 3x3 武器轮盘。
攻击 (Combat)：根据中奖线触发不同类型的武器攻击（单体/AOE/全屏）。
充能 (Jackpot)：Spin 和中奖会为右侧“能量核心”充能，满额触发全屏爆奖。
推进 (Progress)：消灭僵尸积累进度，每 2 次 Spin 僵尸前进一步（回合制）。
2. 界面与交互 (UI/UX)
布局架构：PC/宽屏适配（左右分栏设计）
2.1 左侧：沉浸式战场 (Game Stage - 70%)
背景：动态赛博城市夜景（暗色调，具备视差或静态图压暗处理）。
战斗网格 (Grid)：10x6 隐形网格。
上方：僵尸生成与移动区域。
中间：子弹飞行轨迹。
下方：3x3 Slot 滚轮区域（无缝嵌入场景）。
视觉表现：
Slot 滚轮：带有动态模糊 (BlurFilter) 的极速转动效果，停止时具备机械回弹 (Back.out) 质感。
伤害数字：手游风格的“飘字”系统（暴击放大、弹跳）。
2.2 右侧：战术指挥塔 (Control Dashboard - 30%)
风格：深色磨砂玻璃面板 (Backdrop-filter: blur)，左侧亮蓝边框。
模块分布（从上至下）：
数据监控 (Stats)：
实时显示 RTP (玩家回报率)、净收益 (Net)、当前关卡进度。
字体：绿色/青色 Monospace 等宽字体。
能量核心 (Jackpot Core)：
视觉：悬浮的六边形/圆形反应堆，持续呼吸旋转。
交互：每次 Spin 吸入光点；过载时剧烈震动并喷射金币粒子。
皮肤切换 (Theme Switcher)：
5 个圆形色点，点击切换全局配色（青/紫/粉/绿/金）。
注额控制 (Bet Control)：
[-] [数值] [+] 按钮组，支持长按或快速点击。
范围：1 - 500。
核心操作区：
SPIN 按钮：巨大异形按钮（切角设计），警示黄渐变，极具点击欲望。
AUTO 按钮：切换开关，激活时红灯闪烁。
3. 游戏系统详解
3.1 老虎机系统 (Slot System)
规格：3 列 x 3 行。
图标 (Symbols) - 武器化 UI：
Low (Value 1): 9mm 子弹 (铜色) —— 对应轻型攻击。
Mid (Value 2): 手雷 (绿色) —— 对应爆炸攻击。
High (Value 3): 导弹/核弹 (红色) —— 对应重型攻击。
Wild (Value 4): 战术雷达 (全息蓝) —— 替代任意符号。
中奖逻辑：9 条中奖线判定。
结果库 (Result Bank)：预生成 20,000 局结果，RTP 控制在 99% - 180%，消除计算延迟，实现“秒开”。
3.2 战斗系统 (Bullet System)
根据中奖图标类型触发不同弹道：
Type 1 (子弹)：极速直线光束，单体伤害。
Type 2 (手雷)：抛物线或慢速光球，命中后产生小范围 AOE (Glow 扩散)。
Type 3 (导弹)：粗激光或穿透弹，对整列/全屏敌人造成高额伤害。
打击感：命中时产生粒子爆裂、屏幕轻微震动。
3.3 敌人系统 (Enemy System)
回合制移动：
摒弃时间驱动，改为 Spin 驱动。
规则：玩家每点击 2 次 Spin，所有僵尸向下移动一格。
单位类型 (Q版风格)：
Walker (杂兵)：绿色，Q版大眼怪，数量多。
Runner (突击)：红色，体型小，移动逻辑判定可能更快（或闪避率高）。
Tank (肉盾)：紫色/巨大，血量极厚，带有护盾光效。
Boss (首领)：金色，占据 2x2 或更大空间，血条独立显示，死亡掉落巨额 Bonus。
3.4 关卡系统 (Level Manager)
晋级条件：击杀指定数量的僵尸 (Kill Count)。
波次刷新：每 4 次 Spin 刷新一波新怪。
难度曲线：
Level 1: 仅 Walker。
Level 2: 加入 Runner。
Level 3: 加入 Tank + 刷新频率加快。
失败判定：僵尸触达底线（Slot 区域上方），触发 Mission Failed。
3.5 经济与奖池 (Economy & Jackpot)
基础收益：中奖线金额直接加到余额。
Jackpot 机制：
积累：每次下注的 5% + 中奖金额的 1% 充入能量核心。
爆发 (Burst)：当积攒值每满 10.0 单位，触发“过载”。
奖励：全屏震动 + 金币喷泉 + 额外固定奖金 (Bonus)。
4. 技术规格 (Technical Specs)
4.1 核心栈
框架：Vite (构建工具) + Pixi.js v8 (渲染引擎)。
动画：GSAP (GreenSock) 用于所有缓动动画（UI 弹跳、数字滚动、粒子运动）。
滤镜：Pixi-Filters (GlowFilter, BlurFilter, AdjustmentFilter)。
4.2 性能优化
资源管理：使用 Assets.load 预加载所有 Sprite。
渲染模式：
对于像素素材：TextureStyle.defaultOptions.scaleMode = 'nearest'。
对于高清素材：使用 Linear 采样。
对象池 (Object Pooling)：
子弹、粒子特效、伤害飘字均采用对象池复用，避免 GC 卡顿。
防死锁机制：
Spin 按钮增加 try...finally 块。
waitForBullets 增加 2000ms 强制超时兜底，防止动画丢失导致游戏卡死。
5. 待办与未来规划 (Roadmap)
[ ] 音效实装：添加 BGM（赛博合成波）和 SFX（开枪、转动、金币声）。
[ ] 移动端适配：目前为宽屏布局，移动端需开发竖屏响应式布局（Grid 在上，Controls 在下）。
[ ] 技能系统：在侧边栏增加主动技能（如：全屏清屏核弹），消耗 Jackpot 能量释放。
6. 变更日志 (Change Log)
v2.0 Pro (当前)
[重构] 彻底重写 HTML 结构，实施“左游右控”分栏布局。
[新增] 引入 Sprite 渲染系统，废弃 Emoji。
[新增] 引入 Jackpot 能量核心可视化系统。
[优化] Slot 转动逻辑重写，使用 BlurFilter + 变速运动。
[修复] 修复 Spin 按钮死锁 Bug (超时机制)。
[调整] 游戏节奏改为 Spin 回合制。
v1.2
引入 PRD 文档。
增加 ResultBank 预计算结果。
增加 ThemeManager 换肤功能。
v1.0 (Demo)
基础原型，单 HTML 文件，Emoji 画面。
验收标准 (Acceptance Criteria):
点击 Spin 后，滚轮丝滑转动无卡顿，结果秒出。
右侧面板 UI 在不同分辨率下不遮挡左侧游戏画面。
自动旋转 (Auto) 可随时点击停止，且能正确完成当前局。
画面中无任何 Emoji，全部为图形/图片资源。
长时间挂机 (Auto 模式) 100 局以上不崩溃、不卡死。

## Documentation

项目文档已收集在 `docs/` 目录。为便于浏览，已生成文档目录 `docs/TOC.md`，包含以下主题摘要：

- Guides: 构建、音频、组合系统、升级集成、场景构成、状态机架构等。
- HUD / UI: HUD 集成、重构与修复说明。
- Systems & Performance: 子弹系统、FX 重构、性能优化说明。
- Audio: 音频系统修复与加固指南。
- Premium / UI Upgrades: 高级 UI/皮肤与 VFX 改进说明。
- Dashboards & KPIs: KPI 仪表盘设计与实现。
- Responsive & Mobile: 响应式与移动端 UX 指南。

请阅读 `docs/TOC.md` 以获得完整目录并跳转到具体文档。

例如： [docs/TOC.md](docs/TOC.md)
