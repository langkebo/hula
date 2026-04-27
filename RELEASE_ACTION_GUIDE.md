# 🚀 发布行动指南 - v2.0.0-sdk

> 创建日期：2026-04-25
> 当前状态：准备创建 Pull Request
> 预计完成时间：1-2 周

---

## 📋 当前状态

### ✅ 已完成工作

**优化工作**：
- ✅ 移除 7 个未使用依赖
- ✅ 添加 2 个 CI 工作流
- ✅ 修复 2 个 worker 路径 bug
- ✅ 创建 17 份完整文档
- ✅ 提交 7 个高质量 commits

**分支状态**：
- 分支：`feature/message-performance`
- Commits：7 个
- 文档：17 份
- 状态：✅ 准备就绪

### ⚠️ 待处理工作

**未提交的更改**：
- 113 个文件有修改（包括其他功能开发）
- 需要决定哪些更改包含在此次发布中

---

## 🎯 推荐方案

### 方案 A：仅发布优化工作（推荐）

**优点**：
- 范围清晰，风险可控
- 审查简单，快速合并
- 符合单一职责原则

**步骤**：
1. 确保当前 7 个 commits 已提交
2. 创建 Pull Request（仅包含这 7 个 commits）
3. 代码审查
4. 合并到 main
5. 创建 Tag 和 Release

**命令**：
```bash
# 1. 确认当前提交
git log --oneline -7

# 2. 推送分支
git push origin feature/message-performance

# 3. 在 GitHub 上创建 PR
# 使用 PR_TEMPLATE_v2.0.0-sdk.md 内容
```

### 方案 B：包含所有更改

**优点**：
- 一次性发布所有功能

**缺点**：
- 审查复杂，风险较高
- 可能包含未完成的功能

**不推荐**：建议将其他更改放在后续 PR 中

---

## 📝 详细步骤指南

### 步骤 1：确认提交状态 ✅

```bash
# 查看已提交的 commits
git log --oneline -7

# 应该看到：
# c30d16e6 - docs: add PR template and project status report
# 061edb40 - docs: add complete execution summary
# 3e91862b - docs: add release notes and checklist
# 36c71743 - docs: add comprehensive optimization reports
# e6adb660 - docs: enhance CONTRIBUTING.md
# cf20f89a - ci: add SDK compatibility check
# b3c4a9da - chore: remove unused dependencies
```

**状态**：✅ 已完成

### 步骤 2：推送分支到远程 ⏳

```bash
# 推送分支
git push origin feature/message-performance

# 如果分支已存在，使用 force push（谨慎）
# git push origin feature/message-performance --force
```

**预期结果**：
- 分支推送成功
- 7 个 commits 在远程可见

### 步骤 3：创建 Pull Request ⏳

**在 GitHub 上操作**：

1. 访问仓库页面
2. 点击 "Pull requests" → "New pull request"
3. 选择分支：
   - Base: `main` (或 `master`)
   - Compare: `feature/message-performance`
4. 填写 PR 信息：
   - **标题**：`Release v2.0.0-sdk: SDK Integration & Optimization`
   - **描述**：复制 `PR_TEMPLATE_v2.0.0-sdk.md` 的内容
5. 添加标签：
   - `enhancement`
   - `documentation`
   - `ci/cd`
6. 请求审查者
7. 创建 PR

**PR 描述要点**：
- 移除 7 个未使用依赖
- 添加 SDK 兼容性检查
- 添加性能测试
- 增强开发文档
- 修复 worker 路径

### 步骤 4：代码审查 ⏳

**审查重点**：

1. **依赖变更**
   - 确认移除的依赖确实未使用
   - 验证构建和测试通过

2. **CI 配置**
   - 审查 `sdk-check.yml` 配置
   - 审查 `performance.yml` 配置
   - 验证性能预算合理

3. **文档完整性**
   - 审查所有新增文档
   - 确认文档准确性

4. **Bug 修复**
   - 验证 worker 路径修复正确

**审查清单**：
- [ ] 代码变更合理
- [ ] 测试全部通过
- [ ] 文档完整准确
- [ ] CI 配置正确
- [ ] 无破坏性变更

### 步骤 5：合并 PR ⏳

**合并前检查**：
```bash
# 确保 CI 全部通过
# 确保至少 1 个 approver

# 合并方式（团队决定）：
# - Squash and merge（推荐，保持历史清晰）
# - Merge commit（保留所有 commits）
# - Rebase and merge（线性历史）
```

**合并后**：
- 分支自动删除（可选）
- main 分支更新

### 步骤 6：创建 Git Tag ⏳

```bash
# 切换到 main 分支
git checkout main
git pull origin main

# 创建 annotated tag
git tag -a v2.0.0-sdk -m "Release v2.0.0-sdk: SDK Integration & Optimization

Major release focusing on:
- Dependency cleanup (removed 7 unused packages)
- CI/CD enhancements (SDK checks + performance testing)
- Documentation improvements
- Bug fixes (worker paths)

See RELEASE_NOTES_v2.0.0-sdk.md for full details."

# 推送 tag
git push origin v2.0.0-sdk
```

**验证**：
```bash
# 查看 tag
git tag -l "v2.0.0-sdk"

# 查看 tag 详情
git show v2.0.0-sdk
```

### 步骤 7：创建 GitHub Release ⏳

**在 GitHub 上操作**：

1. 访问 Releases 页面
2. 点击 "Draft a new release"
3. 填写信息：
   - **Tag**: `v2.0.0-sdk`
   - **Release title**: `v2.0.0-sdk - SDK Integration & Optimization`
   - **Description**: 复制 `RELEASE_NOTES_v2.0.0-sdk.md` 的内容
4. 选项：
   - ✅ **This is a pre-release**（用于灰度发布）
   - [ ] Set as the latest release（暂不勾选）
5. 点击 "Publish release"

**Release 内容要点**：
- 新功能列表
- 依赖变更
- CI/CD 增强
- 文档改进
- 迁移指南
- 已知问题

### 步骤 8：部署到 Staging ⏳

```bash
# 部署命令（根据实际基础设施调整）
# 示例：
# npm run deploy:staging
# 或使用 CI/CD 自动部署
```

**验证**：
- [ ] Staging 环境部署成功
- [ ] 冒烟测试通过
- [ ] 手动测试核心功能

### 步骤 9：灰度发布 - 10% ⏳

**部署**：
```bash
# 启用 10% 流量
# 具体命令取决于部署平台
```

**监控（48 小时）**：
- [ ] 错误率 < 0.1%
- [ ] 性能指标稳定
- [ ] 无严重 bug
- [ ] 用户反馈正面

**监控指标**：
- 错误率
- 响应时间
- 首屏加载时间
- 用户投诉数

### 步骤 10：灰度发布 - 50% ⏳

**部署**：
```bash
# 扩大到 50% 流量
```

**监控（48 小时）**：
- [ ] 错误率 < 0.1%
- [ ] 性能指标稳定
- [ ] 无严重 bug
- [ ] 用户反馈正面

### 步骤 11：全量发布 - 100% ⏳

**部署**：
```bash
# 部署到 100% 用户
```

**监控（48 小时）**：
- [ ] 错误率 < 0.1%
- [ ] 性能指标稳定
- [ ] 无严重 bug
- [ ] 用户反馈正面

**最终步骤**：
- [ ] 更新 GitHub Release（移除 pre-release 标记）
- [ ] 发布公告（Discord, 社交媒体）
- [ ] 更新文档网站（如有）
- [ ] 通知社区

---

## 🔄 回滚方案

### 立即回滚（< 1 小时）

**触发条件**：
- 错误率 > 1%
- 严重安全漏洞
- 数据丢失或损坏
- 完全服务中断

**回滚步骤**：
```bash
# 方案 1：回滚到上一个 tag
git checkout v1.x.x
# 重新部署

# 方案 2：Revert commits
git revert <commit-hash>
git push origin main
# 重新部署
```

### 渐进回滚（< 24 小时）

**触发条件**：
- 错误率 0.5% - 1%
- 性能降低 > 20%
- 多个非严重 bug

**回滚步骤**：
1. 减少流量：100% → 50% → 10% → 0%
2. 调查问题
3. 准备 hotfix
4. 重新部署

---

## 📊 成功标准

### 必须达成
- [ ] PR 合并成功
- [ ] Tag 创建成功
- [ ] Release 发布成功
- [ ] Staging 测试通过
- [ ] 每个灰度阶段错误率 < 0.1%
- [ ] 无严重 bug

### 应该达成
- [ ] 性能指标稳定
- [ ] 用户反馈正面
- [ ] 文档访问量增加
- [ ] 社区反响良好

---

## 📞 联系方式

**紧急联系**：
- Discord: https://discord.gg/WhSkvhNEeE
- WeChat: cy2439646234

**文档支持**：
- 完整审查报告：`docs/optimization-plan.md`
- 发布说明：`RELEASE_NOTES_v2.0.0-sdk.md`
- 发布清单：`RELEASE_CHECKLIST_v2.0.0-sdk.md`
- 项目状态：`PROJECT_STATUS_REPORT.md`

---

## ✅ 快速检查清单

### 发布前
- [x] 代码已提交（7 commits）
- [x] 文档已完成（17 份）
- [x] 测试已通过（2334/2334）
- [ ] 分支已推送
- [ ] PR 已创建
- [ ] 代码已审查

### 发布中
- [ ] PR 已合并
- [ ] Tag 已创建
- [ ] Release 已发布
- [ ] Staging 已部署
- [ ] 灰度 10% 完成
- [ ] 灰度 50% 完成
- [ ] 全量发布完成

### 发布后
- [ ] 监控正常
- [ ] 用户反馈收集
- [ ] 文档已归档
- [ ] 下一版本规划

---

## 🎯 下一步行动

### 立即执行（今天）

1. **推送分支**
   ```bash
   git push origin feature/message-performance
   ```

2. **创建 Pull Request**
   - 使用 `PR_TEMPLATE_v2.0.0-sdk.md`
   - 请求代码审查

### 本周内

3. **完成代码审查**
4. **合并 PR**
5. **创建 Tag 和 Release**

### 下周

6. **部署到 Staging**
7. **开始灰度发布**

---

*指南创建时间：2026-04-25*
*当前状态：准备推送分支*
*下一步：git push origin feature/message-performance*
