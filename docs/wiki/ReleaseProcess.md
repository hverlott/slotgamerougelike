# 发布流程

项目采用 `standard-version` 管理语义化版本与 `CHANGELOG.md`。

本地发布步骤：

```powershell
npm run release
git push --follow-tags
```

自动化：
- 仓库包含 GitHub Actions，用于在 tag 推送时创建 Release 并（可选）在 Release 发布时推送到 npm（需 `NPM_TOKEN`）。

将发行说明（如 `releases/v1.0.2.md`）同步到 GitHub Release：
- 可以使用 `gh` CLI：

```powershell
gh release create v1.0.2 releases/v1.0.2.md --title "v1.0.2" --notes-file releases/v1.0.2.md
```

或在 Actions 中手动触发 `Create Release From File` 工作流。