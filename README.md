Zombie Slot Defense Pro - 产品需求文档 (PRD)
# slotgamerougelike

轻量 HTML5 槽机策略游戏仓库（Slot + Rogue-like / Tower-Defense 元素）。此仓库包含源码、系统设计文档与发布流水线。

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
