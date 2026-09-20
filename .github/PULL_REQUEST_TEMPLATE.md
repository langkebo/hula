#### 💻 变更类型 | Change Type

<!-- For change type, change [ ] to [x]. -->

- [ ] ✨ feat | 新增功能
- [ ] 🐛 fix | 修复缺陷
- [ ] ♻️ refactor | 代码重构（不包括 bug 修复、功能新增）
- [ ] 💄 style | 代码格式（不影响功能，例如空格、分号等格式修正）
- [ ] 📦️ build | 构建流程、外部依赖变更（如升级 npm 包、修改 vite 配置等）
- [ ] 🚀 perf | 性能优化
- [ ] 📝 docs | 文档变更
- [ ] 🧪 test | 添加疏漏测试或已有测试改动
- [ ] ⚙️ ci | 修改 CI 配置、脚本
- [ ] ↩️ revert | 回滚 commit
- [ ] 🛠️ chore | 对构建过程或辅助工具和库的更改（不影响源文件、测试用例）

#### 🎨 UI 约束自检 | UI Constraints

<!-- 涉及 .vue / .scss / .css 时勾选；口径与 UI-OPTIMIZATION-PLAN 阶段 1 一致，由 pnpm check:ratchet 与 src/styles/__tests__/design-baseline.test.ts 双重守护。 -->

- [ ] 未新增静态内联 `style="..."`（核心视图要求为 0；布局/间距请走 UnoCSS 工具类或 scoped 样式）
- [ ] 未新增 `!important`；若必须保留，已在同一规则块上方写明理由（reduced-motion 区块除外）
- [ ] 16px 及以上的圆角使用 `--tjg-radius-*` token（不用 `border-radius: 20px` 这类字面量）
- [ ] 颜色使用 `--tjg-*` token，未引入新的硬编码色值

#### 🔀 变更说明 | Description of Change

<!-- Thank you for your Pull Request. Please provide a description above. -->

#### 📝 补充信息 | Additional Information

<!-- Add any other context about the Pull Request here. -->
