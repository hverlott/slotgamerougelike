# Contributing

欢迎贡献！为了使版本与变更日志自动化，请遵循下列约定：

- 使用 Conventional Commits（例如 `feat:`, `fix:`, `chore:`, `docs:`）。
- 在准备发布时运行 `npm run release` —— 这将使用 `standard-version` 更新 `package.json` 的 `version`，并把变更写入 `CHANGELOG.md`。
- 版本发布流程：
  1. 使用约定提交（例如 `feat: add new enemy type`）。
  2. 合并到 `main` 后，本地或 CI 可以执行 `npm run release` 生成版本提交和 changelog。
  3. 使用 `git tag vX.Y.Z` 并 push tag；仓库工作流会基于 tag 创建 GitHub Release。

保持提交信息简明、有意义，便于自动化工具生成清晰的变更记录。
