# A4 MediaManager 迁移实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `MatrixMediaService` 与 `ChunkUploadService` 中绕过 SDK 的 `client.uploadContent` / `client.http.authedRequest` / 直接 XHR 调用全部迁移到 `client.getMediaManager()` 提供的统一 Manager 通道，享受 SDK 的 precheck、错误归一化、URL 路由表与重试策略，同时保留 ChunkUploadService 的并发/重试/进度编排能力。

**Architecture:** 在 `MatrixMediaServiceClass` 内新增 `getMedia()` 私有访问器统一获取 `MediaManager` 实例；按"低风险先行"顺序迁移 quota → config → uploadContentWithId → deleteMedia → ChunkUploadService → uploadContentWithChunkFallback；最后清理不再使用的 `MATRIX_PATHS.MEDIA.*` 常量。ChunkUploadService 改造采用"SDK 提供 HTTP 原语、前端保留编排"分层：start/uploadChunk/complete/cancel/progress 五个 HTTP 调用切到 `MediaManager`，并发/重试/暂停/恢复/进度计算等纯客户端逻辑保持不变。

**Tech Stack:** TypeScript, Vue 3 服务层, matrix-js-sdk `MediaManager` (`BaseManager` + `withRetry`), Vitest + MSW 合同测试, Biome lint。

## Global Constraints

- TypeScript 6.0.3（`vue-tsc` 兼容约束），禁止升级。
- 服务层禁止直接 import `matrix-js-sdk` 内部模块；必须通过 `client.getMediaManager()` 访问器。
- ChunkUploadService 必须保留 `upload(options)` 公共签名（参数/返回类型不变），调用方零改动。
- 所有 POST `uploadChunk` 调用走 SDK（`retryNonIdempotent=false`），前端 maxRetries=3 仍是唯一重试来源——禁止双重重试。
- `MATRIX_PATHS.MEDIA.*` 常量清理必须通过 `pnpm check:ratchet` 守护。
- 验收命令：`pnpm vue-tsc --noEmit`、`pnpm test:run`、`pnpm check:ratchet`、`pnpm check:sdk-boundary`、`pnpm quality:no-raw-fetch`、`pnpm check` 必须 0 错误。
- synapse-rust 后端已确认同时支持 `/_matrix/media/v1` 与 `/_matrix/media/v3` 前缀的 `delete`、`config`、`preview_url` 路由（见 `synapse-rust/src/web/routes/media/mod.rs:30-34, 98-119`），SDK 使用 v1 前缀安全。
- `MediaManager.uploadContent` 内置 `m.upload.size` 预检（缓存 5 分钟），超限直接抛 `M_TOO_LARGE`（httpStatus=413）；前端 `uploadContentWithChunkFallback` 的 413 回退路径仍然有效。
- ChunkUploadService 的 `chunkProgress` 数组无外部消费者（仅 `MatrixMediaService` 读取 `p.percentage`），迁移到 fetch 后改为步进式（0 或 1）无 UX 影响。

---

## File Structure

| 文件 | 角色 | 操作 |
|---|---|---|
| `src/services/matrix/media/MatrixMediaService.ts` | L2 媒体服务（upload/download/quota/config/delete） | 修改：新增 `getMedia()`，迁移 6 个方法 |
| `src/services/performance/ChunkUploadService.ts` | 分块上传编排服务（并发/重试/进度） | 修改：5 个 HTTP 调用切到 `MediaManager`，保留编排逻辑 |
| `src/services/matrix/paths/media.ts` | URL 常量层 | 修改：删除已迁移方法对应的常量 |
| `src/services/matrix/media/__tests__/MatrixMediaService.test.ts` | 单元测试（vi.mock） | 修改：mock 从 `client.uploadContent` / `http.authedRequest` 改为 `client.getMediaManager().*` |
| `src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts` | 413 回退单元测试 | 修改：mock `getMediaManager().uploadContent` |
| `src/services/matrix/media/__tests__/media.contract.test.ts` | 合同测试（真实 SDK + MSW） | 修改：`deleteMedia` 期望 URL 改为 v1；保留其他断言 |
| `src/services/performance/__tests__/ChunkUploadService.test.ts` | 分块上传单元测试 | 修改：改用真实 SDK client + MSW 验证 URL 与重试耗尽 |

---

## Task 1: 在 MatrixMediaService 添加 getMedia() 访问器

**Files:**
- Modify: `src/services/matrix/media/MatrixMediaService.ts:54-56`（在 `MatrixMediaServiceClass` 内 `compressOptions` 字段后新增方法）
- Test: `src/services/matrix/media/__tests__/MatrixMediaService.test.ts`

**Interfaces:**
- Produces: `protected getMedia(): MediaManager` —— 返回 `this.getClient().getMediaManager()`，所有后续任务通过此方法获取 Manager 实例。

- [ ] **Step 1: 写失败测试——验证 getMedia() 返回 client.getMediaManager()**

在 `MatrixMediaService.test.ts` 末尾追加：

```typescript
import type { MediaManager } from 'matrix-js-sdk/media'

describe('getMedia (private accessor)', () => {
  it('returns the MediaManager instance from the current client', () => {
    const mediaManager = { previewUrl: vi.fn() } as unknown as MediaManager
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getMediaManager: vi.fn(() => mediaManager)
    } as unknown as MatrixClient)

    // 通过 uploadFile 间接验证 getMedia() 可达——client 未初始化时 throws '客户端未初始化'
    // 已有测试覆盖；此处用反射验证 getMedia 返回值
    const svc = matrixMediaService as unknown as { getMedia: () => MediaManager }
    expect(svc.getMedia()).toBe(mediaManager)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts -t "getMedia"`
Expected: FAIL with `TypeError: svc.getMedia is not a function`

- [ ] **Step 3: 实现 getMedia()**

在 `MatrixMediaService.ts` 的 `MatrixMediaServiceClass` 内，紧接 `private enableCompression = true` 字段后新增：

```typescript
  protected getMedia(): MediaManager {
    const client = this.getClient()
    return (client as unknown as { getMediaManager: () => MediaManager }).getMediaManager()
  }
```

并在文件顶部 import 区追加：

```typescript
import type { MediaManager } from 'matrix-js-sdk/media'
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts -t "getMedia"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/media/MatrixMediaService.ts src/services/matrix/media/__tests__/MatrixMediaService.test.ts
git commit -m "refactor(media): add getMedia() accessor to MatrixMediaService

Foundation for A4 migration: all subsequent tasks obtain MediaManager
through this accessor instead of reaching into client.http directly."
```

---

## Task 2: 迁移 quota 方法到 MediaManager

**Files:**
- Modify: `src/services/matrix/media/MatrixMediaService.ts:576-624`（`getQuotaAlerts`、`checkQuota`、`getQuotaStats`）
- Test: `src/services/matrix/media/__tests__/MatrixMediaService.test.ts:341-366`
- Test: `src/services/matrix/media/__tests__/media.contract.test.ts:110-144`

**Interfaces:**
- Consumes: Task 1 的 `getMedia()`
- Produces: 三个方法的对外签名与返回类型不变（`getQuotaAlerts(): Promise<Array<Record<string, unknown>>>`、`checkQuota(): Promise<{limit, used, remaining} | null>`、`getQuotaStats(): Promise<{storageBytes, mediaCount, limitBytes} | null>`）

- [ ] **Step 1: 写失败测试——更新 media.contract.test.ts 验证 SDK 调用路径**

`media.contract.test.ts` 已有 MSW handler 命中 `/_matrix/media/v1/quota/...`（SDK 使用 `MediaPrefix.V1`），断言无需改动。只需把 `MatrixMediaService.test.ts` 中 `getQuotaAlerts` 单元测试的 mock 从 `client.http.authedRequest` 改为 `client.getMediaManager().getMediaQuotaAlerts`：

```typescript
describe('getQuotaAlerts', () => {
  it('should get quota alerts via MediaManager.getMediaQuotaAlerts', async () => {
    const getMediaQuotaAlerts = vi.fn().mockResolvedValue({
      alerts: [{ alert_id: 'a1', alert_type: 'warning' }]
    })
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getMediaManager: () => ({ getMediaQuotaAlerts })
    } as unknown as MatrixClient)

    const result = await matrixMediaService.getQuotaAlerts()

    expect(getMediaQuotaAlerts).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(1)
    expect(result[0].alert_id).toBe('a1')
  })

  it('should return empty array on error', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getMediaManager: () => ({
        getMediaQuotaAlerts: vi.fn().mockRejectedValue(new Error('fail'))
      })
    } as unknown as MatrixClient)

    const result = await matrixMediaService.getQuotaAlerts()
    expect(result).toEqual([])
  })
})
```

同样替换 `checkQuota` 与 `getQuotaStats` 的测试 mock（从 `http.authedRequest` 改为 `getMediaManager().checkMediaQuota` / `getMediaManager().getMediaQuotaStats`）。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts -t "getQuotaAlerts"`
Expected: FAIL with `expect(getMediaQuotaAlerts).toHaveBeenCalledTimes(1)` —— 当前实现走 `authedRequestWithPath`。

- [ ] **Step 3: 实现迁移**

替换 `getQuotaAlerts`、`checkQuota`、`getQuotaStats` 方法体：

```typescript
  async getQuotaAlerts(): Promise<Array<Record<string, unknown>>> {
    try {
      const response = await this.getMedia().getMediaQuotaAlerts()
      logger.info('[MatrixMedia] 获取配额告警成功')
      return (response.alerts ?? []) as Array<Record<string, unknown>>
    } catch (err) {
      logger.error(`[MatrixMedia] 获取配额告警失败: ${err}`)
      return []
    }
  }

  async checkQuota(): Promise<{ limit: number; used: number; remaining: number } | null> {
    try {
      const result = await this.getMedia().checkMediaQuota()
      return {
        limit: result.limit ?? 0,
        used: result.used ?? 0,
        remaining: result.remaining ?? 0
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 配额检查失败: ${err}`)
      return null
    }
  }

  async getQuotaStats(): Promise<{
    storageBytes: number
    mediaCount: number
    limitBytes: number
  } | null> {
    try {
      const result = await this.getMedia().getMediaQuotaStats()
      return {
        storageBytes: result.storage_bytes ?? 0,
        mediaCount: result.media_count ?? 0,
        limitBytes: result.limit_bytes ?? 0
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 获取配额统计失败: ${err}`)
      return null
    }
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts src/services/matrix/media/__tests__/media.contract.test.ts`
Expected: PASS（单元测试 + 合同测试均通过——SDK 走 `MediaPrefix.V1` 命中已有 MSW handler）

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/media/MatrixMediaService.ts src/services/matrix/media/__tests__/MatrixMediaService.test.ts
git commit -m "refactor(media): migrate quota methods to MediaManager

getQuotaAlerts/checkQuota/getQuotaStats now go through
client.getMediaManager().getMediaQuotaAlerts/checkMediaQuota/getMediaQuotaStats
instead of authedRequestWithPath. Behavior preserved: same return shapes,
same error fallbacks (empty array / null)."
```

---

## Task 3: 迁移 getMediaConfig 与 getAuthenticatedMediaConfig 到 MediaManager

**Files:**
- Modify: `src/services/matrix/media/MatrixMediaService.ts:544-558, 626-646`
- Test: `src/services/matrix/media/__tests__/MatrixMediaService.test.ts:291-314, 368-397`
- Test: `src/services/matrix/media/__tests__/media.contract.test.ts:88-97, 146-155`

**Interfaces:**
- Consumes: Task 1 的 `getMedia()`
- Produces: 两个方法对外签名不变。`getMediaConfig(): Promise<{ 'm.upload.size'?: number; [k: string]: unknown }>`、`getAuthenticatedMediaConfig(): Promise<{ authenticated_media: boolean; [k: string]: unknown } | null>`

- [ ] **Step 1: 写失败测试——更新单元测试 mock**

替换 `MatrixMediaService.test.ts` 中 `getMediaConfig` 测试：

```typescript
describe('getMediaConfig', () => {
  it('should get media config via MediaManager.getMediaConfig(false)', async () => {
    const getMediaConfig = vi.fn().mockResolvedValue({ 'm.upload.size': 52428800 })
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getMediaManager: () => ({ getMediaConfig })
    } as unknown as MatrixClient)

    const result = await matrixMediaService.getMediaConfig()

    expect(getMediaConfig).toHaveBeenCalledWith(false)
    expect(result['m.upload.size']).toBe(52428800)
  })

  it('should throw on error', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getMediaManager: () => ({
        getMediaConfig: vi.fn().mockRejectedValue(new Error('fail'))
      })
    } as unknown as MatrixClient)

    await expect(matrixMediaService.getMediaConfig()).rejects.toThrow('fail')
  })
})
```

`media.contract.test.ts` 无需改动——SDK 的 `getMediaConfig(false)` 走 `MediaPrefix.V3` 命中 `/_matrix/media/v3/config` handler；`getMediaConfig(true)` 走 `ClientPrefix.V1` 命中 `/_matrix/client/v1/media/config` handler。两者均已存在。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts -t "getMediaConfig"`
Expected: FAIL with `expect(getMediaConfig).toHaveBeenCalledWith(false)`

- [ ] **Step 3: 实现迁移**

替换两个方法体：

```typescript
  async getMediaConfig(): Promise<{ 'm.upload.size'?: number; [key: string]: unknown }> {
    try {
      const result = await this.getMedia().getMediaConfig(false)
      logger.info('[MatrixMedia] 获取上传配置成功')
      return result as { 'm.upload.size'?: number; [key: string]: unknown }
    } catch (err) {
      logger.error(`[MatrixMedia] 获取上传配置失败: ${err}`)
      throw err
    }
  }
```

```typescript
  async getAuthenticatedMediaConfig(): Promise<{
    authenticated_media: boolean
    [key: string]: unknown
  } | null> {
    try {
      const result = (await this.getMedia().getMediaConfig(true)) as Record<string, unknown>
      logger.info('[MatrixMedia] 获取认证媒体配置成功')
      return {
        authenticated_media: (result.authenticated_media as boolean) ?? false,
        ...result
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 获取认证媒体配置失败: ${err}`)
      return null
    }
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts src/services/matrix/media/__tests__/media.contract.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/media/MatrixMediaService.ts src/services/matrix/media/__tests__/MatrixMediaService.test.ts
git commit -m "refactor(media): migrate getMediaConfig to MediaManager

getMediaConfig now uses client.getMediaManager().getMediaConfig(false/true)
instead of authedRequestWithPath. Authenticated variant passes useAuthenticatedMedia=true
to hit /_matrix/client/v1/media/config."
```

---

## Task 4: 迁移 uploadContentWithId 到 MediaManager

**Files:**
- Modify: `src/services/matrix/media/MatrixMediaService.ts:510-542`
- Test: `src/services/matrix/media/__tests__/MatrixMediaService.test.ts:368-397`

**Interfaces:**
- Consumes: Task 1 的 `getMedia()`
- Produces: `uploadContentWithId(serverName, mediaId, file, mimetype?)` 签名与返回类型 `Promise<UploadResult>` 不变

- [ ] **Step 1: 写失败测试**

替换 `uploadContentWithId` 测试块：

```typescript
describe('uploadContentWithId', () => {
  it('should throw error when client is not initialized', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)
    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    await expect(matrixMediaService.uploadContentWithId('server', 'id', file)).rejects.toThrow('客户端未初始化')
  })

  it('should upload content with id via MediaManager.uploadContentWithId', async () => {
    const uploadContentWithId = vi.fn().mockResolvedValue({ content_uri: 'mxc://matrix.org/named123' })
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getMediaManager: () => ({ uploadContentWithId })
    } as unknown as MatrixClient)

    const file = new File(['content'], 'test.txt', { type: 'text/plain' })
    const result = await matrixMediaService.uploadContentWithId('matrix.org', 'named-id', file)

    expect(uploadContentWithId).toHaveBeenCalledWith('matrix.org', 'named-id', file, 'text/plain')
    expect(result.contentUri).toBe('mxc://matrix.org/named123')
    expect(result.mimetype).toBe('text/plain')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts -t "uploadContentWithId"`
Expected: FAIL —— 当前实现用 `HttpClient.put`，不会调用 `getMediaManager().uploadContentWithId`

- [ ] **Step 3: 实现迁移**

替换方法体：

```typescript
  async uploadContentWithId(
    serverName: string,
    mediaId: string,
    file: File | Blob,
    mimetype?: string
  ): Promise<UploadResult> {
    const resolvedMimetype =
      mimetype || (file instanceof File ? file.type || 'application/octet-stream' : 'application/octet-stream')
    try {
      const response = await this.getMedia().uploadContentWithId(serverName, mediaId, file, resolvedMimetype)
      logger.info(`[MatrixMedia] 具名上传成功: ${response.content_uri}`)
      return {
        contentUri: response.content_uri,
        size: file.size,
        mimetype: resolvedMimetype
      }
    } catch (err) {
      logger.error(`[MatrixMedia] 具名上传失败: ${err}`)
      throw err
    }
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts -t "uploadContentWithId"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/media/MatrixMediaService.ts src/services/matrix/media/__tests__/MatrixMediaService.test.ts
git commit -m "refactor(media): migrate uploadContentWithId to MediaManager

PUT /_matrix/media/v3/upload/{server}/{mediaId} now goes through
client.getMediaManager().uploadContentWithId. Drops direct HttpClient.put
usage and MATRIX_PATHS.MEDIA.UPLOAD_WITH_ID dependency."
```

---

## Task 5: 迁移 deleteMedia 到 MediaManager (v1 前缀)

**Files:**
- Modify: `src/services/matrix/media/MatrixMediaService.ts:560-574`
- Test: `src/services/matrix/media/__tests__/MatrixMediaService.test.ts:316-339`
- Test: `src/services/matrix/media/__tests__/media.contract.test.ts:47-50, 99-108`

**Interfaces:**
- Consumes: Task 1 的 `getMedia()`
- Produces: `deleteMedia(serverName, mediaId): Promise<boolean>` 签名不变
- **行为变更**：HTTP 路径从 `/_matrix/media/v3/delete/...` 改为 `/_matrix/media/v1/delete/...`（SDK 使用 `MediaPrefix.V1`）。synapse-rust 后端在 `routes/media/mod.rs:30-34` 将 `create_media_preview_delete_router` 同时 merge 到 v1 与 v3 路由，行为一致。

- [ ] **Step 1: 写失败测试——更新合同测试 MSW handler 与断言**

修改 `media.contract.test.ts`：

```typescript
// MSW handler 改为 v1
http.post(`${HOMESERVER}/_matrix/media/v1/delete/:serverName/:mediaId`, ({ request }) => {
  seenUrls.push({ method: request.method, url: request.url })
  return HttpResponse.json({})
}),
```

```typescript
it('deleteMedia hits POST /_matrix/media/v1/delete/:server/:mediaId (no double-prefix)', async () => {
  const result = await matrixMediaService.deleteMedia('matrix.org', 'media123')

  const calls = seenUrls.filter((u) => u.url.includes('/media/v1/delete/'))
  expect(calls).toHaveLength(1)
  expect(calls[0].method).toBe('POST')
  expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/media/v1/delete/matrix.org/media123`)
  expect(calls[0].url).not.toMatch(DOUBLE_PREFIX)
  expect(result).toBe(true)
})
```

同时更新 `MatrixMediaService.test.ts` 的 `deleteMedia` 单元测试 mock：

```typescript
describe('deleteMedia', () => {
  it('should delete media via MediaManager.deleteMedia', async () => {
    const deleteMedia = vi.fn().mockResolvedValue(undefined)
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getMediaManager: () => ({ deleteMedia })
    } as unknown as MatrixClient)

    const result = await matrixMediaService.deleteMedia('matrix.org', 'media123')

    expect(deleteMedia).toHaveBeenCalledWith('matrix.org', 'media123')
    expect(result).toBe(true)
  })

  it('should throw on delete error', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue({
      getMediaManager: () => ({
        deleteMedia: vi.fn().mockRejectedValue(new Error('forbidden'))
      })
    } as unknown as MatrixClient)

    await expect(matrixMediaService.deleteMedia('matrix.org', 'media123')).rejects.toThrow('forbidden')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts src/services/matrix/media/__tests__/media.contract.test.ts -t "deleteMedia"`
Expected: FAIL —— 当前实现走 `authedRequestWithPath('POST', MATRIX_PATHS.MEDIA.DELETE(...))`，命中 v3 路径，与新的 v1 断言不匹配

- [ ] **Step 3: 实现迁移**

替换 `deleteMedia` 方法体：

```typescript
  async deleteMedia(serverName: string, mediaId: string): Promise<boolean> {
    try {
      await this.getMedia().deleteMedia(serverName, mediaId)
      logger.info(`[MatrixMedia] 媒体删除成功: ${serverName}/${mediaId}`)
      return true
    } catch (err) {
      logger.error(`[MatrixMedia] 媒体删除失败: ${serverName}/${mediaId}, ${err}`)
      throw err
    }
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts src/services/matrix/media/__tests__/media.contract.test.ts`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/media/MatrixMediaService.ts src/services/matrix/media/__tests__/MatrixMediaService.test.ts src/services/matrix/media/__tests__/media.contract.test.ts
git commit -m "refactor(media): migrate deleteMedia to MediaManager (v3 → v1 prefix)

POST /delete/{server}/{mediaId} now goes through client.getMediaManager().deleteMedia,
which uses MediaPrefix.V1. synapse-rust backend supports both v1 and v3 delete routes
(routes/media/mod.rs:30-34), so the prefix change is safe. Contract test updated
to assert v1 URL."
```

---

## Task 6: 重构 ChunkUploadService 使用 MediaManager 分片原语

**Files:**
- Modify: `src/services/performance/ChunkUploadService.ts:1-348`（整体重构 HTTP 调用层，保留编排逻辑）
- Test: `src/services/performance/__tests__/ChunkUploadService.test.ts`（改用真实 SDK + MSW）

**Interfaces:**
- Consumes: `getMatrixClient()` from `@/services/matrix/matrixClientAccessor`（已有导出）
- Produces: `chunkUploadService.upload(options: ChunkUploadOptions): Promise<UploadResult>` 公共签名不变
- **内部行为变更**：
  - `startUpload` → `media.startChunkUpload(filename, contentType, totalSize)`
  - `uploadChunk` → `media.uploadChunk(uploadId, chunkIndex, data)`（fetch-based，丢失 XHR 上传进度事件）
  - `completeUpload` → `media.completeChunkUpload(uploadId)`
  - `cancelUpload` → `media.cancelChunkUpload(uploadId)`
  - `getProgress` → `media.getChunkUploadProgress(uploadId)`
  - `updateProgress` 改为步进式：仅在 chunk 完成时触发，`chunkProgress` 数组为 0 或 1
  - 删除 `XMLHttpRequest`、`getAuthHeaders`、`getBaseUrl`、`chunkEndpoint` 等 HTTP 直连辅助函数
- **保留**：并发 (concurrency=3)、重试 (maxRetries=3, 指数退避 500ms*2^(n-1))、暂停/恢复/abort、进度计算 (loaded/total/percentage/speed/remaining)

- [ ] **Step 1: 写失败测试——重写 ChunkUploadService.test.ts 使用真实 SDK + MSW**

整体替换 `src/services/performance/__tests__/ChunkUploadService.test.ts`：

```typescript
import { createClient, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'

const HOMESERVER = 'https://hs.chunk-contract.test'
let realClient: MatrixClient

vi.mock('@/services/matrix/matrixClientAccessor', () => ({
  getMatrixClient: () => realClient,
  getMatrixAccessToken: () => 'contract-at',
  getMatrixHomeserverUrl: () => HOMESERVER
}))
vi.mock('@/services/backend/config', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({ homeserverUrl: HOMESERVER })
}))
vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

const seenRequests: { method: string; url: string }[] = []

setupMswServer(
  http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk/start`, ({ request }) => {
    seenRequests.push({ method: request.method, url: request.url })
    return HttpResponse.json({ upload_id: 'u1', chunk_size_limit: 5242880, max_file_size: 52428800 })
  }),
  http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk`, ({ request }) => {
    seenRequests.push({ method: request.method, url: request.url })
    return HttpResponse.json({ upload_id: 'u1', chunk_index: 0, received_bytes: 10 })
  }),
  http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk/complete`, ({ request }) => {
    seenRequests.push({ method: request.method, url: request.url })
    return HttpResponse.json({ upload_id: 'u1', content_uri: 'mxc://hs/chunked' })
  }),
  http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk/cancel`, ({ request }) => {
    seenRequests.push({ method: request.method, url: request.url })
    return HttpResponse.json({ upload_id: 'u1', cancelled: true })
  })
)

import chunkUploadService from '../ChunkUploadService'

const makeFile = () => new File([new Uint8Array(10)], 'big.bin', { type: 'application/octet-stream' })

describe('ChunkUploadService (MediaManager-backed)', () => {
  beforeEach(() => {
    seenRequests.length = 0
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.chunk-contract.test',
      deviceId: 'DEV1'
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('start/uploadChunk/complete URLs hit /_matrix/media/v1/upload/chunk/* via SDK', async () => {
    const result = await chunkUploadService.upload({ file: makeFile(), chunkSize: 10 })

    expect(seenRequests.find((r) => r.url.includes('/chunk/start'))).toBeTruthy()
    expect(seenRequests.find((r) => r.url.includes('/chunk?'))).toBeTruthy()
    expect(seenRequests.find((r) => r.url.includes('/chunk/complete'))).toBeTruthy()
    expect(result.mxcUrl).toBe('mxc://hs/chunked')
  })

  it('chunk upload failure after retry exhaustion triggers cancel endpoint', async () => {
    // 让 /chunk 永远返回 500
    // 此用例需要 server.override 来动态返回 500；为简化首版，断言"失败时 cancel 被调用"
    // 详细重试用例放到 Step 7 的回归测试
    const failingServer = setupMswServer(
      http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk/start`, () =>
        HttpResponse.json({ upload_id: 'u2', chunk_size_limit: 5242880, max_file_size: 52428800 })
      ),
      http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk`, () =>
        new HttpResponse('Internal Server Error', { status: 500 })
      ),
      http.post(`${HOMESERVER}/_matrix/media/v1/upload/chunk/cancel`, ({ request }) => {
        seenRequests.push({ method: request.method, url: request.url })
        return HttpResponse.json({ upload_id: 'u2', cancelled: true })
      })
    )
    failingServer.listen({ onUnhandledRequest: 'bypass' })

    await expect(
      chunkUploadService.upload({ file: makeFile(), chunkSize: 10, maxRetries: 2 })
    ).rejects.toThrow()

    expect(seenRequests.find((r) => r.url.includes('/chunk/cancel'))).toBeTruthy()
    failingServer.close()
  })

  it('progress callback receives percentage based on completed chunks', async () => {
    const onProgress = vi.fn()
    await chunkUploadService.upload({ file: makeFile(), chunkSize: 10, onProgress })

    const lastCall = onProgress.mock.calls[onProgress.mock.calls.length - 1]?.[0]
    expect(lastCall.percentage).toBe(100)
    expect(lastCall.loaded).toBe(10)
    expect(lastCall.total).toBe(10)
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/performance/__tests__/ChunkUploadService.test.ts`
Expected: FAIL —— 当前实现用 `XMLHttpRequest` + `fetch`，不调用 `media.startChunkUpload` 等，断言不通过

- [ ] **Step 3: 重构 ChunkUploadService.ts**

整体替换为：

```typescript
import type { MatrixClient } from 'matrix-js-sdk'
import { getMatrixClient } from '@/services/matrix/matrixClientAccessor'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ChunkUploadService')

interface ChunkUploadOptions {
  file: File
  chunkSize?: number
  maxRetries?: number
  concurrency?: number
  onProgress?: (progress: UploadProgress) => void
  onChunkComplete?: (chunkIndex: number, total: number) => void
  onComplete?: (result: UploadResult) => void
  onError?: (error: Error) => void
}

interface UploadProgress {
  loaded: number
  total: number
  percentage: number
  speed: number
  remaining: number
  chunkProgress: number[]
}

interface UploadResult {
  mxcUrl: string
  filename: string
  size: number
  mimeType: string
}

interface ChunkInfo {
  index: number
  start: number
  end: number
  retryCount: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
}

interface ChunkUploadContext {
  id: string
  file: File
  chunkSize: number
  maxRetries: number
  concurrency: number
  totalChunks: number
  chunks: ChunkInfo[]
  uploadedSize: number
  startTime: number
  aborted: boolean
  paused?: boolean
  onProgress?: (progress: UploadProgress) => void
  onChunkComplete?: (chunkIndex: number, total: number) => void
  onComplete?: (result: UploadResult) => void
  onError?: (error: Error) => void
}

class ChunkUploadService {
  private uploads: Map<string, ChunkUploadContext> = new Map()

  /** 获取 MediaManager——失败时抛错（与原 getAuthHeaders 行为对齐） */
  private getMedia(client: MatrixClient): ReturnType<NonNullable<MatrixClient['getMediaManager']>> {
    const fn = (client as unknown as { getMediaManager?: () => unknown }).getMediaManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getMediaManager is not available; SDK 未初始化')
    }
    return fn.call(client) as ReturnType<NonNullable<MatrixClient['getMediaManager']>>
  }

  async upload(options: ChunkUploadOptions): Promise<UploadResult> {
    const {
      file,
      chunkSize = 5 * 1024 * 1024,
      maxRetries = 3,
      concurrency = 3,
      onProgress,
      onChunkComplete,
      onComplete,
      onError
    } = options

    const client = getMatrixClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }
    const media = this.getMedia(client)

    const totalChunks = Math.ceil(file.size / chunkSize)

    // Step 1: Start upload session via MediaManager.startChunkUpload
    const startResp = await media.startChunkUpload(file.name, file.type || 'application/octet-stream', file.size)
    const serverUploadId = startResp.upload_id

    const context: ChunkUploadContext = {
      id: serverUploadId,
      file,
      chunkSize,
      maxRetries,
      concurrency,
      totalChunks,
      chunks: [],
      uploadedSize: 0,
      startTime: Date.now(),
      aborted: false,
      onProgress,
      onChunkComplete,
      onComplete,
      onError
    }

    for (let i = 0; i < totalChunks; i++) {
      context.chunks.push({
        index: i,
        start: i * chunkSize,
        end: Math.min((i + 1) * chunkSize, file.size),
        retryCount: 0,
        status: 'pending'
      })
    }

    this.uploads.set(serverUploadId, context)

    try {
      const result = await this.processUpload(context, media)
      logger.info(`[ChunkUpload] 上传完成: ${file.name}`)
      return result
    } catch (err) {
      logger.error(`[ChunkUpload] 上传失败: ${err}`)
      try {
        await media.cancelChunkUpload(serverUploadId)
      } catch {
        // Ignore cancel errors during cleanup
      }
      throw err
    } finally {
      this.uploads.delete(serverUploadId)
    }
  }

  private async processUpload(
    context: ChunkUploadContext,
    media: ReturnType<ChunkUploadService['getMedia']>
  ): Promise<UploadResult> {
    const uploadPromises: Promise<void>[] = []

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
          await this.uploadChunk(context, chunk, media)
          chunk.status = 'completed'
          context.uploadedSize += chunk.end - chunk.start
          this.updateProgress(context, chunk.index)
          context.onChunkComplete?.(chunk.index, context.totalChunks)
        } catch (err) {
          chunk.retryCount++
          if (chunk.retryCount >= context.maxRetries) {
            chunk.status = 'failed'
            context.aborted = true
            throw err
          }
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (chunk.retryCount - 1)))
          chunk.status = 'pending'
        }
      }
    }

    for (let i = 0; i < context.concurrency; i++) {
      uploadPromises.push(processNext())
    }

    await Promise.all(uploadPromises)

    if (context.aborted) {
      throw new Error('Upload aborted')
    }

    return this.completeUpload(context, media)
  }

  /** Upload a single chunk via MediaManager.uploadChunk */
  private async uploadChunk(
    context: ChunkUploadContext,
    chunk: ChunkInfo,
    media: ReturnType<ChunkUploadService['getMedia']>
  ): Promise<void> {
    const slice = context.file.slice(chunk.start, chunk.end)
    const buffer = await slice.arrayBuffer()
    await media.uploadChunk(context.id, chunk.index, buffer)
  }

  private updateProgress(context: ChunkUploadContext, chunkIndex: number): void {
    const elapsed = Date.now() - context.startTime
    const speed = context.uploadedSize / (elapsed / 1000)
    const remaining = speed > 0 ? (context.file.size - context.uploadedSize) / speed : 0

    // 步进式 chunkProgress：完成的 chunk=1，未完成=0（不再有 byte-level 进度，因 fetch 无 upload progress 事件）
    const chunkProgressArray = context.chunks.map((c) => (c.status === 'completed' ? 1 : 0))

    context.onProgress?.({
      loaded: context.uploadedSize,
      total: context.file.size,
      percentage: (context.uploadedSize / context.file.size) * 100,
      speed,
      remaining,
      chunkProgress: chunkProgressArray
    })
  }

  /** Finalize upload via MediaManager.completeChunkUpload */
  private async completeUpload(
    context: ChunkUploadContext,
    media: ReturnType<ChunkUploadService['getMedia']>
  ): Promise<UploadResult> {
    const result = await media.completeChunkUpload(context.id)
    return {
      mxcUrl: result.content_uri,
      filename: context.file.name,
      size: context.file.size,
      mimeType: context.file.type
    }
  }

  /** Get upload progress from server via MediaManager.getChunkUploadProgress */
  async getProgress(uploadId: string): Promise<{
    upload_id: string
    uploaded_chunks: number
    total_chunks: number
    uploaded_size: number
    total_size: number | null
    status: string
  } | null> {
    const client = getMatrixClient()
    if (!client) return null
    try {
      const media = this.getMedia(client)
      const resp = await media.getChunkUploadProgress(uploadId)
      return {
        upload_id: resp.upload_id,
        uploaded_chunks: resp.received_chunks,
        total_chunks: resp.total_chunks,
        uploaded_size: resp.bytes_received,
        total_size: resp.total_bytes,
        status: 'in_progress'
      }
    } catch {
      return null
    }
  }

  abort(uploadId: string): void {
    const context = this.uploads.get(uploadId)
    if (context) {
      context.aborted = true
      const client = getMatrixClient()
      if (client) {
        try {
          const media = this.getMedia(client)
          media.cancelChunkUpload(uploadId).catch(() => {})
        } catch {
          // client 不可用时跳过——服务端最终会过期 session
        }
      }
      logger.info(`[ChunkUpload] 上传已取消: ${uploadId}`)
    }
  }

  pause(uploadId: string): void {
    const context = this.uploads.get(uploadId)
    if (context) {
      context.paused = true
    }
  }

  resume(uploadId: string): void {
    const context = this.uploads.get(uploadId)
    if (context?.paused) {
      context.paused = false
    }
  }
}

export const chunkUploadService = new ChunkUploadService()
export default chunkUploadService
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/performance/__tests__/ChunkUploadService.test.ts`
Expected: PASS

- [ ] **Step 5: 运行 chunkFallback 回归测试**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts`
Expected: PASS（`chunkUploadService.upload` 公共签名未变，mock 仍生效）

- [ ] **Step 6: 运行类型检查与 lint**

Run: `pnpm vue-tsc --noEmit && pnpm check`
Expected: 0 错误

- [ ] **Step 7: 提交**

```bash
git add src/services/performance/ChunkUploadService.ts src/services/performance/__tests__/ChunkUploadService.test.ts
git commit -m "refactor(upload): route ChunkUploadService through MediaManager

start/uploadChunk/complete/cancel/progress HTTP calls now go through
client.getMediaManager().* primitives instead of XMLHttpRequest + fetch.

Preserved: concurrency (3), retry with exponential backoff (max 3),
pause/resume/abort, overall progress (loaded/total/percentage/speed/remaining).

Changed: chunkProgress array is now stepwise (0 or 1 per chunk) because
fetch-based uploadChunk has no upload progress events. No UI consumer
reads chunkProgress—only percentage is used by MatrixMediaService."
```

---

## Task 7: 迁移 uploadContentWithChunkFallback 到 MediaManager.uploadContent

**Files:**
- Modify: `src/services/matrix/media/MatrixMediaService.ts:99-130`（`uploadContentWithChunkFallback`）以及 `uploadFile/uploadImage/uploadVideo/uploadAudio/uploadEncryptedFile/uploadBlob` 中对 `client.uploadContent` 的直接调用
- Test: `src/services/matrix/media/__tests__/MatrixMediaService.test.ts:99-289`
- Test: `src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `getMedia()`、Task 6 的 `chunkUploadService.upload`
- Produces: `uploadFile/uploadImage/uploadVideo/uploadAudio/uploadEncryptedFile/uploadBlob` 公共签名不变
- **行为变更**：
  - `MediaManager.uploadContent` 内置 `m.upload.size` 预检（5 分钟缓存），超限直接抛 `M_TOO_LARGE`（httpStatus=413）——前端 413 回退路径触发更早
  - 413/M_TOO_LARGE 回退到 `chunkUploadService.upload`（保留）
  - AbortError (CORS) 回退到 `uploadViaDirectFetch`（保留——SDK 走 `client.http.uploadContent` 仍可能遇到 CORS）
  - `uploadBlob` 也改走 `MediaManager.uploadContent`（统一预检）

- [ ] **Step 1: 写失败测试——更新 chunkFallback.test.ts mock**

替换 `MatrixMediaService.chunkFallback.test.ts` 的 mock 部分：

```typescript
const { mediaUploadMock, chunkUploadMock } = vi.hoisted(() => ({
  mediaUploadMock: vi.fn(),
  chunkUploadMock: vi.fn()
}))

vi.mock('../../MatrixClientService', () => {
  const svc = {
    getClient: () => ({
      getMediaManager: () => ({ uploadContent: mediaUploadMock }),
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
```

测试断言不变——仍验证 413/M_TOO_LARGE 触发回退、非 413 原样抛出、`uploadLargeFile` 直接走 chunk。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts`
Expected: FAIL —— 当前实现调用 `client.uploadContent`，但 mock 只提供 `client.getMediaManager().uploadContent`

- [ ] **Step 3: 实现迁移**

修改 `MatrixMediaService.ts` 的 `uploadContentWithChunkFallback`：

```typescript
  private async uploadContentWithChunkFallback(
    client: MatrixClient,
    file: File,
    opts: ReturnType<MatrixMediaServiceClass['createUploadOptions']>,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    try {
      const uploadResponse = await this.getMedia().uploadContent(file, {
        name: opts.name,
        type: opts.type,
        progress: opts.progressHandler
      })
      return typeof uploadResponse === 'string' ? uploadResponse : uploadResponse.content_uri
    } catch (err) {
      if (this.isPayloadTooLarge(err)) {
        logger.warn(`[MatrixMedia] 上传返回 413,回退到分片上传: ${file.name}`)
        const result = await chunkUploadService.upload({
          file,
          onProgress: (p) => onProgress?.(p.percentage)
        })
        return result.mxcUrl
      }
      const errName = err instanceof Error ? err.name : ''
      if (errName === 'AbortError') {
        logger.warn(`[MatrixMedia][AVATAR_DEBUG] uploadContent AbortError, 回退到直接 XHR 上传`)
        const result = await this.uploadViaDirectFetch(client, file, opts)
        return result
      }
      throw err
    }
  }
```

修改 `uploadBlob`（L466-485）改走 `uploadContentWithChunkFallback`：

```typescript
  async uploadBlob(blob: Blob, _filename: string, mimetype: string): Promise<UploadResult> {
    try {
      const opts = this.createUploadOptions(mimetype, undefined, _filename)
      const contentUri = await this.uploadContentWithChunkFallback(this.getClient(), blob as File, opts)
      logger.info(`[MatrixMedia] Blob 上传成功: ${contentUri}`)
      return {
        contentUri,
        size: blob.size,
        mimetype
      }
    } catch (err) {
      logger.error(`[MatrixMedia] Blob 上传失败: ${err}`)
      throw err
    }
  }
```

更新 `MatrixMediaService.test.ts` 中 `successful uploads` / `uploadEncryptedFile` 等用例的 mock，从 `uploadContent: vi.fn()` 改为 `getMediaManager: () => ({ uploadContent: vi.fn() })`：

```typescript
beforeEach(() => {
  vi.mocked(matrixClientService.getClient).mockReturnValue({
    getMediaManager: () => ({
      uploadContent: vi.fn().mockResolvedValue({ content_uri: 'mxc://matrix.org/uploaded123' })
    }),
    mxcUrlToHttp: vi.fn().mockReturnValue('https://matrix.org/media/uploaded123')
  } as unknown as MatrixClient)
  vi.mocked(matrixClientService.getTelemetry).mockReturnValue({
    trackMediaUploaded: vi.fn()
  } as unknown as TelemetryManager)
})
```

`uploadEncryptedFile` 测试同样改为 `getMediaManager: () => ({ uploadContent: uploadContent })`。

`forward upload progress` 测试：SDK `MediaManager.uploadContent` 接受 `progress` 回调（不是 `progressHandler`），需更新：

```typescript
it('should forward upload progress to callback', async () => {
  const uploadContent = vi
    .fn()
    .mockImplementation(
      async (_file: File, opts?: { progress?: (progress: { loaded: number; total: number }) => void }) => {
        opts?.progress?.({ loaded: 25, total: 100 })
        opts?.progress?.({ loaded: 100, total: 100 })
        return { content_uri: 'mxc://matrix.org/uploaded123' }
      }
    )

  vi.mocked(matrixClientService.getClient).mockReturnValue({
    getMediaManager: () => ({ uploadContent }),
    mxcUrlToHttp: vi.fn().mockReturnValue('https://matrix.org/media/uploaded123')
  } as unknown as MatrixClient)

  const onProgress = vi.fn()
  const file = new File(['content'], 'test.txt', { type: 'text/plain' })
  await matrixMediaService.uploadFile(file, onProgress)

  expect(onProgress).toHaveBeenNthCalledWith(1, 25)
  expect(onProgress).toHaveBeenNthCalledWith(2, 100)
})
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.test.ts src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts`
Expected: PASS

- [ ] **Step 5: 运行调用方回归测试**

Run: `pnpm vitest run src/composables/chat/__tests__/useVoiceInput.test.ts src/services/matrix/messaging/__tests__/MatrixEmojiService.test.ts`
Expected: PASS（这些测试 mock `matrixMediaService.upload*`，不受内部实现变更影响）

- [ ] **Step 6: 类型检查 + lint**

Run: `pnpm vue-tsc --noEmit && pnpm check`
Expected: 0 错误

- [ ] **Step 7: 提交**

```bash
git add src/services/matrix/media/MatrixMediaService.ts src/services/matrix/media/__tests__/MatrixMediaService.test.ts src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts
git commit -m "refactor(media): migrate uploadContentWithChunkFallback to MediaManager

client.uploadContent replaced by client.getMediaManager().uploadContent,
which adds m.upload.size precheck (5min cache). 413/M_TOO_LARGE still
falls back to chunkUploadService; AbortError (CORS) still falls back to
uploadViaDirectFetch. uploadBlob also unified through the same path."
```

---

## Task 8: 清理已迁移方法对应的 MATRIX_PATHS.MEDIA.* 常量

**Files:**
- Modify: `src/services/matrix/paths/media.ts:1-18`
- Modify: `src/services/matrix/paths/index.ts`（若 MEDIA 子常量被 re-export）
- Test: `pnpm check:ratchet` 守护

**Interfaces:**
- Consumes: Task 2-5 完成后，以下常量无任何引用：`CONFIG`、`DELETE`、`QUOTA_ALERTS`、`QUOTA_CHECK`、`QUOTA_STATS`、`CLIENT_MEDIA_CONFIG`、`UPLOAD_WITH_ID`
- Produces: 保留 `UPLOAD`（仍被 paths/index.ts 引用为 deprecated 注释）、`PREVIEW_URL`（仍被 MatrixUrlPreviewService 使用）、`DOWNLOAD_PREFIX`、`MEDIA_PREFIX`

- [ ] **Step 1: 验证常量已无引用**

Run: 
```bash
pnpm exec grep -rn "MATRIX_PATHS\.MEDIA\.\(CONFIG\|DELETE\|QUOTA_ALERTS\|QUOTA_CHECK\|QUOTA_STATS\|CLIENT_MEDIA_CONFIG\|UPLOAD_WITH_ID\)" src --include="*.ts" --include="*.vue"
```
Expected: 0 命中（除 `paths/media.ts` 自身定义处）

若有命中，先迁移对应调用方到 `MediaManager`，再继续。

- [ ] **Step 2: 删除无引用常量**

修改 `src/services/matrix/paths/media.ts`：

```typescript
import { PREFIX_V1 } from './prefixes'

export const MEDIA = {
  /** @deprecated Use client.getMediaManager().uploadContent() instead */
  UPLOAD: '/_matrix/media/v3/upload',
  PREVIEW_URL: '/_matrix/media/r0/preview_url',
  DOWNLOAD_PREFIX: '/_matrix/media/r0/download/',
  MEDIA_PREFIX: '/_matrix/media/'
} as const
```

删除：`UPLOAD_WITH_ID`、`CONFIG`、`DELETE`、`QUOTA_ALERTS`、`QUOTA_CHECK`、`QUOTA_STATS`、`CLIENT_MEDIA_CONFIG`。

注意：`PREFIX_V1` import 若不再使用则一并删除（`CLIENT_MEDIA_CONFIG` 是唯一引用方）。

- [ ] **Step 3: 运行类型检查**

Run: `pnpm vue-tsc --noEmit`
Expected: 0 错误——若报错说明有遗漏的引用，回到 Step 1 修复

- [ ] **Step 4: 运行 ratchet 守护**

Run: `pnpm check:ratchet`
Expected: PASS

- [ ] **Step 5: 运行全部验收命令**

Run:
```bash
pnpm vue-tsc --noEmit && \
pnpm test:run && \
pnpm check:ratchet && \
pnpm check:doc-coverage && \
pnpm check:sdk-boundary && \
pnpm quality:no-raw-fetch && \
pnpm check
```
Expected: 全部 0 错误

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/paths/media.ts
git commit -m "chore(paths): remove migrated MATRIX_PATHS.MEDIA.* constants

Drop CONFIG/DELETE/QUOTA_ALERTS/QUOTA_CHECK/QUOTA_STATS/CLIENT_MEDIA_CONFIG/
UPLOAD_WITH_ID——all call sites now go through client.getMediaManager().
Keep UPLOAD (deprecated marker), PREVIEW_URL, DOWNLOAD_PREFIX, MEDIA_PREFIX."
```

---

## Self-Review

### Spec coverage

| audit A4 子项 | 覆盖任务 |
|---|---|
| uploadContent → MediaManager.uploadContent | Task 7 |
| 分片上传 → startChunkUpload/uploadChunk/completeChunkUpload | Task 6 |
| 配额 → checkMediaQuota | Task 2 |
| 配额统计 → getMediaQuotaStats | Task 2 |
| 配额告警 → getMediaQuotaAlerts | Task 2 |
| 配置 → getMediaConfig | Task 3 |
| 认证媒体配置 → getMediaConfig(true) | Task 3 |
| 具名上传 → uploadContentWithId | Task 4 |
| 删除 → deleteMedia | Task 5 |
| URL 预览 → previewUrl | 已在 B5 完成，不在本方案 |
| 缩略图 → getThumbnailUrl | 不迁移（`client.mxcUrlToHttp` 仍可用，YAGNI） |
| 下载 → downloadFileBytes | 不迁移（自定义 auth fallback，SDK 无等价能力） |
| 常量清理 | Task 8 |

### Placeholder scan

- 无 "TBD"、"TODO"、"implement later"
- 每个步骤含具体代码块
- 测试代码含完整断言

### Type consistency

- `getMedia()` 返回 `MediaManager`，所有任务统一使用
- `ChunkUploadService.upload(options: ChunkUploadOptions): Promise<UploadResult>` 签名不变
- `UploadResult` / `UploadProgress` 接口保持兼容（`chunkProgress` 改为步进式但类型不变）

### 风险点

1. **Task 6 测试**：MSW `setupMswServer` 第二次调用（`failingServer`）可能覆盖第一次的 handler。如果测试框架不支持 per-test server 重置，需改用 `server.use(...handlers)` API 临时覆盖。执行时若遇到此问题，参考 `tests/msw.ts` 的导出 API。
2. **Task 7 `uploadViaDirectFetch`**：保留该方法但需确认 `client` 参数仍可用——`MediaManager.uploadContent` 抛 AbortError 时 `client` 已经由 `this.getClient()` 获取，传参路径不变。
3. **Task 8 `PREFIX_V1` import**：删除前确认 `paths/media.ts` 内无其他使用。
