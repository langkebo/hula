# MatrixHttpClient 移除 UI 副作用重构计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `MatrixHttpClient` 中直接操作 `window.$loadingBar` 和 `window.$message` 的 UI 副作用代码完全移除，使 HTTP 客户端回归纯传输职责，UI 反馈交由调用方通过 `useActionFeedback` / `withErrorHandling` 显式处理。

**Architecture:** `MatrixHttpClient` 当前在 `request()` 内部根据 `showLoading` / `showErrorToast` 选项直接调用 Naive UI 全局对象（`window.$loadingBar` 和 `window.$message`），违反了 HTTP 客户端与 UI 层的职责分离。审计确认：`showLoading` 选项无任何调用方使用（完全死代码）；`showErrorToast` 选项无调用方显式使用，但 `safeRequest()` 内部通过 `showErrorToast: !quiet` 隐式启用，影响 1 个生产调用方（`RoomCapabilitiesService`，其为缓存后台刷新场景，不应弹错误 toast）。同时移除 0 调用方的死方法 `requestAppResult`。

**Tech Stack:** TypeScript, Vue 3, Vitest, Naive UI（`window.$message` / `window.$loadingBar` 全局注入）

## Global Constraints

- **TDD 强制执行**：每个任务先写测试（红），再写实现（绿），再提交。禁止跳过测试步骤。
- **禁止保留向后兼容垫片**：`showLoading` / `showErrorToast` 选项从接口中完全删除，不留 `@deprecated` 标记或 `_` 前缀变量。YAGNI。
- **禁止扩大重构范围**：本计划仅处理 `MatrixHttpClient.ts` 内的 UI 副作用。`messageLoading.ts` 中直接操作 `window.$loadingBar` 的代码不在本计划范围内（见"Out of Scope"章节）。
- **禁止修改 `quiet` 选项的日志行为**：`quiet` 选项当前同时控制 `logger.info/error` 输出和 `showErrorToast`。重构后 `quiet` 仅控制 logger 输出（非 UI 副作用），保留现有 4 个 `quiet: true` 调用方不变。
- **测试命令**：单文件测试用 `npx vitest run <file-path>`；全量测试用 `pnpm test:run`。
- **提交粒度**：每个 Task 结束时提交一次，提交信息格式 `refactor(matrix-http-client): <task 描述>`。

---

## File Structure

| 文件 | 职责 | 操作 |
|------|------|------|
| `src/services/matrix/MatrixHttpClient.ts` | HTTP 客户端核心实现 | 修改：移除 `showLoading` / `showErrorToast` 选项及 `requestAppResult` 方法 |
| `src/services/matrix/__tests__/MatrixHttpClient.test.ts` | `MatrixHttpClient` 单元测试 | 修改：新增 characterization 测试 + 移除副作用后的回归测试 |
| `src/services/matrix/room/RoomCapabilitiesService.ts` | 房间能力缓存服务（唯一受影响的隐式 `showErrorToast` 调用方） | 不修改代码，新增回归测试验证无 toast |

**不修改的文件**（已审计确认无影响）：
- `src/services/matrix/room/MetadataService.ts`（3 处 `quiet: true`，已主动抑制副作用）
- `src/services/matrix/notifications/MatrixRoomNotificationService.ts`（1 处 `quiet: true`）
- `src/services/matrix/notifications/MatrixNotificationService.ts`（直接 `request()`，不经 safeRequest）
- `src/services/matrix/ai/*.ts`（全部直接 `request()`，无副作用）
- `src/services/mapApi.ts`（使用 `requestResult`，无副作用）
- `src/composables/chat/useAssistantModelPresets.ts`（使用 `requestResult`，无副作用）

---

## Task 1: Characterization 测试 — 记录当前 UI 副作用行为

**目的**：在重构前用测试固化当前行为，作为后续移除副作用的对照基线。这些测试将在 Task 2-3 中被修改为断言"副作用不再发生"。

**Files:**
- Modify: `src/services/matrix/__tests__/MatrixHttpClient.test.ts`

**Interfaces:**
- Consumes: `matrixHttpClient.request()`, `matrixHttpClient.safeRequest()`, `matrixHttpClient.get()`
- Produces: 4 个 characterization 测试用例，后续 Task 会修改这些测试的断言方向

- [ ] **Step 1: 在测试文件顶部添加 `window.$message` 和 `window.$loadingBar` 的 mock**

在 `src/services/matrix/__tests__/MatrixHttpClient.test.ts` 的 `beforeEach` 块内（第 50-59 行之间），添加全局 mock 初始化。在现有 `beforeEach` 的 `vi.clearAllMocks()` 之后添加：

```typescript
  beforeEach(() => {
    vi.clearAllMocks()
    // Characterization: mock Naive UI global side-effect targets
    vi.stubGlobal('$message', {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    })
    vi.stubGlobal('$loadingBar', {
      start: vi.fn(),
      finish: vi.fn(),
      error: vi.fn()
    })
    authedRequest = vi.fn().mockResolvedValue({})
    getMatrixHomeserverUrlMock.mockReturnValue('https://matrix.test')
    getMatrixAccessTokenMock.mockReturnValue('tok-abc')
    runtimeFetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
    getMatrixClientMock.mockReturnValue({
      http: { authedRequest }
    } as unknown as MatrixClient)
  })
```

- [ ] **Step 2: 添加 characterization 测试块**

在现有 `describe('MatrixHttpClient', () => { ... })` 块内最后一个 `it` 之后（第 131 行 `})` 之前），添加以下 4 个测试：

```typescript
  it('showLoading: true 时调用 window.$loadingBar.start/finish', async () => {
    authedRequest.mockResolvedValueOnce({ ok: true })

    await matrixHttpClient.request('GET', '/test', {
      showLoading: true
    } as never)

    expect(window.$loadingBar.start).toHaveBeenCalledTimes(1)
    expect(window.$loadingBar.finish).toHaveBeenCalledTimes(1)
    expect(window.$loadingBar.error).not.toHaveBeenCalled()
  })

  it('showLoading: true 请求失败时调用 window.$loadingBar.error', async () => {
    authedRequest.mockRejectedValueOnce(new Error('boom'))

    await expect(
      matrixHttpClient.request('GET', '/test', {
        showLoading: true
      } as never)
    ).rejects.toThrow('boom')

    expect(window.$loadingBar.start).toHaveBeenCalledTimes(1)
    expect(window.$loadingBar.error).toHaveBeenCalledTimes(1)
    expect(window.$loadingBar.finish).not.toHaveBeenCalled()
  })

  it('showErrorToast: true 请求失败时调用 window.$message.error', async () => {
    authedRequest.mockRejectedValueOnce(new Error('boom'))

    await expect(
      matrixHttpClient.request('GET', '/test', {
        showErrorToast: true
      } as never)
    ).rejects.toThrow('boom')

    expect(window.$message.error).toHaveBeenCalledWith('boom')
  })

  it('safeRequest 默认（quiet 未设）失败时调用 window.$message.error', async () => {
    authedRequest.mockRejectedValueOnce(new Error('boom'))

    await matrixHttpClient.get('/test')

    expect(window.$message.error).toHaveBeenCalledWith('boom')
  })
```

- [ ] **Step 3: 运行测试验证全部通过（确认当前行为被正确固化）**

Run: `npx vitest run src/services/matrix/__tests__/MatrixHttpClient.test.ts`
Expected: PASS（所有测试通过，包括新增的 4 个 characterization 测试）

- [ ] **Step 4: 提交**

```bash
git add src/services/matrix/__tests__/MatrixHttpClient.test.ts
git commit -m "test(matrix-http-client): add characterization tests for UI side effects"
```

---

## Task 2: 移除 `showLoading` 选项（死代码）

**目的**：`showLoading` 选项在整个代码库中无任何调用方使用，是完全死代码。直接移除。

**Files:**
- Modify: `src/services/matrix/MatrixHttpClient.ts:19,218,221-223,231-233,240-242`
- Modify: `src/services/matrix/__tests__/MatrixHttpClient.test.ts`（更新 characterization 测试断言）

**Interfaces:**
- Consumes: Task 1 的 characterization 测试
- Produces: `MatrixHttpRequestOptions` 不再包含 `showLoading` 字段

- [ ] **Step 1: 修改 characterization 测试，断言 `window.$loadingBar` 不再被调用**

在 `src/services/matrix/__tests__/MatrixHttpClient.test.ts` 中，将 Task 1 添加的前两个测试（`showLoading: true 时调用 window.$loadingBar.start/finish` 和 `showLoading: true 请求失败时调用 window.$loadingBar.error`）替换为：

```typescript
  it('request 不再操作 window.$loadingBar（即使传入 showLoading）', async () => {
    authedRequest.mockResolvedValueOnce({ ok: true })

    await matrixHttpClient.request('GET', '/test')

    expect(window.$loadingBar.start).not.toHaveBeenCalled()
    expect(window.$loadingBar.finish).not.toHaveBeenCalled()
    expect(window.$loadingBar.error).not.toHaveBeenCalled()
  })

  it('request 失败不再操作 window.$loadingBar', async () => {
    authedRequest.mockRejectedValueOnce(new Error('boom'))

    await expect(matrixHttpClient.request('GET', '/test')).rejects.toThrow('boom')

    expect(window.$loadingBar.start).not.toHaveBeenCalled()
    expect(window.$loadingBar.error).not.toHaveBeenCalled()
    expect(window.$loadingBar.finish).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: 运行测试验证前两个测试 FAIL（确认测试有效）**

Run: `npx vitest run src/services/matrix/__tests__/MatrixHttpClient.test.ts`
Expected: FAIL — 前两个测试失败（`window.$loadingBar.start` 被调用，断言 `not.toHaveBeenCalled` 不通过）

- [ ] **Step 3: 从 `MatrixHttpRequestOptions` 接口移除 `showLoading` 字段**

在 `src/services/matrix/MatrixHttpClient.ts` 第 19 行，删除：

```typescript
  showLoading?: boolean
```

删除后接口变为：

```typescript
interface MatrixHttpRequestOptions {
  queryParams?: Record<string, string | number>
  body?: Record<string, unknown>
  headers?: Record<string, string>
  throwOnError?: boolean
  logPrefix?: string
  defaultValue?: unknown
  quiet?: boolean
  retries?: number
  retryDelay?: number
  showErrorToast?: boolean
}
```

- [ ] **Step 4: 从 `request()` 方法移除 `showLoading` 相关代码**

在 `src/services/matrix/MatrixHttpClient.ts` 的 `request()` 方法中：

**删除第 218 行**：
```typescript
    const showLoading = requestOptions.showLoading ?? false
```

**删除第 221-223 行**（try 块开始前的 loadingBar.start）：
```typescript
    if (showLoading && window.$loadingBar) {
      window.$loadingBar.start()
    }
```

**删除第 231-233 行**（成功后的 loadingBar.finish）：
```typescript
        if (showLoading && window.$loadingBar) {
          window.$loadingBar.finish()
        }
```

**删除第 240-242 行**（catch 块中的 loadingBar.error）：
```typescript
          if (showLoading && window.$loadingBar) {
            window.$loadingBar.error()
          }
```

修改后 `request()` 方法的重试循环变为：

```typescript
    let retries = requestOptions.retries ?? 0
    const retryDelay = requestOptions.retryDelay ?? 1000

    while (true) {
      try {
        const result = await this._doRequest<T>(method, requestPath, requestOptions)
        return result
      } catch (err: unknown) {
        const error = err as Error & { message?: string }
        // Retry only on network errors or 5xx server errors
        const isRetryable = err instanceof TypeError || error.message?.includes('HTTP 5')
        if (!isRetryable || retries <= 0) {
          if (showErrorToast && window.$message) {
            window.$message.error(error.message || String(err))
          }
          throw err
        }
        retries--
        logger.warn(`请求失败，准备重试 (${retries} 次剩余): ${requestPath}`, err)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    }
```

- [ ] **Step 5: 运行测试验证全部通过**

Run: `npx vitest run src/services/matrix/__tests__/MatrixHttpClient.test.ts`
Expected: PASS（所有测试通过，包括修改后的 2 个 loadingBar 测试）

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/MatrixHttpClient.ts src/services/matrix/__tests__/MatrixHttpClient.test.ts
git commit -m "refactor(matrix-http-client): remove dead showLoading option and loadingBar side effects"
```

---

## Task 3: 移除 `showErrorToast` UI 副作用（接口 + request + safeRequest）

**目的**：移除 `showErrorToast` 选项及 `request()` 中的 `window.$message.error()` 调用，同时移除 `safeRequest()` 中 `showErrorToast: !quiet` 的隐式映射。`MatrixHttpClient` 不再直接操作任何 UI 全局对象。

**Files:**
- Modify: `src/services/matrix/MatrixHttpClient.ts:20,219,243-245,338-343`
- Modify: `src/services/matrix/__tests__/MatrixHttpClient.test.ts`（更新 characterization 测试断言）

**Interfaces:**
- Consumes: Task 2 的测试基线
- Produces: `MatrixHttpRequestOptions` 不再包含 `showErrorToast` 字段；`safeRequest` 不再注入 `showErrorToast`

- [ ] **Step 1: 修改 characterization 测试，断言 `window.$message.error` 不再被调用**

在 `src/services/matrix/__tests__/MatrixHttpClient.test.ts` 中，将 Task 1 添加的后两个测试（`showErrorToast: true 请求失败时调用 window.$message.error` 和 `safeRequest 默认（quiet 未设）失败时调用 window.$message.error`）替换为：

```typescript
  it('request 不再操作 window.$message（即使传入 showErrorToast）', async () => {
    authedRequest.mockRejectedValueOnce(new Error('boom'))

    await expect(
      matrixHttpClient.request('GET', '/test', {
        showErrorToast: true
      } as never)
    ).rejects.toThrow('boom')

    expect(window.$message.error).not.toHaveBeenCalled()
  })

  it('safeRequest 默认（quiet 未设）失败时不再调用 window.$message.error', async () => {
    authedRequest.mockRejectedValueOnce(new Error('boom'))

    await matrixHttpClient.get('/test')

    expect(window.$message.error).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: 运行测试验证这两个测试 FAIL（确认测试有效）**

Run: `npx vitest run src/services/matrix/__tests__/MatrixHttpClient.test.ts`
Expected: FAIL — 这两个测试失败（`window.$message.error` 被调用，断言 `not.toHaveBeenCalled` 不通过）

- [ ] **Step 3: 从 `MatrixHttpRequestOptions` 接口移除 `showErrorToast` 字段**

在 `src/services/matrix/MatrixHttpClient.ts` 中，删除接口中的 `showErrorToast` 行（Task 2 后约在第 19 行）：

```typescript
  showErrorToast?: boolean
```

删除后接口变为：

```typescript
interface MatrixHttpRequestOptions {
  queryParams?: Record<string, string | number>
  body?: Record<string, unknown>
  headers?: Record<string, string>
  throwOnError?: boolean
  logPrefix?: string
  defaultValue?: unknown
  quiet?: boolean
  retries?: number
  retryDelay?: number
}
```

- [ ] **Step 4: 从 `request()` 方法移除 `showErrorToast` 变量和 `window.$message.error` 调用**

在 `src/services/matrix/MatrixHttpClient.ts` 的 `request()` 方法中：

**删除 `showErrorToast` 变量声明**（Task 2 后约在第 215 行）：
```typescript
    const showErrorToast = requestOptions.showErrorToast ?? false
```

**删除 catch 块中的 `window.$message.error` 调用**（Task 2 后约在第 223-225 行）：
```typescript
          if (showErrorToast && window.$message) {
            window.$message.error(error.message || String(err))
          }
```

修改后 `request()` 方法的重试循环变为：

```typescript
    let retries = requestOptions.retries ?? 0
    const retryDelay = requestOptions.retryDelay ?? 1000

    while (true) {
      try {
        const result = await this._doRequest<T>(method, requestPath, requestOptions)
        return result
      } catch (err: unknown) {
        const error = err as Error & { message?: string }
        // Retry only on network errors or 5xx server errors
        const isRetryable = err instanceof TypeError || error.message?.includes('HTTP 5')
        if (!isRetryable || retries <= 0) {
          throw err
        }
        retries--
        logger.warn(`请求失败，准备重试 (${retries} 次剩余): ${requestPath}`, err)
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    }
```

- [ ] **Step 5: 从 `safeRequest()` 移除 `showErrorToast: !quiet` 映射**

在 `src/services/matrix/MatrixHttpClient.ts` 的 `safeRequest()` 方法中，将：

```typescript
  async safeRequest<T>(
    method: MatrixHttpMethod,
    path: string,
    options: MatrixHttpRequestOptions = {}
  ): Promise<T | null> {
    const { logPrefix = 'MatrixHttpClient', defaultValue = null, quiet = false, throwOnError = false } = options

    const mergedOptions = {
      showErrorToast: !quiet,
      ...options
    }

    try {
      const result = await this.request<T>(method, path, mergedOptions)
      if (!quiet && method !== 'GET') {
        logger.info(`[${logPrefix}] ${method} ${path} 成功`)
      }
      return result
    } catch (err) {
      if (!quiet) {
        logger.error(`[${logPrefix}] ${method} ${path} 失败`, err)
      }
      if (throwOnError) {
        throw err
      }
      return defaultValue as T | null
    }
  }
```

替换为（移除 `mergedOptions` 和 `showErrorToast: !quiet`，直接传递 `options`）：

```typescript
  async safeRequest<T>(
    method: MatrixHttpMethod,
    path: string,
    options: MatrixHttpRequestOptions = {}
  ): Promise<T | null> {
    const { logPrefix = 'MatrixHttpClient', defaultValue = null, quiet = false, throwOnError = false } = options

    try {
      const result = await this.request<T>(method, path, options)
      if (!quiet && method !== 'GET') {
        logger.info(`[${logPrefix}] ${method} ${path} 成功`)
      }
      return result
    } catch (err) {
      if (!quiet) {
        logger.error(`[${logPrefix}] ${method} ${path} 失败`, err)
      }
      if (throwOnError) {
        throw err
      }
      return defaultValue as T | null
    }
  }
```

- [ ] **Step 6: 运行测试验证全部通过**

Run: `npx vitest run src/services/matrix/__tests__/MatrixHttpClient.test.ts`
Expected: PASS（所有测试通过，包括修改后的 2 个 message 测试）

- [ ] **Step 7: 运行全量测试套件验证无回归**

Run: `pnpm test:run`
Expected: PASS（所有测试通过。重点关注 `RoomCapabilitiesService.test.ts`、`MetadataService` 相关测试、`MatrixRoomNotificationService.test.ts`、`MatrixNotificationService.test.ts`）

- [ ] **Step 8: 提交**

```bash
git add src/services/matrix/MatrixHttpClient.ts src/services/matrix/__tests__/MatrixHttpClient.test.ts
git commit -m "refactor(matrix-http-client): remove showErrorToast option and window.\$message side effects"
```

---

## Task 4: 移除死方法 `requestAppResult`

**目的**：`requestAppResult` 方法在整个代码库中无任何调用方（0 处生产代码、0 处测试代码），是完全死代码。移除以减少维护负担。

**Files:**
- Modify: `src/services/matrix/MatrixHttpClient.ts`（删除 `requestAppResult` 方法及相关 import）

**Interfaces:**
- Consumes: 无
- Produces: `MatrixHttpClient` 类不再暴露 `requestAppResult` 方法

- [ ] **Step 1: 确认 `requestAppResult` 无调用方**

运行以下搜索命令确认 0 调用方：

```bash
npx vitest run src/services/matrix/__tests__/MatrixHttpClient.test.ts
```

然后用 Grep 搜索 `requestAppResult`：
- 搜索路径：`src/`
- 期望结果：仅在 `MatrixHttpClient.ts` 中出现（定义处），无其他文件引用

- [ ] **Step 2: 删除 `requestAppResult` 方法**

在 `src/services/matrix/MatrixHttpClient.ts` 中，删除整个 `requestAppResult` 方法（约第 365-376 行）：

```typescript
  /**
   * 发送请求并返回 Result<T, AppError> 格式
   */
  async requestAppResult<T>(
    method: MatrixHttpMethod,
    path: string,
    options: MatrixHttpRequestOptions = {}
  ): Promise<Result<T, AppError>> {
    try {
      const data = await this.request<T>(method, path, options)
      return ok(data)
    } catch (e) {
      return err(toAppError(e))
    }
  }
```

- [ ] **Step 3: 检查并清理因 `requestAppResult` 删除而变为未使用的 import**

删除 `requestAppResult` 后，检查 `MatrixHttpClient.ts` 顶部的 import：

```typescript
import { type AppError, toAppError } from '@/common/errors'
import { err, ok, type Result } from '@/common/result'
```

搜索 `AppError`、`toAppError`、`err`、`ok`、`Result` 在文件剩余代码中的使用：
- 如果 `toAppError`、`err`、`ok`、`Result` 仅被 `requestAppResult` 使用，则删除整行 import
- 如果 `AppError` 仍被其他地方使用，保留对应 import

执行 Grep 搜索：
- 搜索 `toAppError` 在 `MatrixHttpClient.ts` 中的出现次数
- 搜索 `\berr\(` 和 `\bok\(` 在 `MatrixHttpClient.ts` 中的出现次数
- 搜索 `Result<` 在 `MatrixHttpClient.ts` 中的出现次数

若全部为 0，则删除以下两行 import：

```typescript
import { type AppError, toAppError } from '@/common/errors'
import { err, ok, type Result } from '@/common/result'
```

- [ ] **Step 4: 运行测试验证无回归**

Run: `npx vitest run src/services/matrix/__tests__/MatrixHttpClient.test.ts`
Expected: PASS

- [ ] **Step 5: 运行全量类型检查确认无类型错误**

Run: `npx vue-tsc --noEmit`
Expected: PASS（无 TS 错误，确认没有其他文件依赖已删除的方法）

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/MatrixHttpClient.ts
git commit -m "refactor(matrix-http-client): remove dead requestAppResult method"
```

---

## Task 5: 为 `RoomCapabilitiesService` 添加无 UI 副作用的回归测试

**目的**：`RoomCapabilitiesService` 是唯一一个隐式依赖 `showErrorToast` 副作用的生产调用方（通过 `safeRequest` 默认的 `!quiet` 映射）。Task 3 移除副作用后，其行为变为静默失败 + 返回缓存或 `null`（这正是缓存后台刷新场景应有的行为）。添加回归测试固化此正确行为。

**Files:**
- Modify: `src/services/matrix/room/__tests__/RoomCapabilitiesService.test.ts`

**Interfaces:**
- Consumes: Task 3 重构后的 `MatrixHttpClient`（不再触发 UI 副作用）
- Produces: 回归测试验证 `RoomCapabilitiesService` 失败时不操作 `window.$message`

- [ ] **Step 1: 在 `RoomCapabilitiesService.test.ts` 的 `beforeEach` 中添加 `window.$message` mock**

在 `src/services/matrix/room/__tests__/RoomCapabilitiesService.test.ts` 的 `beforeEach` 块内（第 36-39 行），添加：

```typescript
  beforeEach(() => {
    mockAuthedRequest.mockReset()
    roomCapabilitiesService.invalidate()
    vi.stubGlobal('$message', {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    })
  })
```

- [ ] **Step 2: 添加回归测试 — 验证网络失败时不弹错误 toast**

在 `src/services/matrix/room/__tests__/RoomCapabilitiesService.test.ts` 的 `describe` 块内最后一个 `it` 之后添加：

```typescript
  it('网络失败时不调用 window.$message.error（无 UI 副作用）', async () => {
    mockAuthedRequest.mockRejectedValueOnce(new Error('network down'))

    const result = await roomCapabilitiesService.getCapabilities('!fail:server')

    expect(result).toBeNull()
    expect(window.$message.error).not.toHaveBeenCalled()
  })

  it('网络失败后沿用既有缓存', async () => {
    // 第一次请求成功，填充缓存
    mockAuthedRequest.mockResolvedValueOnce({
      room_id: '!cache-fallback:server',
      room_version: '10'
    })
    await roomCapabilitiesService.getCapabilities('!cache-fallback:server')

    // 第二次请求（force=true）失败，应沿用缓存
    mockAuthedRequest.mockRejectedValueOnce(new Error('boom'))
    const result = await roomCapabilitiesService.getCapabilities('!cache-fallback:server', { force: true })

    expect(result?.room_version).toBe('10')
    expect(window.$message.error).not.toHaveBeenCalled()
  })
```

- [ ] **Step 3: 运行测试验证通过**

Run: `npx vitest run src/services/matrix/room/__tests__/RoomCapabilitiesService.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add src/services/matrix/room/__tests__/RoomCapabilitiesService.test.ts
git commit -m "test(room-capabilities): add regression tests for no UI side effects on failure"
```

---

## Task 6: 最终验证与清理

**目的**：全量回归测试 + 类型检查 + lint，确认重构无副作用扩散。

**Files:**
- 无文件修改（仅验证）

- [ ] **Step 1: 运行 MatrixHttpClient 相关全部测试**

Run: `npx vitest run src/services/matrix/__tests__/MatrixHttpClient.test.ts src/services/matrix/room/__tests__/RoomCapabilitiesService.test.ts src/services/matrix/notifications/__tests__/MatrixNotificationService.test.ts src/services/matrix/room/__tests__/MetadataService.test.ts`
Expected: PASS（所有测试通过）

- [ ] **Step 2: 运行全量测试套件**

Run: `pnpm test:run`
Expected: PASS（所有测试通过，无回归）

- [ ] **Step 3: 运行类型检查**

Run: `npx vue-tsc --noEmit`
Expected: PASS（无 TS 错误）

- [ ] **Step 4: 运行 lint 检查**

Run: `npx biome check src/services/matrix/MatrixHttpClient.ts src/services/matrix/__tests__/MatrixHttpClient.test.ts src/services/matrix/room/__tests__/RoomCapabilitiesService.test.ts`
Expected: PASS（无 lint 错误）

- [ ] **Step 5: 验证 `MatrixHttpClient.ts` 中不再包含 `window.$loadingBar` 或 `window.$message` 引用**

用 Grep 搜索 `src/services/matrix/MatrixHttpClient.ts`：
- 搜索 pattern: `window\.\$loadingBar|window\.\$message`
- 期望结果: 0 匹配

- [ ] **Step 6: 最终提交（如有 lint 自动修复）**

```bash
git status
# 如果有未提交的变更：
git add -A
git commit -m "chore(matrix-http-client): final lint cleanup"
```

---

## Out of Scope（不在本计划范围内）

以下问题与 `MatrixHttpClient` UI 副作用相关但不在本重构计划范围内，建议作为独立后续任务处理：

### `messageLoading.ts` 直接操作 `window.$loadingBar`

**文件**：`src/stores/domains/chat/chat/messageLoading.ts`
**位置**：第 63-64、100-101、105-106 行
**现状**：`getPageMsg` 函数在 `showLoadingBar=true` 时直接调用 `window.$loadingBar.start()` / `finish()` / `error()`。这是 `MatrixHttpClient` 之外、代码库中唯一一处由业务代码直接操控全局 loading bar 的位置。
**建议**：将 loading bar 操控迁移到 `useActionFeedback` composable（需先扩展 `useActionFeedback` 暴露 `startProgress` / `finishProgress` / `errorProgress` 方法），或迁移到调用 `messageLoading` 的 Vue 组件层。这是独立的 UI 重构任务，不应与 `MatrixHttpClient` 重构耦合。

### `authGuard.ts` 直接操作 `window.$message`

**文件**：`src/router/authGuard.ts:68`
**现状**：`window.$message?.warning(i18n.t('error.matrix.forbidden'))`
**建议**：路由守卫中使用 `useActionFeedback` 需要处理 Vue 上下文问题，属于独立重构任务。

---

## Self-Review

### 1. Spec coverage（规格覆盖）

| 需求 | 对应 Task |
|------|-----------|
| 移除 `window.$loadingBar` 副作用 | Task 2（移除 `showLoading` 选项及 3 处 `$loadingBar` 调用） |
| 移除 `window.$message` 副作用 | Task 3（移除 `showErrorToast` 选项及 `$message.error` 调用 + `safeRequest` 映射） |
| 移除死代码 | Task 4（移除 0 调用方的 `requestAppResult`） |
| 验证调用方无回归 | Task 5（`RoomCapabilitiesService` 回归测试）+ Task 6（全量测试） |
| 保持 `quiet` 选项的日志行为 | Task 3 Step 5（`safeRequest` 保留 `quiet` 控制 `logger.info/error`，仅移除 `showErrorToast` 映射） |

### 2. Placeholder scan（占位符扫描）

✅ 无 "TBD"、"TODO"、"implement later"、"add appropriate error handling" 等占位符
✅ 所有代码步骤包含完整代码块
✅ 所有测试步骤包含完整测试代码

### 3. Type consistency（类型一致性）

✅ `MatrixHttpRequestOptions` 在 Task 2 移除 `showLoading`，Task 3 移除 `showErrorToast`，最终接口字段一致
✅ `request()` 方法签名在所有 Task 中保持不变
✅ `safeRequest()` 方法签名在所有 Task 中保持不变
✅ Task 1-5 中测试使用的 `matrixHttpClient.request()` / `.get()` / `.safeRequest()` 调用方式与现有代码一致
