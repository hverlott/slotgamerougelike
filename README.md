Zombie Slot Defense Pro - 产品需求文档 (PRD)
# slotgamerougelike

轻量 HTML5 槽机策略游戏仓库（Slot + Rogue-like / Tower-Defense 元素）。此仓库包含源码、系统设计文档与发布流水线。

## 项目简介
slotgamerougelike 是一个前端游戏原型工程，目标是提供：
- 一个基于 `pixi.js` 的渲染与游玩框架，便于快速迭代游戏机制；
- 一套模块化的游戏系统（SlotSystem、BulletSystem、EnemySystem、HUD 等），便于复用与教学；
- 完整的文档集（`docs/`）与发布流程（`standard-version` + GitHub Actions），方便团队协作与持续发布；

该项目适合用于原型开发、课堂示例或作为入门级的 HTML5 游戏模板。

**主要内容**
- 源码：`src/`
- 文档：`docs/`（已生成 `docs/TOC.md` 作为目录）
- 发布说明：`releases/`（包含 `releases/v1.0.2.md`）
- 版本管理：使用 `standard-version` 自动维护 `CHANGELOG.md` 与 `package.json` 版本

## 快速开始

先决条件：Node.js 18+, npm

```powershell
cd (your-repo)
npm install
npm run dev      # 开发模式 (Vite)
npm run build    # 生产构建
```

## 文档与索引
- 文档目录：`docs/TOC.md`（项目文档目录与链接）
- 设计/实现文档位于 `docs/`，如 HUD、Audio、BulletSystem 等。

## 发布与发行
- Changelog：`CHANGELOG.md`
- Release notes：`releases/v1.0.2.md`
- 本地生成 release：`npm run release`（使用 `standard-version`，会更新 `CHANGELOG.md`、`package.json` 并打 tag）
- 自动发布：仓库包含 GitHub Actions（在 `.github/workflows/`），可在 Release 发布时将包推到 npm（需在仓库 Secrets 中配置 `NPM_TOKEN`）。

## 贡献
请阅读 `CONTRIBUTING.md`，使用 Conventional Commits（`feat:`, `fix:` 等）以便 `standard-version` 正确生成变更日志。

## 许可证
本项目使用 ISC 许可证。


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

## 版本迭代（详细）

以下为每个已发布版本的迭代详情（按时间倒序）：

### v1.0.2 — 2025-12-18

This is a detailed release note for `v1.0.2` generated from the project's changelog and recent changes.

Highlights
- Docs: Large set of design, implementation and fix documents added under `docs/` to explain systems and fixes.
- Systems: Multiple game system updates and refactors (Audio, HUD, FX, Bullet, Combo, Build, Upgrade systems).
- Version bump: package version updated to `1.0.2`.

Notable Changes (from CHANGELOG)

See `CHANGELOG.md` for the full generated entries. Key items:

- Bumped version to `1.0.2` and updated `CHANGELOG.md`.
- Numerous docs added to `docs/` covering architecture, performance, HUD fixes, audio hardening and more.
- Multiple source files updated across `src/` to improve state machine, turn planning and UI components.

Upgrade notes

- No breaking API changes expected for consumers — this is primarily documentation and internal improvements.
- If you build locally, run:

```powershell
npm ci
npm run build
```

How this release was made

- Versioning: `standard-version` was used to bump `package.json` and update `CHANGELOG.md`.
- Tag: `v1.0.2` created and pushed to remote.

Contributors

Thanks to everyone who contributed changes and documentation.

---

### v1.0.1 — 2025-12-17

（变更条目见 `CHANGELOG.md`）

- 该版本包含一系列小的修复与初始发布步骤，详细条目已记录在 `CHANGELOG.md`，并通过 `standard-version` 维护。

如果需要，我可以把 `CHANGELOG.md` 中的每个条目也逐条展开并放入此处，或者为更早的 tag（如 `v1.0.0`）生成相同形式的详细说明。
