# AdminUsers.vue 速率限制 Modal 废弃输入清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 清理 [AdminUsers.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/admin/AdminUsers.vue) 中速率限制 modal 的废弃表单输入。该 modal 仍收集 `messagesPerSecond`/`burstCount` 两个数值，但调用 `overrideUserRateLimit(userId)` 时被静默丢弃——SDK 的 `overrideRateLimit` 只接受 userId，只能完全禁用速率限制（无法设置具体值）。modal 将从表单输入改为确认对话框，并更新 i18n 文案以反映"覆盖/禁用"语义。

**Architecture:** Task 4（`2026-08-06-admin-facade-dual-write-cleanup.md`）已将 `setRateLimit(userId, _limit)` 重命名为 `overrideUserRateLimit(userId)` 并删除了误导性的 `limit` 参数。但 [AdminUsers.vue](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/admin/AdminUsers.vue) 的 modal UI 未同步更新，仍保留两个 `n-input-number` 收集用户输入，调用时丢弃。这是 Task 4 的自然补全——当时按 Global Constraint "禁止扩大重构范围" 推迟至此独立计划。`getRateLimit`（V1 读取）仍返回 `{messagesPerSecond, burstCount}` 用于显示，`deleteRateLimit`（V1 删除）仍存在，两者均保留。

**Tech Stack:** Vue 3 (Composition API, `<script setup>`), Naive UI, vue-i18n, TypeScript

## Global Constraints

- **禁止扩大范围**：仅修改 `AdminUsers.vue`、`i18n.d.ts`、i18n 语言包文件、`AdminUsers.vue` 的测试文件（若存在且引用 `rateLimitForm`）。不触碰 `UserService.ts`/`AdminFacadeService.ts`/`useAdminUsers.ts`（已在 Task 4 完成）。
- **保留 V1 显示与删除功能**：`<n-descriptions>` 显示区（L168-175，展示 `getRateLimit` 返回值）和 `deleteRateLimit` 按钮（L180-182）必须保留并正常工作。
- **i18n key 处理策略**：新增 `overrideUserRateLimit` 和 `overrideRateLimitConfirm` 两个 key；保留 `messagesPerSecond`/`burstCount` key（显示区仍用）；`setRateLimit` key 若无其他引用则删除，否则保留（grep 确认）。
- **Naive UI dialog 样式**：modal 改为 `preset="dialog"` 确认样式，参照项目内其他确认对话框的写法。
- **commit scope 用 `admin`**（commitlint scope-enum 限制）。
- **测试命令**：`npx vitest run src/views/admin/`；`npx biome check src/views/admin/AdminUsers.vue`；`vue-tsc --noEmit`。

---

## File Structure

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/views/admin/AdminUsers.vue` | 用户管理页面 | 修改：modal 从表单改为确认对话框；删除 `rateLimitForm` ref；按钮文案改用新 i18n key |
| `src/typings/i18n.d.ts` | i18n 类型定义 | 修改：新增 `overrideUserRateLimit`/`overrideRateLimitConfirm` key；删除 `setRateLimit` key（若无其他引用） |
| i18n 语言包文件（grep 定位） | 翻译文案 | 修改：新增对应翻译；删除 `setRateLimit`（若适用） |
| `src/views/admin/__tests__/AdminUsers.test.ts`（若存在） | 组件测试 | 修改：更新引用 `rateLimitForm` 的测试；若无此文件则跳过 |

**不修改的文件**：
- `src/services/matrix/admin/UserService.ts`（`overrideUserRateLimit`/`getRateLimit`/`deleteRateLimit` 签名不变）
- `src/composables/admin/useAdminUsers.ts`（Task 4 已完成迁移）
- `src/services/matrix/admin/AdminTypes.ts`（`RateLimit` 接口保留，`getRateLimit` 仍返回）

---

## Task 1: 简化 modal 为确认对话框 + 删除废弃 ref

**目的**：将 [AdminUsers.vue:242-256](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/admin/AdminUsers.vue#L242) 的 `<n-modal>` 从表单输入改为确认提示；删除 L318-321 的 `rateLimitForm` ref（无消费者）。

**Files:**
- Modify: `src/views/admin/AdminUsers.vue:242-256, 318-321`
- Modify: i18n 文件（grep 定位）

**Interfaces:**
- Produces: modal 不再收集 `messagesPerSecond`/`burstCount` 输入；点击确认后调用 `overrideUserRateLimit(userId)`。

- [ ] **Step 1: grep 确认 i18n 文件位置与现有 key 引用**

```bash
grep -rn "admin.users.setRateLimit\|admin.users.messagesPerSecond\|admin.users.burstCount" src/
```

记录所有引用位置，确认 `messagesPerSecond`/`burstCount` key 是否还被 `<n-descriptions>` 显示区使用（应保留），`setRateLimit` key 是否还有非 modal 引用。

- [ ] **Step 2: 重写 modal 为确认对话框**

将 [AdminUsers.vue:242-256](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/admin/AdminUsers.vue#L242) 的 `<n-modal>` 替换为：

```vue
<n-modal
  v-model:show="showRateLimitDialog"
  :title="t('admin.users.overrideUserRateLimit')"
  preset="dialog"
  style="width: 400px">
  <span>{{ t('admin.users.overrideRateLimitConfirm') }}</span>
  <template #action>
    <n-button @click="showRateLimitDialog = false">{{ t('common.cancel') }}</n-button>
    <n-button type="warning" :loading="settingRateLimit" @click="handleOverrideRateLimit">
      {{ t('admin.users.overrideUserRateLimit') }}
    </n-button>
  </template>
</n-modal>
```

注意：`settingRateLimit` loading 状态保留（L610 处的 `settingRateLimit.value = true/false` 不变）。

- [ ] **Step 3: 删除 `rateLimitForm` ref**

删除 [AdminUsers.vue:318-321](file:///Users/ljf/Desktop/hu_ts/Tjg/src/views/admin/AdminUsers.vue#L318)：

```typescript
const rateLimitForm = ref({
  messagesPerSecond: 10,
  burstCount: 20
})
```

- [ ] **Step 4: 重命名按钮触发函数（如需要）**

检查 L609 处的函数名。当前函数体已调用 `admin.overrideUserRateLimit(selectedUser.value.userId)`（L612），但函数名可能仍是 `handleSetRateLimit` 或类似。若函数名含 `setRateLimit`，重命名为 `handleOverrideRateLimit` 以匹配新语义。同步更新 L177-179 按钮的 `@click` 绑定。

- [ ] **Step 5: 更新触发按钮文案**

L177-179 的按钮文案从 `t('admin.users.setRateLimit')` 改为 `t('admin.users.overrideUserRateLimit')`。

---

## Task 2: 更新 i18n key

**目的**：新增 `overrideUserRateLimit` 和 `overrideRateLimitConfirm` 两个 i18n key 及对应翻译；处理废弃的 `setRateLimit` key。

**Files:**
- Modify: `src/typings/i18n.d.ts`
- Modify: i18n 语言包文件（Task 1 Step 1 grep 定位）

**Interfaces:**
- Produces: i18n 新增 `admin.users.overrideUserRateLimit`、`admin.users.overrideRateLimitConfirm`。

- [ ] **Step 1: 在 i18n.d.ts 新增 key 类型**

在 `admin.users` 命名空间下新增：

```typescript
overrideUserRateLimit: string
overrideRateLimitConfirm: string
```

- [ ] **Step 2: 在各语言包新增翻译**

中文（zh-CN）：
- `overrideUserRateLimit`: `'覆盖速率限制'`
- `overrideRateLimitConfirm`: `'确定要禁用该用户的速率限制吗？此操作将覆盖所有限制设置。'`

英文（en-US）：
- `overrideUserRateLimit`: `'Override Rate Limit'`
- `overrideRateLimitConfirm`: `'Disable rate limiting for this user? This will override all limit settings.'`

其他语言包按项目现有语言补全（grep 定位所有含 `admin.users.setRateLimit` 的文件）。

- [ ] **Step 3: 处理 `setRateLimit` key**

根据 Task 1 Step 1 的 grep 结果：
- 若 `setRateLimit` key 无其他引用（仅 modal 标题和按钮用，现已改用新 key），则从 i18n.d.ts 和各语言包删除。
- 若仍有其他引用，保留不动。

- [ ] **Step 4: 保留 `messagesPerSecond`/`burstCount` key**

确认 `<n-descriptions>` 显示区（L168-175）仍使用这两个 key，**不删除**。

---

## Task 3: 验证

**目的**：确保 modal 清理后无回归。

- [ ] **Step 1: 类型检查**

```bash
npx vue-tsc --noEmit
```

预期：0 错误。

- [ ] **Step 2: 测试**

```bash
npx vitest run src/views/admin/
```

预期：全部通过。若 `AdminUsers.test.ts` 引用了 `rateLimitForm`，需在 Task 1 同步更新测试。

- [ ] **Step 3: Biome lint**

```bash
npx biome check src/views/admin/AdminUsers.vue
```

预期：clean。

- [ ] **Step 4: grep 确认无残留**

```bash
grep -rn "rateLimitForm" src/
grep -rn "admin.users.setRateLimit" src/views/admin/AdminUsers.vue
```

预期：`rateLimitForm` 0 匹配；`admin.users.setRateLimit` 在 AdminUsers.vue 中 0 匹配（若 i18n key 保留则可能有其他文件匹配，可接受）。

- [ ] **Step 5: 视觉验证（手动）**

启动 dev server，打开 Admin 用户管理页，选中用户，点击速率限制按钮：
- modal 应为确认对话框（无输入框）
- 文案应表达"禁用/覆盖"语义
- 点击确认后速率限制被禁用
- `<n-descriptions>` 仍正常显示当前用户的速率限制值
- `deleteRateLimit` 按钮仍可用

- [ ] **Step 6: 提交**

```bash
git add src/views/admin/AdminUsers.vue src/typings/i18n.d.ts <i18n 语言包文件>
git commit -m "refactor(admin): simplify rate limit modal to confirm dialog, drop unused form inputs"
```

---

## Risks

- **低**：纯 UI + i18n 变更，无服务端/API 影响。`getRateLimit`/`deleteRateLimit` V1 方法不变。
- 需视觉验证 Naive UI `preset="dialog"` 确认样式符合预期。
- 若项目支持多语言，需补全所有语言包的翻译（Task 2 Step 2）。
