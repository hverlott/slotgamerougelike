# 开发者指南

项目结构概览：

- `src/`：核心源码
  - `core/`：引擎初始化、主循环（`GameLoop.js`）、应用入口（`App.js`）
  - `systems/`：各系统实现（见上文）
  - `ui/`：界面组件
  - `utils/`：工具函数（RNG、Math、theme 等）

编码规范：
- 使用 Conventional Commits（`feat:`、`fix:`、`chore:`）以便 `standard-version` 正确生成变更日志。
- 提交前运行 `npm run lint`（如已配置）并确保构建通过。

本地调试：
- 使用 `npm run dev` 启动 Vite 开发服务器并在浏览器查看。

贡献流程：
- 提交 PR → CI 通过 → 使用约定提交信息合并到 `main`。