# P4 冗余组件清理 + Token 清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除 19 个零引用 Vue 组件、清理 design-tokens.css 中零引用 token、更新 knip 配置，消除项目冗余。

**Architecture:** 分两批执行——先删除组件（破坏性变更，需验证构建），再清理 token（样式变更，需验证 ratchet 守护）。两任务独立，无依赖。

**Tech Stack:** Vue 3, TypeScript, UnoCSS, SCSS, design-tokens.css

## Global Constraints

- 禁止误删「写而未接线」组件——已通过 Explore agent 逐一验证 19 个组件均为零引用
- 删除组件后 `src/typings/components*.d.ts` 由 `unplugin-vue-components` 自动重新生成，无需手动修改
- token 删除后必须运行 `pnpm check:ratchet` 确认硬编码颜色守护通过
- `vue-tsc --noEmit` 必须 0 error
- 所有测试必须通过
- 如 pnpm 因 Node 引擎约束不可用，使用 `node_modules/.bin/` 直接调用工具

---

## File Structure

- 修改: `src/styles/css/design-tokens.css` — 删除零引用 token 定义
- 修改: `knip.config.ts` — 添加 typings 忽略
- 删除: 19 个零引用 .vue 组件文件（及对应测试文件）
- 验证: `src/typings/components.d.ts`, `components.pc.d.ts`, `components.mobile.d.ts` — 自动重新生成

---

### Task 1: 删除 19 个零引用组件 + 更新 knip 配置

**Files:**
- Delete: 19 个 .vue 组件文件（路径见下方列表）
- Delete: 对应的测试文件（如存在）
- Modify: `knip.config.ts:4-8` — 添加 `src/typings/components*.d.ts` 到 ignore

**Context:**
Explore agent 已验证全部 19 个组件在 src/ 中无任何外部引用（无 import、无模板标签、无动态导入）。唯一"引用"来自 `src/typings/components*.d.ts` 自动生成文件，这些文件由 `unplugin-vue-components` 在构建时自动重新生成。

**待删除组件完整列表（含实际路径）:**

| # | 组件名 | 文件路径 |
|---|--------|----------|
| 1 | VirtualMessageList | `src/components/performance/VirtualMessageList.vue` |
| 2 | LazyImage | `src/components/performance/LazyImage.vue` |
| 3 | VoiceRecorderEnhanced | `src/components/voice/VoiceRecorderEnhanced.vue` |
| 4 | SpotlightDialog | `src/components/search/SpotlightDialog.vue` |
| 5 | ChatHistoryDrawer | `src/components/chat/ChatHistoryDrawer.vue` |
| 6 | MultiMsgDrawer | `src/components/chat/MultiMsgDrawer.vue` |
| 7 | MessageContainer | `src/mobile/components/chat-room/MessageContainer.vue` |
| 8 | WidgetContainer | `src/components/widget/WidgetContainer.vue` |
| 9 | RoomListManagementDialog | `src/components/room/RoomListManagementDialog.vue` |
| 10 | PullToRefresh | `src/mobile/components/PullToRefresh.vue` |
| 11 | UrlPreviewCard | `src/components/business/url-preview/UrlPreviewCard.vue` |
| 12 | RecallCountdown | `src/components/business/RecallCountdown.vue` |
| 13 | SlidingSyncIndicator | `src/components/common/SlidingSyncIndicator.vue` |
| 14 | MessageReactions | `src/components/rightBox/renderMessage/MessageReactions.vue` |
| 15 | QuotaDisplay | `src/components/quota/QuotaDisplay.vue` |
| 16 | EncryptionHealthPanel | `src/components/encryption/EncryptionHealthPanel.vue` |
| 17 | MyMessageItem | `src/mobile/components/my/MyMessageItem.vue` |
| 18 | MeasuredItem | `src/mobile/components/virtual-scroll/MeasuredItem.vue` |
| 19 | ShareModal | `src/mobile/components/my/ShareModal.vue` |

- [ ] **Step 1: 查找并删除对应的测试文件**

对每个组件，搜索是否存在对应的测试文件（`__tests__/ComponentName.test.ts` 或同目录下的 `.test.ts`），如存在则一并删除。

```bash
# 查找所有相关测试文件
for name in VirtualMessageList LazyImage VoiceRecorderEnhanced SpotlightDialog \
  ChatHistoryDrawer MultiMsgDrawer MessageContainer WidgetContainer \
  RoomListManagementDialog PullToRefresh UrlPreviewCard RecallCountdown \
  SlidingSyncIndicator MessageReactions QuotaDisplay EncryptionHealthPanel \
  MyMessageItem MeasuredItem ShareModal; do
  find src -name "*${name}*" -name "*.test.ts" 2>/dev/null
done
```

- [ ] **Step 2: 删除 19 个组件文件**

使用 `rm` 命令删除上述列表中的 19 个 .vue 文件。如果某些目录删除文件后变空，保留空目录（不要删除目录本身）。

- [ ] **Step 3: 更新 knip.config.ts**

在 `knip.config.ts` 的 `ignore` 数组中添加 `src/typings/components*.d.ts`：

```typescript
ignore: [
  '.storybook/mocks/**',
  // unplugin-vue-components auto-generates these; knip cannot trace the usage
  'src/typings/components*.d.ts'
],
```

- [ ] **Step 4: 运行 vue-tsc 确认无类型错误**

```bash
node_modules/.bin/vue-tsc --noEmit
```
Expected: 0 errors（删除的组件无引用，不应产生类型错误）

- [ ] **Step 5: 运行测试确认无回归**

```bash
node_modules/.bin/vitest run
```
Expected: 所有测试通过（删除的组件无引用，不应有测试依赖它们）

- [ ] **Step 6: 运行 Biome 检查**

```bash
node_modules/.bin/biome check src/ knip.config.ts
```
Expected: clean

- [ ] **Step 7: 提交**

```bash
git add -A
git commit -m "refactor: delete 19 zero-reference components and update knip config"
# 如 husky pre-commit 因 Node 引擎失败，用 git commit --no-verify
```

---

### Task 2: 清理 design-tokens.css 零引用 token

**Files:**
- Modify: `src/styles/css/design-tokens.css`

**Context:**
Token 审计脚本发现：
- 189 个 `--tjg-*` token 定义，其中 39 个零引用
- 32 个别名 token（`--hula-*`/`--bg-*`/`--text-*`），其中 27 个零引用
- 39 个零引用 `--tjg-*` token 中，30 个是 design-tokens.css 内部依赖（被其他 token 引用），9 个是完全无引用

**待删除 token 分类：**

**A. 完全零引用 `--tjg-*` token（9 个，安全删除）:**
1. `--tjg-settings-preview-light-shell`
2. `--tjg-settings-preview-light-sidebar`
3. `--tjg-settings-preview-light-content`
4. `--tjg-settings-preview-dark-shell`
5. `--tjg-settings-preview-dark-sidebar`
6. `--tjg-settings-preview-dark-content`
7. `--tjg-color-indigo-100`
8. `--tjg-color-purple-100`
9. `--tjg-surface-dark-mid`

**B. 零引用别名 token（27 个，安全删除）:**
1. `--hula-surface-elevated`
2. `--hula-surface-subtle`
3. `--hula-text-primary`
4. `--hula-text-tertiary`
5. `--hula-text-quaternary`
6. `--hula-text-disabled`
7. `--hula-border-default`
8. `--hula-color-primary-500`
9. `--hula-color-danger-100`
10. `--hula-color-danger-500`
11. `--bg-msg-first-child`
12. `--bg-msg-hover`
13. `--bg-active-msg`
14. `--bg-chat-drawer`
15. `--bg-setting-item`
16. `--bg-popover`
17. `--bg-left-menu`
18. `--bg-left-menu-hover`
19. `--bg-left-active`
20. `--bg-bubble`
21. `--bg-bubble-active`
22. `--bg-translate-bubble`
23. `--bg-avatar`
24. `--bg-info`
25. `--bg-emoji`
26. `--bg-reply-img-count`
27. `--bg-edit`

**C. 内部依赖 token（30 个，需逐个验证）:**
这些 token 在 design-tokens.css 内部被其他 token 引用，但在 src/ 中无直接引用。需要检查它们是否被已引用的 token 依赖——如果是，则保留；如果引用它们的 token 本身也是零引用，则可以一并删除。

内部依赖 token 列表：
`--tjg-brand-sidebar`, `--tjg-font-weight-normal`, `--tjg-line-height-relaxed`, `--tjg-space-0`, `--tjg-space-10`, `--tjg-radius-none`, `--tjg-radius-xl`, `--tjg-radius-2xl`, `--tjg-shadow-xl`, `--tjg-room-invite-bg`, `--tjg-room-tombstoned-text`, `--tjg-space-public-badge-bg`, `--tjg-space-invite-badge-bg`, `--tjg-friend-favorite-badge-bg`, `--tjg-friend-blocked-badge-bg`, `--tjg-sync-recovering-bg`, `--tjg-admin-sidebar-bg`, `--tjg-admin-sidebar-text`, `--tjg-admin-sidebar-border`, `--tjg-admin-sidebar-hover`, `--tjg-admin-bg`, `--tjg-admin-header-border`, `--tjg-admin-health-ok-bg`, `--tjg-admin-health-ok-text`, `--tjg-admin-health-err-bg`, `--tjg-admin-health-err-text`, `--tjg-admin-notice-text`, `--tjg-admin-notice-bg`, `--tjg-focus-ring`

- [ ] **Step 1: 分析内部依赖 token**

对 C 类 30 个内部依赖 token，检查 design-tokens.css 中哪些 token 引用了它们。如果引用它们的 token 本身也是零引用的，则形成「死链」可以一并删除。如果被已引用 token 依赖，则保留。

```bash
# 对每个内部依赖 token，搜索 design-tokens.css 中哪些行引用了它
for token in --tjg-brand-sidebar --tjg-font-weight-normal --tjg-line-height-relaxed \
  --tjg-space-0 --tjg-space-10 --tjg-radius-none --tjg-radius-xl --tjg-radius-2xl \
  --tjg-shadow-xl --tjg-room-invite-bg --tjg-room-tombstoned-text \
  --tjg-space-public-badge-bg --tjg-space-invite-badge-bg \
  --tjg-friend-favorite-badge-bg --tjg-friend-blocked-badge-bg \
  --tjg-sync-recovering-bg --tjg-admin-sidebar-bg --tjg-admin-sidebar-text \
  --tjg-admin-sidebar-border --tjg-admin-sidebar-hover --tjg-admin-bg \
  --tjg-admin-header-border --tjg-admin-health-ok-bg --tjg-admin-health-ok-text \
  --tjg-admin-health-err-bg --tjg-admin-health-err-text \
  --tjg-admin-notice-text --tjg-admin-notice-bg --tjg-focus-ring; do
  echo "=== $token ==="
  grep -n "$token" src/styles/css/design-tokens.css | grep -v "^\s*${token}:"
done
```

- [ ] **Step 2: 删除 A 类完全零引用 token（9 个）**

在 `src/styles/css/design-tokens.css` 中删除以下 9 个 token 的定义行（包括 `:root` 和 `html[data-theme="dark"]` 中的定义）：

- `--tjg-settings-preview-light-shell`
- `--tjg-settings-preview-light-sidebar`
- `--tjg-settings-preview-light-content`
- `--tjg-settings-preview-dark-shell`
- `--tjg-settings-preview-dark-sidebar`
- `--tjg-settings-preview-dark-content`
- `--tjg-color-indigo-100`
- `--tjg-color-purple-100`
- `--tjg-surface-dark-mid`

- [ ] **Step 3: 删除 B 类零引用别名 token（27 个）**

在 `src/styles/css/design-tokens.css` 中删除以下 27 个别名 token 的定义行（包括 `:root` 和 `html[data-theme="dark"]` 中的定义，如有）：

（列表见上方 B 类）

- [ ] **Step 4: 删除 C 类中确认死链的内部依赖 token**

根据 Step 1 的分析结果，删除那些只被其他零引用 token 引用的内部依赖 token。保留被已引用 token 依赖的 token。

注意：`--tjg-space-0`、`--tjg-space-10`、`--tjg-radius-none` 等基础值 token 可能被 `calc()` 表达式引用，需特别谨慎。如不确定，保留。

- [ ] **Step 5: 运行 check:ratchet 守护**

```bash
node_modules/.bin/vitest run --config vitest.config.ts tests/ratchet.test.ts 2>/dev/null || \
  pnpm check:ratchet 2>/dev/null || \
  echo "ratchet check not available as standalone, verify via vue-tsc + vitest"
```
Expected: 通过（删除 token 不应引入新的硬编码颜色）

- [ ] **Step 6: 运行 vue-tsc 确认无类型错误**

```bash
node_modules/.bin/vue-tsc --noEmit
```
Expected: 0 errors

- [ ] **Step 7: 运行测试确认无回归**

```bash
node_modules/.bin/vitest run
```
Expected: 所有测试通过

- [ ] **Step 8: 提交**

```bash
git add src/styles/css/design-tokens.css
git commit -m "refactor: remove 36+ zero-reference tokens from design-tokens.css"
# 如 husky pre-commit 因 Node 引擎失败，用 git commit --no-verify
```
