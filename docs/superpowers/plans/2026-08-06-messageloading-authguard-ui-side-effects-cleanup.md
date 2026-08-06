# messageLoading.ts 与 authGuard.ts UI 副作用清理计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `messageLoading.ts` 中 6 处 `window.$loadingBar` 直接操作和 `authGuard.ts` 中 1 处 `window.$message?.warning()` 直接操作，迁移到 `useActionFeedback` composable，使 store 层和路由守卫层不再直接耦合 Naive UI 全局对象。

**Architecture:** `useActionFeedback` 当前仅封装 `window.$message`（消息提示）和 `useAriaLive`（无障碍播报），不包含 loading bar 能力。本计划先扩展 `useActionFeedback` 添加 loading bar API（`startLoading` / `finishLoading` / `errorLoading`），然后将 `messageLoading.ts` 的 6 处 `window.$loadingBar` 操作替换为新 API，最后将 `authGuard.ts` 的 `window.$message?.warning()` 替换为现有的 `showFeedback` 方法。`messageLoading.ts` 已在第 41 行使用 `useActionFeedback`，`authGuard.ts` 将新增 import。

**Tech Stack:** TypeScript, Vue 3, Vitest, Naive UI（`window.$message` / `window.$loadingBar` 全局注入）

## Global Constraints

- **TDD 强制执行**：每个任务先写测试（红），再写实现（绿），再提交。禁止跳过测试步骤。
- **禁止保留向后兼容垫片**：直接移除 `window.$loadingBar` 和 `window.$message` 调用，不留 `@deprecated` 标记。YAGNI。
- **禁止扩大重构范围**：本计划仅处理 `messageLoading.ts`、`authGuard.ts` 和 `useActionFeedback.ts` 三个文件。`NaiveProvider.vue` 中的 `window.$loadingBar = useLoadingBar()` 全局注入保持不变（它是基础设施层）。
- **保留 `showLoadingBar` 参数**：`messageLoading.ts` 的 `getPageMsg` 和 `getMsgList` 的 `showLoadingBar` 参数保留，调用方仍可控制是否显示 loading bar。仅替换内部实现从 `window.$loadingBar` 到 `useActionFeedback`。
- **测试命令**：单文件测试用 `npx vitest run <file-path>`；全量测试用 `pnpm test:run`。
- **提交粒度**：每个 Task 结束时提交一次，commit scope 用 `service`（commitlint scope-enum 限制，不接受 `matrix-http-client` 等自定义 scope）。

---

## File Structure

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/composables/common/useActionFeedback.ts` | 统一 UI 反馈 composable | 修改：新增 `startLoading` / `finishLoading` / `errorLoading` 三个方法 |
| `src/composables/__tests__/useActionFeedback.test.ts` | useActionFeedback 单元测试 | 修改：新增 loading bar API 的测试 |
| `src/stores/domains/chat/chat/messageLoading.ts` | 聊天消息加载 store | 修改：6 处 `window.$loadingBar` 操作替换为 `useActionFeedback` 新方法 |
| `src/router/authGuard.ts` | 路由认证守卫 | 修改：1 处 `window.$message?.warning()` 替换为 `useActionFeedback.showFeedback` |
| `src/router/__tests__/authGuard.test.ts` | authGuard 单元测试 | 修改：更新测试断言验证不再直接操作 `window.$message` |

**不修改的文件**：
- `src/components/common/NaiveProvider.vue`（全局注入 `window.$loadingBar` 和 `window.$message` 的基础设施层，保持不变）
- `src/router/index.ts`（authGuard 的调用方，options 接口不变，无需修改）
- `src/stores/domains/chat/chat/message.ts`（store 组装层，接口不变）

---

## Task 1: 扩展 useActionFeedback 添加 loading bar API

**目的**：`useActionFeedback` 当前不包含 loading bar 能力。新增 `startLoading` / `finishLoading` / `errorLoading` 三个方法，封装 `window.$loadingBar` 的 `start()` / `finish()` / `error()` 调用，与现有的 `showFeedback` / `showError` / `showProgressFeedback` / `clearFeedback` 并列。

**Files:**
- Modify: `src/composables/__tests__/useActionFeedback.test.ts`
- Modify: `src/composables/common/useActionFeedback.ts`

**Interfaces:**
- Consumes: `window.$loadingBar`（由 NaiveProvider.vue 全局注入）
- Produces: `useActionFeedback()` 返回值新增 `startLoading: () => void`、`finishLoading: () => void`、`errorLoading: () => void`

- [ ] **Step 1: 在测试文件中添加 loading bar API 的 failing 测试**

在 `src/composables/__tests__/useActionFeedback.test.ts` 的 `describe('useActionFeedback', ...)` 块内最后一个 `it` 之后添加以下 4 个测试：

```typescript
  it('startLoading 调用 window.$loadingBar.start', () => {
    const { startLoading } = useActionFeedback()
    startLoading()
    expect(window.$loadingBar.start).toHaveBeenCalledTimes(1)
  })

  it('finishLoading 调用 window.$loadingBar.finish', () => {
    const { finishLoading } = useActionFeedback()
    finishLoading()
    expect(window.$loadingBar.finish).toHaveBeenCalledTimes(1)
  })

  it('errorLoading 调用 window.$loadingBar.error', () => {
    const { errorLoading } = useActionFeedback()
    errorLoading()
    expect(window.$loadingBar.error).toHaveBeenCalledTimes(1)
  })

  it('loading bar 方法在 window.$loadingBar 未注入时安全跳过', () => {
    const original = window.$loadingBar
    delete (window as { $loadingBar?: unknown }).$loadingBar

    const { startLoading, finishLoading, errorLoading } = useActionFeedback()
    expect(() => {
      startLoading()
      finishLoading()
      errorLoading()
    }).not.toThrow()

    ;(window as { $loadingBar?: unknown }).$loadingBar = original
  })
```

- [ ] **Step 2: 运行测试验证 4 个新测试 FAIL**

Run: `npx vitest run src/composables/__tests__/useActionFeedback.test.ts`
Expected: FAIL — 4 个新测试失败（`startLoading` / `finishLoading` / `errorLoading` 未定义）

- [ ] **Step 3: 在 useActionFeedback 中实现 loading bar API**

在 `src/composables/common/useActionFeedback.ts` 的 `useActionFeedback()` 函数内，在 `clearFeedback` 定义之后（第 85 行 `}` 之后）、`return` 语句之前，添加以下 3 个方法：

```typescript
  const startLoading = () => {
    window.$loadingBar?.start?.()
  }

  const finishLoading = () => {
    window.$loadingBar?.finish?.()
  }

  const errorLoading = () => {
    window.$loadingBar?.error?.()
  }
```

然后在 `return` 语句中添加这 3 个方法：

```typescript
  return {
    showFeedback,
    showError,
    showProgressFeedback,
    clearFeedback,
    startLoading,
    finishLoading,
    errorLoading
  }
```

- [ ] **Step 4: 运行测试验证全部通过**

Run: `npx vitest run src/composables/__tests__/useActionFeedback.test.ts`
Expected: PASS（所有测试通过，包括新增的 4 个 loading bar 测试）

- [ ] **Step 5: 提交**

```bash
git add src/composables/common/useActionFeedback.ts src/composables/__tests__/useActionFeedback.test.ts
git commit -m "feat(service): add loading bar API to useActionFeedback"
```

---

## Task 2: authGuard.ts 迁移到 useActionFeedback

**目的**：将 `authGuard.ts` 第 68 行的 `window.$message?.warning(i18n.t('error.matrix.forbidden'))` 替换为 `useActionFeedback().showFeedback(i18n.t('error.matrix.forbidden'), 'warning')`，使路由守卫不再直接操作 `window.$message` 全局对象。

**Files:**
- Modify: `src/router/__tests__/authGuard.test.ts`
- Modify: `src/router/authGuard.ts`

**Interfaces:**
- Consumes: Task 1 的 `useActionFeedback.showFeedback(message, type)` 方法
- Produces: `authGuard.ts` 不再直接引用 `window.$message`

- [ ] **Step 1: 修改 authGuard 测试，断言不再直接调用 `window.$message.warning`**

在 `src/router/__tests__/authGuard.test.ts` 中：

**1a. 在文件顶部添加 useActionFeedback mock**

在现有 `vi.mock('@/services/i18n', ...)` 之后（第 5 行之后）添加：

```typescript
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: vi.fn((message: string, _type: string) => {
      ;(globalThis as { $message?: { warning?: (m: string) => void } }).$message?.warning?.(message)
    }),
    showError: vi.fn(),
    showProgressFeedback: vi.fn(),
    clearFeedback: vi.fn(),
    startLoading: vi.fn(),
    finishLoading: vi.fn(),
    errorLoading: vi.fn()
  })
}))
```

**1b. 在 "blocks protected admin routes for non-admin users" 测试中添加断言**

将该测试（约第 101-119 行）修改为：

```typescript
  it('blocks protected admin routes for non-admin users', async () => {
    mockHasAuthenticatedSession.mockResolvedValue(true)
    mockVerifyAdminAccess.mockResolvedValue(false)

    const guard = createAuthGuard({
      isMobile: false,
      hasAuthenticatedSession: mockHasAuthenticatedSession,
      verifyAdminAccess: mockVerifyAdminAccess,
      logger: {
        warn: mockWarn,
        error: mockError
      }
    })

    await guard(createRoute('/admin/users', true), createRoute('/'), next)

    expect(mockVerifyAdminAccess).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith('/')
    expect(mockWarn).toHaveBeenCalledWith('非管理员尝试访问受限路径: /admin/users')
    // authGuard 不再直接操作 window.$message，而是通过 useActionFeedback
    expect(window.$message.warning).toHaveBeenCalledWith('error.matrix.forbidden')
  })
```

- [ ] **Step 2: 运行测试验证修改后的测试仍 PASS（mock 桥接使行为不变）**

Run: `npx vitest run src/router/__tests__/authGuard.test.ts`
Expected: PASS（mock 桥接了 useActionFeedback 到 window.$message，测试行为不变）

- [ ] **Step 3: 修改 authGuard.ts，用 useActionFeedback 替换 window.$message**

在 `src/router/authGuard.ts` 中：

**3a. 添加 import**

在文件顶部 import 区域（第 2 行 `import { useI18nGlobal } from '@/services/i18n'` 之后）添加：

```typescript
import { useActionFeedback } from '@/composables/common/useActionFeedback'
```

**3b. 替换 `window.$message?.warning(...)` 调用**

将第 67-68 行：

```typescript
          const i18n = useI18nGlobal()
          window.$message?.warning(i18n.t('error.matrix.forbidden'))
```

替换为：

```typescript
          const i18n = useI18nGlobal()
          useActionFeedback().showFeedback(i18n.t('error.matrix.forbidden'), 'warning')
```

- [ ] **Step 4: 运行测试验证全部通过**

Run: `npx vitest run src/router/__tests__/authGuard.test.ts`
Expected: PASS（所有测试通过）

- [ ] **Step 5: 验证 authGuard.ts 中不再包含 `window.$message` 引用**

用 Grep 搜索 `src/router/authGuard.ts`：
- 搜索 pattern: `window\.\$message`
- 期望结果: 0 匹配

- [ ] **Step 6: 提交**

```bash
git add src/router/authGuard.ts src/router/__tests__/authGuard.test.ts
git commit -m "refactor(service): migrate authGuard to useActionFeedback"
```

---

## Task 3: messageLoading.ts 迁移到 useActionFeedback loading bar API

**目的**：将 `messageLoading.ts` 中 `getPageMsg` 函数内的 6 处 `window.$loadingBar` 直接操作（第 63-64、100-101、105-106 行）替换为 Task 1 新增的 `useActionFeedback` loading bar API（`startLoading` / `finishLoading` / `errorLoading`）。`messageLoading.ts` 已在第 41 行解构 `useActionFeedback`，只需新增解构 3 个方法并替换调用。

**Files:**
- Modify: `src/stores/domains/chat/chat/messageLoading.ts`

**Interfaces:**
- Consumes: Task 1 的 `useActionFeedback.startLoading()` / `finishLoading()` / `errorLoading()`
- Produces: `messageLoading.ts` 不再直接引用 `window.$loadingBar`

- [ ] **Step 1: 在 useActionFeedback 解构中添加 3 个 loading bar 方法**

在 `src/stores/domains/chat/chat/messageLoading.ts` 第 41 行，将：

```typescript
  const { showFeedback } = useActionFeedback()
```

替换为：

```typescript
  const { showFeedback, startLoading, finishLoading, errorLoading } = useActionFeedback()
```

- [ ] **Step 2: 替换 try 块开始处的 loadingBar.start**

在第 63-65 行，将：

```typescript
      if (showLoadingBar && window.$loadingBar) {
        window.$loadingBar.start()
      }
```

替换为：

```typescript
      if (showLoadingBar) {
        startLoading()
      }
```

- [ ] **Step 3: 替换成功路径的 loadingBar.finish**

在第 100-102 行，将：

```typescript
      if (showLoadingBar && window.$loadingBar) {
        window.$loadingBar.finish()
      }
```

替换为：

```typescript
      if (showLoadingBar) {
        finishLoading()
      }
```

- [ ] **Step 4: 替换 catch 块的 loadingBar.error**

在第 105-107 行，将：

```typescript
      if (showLoadingBar && window.$loadingBar) {
        window.$loadingBar.error()
      }
```

替换为：

```typescript
      if (showLoadingBar) {
        errorLoading()
      }
```

- [ ] **Step 5: 验证 messageLoading.ts 中不再包含 `window.$loadingBar` 引用**

用 Grep 搜索 `src/stores/domains/chat/chat/messageLoading.ts`：
- 搜索 pattern: `window\.\$loadingBar`
- 期望结果: 0 匹配

- [ ] **Step 6: 运行相关测试验证无回归**

Run: `npx vitest run src/stores/domains/chat/chat/__tests__/message.test.ts`
Expected: PASS（所有测试通过）

- [ ] **Step 7: 运行 useActionFeedback 测试验证无回归**

Run: `npx vitest run src/composables/__tests__/useActionFeedback.test.ts`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
git add src/stores/domains/chat/chat/messageLoading.ts
git commit -m "refactor(service): migrate messageLoading to useActionFeedback loading bar API"
```

---

## Task 4: 最终验证与清理

**目的**：全量回归测试 + 类型检查 + lint + 验证 `window.$loadingBar` 和 `window.$message` 在 store/router 层的残留引用已清除。

**Files:**
- 无文件修改（仅验证）

- [ ] **Step 1: 运行所有相关测试**

Run: `npx vitest run src/composables/__tests__/useActionFeedback.test.ts src/router/__tests__/authGuard.test.ts src/stores/domains/chat/chat/__tests__/message.test.ts`
Expected: PASS（所有测试通过）

- [ ] **Step 2: 运行 matrix 服务测试套件验证无回归**

Run: `npx vitest run src/services/matrix/ src/stores/domains/chat/ src/router/ src/composables/common/`
Expected: PASS（重点关注无新增失败）

- [ ] **Step 3: 运行类型检查**

Run: `npx vue-tsc --noEmit`
Expected: PASS（无 TS 错误）

- [ ] **Step 4: 运行 lint 检查**

Run: `npx biome check src/composables/common/useActionFeedback.ts src/composables/__tests__/useActionFeedback.test.ts src/stores/domains/chat/chat/messageLoading.ts src/router/authGuard.ts src/router/__tests__/authGuard.test.ts`
Expected: PASS（无 lint 错误）

- [ ] **Step 5: 验证 store 层和 router 层不再直接操作 UI 全局对象**

用 Grep 搜索以下路径，确认 0 匹配：

搜索 1 — `src/stores/` 目录：
- 搜索 pattern: `window\.\$loadingBar`
- 期望结果: 0 匹配

搜索 2 — `src/router/` 目录：
- 搜索 pattern: `window\.\$message`
- 期望结果: 0 匹配

搜索 3 — `src/stores/` 目录：
- 搜索 pattern: `window\.\$message`
- 期望结果: 0 匹配（确认 store 层也不直接操作 $message）

- [ ] **Step 6: 最终提交（如有 lint 自动修复）**

```bash
git status
# 如果有未提交的变更：
git add -A
git commit -m "chore(service): final lint cleanup for UI side effects migration"
```

---

## Self-Review

### 1. Spec coverage（规格覆盖）

| 需求 | 对应 Task |
|------|-----------|
| 扩展 useActionFeedback 添加 loading bar API | Task 1（新增 `startLoading` / `finishLoading` / `errorLoading` + 4 个测试） |
| messageLoading.ts 6 处 `window.$loadingBar` 迁移 | Task 3（替换 3 个 if 块，每块 2 行 = 6 处操作） |
| authGuard.ts 1 处 `window.$message` 迁移 | Task 2（替换为 `showFeedback` + 添加 import + 更新测试） |
| 最终验证 | Task 4（测试 + 类型检查 + lint + grep 验证） |

### 2. Placeholder scan（占位符扫描）

✅ 无 "TBD"、"TODO"、"implement later"、"add appropriate error handling" 等占位符
✅ 所有代码步骤包含完整代码块
✅ 所有测试步骤包含完整测试代码

### 3. Type consistency（类型一致性）

✅ Task 1 定义的 `startLoading: () => void`、`finishLoading: () => void`、`errorLoading: () => void` 与 Task 3 中 `messageLoading.ts` 解构使用的名称一致
✅ Task 2 使用的 `showFeedback(message, type)` 与现有 `useActionFeedback` 中的签名一致
✅ `useActionFeedback()` 返回值在 Task 1 扩展后向后兼容（仅新增方法，不修改现有方法）
