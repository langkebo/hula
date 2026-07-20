# 性能审计修复实施计划（Performance Audit Fixes）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 2026-07-17 偏执型性能审计的全部 18 项发现（5 项已 AUTO-FIX，本计划覆盖剩余 8 critical + 10 informational）。

**Architecture:** 按「构建配置 → token 刷新链 → 分片上传接线 → 安全/启动 → worker 健壮性 → 移动端渲染 → 并发防护」顺序推进；每个任务独立可测试、独立提交。TDD：先写失败测试再实现。

**Tech Stack:** Vue 3 + TypeScript + Vitest（happy-dom）+ matrix-js-sdk（link:../matrix-js-sdk）+ Vant + Tauri v2。

## Global Constraints

- 回复与文档用简体中文；代码注释仅在 WHY 非显然时添加；不用 emoji。
- 不给未用变量加下划线前缀——直接删除。
- 每个任务收尾必须通过：`pnpm vitest run <本任务测试>`；最终任务跑 `npx vue-tsc --noEmit` + `pnpm check`。
- Matrix SDK 调用只能经 `src/services/matrix/` 服务层；组件不得直接 import matrix-js-sdk。
- 提交用普通 `git commit`（不走 pnpm commit 交互）；只 add 本任务涉及的文件——工作树中存在大量他人在途改动，严禁 `git add -A`。
- homeserver URL（`.env` 的 `VITE_HOMESERVER_URL="https://matrix.test"`）无尾斜杠——所有 URL 拼接必须用 `new URL(path, base)`。
- vitest 只收集 `src/**` 下的测试文件（vitest.config.ts include）。

---

### Task 1: manualChunks——修复 matrix-js-sdk 分块规则失效

**背景：** SDK 经 vite alias（build/config/vite.config.base.ts:23-74）解析到 `../matrix-js-sdk/src/` 真实路径（不含 `node_modules`），现有规则 `'node_modules/matrix-js-sdk': 'matrix-sdk'` 永不命中，SDK 全量落入 Rollup 默认分块。

**Files:**
- Modify: `build/config/chunks.ts:22-29`
- Test: `src/__tests__/manualChunks.test.ts`（新建）

**Interfaces:**
- Produces: `createManualChunks(deps)(id)` 对 `/matrix-js-sdk/src/**` 路径返回 `'matrix-sdk'`（后续无任务依赖，仅构建产物变化）

- [ ] **Step 1: 写失败测试**

```ts
// src/__tests__/manualChunks.test.ts
import { describe, expect, it } from 'vitest'
import { createManualChunks } from '~/build/config/chunks'

describe('createManualChunks', () => {
  const chunker = createManualChunks([])

  it('link 版 matrix-js-sdk 源码路径归入 matrix-sdk chunk', () => {
    expect(chunker('/Users/ci/work/matrix-js-sdk/src/client.ts')).toBe('matrix-sdk')
    expect(chunker('/Users/ci/work/matrix-js-sdk/src/http-api/index.ts')).toBe('matrix-sdk')
  })

  it('npm 安装形态仍然命中', () => {
    expect(chunker('/repo/node_modules/matrix-js-sdk/lib/index.js')).toBe('matrix-sdk')
  })

  it('本项目 src 路径不受影响', () => {
    expect(chunker('/Users/ci/work/hula/src/services/matrix/MatrixClientService.ts')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/__tests__/manualChunks.test.ts`
Expected: FAIL——第一个用例返回 `undefined` 而非 `'matrix-sdk'`

- [ ] **Step 3: 修改 chunks.ts**

在 `manualChunkConfig` 的 `// Matrix SDK 相关` 段首行（`'node_modules/matrix-js-sdk'` 之前）插入：

```ts
  // Matrix SDK 相关
  // link:../matrix-js-sdk 经 vite alias 解析为仓库外真实路径,不含 node_modules
  '/matrix-js-sdk/src/': 'matrix-sdk',
  'node_modules/matrix-js-sdk': 'matrix-sdk',
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/__tests__/manualChunks.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: （可选但推荐）产物验证**

Run: `pnpm metrics:bundle`
Expected: 输出中出现独立的 `matrix-sdk-*.js` chunk 且体积显著（数百 KB 级）；主入口 chunk 相应缩小。若该命令耗时过长可跳过，留待最终任务。

- [ ] **Step 6: Commit**

```bash
git add build/config/chunks.ts src/__tests__/manualChunks.test.ts
git commit -m "fix: match linked matrix-js-sdk real path in manualChunks"
```

---

### Task 2: TokenManager——刷新成功后更新活跃客户端 access token

**背景：** `MatrixTokenManager.refresh`（src/services/matrix/MatrixTokenManager.ts:72-79）与 `MatrixClientService.loginWithToken`（:597-603）刷新后只调 `persistRefreshedToken`（写 SQLite），从不调 `client.setAccessToken()`（SDK 存在此 API：../matrix-js-sdk/src/client.ts:3275）。活客户端持续用旧 token 直到重启。

**Files:**
- Modify: `src/services/matrix/MatrixTokenManager.ts:72-79`
- Modify: `src/services/matrix/MatrixClientService.ts:597-615`
- Test: `src/services/matrix/__tests__/MatrixTokenManager.test.ts`（追加）

**Interfaces:**
- Consumes: `MatrixClient.setAccessToken(token: string): void`（SDK 已有）
- Produces: 刷新成功后 `client.setAccessToken(newAccessToken)` 必然被调用；`loginWithToken` 返回值 `accessToken` 为实际生效的 token

- [ ] **Step 1: 写失败测试（追加到 MatrixTokenManager.test.ts）**

该文件已有 `createMockClient` 工厂（支持 overrides）与 `persistRefreshedTokenMock`。追加：

```ts
  it('refresh 成功后更新活跃客户端的 access token', async () => {
    const request = vi.fn().mockResolvedValue({
      access_token: 'at-new',
      refresh_token: 'rt-new',
      expires_in_ms: 3600000
    })
    const setAccessToken = vi.fn()
    const client = createMockClient({ http: { request }, setAccessToken })

    manager.schedule(client, 'rt-old', 120000)
    await vi.advanceTimersByTimeAsync(60000)

    expect(setAccessToken).toHaveBeenCalledWith('at-new')
    expect(persistRefreshedTokenMock).toHaveBeenCalledWith('@user:example.com', 'at-new', 'rt-new')
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixTokenManager.test.ts`
Expected: FAIL——`setAccessToken` 未被调用

- [ ] **Step 3: 修改 MatrixTokenManager.refresh**

将 `if (newAccessToken) {` 块改为（在持久化之前先更新活客户端）：

```ts
      if (newAccessToken) {
        client.setAccessToken(newAccessToken)
        const uid = client.getUserId()
        if (uid) {
          await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? '')
        }
        logger.info('[TokenRefresh] Access token refreshed successfully')
        this.schedule(client, newRefreshToken ?? refreshToken, newExpiresInMs ?? 0)
      }
```

- [ ] **Step 4: 修改 MatrixClientService.loginWithToken 刷新分支**

`if (newAccessToken && newExpiresInMs && newExpiresInMs > 0) {` 块内首行加 `this.client.setAccessToken(newAccessToken)`，并让返回值反映生效 token。完整改后（:582-615 区域）：

```ts
      let activeAccessToken = token
      if (refreshToken) {
        try {
          if (this.client) {
            const refreshResult = (await this.client.http.request('POST', '/refresh', undefined, {
              refresh_token: refreshToken
            })) as Record<string, unknown>

            const newAccessToken = refreshResult.access_token as string | undefined
            const newRefreshToken = refreshResult.refresh_token as string | undefined
            let newExpiresInMs = refreshResult.expires_in_ms as number | undefined
            const expiresInSec = refreshResult.expires_in as number | undefined
            if (!newExpiresInMs && expiresInSec) {
              newExpiresInMs = expiresInSec * 1000
            }

            if (newAccessToken && newExpiresInMs && newExpiresInMs > 0) {
              this.client.setAccessToken(newAccessToken)
              activeAccessToken = newAccessToken
              const uid = this.client.getUserId()
              if (uid) {
                await persistRefreshedToken(uid, newAccessToken, newRefreshToken ?? refreshToken)
              }
              this.tokenManager.schedule(this.client, newRefreshToken ?? refreshToken, newExpiresInMs)
            }
          }
        } catch {
          // 服务器不支持 refresh 或刷新失败，不影响登录
        }
      }

      return {
        success: true,
        userId: userId,
        deviceId: resolvedDeviceId,
        accessToken: activeAccessToken
      }
```

- [ ] **Step 5: 运行确认通过（含既有契约测试无回归）**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixTokenManager.test.ts src/services/matrix/__tests__/tokenRefresh.contract.test.ts`
Expected: PASS 全绿

- [ ] **Step 6: Commit**

```bash
git add src/services/matrix/MatrixTokenManager.ts src/services/matrix/MatrixClientService.ts src/services/matrix/__tests__/MatrixTokenManager.test.ts
git commit -m "fix: apply refreshed access token to live client, not just SQLite"
```

---

### Task 3: TokenManager——网络错误重试而非强制登出

**背景：** MatrixTokenManager.ts:92-98 对非 404/429 的一切错误调 `logoutExpiredSession()`。离线/超时时 `err.httpStatus` 为 `undefined`，弱网瞬断即被登出。

**Files:**
- Modify: `src/services/matrix/MatrixTokenManager.ts:80-98`
- Test: `src/services/matrix/__tests__/MatrixTokenManager.test.ts`（追加）

**Interfaces:**
- Produces: `httpStatus === undefined`（网络层错误）→ 30 秒后重试，不登出；有 httpStatus 的 4xx/5xx（非 404/429）仍走登出

- [ ] **Step 1: 写失败测试**

```ts
  it('网络错误(无 httpStatus)时安排 30s 重试且不登出', async () => {
    const request = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const client = createMockClient({ http: { request } })

    manager.schedule(client, 'rt1', 120000)
    await vi.advanceTimersByTimeAsync(60000)

    expect(logoutExpiredSessionMock).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })

  it('401(token 失效)仍触发登出清理', async () => {
    const request = vi.fn().mockRejectedValue(Object.assign(new Error('unknown token'), { httpStatus: 401 }))
    const client = createMockClient({ http: { request } })

    manager.schedule(client, 'rt1', 120000)
    await vi.advanceTimersByTimeAsync(60000)

    expect(logoutExpiredSessionMock).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: 运行确认第一个新用例失败**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixTokenManager.test.ts`
Expected: FAIL——网络错误用例中 `logoutExpiredSession` 被调用

- [ ] **Step 3: 在 429 分支之后插入网络错误分支**

```ts
      if (httpStatus === 429) {
        logger.warn('[TokenRefresh] Rate limited (429), retrying in 30s')
        this.schedule(client, refreshToken, 30000)
        return
      }
      if (httpStatus === undefined) {
        logger.warn(`[TokenRefresh] Network error during refresh, retrying in 30s: ${err}`)
        this.schedule(client, refreshToken, 30000)
        return
      }
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixTokenManager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/matrix/MatrixTokenManager.ts src/services/matrix/__tests__/MatrixTokenManager.test.ts
git commit -m "fix: retry token refresh on network errors instead of forcing logout"
```

---

### Task 4: token 过期时间单位归一 + 删除死代码 refreshAccessToken

**背景：** 三处问题——(a) `MatrixClientService.login`（:459、:534）读 `loginResponse.expires_in`，Matrix 规范字段是 `expires_in_ms`；(b) TokenManager `expiresInMs < 1000 ? *1000` 启发式对 `3600`（秒）失效，导致 30 秒即刷新；(c) `MatrixAuthService.refreshAccessToken`（auth/MatrixAuthService.ts:871）零调用者。

**Files:**
- Modify: `src/services/matrix/MatrixClientService.ts:459-461, 534-536`
- Modify: `src/services/matrix/MatrixTokenManager.ts:18-29`
- Modify: `src/services/matrix/auth/MatrixAuthService.ts:871-约895`（删除方法）
- Test: `src/services/matrix/__tests__/MatrixTokenManager.test.ts`（追加）

**Interfaces:**
- Produces: `MatrixTokenManager.schedule(client, refreshToken, expiresInMs)` 只接受毫秒（去掉单位猜测）；调用方负责归一。归一表达式统一为：`expires_in_ms ?? (expires_in ? expires_in * 1000 : 0)`

- [ ] **Step 1: 写失败测试（schedule 不再猜单位）**

```ts
  it('schedule 只按毫秒解释 expiresInMs(不再把小值当秒)', async () => {
    const request = vi.fn().mockResolvedValue({ access_token: 'x' })
    const client = createMockClient({ http: { request }, setAccessToken: vi.fn() })

    // 600ms 的过期时间 → refreshAt = max(600-60000, 30000) = 30000
    manager.schedule(client, 'rt1', 600)
    await vi.advanceTimersByTimeAsync(29999)
    expect(request).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(request).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixTokenManager.test.ts`
Expected: FAIL——旧启发式把 600 当秒（600000ms），30000ms 处不触发……实际旧逻辑 refreshAt=540000，30000ms 时 request 未被调用导致最后断言失败

- [ ] **Step 3: 修改 TokenManager.schedule**

```ts
  schedule(client: MatrixClient, refreshToken: string, expiresInMs: number): void {
    this.clear()
    if (!refreshToken || expiresInMs <= 0) return

    const refreshAt = Math.max(expiresInMs - 60000, 30000)
    logger.info(`[TokenRefresh] Scheduled refresh in ${refreshAt}ms (expiresInMs=${expiresInMs})`)

    this.timer = setTimeout(() => {
      void this.refresh(client, refreshToken)
    }, refreshAt)
  }
```

同时把 `refresh()` 内 `this.schedule(client, newRefreshToken ?? refreshToken, newExpiresInMs ?? 0)` 改为显式分支：

```ts
        if (newExpiresInMs && newExpiresInMs > 0) {
          this.schedule(client, newRefreshToken ?? refreshToken, newExpiresInMs)
        } else {
          logger.info('[TokenRefresh] Server returned no expiry, auto-refresh chain stops')
        }
```

- [ ] **Step 4: 修改 MatrixClientService.login 两处调度（:459 与 :534，代码相同）**

```ts
      const expiresInMs =
        (loginResponse as { expires_in_ms?: number }).expires_in_ms ??
        (loginResponse.expires_in ? loginResponse.expires_in * 1000 : 0)
      if (loginResponse.refresh_token && expiresInMs > 0) {
        this.tokenManager.schedule(this.client!, loginResponse.refresh_token, expiresInMs)
      }
```

- [ ] **Step 5: 删除 MatrixAuthService.refreshAccessToken**

先确认零引用：`grep -rn "refreshAccessToken" src/ | grep -v __tests__` 应只剩定义本身。删除 auth/MatrixAuthService.ts:871 起的整个 `static async refreshAccessToken(...)` 方法（含其 JSDoc）。若 `grep -rn "refreshAccessToken" src/**/__tests__/` 命中测试断言，删除对应测试块。

- [ ] **Step 6: 运行验证**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixTokenManager.test.ts src/services/matrix/auth src/services/matrix/__tests__/tokenRefresh.contract.test.ts`
Expected: PASS 全绿

- [ ] **Step 7: Commit**

```bash
git add src/services/matrix/MatrixTokenManager.ts src/services/matrix/MatrixClientService.ts src/services/matrix/auth/MatrixAuthService.ts src/services/matrix/__tests__/MatrixTokenManager.test.ts
git commit -m "fix: normalize token expiry units at call sites and drop dead refreshAccessToken"
```

---

### Task 5: ChunkUploadService——修复 URL 拼接、失败即停、pause 生效

**背景：** `${baseUrl}_matrix/...`（ChunkUploadService.ts:129/230/268/295/320）在无尾斜杠 baseUrl 下产生 `https://matrix.test_matrix/...` 非法主机名；chunk 重试耗尽后其余 worker 继续空跑；`pause()` 设置的 `context.paused` 无人读取。

**Files:**
- Modify: `src/services/performance/ChunkUploadService.ts`
- Test: `src/services/performance/__tests__/ChunkUploadService.test.ts`（新建）

**Interfaces:**
- Produces: `chunkUploadService.upload(options: ChunkUploadOptions): Promise<UploadResult>`（签名不变，URL 修复）；Task 6 消费 `UploadResult.mxcUrl`
- 内部新增 `chunkEndpoint(path: string, params?: URLSearchParams): string`

- [ ] **Step 1: 写失败测试**

```ts
// src/services/performance/__tests__/ChunkUploadService.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/matrixClientAccessor', () => ({
  getMatrixAccessToken: () => 'tok-1',
  getMatrixHomeserverUrl: () => 'https://matrix.test'
}))
vi.mock('@/services/backend/config', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({ homeserverUrl: 'https://matrix.test' })
}))

import chunkUploadService from '../ChunkUploadService'

class FakeXHR {
  static instances: FakeXHR[] = []
  static failuresRemaining = 0
  upload = { onprogress: null as null | ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) }
  status = 200
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  url = ''
  open(_method: string, url: string) {
    this.url = url
  }
  setRequestHeader() {}
  send() {
    FakeXHR.instances.push(this)
    if (FakeXHR.failuresRemaining > 0) {
      FakeXHR.failuresRemaining--
      this.status = 500
    }
    queueMicrotask(() => this.onload?.())
  }
}

const fetchMock = vi.fn()

const okJson = (body: unknown) =>
  ({ ok: true, json: async () => body, text: async () => '' }) as unknown as Response

beforeEach(() => {
  FakeXHR.instances = []
  FakeXHR.failuresRemaining = 0
  fetchMock.mockReset()
  vi.stubGlobal('XMLHttpRequest', FakeXHR)
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const makeFile = () => new File([new Uint8Array(10)], 'big.bin', { type: 'application/octet-stream' })

describe('ChunkUploadService', () => {
  it('start/complete 端点 URL 含合法主机与 /_matrix 前缀', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ upload_id: 'u1', chunk_size_limit: 1, max_file_size: 1 }))
      .mockResolvedValueOnce(okJson({ content_uri: 'mxc://hs/x', size: 10 }))

    const result = await chunkUploadService.upload({ file: makeFile(), chunkSize: 10 })

    expect(fetchMock.mock.calls[0][0]).toBe('https://matrix.test/_matrix/media/v1/upload/chunk/start')
    expect(fetchMock.mock.calls[1][0]).toBe('https://matrix.test/_matrix/media/v1/upload/chunk/complete')
    expect(FakeXHR.instances[0].url).toContain('https://matrix.test/_matrix/media/v1/upload/chunk?')
    expect(result.mxcUrl).toBe('mxc://hs/x')
  })

  it('chunk 重试耗尽后上传失败并调用 cancel 端点', async () => {
    fetchMock
      .mockResolvedValueOnce(okJson({ upload_id: 'u2', chunk_size_limit: 1, max_file_size: 1 }))
      .mockResolvedValueOnce(okJson({}))
    FakeXHR.failuresRemaining = 99

    await expect(chunkUploadService.upload({ file: makeFile(), chunkSize: 10, maxRetries: 2 })).rejects.toThrow()

    expect(fetchMock.mock.calls[1][0]).toBe('https://matrix.test/_matrix/media/v1/upload/chunk/cancel')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/services/performance/__tests__/ChunkUploadService.test.ts`
Expected: FAIL——URL 为 `https://matrix.test_matrix/...`

- [ ] **Step 3: 实现修复**

在 `getAuthHeaders` 之后加辅助函数，并替换 5 处 URL 拼接：

```ts
function chunkEndpoint(path: string, params?: URLSearchParams): string {
  const url = new URL(`/_matrix/media/v1/upload/chunk${path}`, getBaseUrl())
  if (params) url.search = params.toString()
  return url.toString()
}
```

- `startUpload`: `fetch(chunkEndpoint('/start'), ...)`
- `uploadChunk`: `xhr.open('POST', chunkEndpoint('', params))`
- `completeUpload`: `fetch(chunkEndpoint('/complete'), ...)`
- `cancelUpload`: `fetch(chunkEndpoint('/cancel'), ...)`
- `getProgress`: `fetch(chunkEndpoint('/progress', new URLSearchParams({ upload_id: uploadId })), { headers: getAuthHeaders() })`

`processNext` 循环改为（失败即停 + pause 生效）：

```ts
    const processNext = async () => {
      while (!context.aborted) {
        if (context.paused) {
          await new Promise((resolve) => setTimeout(resolve, 200))
          continue
        }
        const chunk = context.chunks.find((c) => c.status === 'pending')
        if (!chunk) break

        chunk.status = 'uploading'

        try {
          await this.uploadChunk(context, chunk)
          chunk.status = 'completed'
          context.onChunkComplete?.(chunk.index, context.totalChunks)
        } catch (err) {
          chunk.retryCount++
          if (chunk.retryCount >= context.maxRetries) {
            chunk.status = 'failed'
            context.aborted = true
            throw err
          }
          // 指数退避,避免立即重试打爆服务器
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (chunk.retryCount - 1)))
          chunk.status = 'pending'
        }
      }
    }
```

注意 `processUpload` 末尾 `if (context.aborted) throw new Error('Upload aborted')` 与 `Promise.all` 的关系：重试耗尽时 `Promise.all` 已 reject，外层 `upload()` 的 catch 负责 cancel——保持不变。

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/services/performance/__tests__/ChunkUploadService.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/services/performance/ChunkUploadService.ts src/services/performance/__tests__/ChunkUploadService.test.ts
git commit -m "fix: build valid chunk upload URLs, stop workers on retry exhaustion, honor pause"
```

---

### Task 6: MatrixMediaService——接线 413 → 分片上传回退

**背景：** 上传主链路 `client.uploadContent` 遇 413/`M_TOO_LARGE` 直接抛错；ChunkUploadService 修好后在此接线。

**Files:**
- Modify: `src/services/matrix/media/MatrixMediaService.ts`（uploadFile/uploadImage/uploadVideo/uploadAudio/uploadEncryptedFile，:162-310 区域）
- Test: `src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts`（新建）

**Interfaces:**
- Consumes: Task 5 的 `chunkUploadService.upload({ file, onProgress }) → Promise<{ mxcUrl: string; ... }>`
- Produces: 各 uploadXxx 签名与返回类型不变；413 时透明回退

- [ ] **Step 1: 写失败测试**

```ts
// src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { uploadContentMock, chunkUploadMock } = vi.hoisted(() => ({
  uploadContentMock: vi.fn(),
  chunkUploadMock: vi.fn()
}))

vi.mock('../../MatrixClientService', () => {
  const svc = {
    getClient: () => ({
      uploadContent: uploadContentMock,
      mxcUrlToHttp: () => null,
      http: { authedRequest: vi.fn() }
    }),
    getTelemetry: () => null
  }
  return { default: svc, matrixClientService: svc }
})

vi.mock('@/services/performance/ChunkUploadService', () => ({
  chunkUploadService: { upload: chunkUploadMock },
  default: { upload: chunkUploadMock }
}))

import { matrixMediaService } from '../MatrixMediaService'

const bigFile = new File([new Uint8Array(8)], 'big.bin', { type: 'application/octet-stream' })

describe('MatrixMediaService 413 分片回退', () => {
  beforeEach(() => {
    uploadContentMock.mockReset()
    chunkUploadMock.mockReset()
  })

  it('uploadFile 遇 413 回退分片上传并返回其 mxcUrl', async () => {
    uploadContentMock.mockRejectedValueOnce(Object.assign(new Error('too large'), { httpStatus: 413 }))
    chunkUploadMock.mockResolvedValueOnce({ mxcUrl: 'mxc://hs/chunked', filename: 'big.bin', size: 8, mimeType: 'application/octet-stream' })

    const result = await matrixMediaService.uploadFile(bigFile)

    expect(chunkUploadMock).toHaveBeenCalledTimes(1)
    expect(result.contentUri).toBe('mxc://hs/chunked')
  })

  it('errcode M_TOO_LARGE 同样触发回退', async () => {
    uploadContentMock.mockRejectedValueOnce(Object.assign(new Error('too large'), { errcode: 'M_TOO_LARGE' }))
    chunkUploadMock.mockResolvedValueOnce({ mxcUrl: 'mxc://hs/chunked2', filename: 'big.bin', size: 8, mimeType: 'application/octet-stream' })

    const result = await matrixMediaService.uploadFile(bigFile)
    expect(result.contentUri).toBe('mxc://hs/chunked2')
  })

  it('非 413 错误原样抛出且不触发分片', async () => {
    uploadContentMock.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { httpStatus: 403 }))

    await expect(matrixMediaService.uploadFile(bigFile)).rejects.toThrow('forbidden')
    expect(chunkUploadMock).not.toHaveBeenCalled()
  })
})
```

注意：`vi.mock('../../MatrixClientService', ...)` 的相对路径以 MatrixMediaService.ts 内实际 import 为准（执行时先 `grep -n "MatrixClientService" src/services/matrix/media/MatrixMediaService.ts` 核对，若是 `../MatrixClientService` 则同步调整 mock 路径）。若 uploadImage 压缩链（compressImage）干扰，仅测 uploadFile 即可覆盖 helper。

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts`
Expected: FAIL——413 时直接 rejects，chunkUploadMock 未被调用

- [ ] **Step 3: 实现 helper 并接入 5 个上传方法**

在 MatrixMediaService 类内新增：

```ts
  private isPayloadTooLarge(err: unknown): boolean {
    const e = err as { httpStatus?: number; errcode?: string }
    return e?.httpStatus === 413 || e?.errcode === 'M_TOO_LARGE'
  }

  private async uploadContentWithChunkFallback(
    client: MatrixClient,
    file: File,
    opts: ReturnType<MatrixMediaService['createUploadOptions']>,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      const uploadResponse = await client.uploadContent(file, opts)
      return typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
    } catch (err) {
      if (!this.isPayloadTooLarge(err)) throw err
      logger.warn(`[MatrixMedia] 上传返回 413,回退到分片上传: ${file.name}`)
      const result = await chunkUploadService.upload({
        file,
        onProgress: (p) => onProgress?.(p.percentage)
      })
      return result.mxcUrl
    }
  }
```

文件头加 `import { chunkUploadService } from '@/services/performance/ChunkUploadService'`。

各方法替换（以 uploadFile 为例，其余同构）：

```ts
      const contentUri = await this.uploadContentWithChunkFallback(
        client,
        file,
        this.createUploadOptions(file.type, onProgress, file.name),
        onProgress
      )
      logger.info(`[MatrixMedia] 文件上传成功: ${contentUri}`)
```

- uploadImage：第一个参数传 `fileToUpload`（压缩后）
- uploadVideo/uploadAudio：同 uploadFile
- uploadEncryptedFile：先包一层 File 再走 helper：

```ts
      const encryptedBlobFile = new File([encryptedPayload.encryptedData as unknown as BlobPart], file.name, {
        type: 'application/octet-stream'
      })
      const contentUri = await this.uploadContentWithChunkFallback(
        client,
        encryptedBlobFile,
        this.createUploadOptions('application/octet-stream', onProgress, file.name, false),
        onProgress
      )
```

`uploadBlob`（语音，小文件）不接回退，保持原状。

- [ ] **Step 4: 运行确认通过 + 既有媒体测试无回归**

Run: `pnpm vitest run src/services/matrix/media`
Expected: PASS 全绿

- [ ] **Step 5: Commit**

```bash
git add src/services/matrix/media/MatrixMediaService.ts src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts
git commit -m "feat: fall back to chunked upload on 413/M_TOO_LARGE in media uploads"
```

---

### Task 7: index.html——收紧 CSP、外置错误捕获脚本、移除过早的 hide_splash_screen

**背景：** CSP script-src 被降级为 `'unsafe-eval' 'unsafe-inline'`（为内联调试脚本让路）；内联脚本在解析时立即 `invoke('hide_splash_screen')`（main.ts:33 已有正式调用点）。方案：错误捕获脚本移到 `public/error-capture.js`（`script-src 'self'` 覆盖，无需 hash/unsafe-inline），恢复 `'wasm-unsafe-eval'`。

**Files:**
- Create: `public/error-capture.js`
- Modify: `index.html`（CSP meta + script 引用）

**Interfaces:**
- Produces: 全局 error/unhandledrejection 上报行为不变（经 `window.__TAURI__.core.invoke('set_complete', ...)`）；COEP/COOP 保持移除（WKWebView 兼容）

- [ ] **Step 1: 创建 public/error-capture.js**

把 index.html 内联脚本中除 `hide_splash_screen` 块外的内容原样迁移：

```js
// Global error capture - report via Tauri IPC
var _errorReporting = false;
var _report = function (tag, msg) {
  if (window.__TAURI__ && !_errorReporting) {
    _errorReporting = true;
    try {
      var p = window.__TAURI__.core.invoke('set_complete', { task: tag + ': ' + String(msg).slice(0, 200) });
      if (p && typeof p.catch === 'function') p.catch(function () {});
    } catch (e) {} finally {
      _errorReporting = false;
    }
  }
};
window.addEventListener(
  'error',
  function (e) {
    if (e.target && e.target.tagName === 'SCRIPT') {
      _report('MOD-LOAD-ERR', (e.target.src || 'inline') + ' | ' + (e.message || ''));
    } else if (e.message && e.message.indexOf('Importing a module script failed') !== -1) {
      _report('MOD-IMPORT-FAIL', 'file=' + (e.filename || '?') + ' msg=' + (e.message || ''));
    } else {
      _report('JS-RUNTIME-ERROR', e.message + ' ' + e.filename + ':' + e.lineno + ':' + e.colno);
    }
  },
  true
);
window.addEventListener('unhandledrejection', function (e) {
  var reason = e.reason;
  var detail = '';
  if (reason && typeof reason === 'object') {
    detail = 'msg=' + (reason.message || '') + ' stack=' + String(reason.stack || '').slice(0, 200);
  } else {
    detail = String(reason);
  }
  _report('UNHANDLED-REJ', detail.slice(0, 250));
});
```

（注意：不迁移 `if (window.__TAURI__) { hide_splash_screen }` 块——直接删除，main.ts:33 已在应用启动时调用。）

- [ ] **Step 2: 修改 index.html**

删除整段内联 `<script>...</script>`，替换为：

```html
    <script src="/error-capture.js"></script>
    <script type="module" src="/src/main.ts"></script>
```

CSP meta 中 `script-src` 改回：

```
script-src 'self' 'wasm-unsafe-eval' https://localhost:* http://localhost:* http://127.0.0.1:* https://repo.huaweicloud.com:*;
```

（其余指令不动；COEP/COOP 注释保留。）

- [ ] **Step 3: 验证**

Run: `grep -c "unsafe-eval\|unsafe-inline" index.html`
Expected: 输出 `1`（仅剩 style-src 的 'unsafe-inline'，script-src 已无）。
Run: `pnpm dev` 打开 http://localhost:6130，控制台无 CSP 违规、无 error-capture.js 404，页面正常渲染后 Ctrl-C。

- [ ] **Step 4: Commit**

```bash
git add index.html public/error-capture.js
git commit -m "fix: restore strict CSP by externalizing error capture script"
```

---

### Task 8: MatrixWorkerHost——error/messageerror 处理与 readyPromise reject

**背景：** MatrixWorkerHost.ts:80-91 只监听 message；worker 加载失败时 `readyPromise` 永不 settle，pending 请求永久挂起；`terminate()`（:276-289）不 reject 未决的 readyPromise。

**Files:**
- Modify: `src/services/matrix/MatrixWorkerHost.ts:45-91, 276-289`
- Test: `src/services/matrix/__tests__/MatrixWorkerHost.test.ts`（追加；FakeWorker 已有 listeners Map，新增 emitError 辅助）

**Interfaces:**
- Produces: worker error → `start()` 返回的 Promise reject、所有 pending reject、`isStarted` 变 false、可重新 `start()`

- [ ] **Step 1: FakeWorker 增加 emitError（测试文件内，emit 方法旁）**

```ts
  emitError(message = 'worker boom') {
    const evt = { message } as unknown as Event
    for (const cb of this.listeners.get('error') ?? []) cb(evt)
  }
```

- [ ] **Step 2: 写失败测试（追加 describe）**

```ts
describe('worker 错误处理', () => {
  it('worker error 使 start() reject 且 pending 请求全部失败', async () => {
    const worker = new FakeWorker()
    const host = new MatrixWorkerHost(() => worker as unknown as Worker)

    const ready = host.start()
    const readyOutcome = ready.catch((e: Error) => e)
    const pingOutcome = host.ping().catch((e: Error) => e)

    worker.emitError('load failed')

    expect((await readyOutcome) instanceof Error).toBe(true)
    expect((await pingOutcome) instanceof Error).toBe(true)
    expect(host.isStarted).toBe(false)
    expect(worker.terminated).toBe(true)
  })

  it('error 后可重新 start()', async () => {
    let current = new FakeWorker()
    const host = new MatrixWorkerHost(() => current as unknown as Worker)

    const first = host.start().catch(() => 'failed')
    current.emitError()
    expect(await first).toBe('failed')

    current = new FakeWorker()
    const second = host.start()
    current.emit({ type: 'ready' })
    await expect(second).resolves.toBeUndefined()
  })

  it('terminate 时未就绪的 start() 也被 reject', async () => {
    const worker = new FakeWorker()
    const host = new MatrixWorkerHost(() => worker as unknown as Worker)

    const ready = host.start().catch((e: Error) => e)
    host.terminate('bye')

    expect((await ready) instanceof Error).toBe(true)
  })
})
```

（`ready` 信号的消息形状以文件内既有用例为准——若既有测试用 `worker.emit({ type: 'ready' })` 之外的形状，照抄既有形状。构造器工厂类型同文件内既有 `makeHost` 写法。）

- [ ] **Step 3: 运行确认失败**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixWorkerHost.test.ts`
Expected: FAIL——三个新用例超时或断言失败

- [ ] **Step 4: 实现**

类成员增加：

```ts
  private readyReject: ((err: Error) => void) | null = null
  private readonly onWorkerError = (event: Event) => {
    const message = (event as ErrorEvent)?.message || 'worker error'
    this.disposeWorker(new Error(`[MatrixWorkerHost] worker failed: ${message}`))
  }
```

`start()` 改为：

```ts
  start(): Promise<void> {
    if (this.readyPromise) return this.readyPromise

    const worker = this.factory()
    worker.addEventListener('message', this.onMessage as EventListener)
    worker.addEventListener('error', this.onWorkerError)
    worker.addEventListener('messageerror', this.onWorkerError)
    this.worker = worker

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.readyResolve = resolve
      this.readyReject = reject
    })
    return this.readyPromise
  }
```

新增私有方法并让 `terminate` 复用：

```ts
  private disposeWorker(err: Error): void {
    if (this.worker) {
      this.worker.removeEventListener('message', this.onMessage as EventListener)
      this.worker.removeEventListener('error', this.onWorkerError)
      this.worker.removeEventListener('messageerror', this.onWorkerError)
      this.worker.terminate()
      this.worker = null
    }
    for (const pending of this.pending.values()) {
      pending.reject(err)
    }
    this.pending.clear()
    this.readyReject?.(err)
    this.readyPromise = null
    this.readyResolve = null
    this.readyReject = null
  }

  terminate(reason: string = 'host terminated'): void {
    if (!this.worker) return
    this.disposeWorker(new Error(reason))
  }
```

（`WorkerLike` 类型需补 `'addEventListener' | 'removeEventListener'` 的 error 事件签名——现有 Pick 已含这两个方法名，无需改。ready 成功后 `readyReject` 残留引用对已 settle 的 Promise 调用是 no-op，安全。）

- [ ] **Step 5: 运行确认全绿（含既有 233 行改动的用例）**

Run: `pnpm vitest run src/services/matrix/__tests__/MatrixWorkerHost.test.ts`
Expected: PASS 全绿

- [ ] **Step 6: Commit**

```bash
git add src/services/matrix/MatrixWorkerHost.ts src/services/matrix/__tests__/MatrixWorkerHost.test.ts
git commit -m "fix: reject ready and pending requests when matrix worker errors"
```

---

### Task 9: useLocationShare——reset 停止在途 beacon + startBeacon 防重入

**背景：** `reset()`（useLocationShare.ts:175-181）丢弃 `beaconInfoEventId` 但不调 `stopBeacon`，服务器继续广播位置最长 1 小时（隐私）；`startBeacon` 无防重入，二次调用覆盖 eventId 使前一个 beacon 失控。

**Files:**
- Modify: `src/composables/location/useLocationShare.ts:124-181`
- Test: `src/composables/location/__tests__/useLocationShare.test.ts`（追加；文件已 mock matrixBeaconService 的 createBeacon/stopBeacon）

**Interfaces:**
- Produces: `reset()` 签名不变（内部 fire-and-forget 停 beacon）；`startBeacon` 在 sharing 中返回 false 不重复创建

- [ ] **Step 1: 写失败测试（追加）**

```ts
  it('sharing 中再次 startBeacon 直接返回 false 且不重复创建', async () => {
    mockCreateBeacon.mockResolvedValueOnce({ event_id: '$beacon1' })
    const flow = useLocationShare()

    expect(await flow.startBeacon('!room:hs')).toBe(true)
    expect(await flow.startBeacon('!room:hs')).toBe(false)
    expect(mockCreateBeacon).toHaveBeenCalledTimes(1)
  })

  it('reset 时若有在途 beacon 则调用 stopBeacon', async () => {
    mockCreateBeacon.mockResolvedValueOnce({ event_id: '$beacon2' })
    mockStopBeacon.mockResolvedValueOnce(true)
    const flow = useLocationShare()

    await flow.startBeacon('!room:hs')
    flow.reset()
    await Promise.resolve()

    expect(mockStopBeacon).toHaveBeenCalledWith('!room:hs', '$beacon2')
    expect(flow.sharing.value).toBe(false)
  })
```

（mock 变量名 `mockCreateBeacon`/`mockStopBeacon` 与文件既有 vi.hoisted 定义一致；`startBeacon` 内部 `resolveRoomId` 若对入参有格式要求，参照文件内既有 startBeacon 用例的房间 ID 写法。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/composables/location/__tests__/useLocationShare.test.ts`
Expected: FAIL——第一个用例 createBeacon 被调用 2 次；第二个用例 stopBeacon 未被调用

- [ ] **Step 3: 实现**

组合式函数内新增状态并改两个函数：

```ts
  const activeBeaconRoomId = ref<string | null>(null)
```

`startBeacon` 开头加 guard，成功时记录房间：

```ts
  const startBeacon = async (roomId: string, duration: number = DEFAULT_BEACON_TIMEOUT): Promise<boolean> => {
    if (sharing.value) return false
    const resolved = resolveRoomId(roomId)
    if (!resolved) {
      showFeedback(t('location_share.start_failed'), 'error')
      return false
    }
    try {
      const beacon = await matrixBeaconService.createBeacon({
        roomId: resolved,
        timeout: duration
      })
      beaconInfoEventId.value = beacon.event_id
      activeBeaconRoomId.value = resolved
      sharing.value = true
      ...
```

`stopBeacon` 成功分支加 `activeBeaconRoomId.value = null`。

`reset` 改为：

```ts
  const reset = (): void => {
    if (sharing.value && beaconInfoEventId.value && activeBeaconRoomId.value) {
      const rid = activeBeaconRoomId.value
      const eventId = beaconInfoEventId.value
      matrixBeaconService.stopBeacon(rid, eventId).catch((err) => {
        logger.warn('reset 时停止 beacon 失败', err)
      })
    }
    sharing.value = false
    currentLocation.value = null
    error.value = null
    beaconInfoEventId.value = null
    activeBeaconRoomId.value = null
    loading.value = false
  }
```

（reset 直调 `matrixBeaconService.stopBeacon` 而非本组合式的 `stopBeacon`，避免其 showFeedback 弹提示。）

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/composables/location/__tests__/useLocationShare.test.ts`
Expected: PASS 全绿

- [ ] **Step 5: Commit**

```bash
git add src/composables/location/useLocationShare.ts src/composables/location/__tests__/useLocationShare.test.ts
git commit -m "fix: stop live beacon on reset and guard startBeacon reentry"
```

---

### Task 10: rooms/index.vue——房间列表虚拟化

**背景：** rooms/index.vue:42-49 用 van-list + v-for 全量渲染；`onLoadMore()`（:252-254）直接 `finished.value = true`，分页是假的。仓库已有 `SmartVirtualList`（src/mobile/components/virtual-scroll/SmartVirtualList.vue，message/index.vue:94 是用法样板）。

**Files:**
- Modify: `src/mobile/views/rooms/index.vue`

**Interfaces:**
- Consumes: `SmartVirtualList` props `{ items, itemHeight, buffer, keyField }` + 默认插槽 `{ item }`

- [ ] **Step 1: 模板替换**

把 van-pull-refresh 内的 van-list 块替换为：

```vue
    <van-pull-refresh v-else v-model="refreshing" @refresh="onRefresh" class="flex-1 min-h-0">
      <SmartVirtualList
        class="h-full overflow-y-auto overflow-x-hidden"
        :items="roomList"
        :item-height="72"
        :buffer="6"
        key-field="roomId">
        <template #default="{ item: room }">
          <van-swipe-cell>
            <!-- 原 van-swipe-cell 内部行内容原样保留(含已加的 loading="lazy" 头像) -->
          </van-swipe-cell>
        </template>
      </SmartVirtualList>
    </van-pull-refresh>
```

行内容不改动，只把 `v-for="room in roomList" :key="room.roomId"` 从 van-swipe-cell 上移除（room 现由插槽解构提供）。

- [ ] **Step 2: 清理脚本区**

- `import SmartVirtualList from '@/mobile/components/virtual-scroll/SmartVirtualList.vue'`
- 删除 `loadingMore`、`finished` 两个 ref 与 `onLoadMore` 函数（连同 template 中对它们的引用一起消失；不留下未用变量）。

- [ ] **Step 3: 验证**

Run: `ls src/mobile/views/rooms/__tests__/ 2>/dev/null && pnpm vitest run src/mobile/views/rooms || echo "无既有测试"`；若有测试文件且因 SmartVirtualList 挂载失败，给其 global.stubs 增加：

```ts
  SmartVirtualList: {
    props: ['items'],
    template: '<div><div v-for="(item, i) in items" :key="i"><slot :item="item" :index="i" /></div></div>'
  }
```

Run: `npx vue-tsc --noEmit 2>&1 | grep "rooms/index" || echo OK`
Expected: OK

- [ ] **Step 4: 手动验证（如设备可用）**

`pnpm idev:mac` 或浏览器 `pnpm dev`，进入房间 tab：列表滚动流畅、下拉刷新可用、点击行进入房间正常。无法真机验证则在提交信息注明。

- [ ] **Step 5: Commit**

```bash
git add src/mobile/views/rooms/index.vue
git commit -m "perf: virtualize mobile room list with SmartVirtualList"
```

---

### Task 11: dynamic/index.vue——space 成员列表上限 + 查看全部

**背景：** dynamic/index.vue:69-77 对 `spaceMemberMap[...]` 全量 v-for，大 space 展开渲染数百行。方案：默认前 50 + 「查看全部」按钮。

**Files:**
- Modify: `src/mobile/views/dynamic/index.vue`
- Modify: `locales/zh-CN/space.json`、`locales/en/space.json`（若 `space.management.*` 键实际在别的文件，以 `grep -rn "space.management.no_members" locales/` 结果为准）

**Interfaces:**
- Produces: `visibleMembers(key: string): Member[]`、`expandedMembers: Ref<Record<string, boolean>>`（仅本组件内）

- [ ] **Step 1: i18n 键**

zh-CN：`"show_all_members": "查看全部 {count} 位成员"`；en：`"show_all_members": "Show all {count} members"`——加到 `space.management` 对象内。

- [ ] **Step 2: 脚本区新增**

```ts
const MEMBER_DISPLAY_LIMIT = 50
const expandedMembers = ref<Record<string, boolean>>({})

const visibleMembers = (key: string) => {
  const list = spaceMemberMap[key] || []
  return expandedMembers.value[key] ? list : list.slice(0, MEMBER_DISPLAY_LIMIT)
}
```

（`spaceMemberMap` 若是 `ref`，改为 `spaceMemberMap.value[key]`——以文件内现有声明为准。）

- [ ] **Step 3: 模板替换**

```vue
          <div v-else>
            <div
              v-for="member in visibleMembers(sp.spaceId || sp.roomId)"
              :key="member.userId || member.uid"
              class="flex items-center gap-10px px-14px py-10px border-b border-[--hula-border-default] last:border-b-0">
              <!-- 行内容不变 -->
            </div>
            <div
              v-if="!expandedMembers[sp.spaceId || sp.roomId] && (spaceMemberMap[sp.spaceId || sp.roomId] || []).length > MEMBER_DISPLAY_LIMIT"
              class="py-10px text-center text-13px text-[--hula-color-primary] tap-highlight"
              @click="expandedMembers[sp.spaceId || sp.roomId] = true">
              {{ t('space.management.show_all_members', { count: (spaceMemberMap[sp.spaceId || sp.roomId] || []).length }) }}
            </div>
          </div>
```

- [ ] **Step 4: 验证**

Run: `npx vue-tsc --noEmit 2>&1 | grep "dynamic/index" || echo OK` → Expected: OK
Run: `pnpm vitest run src/mobile/views/dynamic 2>/dev/null || echo "无既有测试"`

- [ ] **Step 5: Commit**

```bash
git add src/mobile/views/dynamic/index.vue locales/zh-CN locales/en
git commit -m "perf: cap space member list at 50 with show-all expansion"
```

---

### Task 12: MobileForwardDialog——会话列表虚拟化

**背景：** MobileForwardDialog.vue:40-64 对 `filteredRooms`（= 全部会话）全量渲染 van-cell 行。

**Files:**
- Modify: `src/mobile/views/chat-room/MobileForwardDialog.vue`
- Modify: `src/mobile/views/chat-room/__tests__/MobileForwardDialog.test.ts`（stub 更新）

**Interfaces:**
- Consumes: `SmartVirtualList`（同 Task 10）

- [ ] **Step 1: 更新测试 stub（先行，保证测试始终描述行为）**

在测试文件 `vantStubs` 中追加：

```ts
  SmartVirtualList: {
    props: ['items'],
    template: '<div><div v-for="(item, i) in items" :key="i"><slot :item="item" :index="i" /></div></div>'
  }
```

Run: `pnpm vitest run src/mobile/views/chat-room/__tests__/MobileForwardDialog.test.ts`
Expected: PASS（stub 尚未被用到，仍绿——这是基线）

- [ ] **Step 2: 模板替换**

```vue
      <!-- 房间列表 -->
      <div class="mobile-forward-dialog__list">
        <div v-if="filteredRooms.length === 0" class="mobile-forward-dialog__empty">
          {{ t('message.forward.no_rooms') }}
        </div>
        <SmartVirtualList
          v-else
          class="h-full overflow-y-auto"
          :items="filteredRooms"
          :item-height="56"
          :buffer="6"
          key-field="roomId">
          <template #default="{ item: room }">
            <van-cell
              clickable
              data-test="forward-room-item"
              :data-room-id="room.roomId"
              @click="handleToggleRoom(room.roomId)">
              <!-- icon/title 插槽内容原样保留 -->
            </van-cell>
          </template>
        </SmartVirtualList>
      </div>
```

脚本区加 `import SmartVirtualList from '@/mobile/components/virtual-scroll/SmartVirtualList.vue'`。确认 `.mobile-forward-dialog__list` 样式有固定高度或 flex 高度（虚拟列表需要确定的滚动容器高度；若目前是 max-height，改为 `height` 或加 `min-h-0 flex-1`）。

- [ ] **Step 3: 验证**

Run: `pnpm vitest run src/mobile/views/chat-room/__tests__/MobileForwardDialog.test.ts`
Expected: PASS 全部 6 个既有用例（过滤、toggle、禁用、转发成功等行为不变）

- [ ] **Step 4: Commit**

```bash
git add src/mobile/views/chat-room/MobileForwardDialog.vue src/mobile/views/chat-room/__tests__/MobileForwardDialog.test.ts
git commit -m "perf: virtualize forward dialog room list"
```

---

### Task 13: useVoIPCallFlow——shallowRef、hangup 快照、双击防护

**背景：** (a) `callInfo = ref<CallInfo>` 深代理含 MediaStream 的高频更新对象；(b) `hangup()` finally 无条件清空状态——快速挂断→重拨会摧毁新通话；(c) `startCall`/`answerCall` 无 in-flight guard，双击下两路呼叫。

**Files:**
- Modify: `src/composables/webrtc/useVoIPCallFlow.ts`
- Test: `src/composables/webrtc/__tests__/useVoIPCallFlow.test.ts`（新建）

**Interfaces:**
- Consumes: `matrixVoIPService`（`@/services/matrix/media/MatrixVoIPService`）的 `startCall/answerCall/hangupCall/onCallUpdate`
- Produces: 组合式返回签名不变

- [ ] **Step 1: 写失败测试**

```ts
// src/composables/webrtc/__tests__/useVoIPCallFlow.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { voipMock, showFeedbackMock } = vi.hoisted(() => ({
  voipMock: {
    startCall: vi.fn(),
    answerCall: vi.fn(),
    hangupCall: vi.fn(),
    rejectCall: vi.fn(),
    toggleMute: vi.fn(),
    toggleVideo: vi.fn(),
    toggleSpeaker: vi.fn(),
    startScreenshare: vi.fn(),
    stopScreenshare: vi.fn(),
    onCallUpdate: vi.fn(() => () => {})
  },
  showFeedbackMock: vi.fn()
}))

vi.mock('@/services/matrix/media/MatrixVoIPService', () => ({
  matrixVoIPService: voipMock
}))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: showFeedbackMock })
}))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

import { useVoIPCallFlow } from '../useVoIPCallFlow'

describe('useVoIPCallFlow 并发防护', () => {
  beforeEach(() => {
    voipMock.startCall.mockReset()
    voipMock.hangupCall.mockReset()
    voipMock.onCallUpdate.mockClear()
  })

  it('startCall 双击只发起一路呼叫', async () => {
    let resolveCall!: (v: { callId: string }) => void
    voipMock.startCall.mockImplementation(() => new Promise((r) => (resolveCall = r)))
    const flow = useVoIPCallFlow()

    const first = flow.startCall('!room:hs', 'voice')
    const second = flow.startCall('!room:hs', 'voice')
    resolveCall({ callId: 'c1' })
    await Promise.all([first, second])

    expect(voipMock.startCall).toHaveBeenCalledTimes(1)
  })

  it('hangup 期间产生的新通话状态不被 finally 误清', async () => {
    voipMock.startCall.mockResolvedValue({ callId: 'c1' })
    let resolveHangup!: () => void
    voipMock.hangupCall.mockImplementation(() => new Promise<void>((r) => (resolveHangup = r)))
    const flow = useVoIPCallFlow()

    await flow.startCall('!room:hs', 'voice')
    const hanging = flow.hangup()

    voipMock.startCall.mockResolvedValue({ callId: 'c2' })
    await flow.startCall('!room:hs', 'voice')

    resolveHangup()
    await hanging

    expect(flow.callId.value).toBe('c2')
  })
})
```

（`startCall` 的真实签名与返回形状以 useVoIPCallFlow.ts 为准——执行时先读该文件 40-100 行核对参数与 `callId.value` 赋值来源，必要时调整 mock 返回形状；测试意图不变：双击去重、快照保护。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/composables/webrtc/__tests__/useVoIPCallFlow.test.ts`
Expected: FAIL——startCall 被调 2 次；hangup 后 callId 为 null

- [ ] **Step 3: 实现**

- `import { ref, shallowRef, computed, onUnmounted } from 'vue'`；`const callInfo = ref<CallInfo | null>(null)` → `const callInfo = shallowRef<CallInfo | null>(null)`
- `startCall`/`answerCall` 开头：`if (loading.value) return false`（返回类型按现有签名，若返回 Promise<boolean> 则 false，若 void 则直接 return）
- `hangup` 快照化：

```ts
  const hangup = async (): Promise<void> => {
    const id = callId.value
    if (!id) return
    loading.value = true
    try {
      await matrixVoIPService.hangupCall(id)
    } catch (err) {
      logger.error('hangup failed', err)
      showFeedback(t('voip.errors.hangup_failed'), 'error')
    } finally {
      if (callId.value === id) {
        callId.value = null
        callInfo.value = null
        isAudioMuted.value = false
        isVideoEnabled.value = false
        isSpeakerOn.value = false
        isScreensharing.value = false
        if (unsubscribeCallUpdate) {
          unsubscribeCallUpdate()
          unsubscribeCallUpdate = null
        }
      }
      loading.value = false
    }
  }
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/composables/webrtc/__tests__/useVoIPCallFlow.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/composables/webrtc/useVoIPCallFlow.ts src/composables/webrtc/__tests__/useVoIPCallFlow.test.ts
git commit -m "fix: guard VoIP call flow against double-invoke and hangup/redial race"
```

---

### Task 14: 加密流程组合式——in-flight guard

**背景：** `useKeyBackupFlow`（createBackup :68 等 3 个函数）、`useSecureBackupFlow`（:68/:94/:123/:147 共 4 个）、`useDeviceVerifyFlow`（:64 startSas 等 3 个）均 `loading.value = true` 但入口不检查。双击 `createBackup` 会连转两次备份 key，作废刚展示给用户的恢复密钥。

**Files:**
- Modify: `src/composables/encryption/useKeyBackupFlow.ts`
- Modify: `src/composables/encryption/useSecureBackupFlow.ts`
- Modify: `src/composables/encryption/useDeviceVerifyFlow.ts`
- Test: `src/composables/encryption/__tests__/flowGuards.test.ts`（新建）

**Interfaces:**
- Produces: 各 mutating 函数入口统一 `if (loading.value) return false`，签名不变

- [ ] **Step 1: 写失败测试**

```ts
// src/composables/encryption/__tests__/flowGuards.test.ts
import { describe, expect, it, vi } from 'vitest'

const { cryptoMock, keyBackupMock, verificationMock } = vi.hoisted(() => ({
  cryptoMock: {
    setupKeyBackup: vi.fn(),
    setupSecureBackup: vi.fn(),
    getKeyBackupInfo: vi.fn().mockResolvedValue(null)
  },
  keyBackupMock: {
    getBackupInfo: vi.fn().mockResolvedValue(null),
    restoreKeyBackup: vi.fn()
  },
  verificationMock: {
    startSasVerification: vi.fn()
  }
}))

vi.mock('@/services/matrix/crypto/MatrixCryptoService', () => ({ default: cryptoMock }))
vi.mock('@/services/matrix/crypto/MatrixKeyBackupService', () => ({ matrixKeyBackupService: keyBackupMock }))
vi.mock('@/services/matrix/crypto/MatrixVerificationService', () => ({ matrixVerificationService: verificationMock }))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

import { useKeyBackupFlow } from '../useKeyBackupFlow'

describe('加密流程 in-flight guard', () => {
  it('createBackup 双击只执行一次', async () => {
    let resolveSetup!: () => void
    cryptoMock.setupKeyBackup.mockImplementation(() => new Promise<void>((r) => (resolveSetup = r)))
    const flow = useKeyBackupFlow()

    const first = flow.createBackup()
    const second = flow.createBackup()
    resolveSetup()
    const [r1, r2] = await Promise.all([first, second])

    expect(cryptoMock.setupKeyBackup).toHaveBeenCalledTimes(1)
    expect(r1).toBe(true)
    expect(r2).toBe(false)
  })
})
```

（mock 的服务方法名以三个组合式文件内的真实调用为准——执行时先 `grep -n "matrixCryptoService\.\|matrixKeyBackupService\.\|matrixVerificationService\." src/composables/encryption/use{KeyBackup,SecureBackup,DeviceVerify}Flow.ts` 列出全部被调方法，把 mock 补全为超集，避免 undefined 方法崩溃。测试主体只需覆盖 createBackup 一例——guard 是同一行代码模式，其余函数靠 Step 3 落地 + Step 4 回归即可。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/composables/encryption/__tests__/flowGuards.test.ts`
Expected: FAIL——setupKeyBackup 被调 2 次

- [ ] **Step 3: 三个文件统一加 guard**

对以下每个 async 函数体第一行（`loading.value = true` 之前）插入 `if (loading.value) return false`：
- useKeyBackupFlow.ts：`createBackup`、`restoreFromBackup`、`importFromRecoveryKey`（以 grep `loading.value = true` 命中的函数为准）
- useSecureBackupFlow.ts：4 处（:68/:94/:123/:147 对应函数）
- useDeviceVerifyFlow.ts：3 处（:64/:95/:115 对应函数，含 `startSas`）

若个别函数返回类型不是 `Promise<boolean>`（如 `Promise<void>`），guard 改为 `if (loading.value) return`。

- [ ] **Step 4: 运行验证（新测试 + 既有加密测试回归）**

Run: `pnpm vitest run src/composables/encryption`
Expected: PASS 全绿

- [ ] **Step 5: Commit**

```bash
git add src/composables/encryption/useKeyBackupFlow.ts src/composables/encryption/useSecureBackupFlow.ts src/composables/encryption/useDeviceVerifyFlow.ts src/composables/encryption/__tests__/flowGuards.test.ts
git commit -m "fix: add in-flight guards to encryption backup and verification flows"
```

---

### Task 15: useMessageMultiSelect——batchDelete 快照与防重入

**背景：** batchDelete（useMessageMultiSelect.ts:185-214）循环内每次读响应式 `roomId.value`，批删中途切房间会用新房间配旧事件 ID；`processing` 置位但入口不检查。

**Files:**
- Modify: `src/composables/messaging/useMessageMultiSelect.ts:185-214`
- Test: `src/composables/messaging/__tests__/useMessageMultiSelect.test.ts`（追加）

**Interfaces:**
- Produces: `batchDelete(): Promise<number>` 签名不变

- [ ] **Step 1: 写失败测试（追加到既有测试文件）**

既有事实：composable 签名 `useMessageMultiSelect({ roomId: MaybeRef<string> })`（useMessageMultiSelect.ts:16/:39），内部 `roomId = computed(() => unref(options.roomId) ?? '')`；测试文件已有 `mockRecallMessage` 与 `mockChatMessageListByRoomId`（chat store mock）。选中消息的构造方式参照文件内既有 batchDelete 用例（通过 `mockChatMessageListByRoomId` 返回消息数组 + `toggleSelect`/`selectedIds` 置入）。追加：

```ts
  it('batchDelete 进行中切换房间仍按开始时的 roomId 删除', async () => {
    const roomIdRef = ref('!a:hs')
    mockChatMessageListByRoomId.mockReturnValue([
      { message: { id: '$m1' } },
      { message: { id: '$m2' } }
    ] as any[])
    let releaseFirst!: () => void
    mockRecallMessage
      .mockImplementationOnce(() => new Promise<void>((r) => (releaseFirst = r)))
      .mockResolvedValue(undefined)

    const ms = useMessageMultiSelect({ roomId: roomIdRef })
    ms.toggleSelect('$m1')
    ms.toggleSelect('$m2')

    const deleting = ms.batchDelete()
    roomIdRef.value = '!b:hs'
    releaseFirst()
    await deleting

    expect(mockRecallMessage).toHaveBeenNthCalledWith(1, '!a:hs', '$m1')
    expect(mockRecallMessage).toHaveBeenNthCalledWith(2, '!a:hs', '$m2')
  })

  it('batchDelete 双击只执行一轮', async () => {
    mockChatMessageListByRoomId.mockReturnValue([{ message: { id: '$m1' } }] as any[])
    let release!: () => void
    mockRecallMessage.mockImplementationOnce(() => new Promise<void>((r) => (release = r)))

    const ms = useMessageMultiSelect({ roomId: '!a:hs' })
    ms.toggleSelect('$m1')

    const first = ms.batchDelete()
    const second = await ms.batchDelete()
    release()
    await first

    expect(second).toBe(0)
    expect(mockRecallMessage).toHaveBeenCalledTimes(1)
  })
```

（`toggleSelect` 与选中 API 名以文件内既有用例为准——若既有用例用其他方法置入选中态（如直接操作 `selectedIds.value`），照抄既有方式；断言不变。）

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/composables/messaging/__tests__/useMessageMultiSelect.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现**

```ts
  const batchDelete = async (): Promise<number> => {
    if (processing.value) return 0
    if (selectedMessages.value.length === 0) {
      showFeedback(t('mobile_chat.multi_select.empty_selection'), 'warning')
      return 0
    }
    processing.value = true
    const rid = roomId.value
    const targets = [...selectedMessages.value]
    const total = targets.length
    let successCount = 0
    try {
      for (const msg of targets) {
        try {
          await matrixMessageService.recallMessage(rid, msg.message.id)
          successCount++
        } catch (err) {
          logger.error(`[batchDelete] 删除消息失败: ${msg.message.id}`, err)
        }
      }
      ...(其余不变)
```

（`roomId` 若在本组合式内是 getter/参数而非 ref，快照写法相应调整为一次求值。）

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/composables/messaging/__tests__/useMessageMultiSelect.test.ts`
Expected: PASS 全绿

- [ ] **Step 5: Commit**

```bash
git add src/composables/messaging/useMessageMultiSelect.ts src/composables/messaging/__tests__/useMessageMultiSelect.test.ts
git commit -m "fix: snapshot roomId and guard reentry in batch message delete"
```

---

### Task 16: App.vue watcher 去重 + userStatus onload 容错

**背景：** (a) App.vue:334 每次 `MSG_INIT` 都注册一个新的 `watch(currentSessionRoomId...)` 且从不停止——登出/重登会累积 watcher；(b) userStatus.ts:14 `img.onload` async 回调内 `getColor` 抛错为未处理 rejection，且无 onerror。

**Files:**
- Modify: `src/App.vue:331-355`
- Modify: `src/stores/domains/user/userStatus.ts:8-21`

**Interfaces:** 无对外变化。

- [ ] **Step 1: App.vue——持有并替换 WatchStopHandle**

```ts
async function setupSessionWatch() {
  try {
    const { MittEnum, RoomTypeEnum } = await import('@/enums')
    let sessionWatchStop: WatchStopHandle | null = null
    useMitt.on(MittEnum.MSG_INIT, async () => {
      const { useAnnouncementStore } = await import('@/stores/domains/chat/announcement')
      const { useGroupStore } = await import('@/stores/domains/chat/group')
      const announcementStore = useAnnouncementStore()
      const groupStore = useGroupStore()

      sessionWatchStop?.()
      sessionWatchStop = watch(
        () => [globalStore.currentSessionRoomId, globalStore.currentSession?.type] as const,
        async ([sessionRoomId, sessionType]) => {
          if (!sessionRoomId || sessionType !== RoomTypeEnum.GROUP) return
          try {
            const result = await groupStore.switchSession({ roomId: sessionRoomId })
            if (result?.success) {
              await announcementStore.loadGroupAnnouncements()
            }
          } catch (error) {
            logger.error('session switch failed:', error)
          }
        },
        { immediate: true }
      )
    })
```

（`WatchStopHandle` 类型经 unplugin-auto-import 可用；若 vue-tsc 报未定义，则 `import type { WatchStopHandle } from 'vue'`。）

- [ ] **Step 2: userStatus.ts——onload 容错**

```ts
const ensureStateColor = (state?: STO.UserState) => {
  if (!state || state.bgColor || !state.url) return

  const img = new Image()
  img.src = state.url
  img.onload = async () => {
    try {
      const color = await getColor(img)
      if (color) {
        state.bgColor = `rgba(${color.array().join(',')}, 0.4)`
      }
    } catch {
      // 颜色提取失败时保持默认背景,不产生 unhandled rejection
    }
  }
  img.onerror = () => {}
}
```

- [ ] **Step 3: 验证**

Run: `npx vue-tsc --noEmit 2>&1 | grep -E "App.vue|userStatus" || echo OK` → Expected: OK
Run: `pnpm vitest run src/stores/domains/user 2>/dev/null | tail -3`（若有既有测试须全绿）

- [ ] **Step 4: Commit**

```bash
git add src/App.vue src/stores/domains/user/userStatus.ts
git commit -m "fix: dedupe session watcher on MSG_INIT and harden avatar color extraction"
```

---

### Task 17: 全量验证 + 更新问题台账

**Files:**
- Modify: `docs/功能实现清单.md`（问题台账区）

- [ ] **Step 1: 全量门禁**

```bash
npx vue-tsc --noEmit
pnpm check
pnpm vitest run
pnpm check:ratchet
```

Expected: vue-tsc 0 错误；biome 无新增问题；vitest 全绿；ratchet ≤ 基线。任一失败：修复后重跑，不得跳过。

- [ ] **Step 2: bundle 对比（若 Task 1 Step 5 跳过了）**

```bash
pnpm metrics:bundle
```

Expected: 存在 `matrix-sdk-*.js` 独立 chunk。记录主 chunk 前后体积到提交信息。

- [ ] **Step 3: 更新 docs/功能实现清单.md 问题台账**

在问题台账表之后追加一节（日期 2026-07-17）：性能审计 18 项发现的处置记录——5 项审计时 AUTO-FIX、本计划 Task 1-16 各自对应的发现与状态（全部 ✅），保留说明：uploadBlob 不接分片回退（语音小文件）、真机滚动性能验证待 iOS/Android 实测、两项 dev-only 观察项维持现状（optimizeDeps 预构建 link 版 SDK 改动后需 `pnpm dev --force`；移动端 `hmr: false` 为有意配置）。

- [ ] **Step 4: Commit**

```bash
git add docs/功能实现清单.md
git commit -m "docs: record performance audit remediation in feature ledger"
```
