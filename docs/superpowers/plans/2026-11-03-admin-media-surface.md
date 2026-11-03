# Admin 媒体子域 UI 补齐实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 admin/media.rs 中 20 条此前无页面的媒体管理端点补齐服务层封装、composable、桌面管理页与导航入口，全部走 SDK `AdminManager` 媒体方法，不新增任何平行 HTTP 实现。

**Architecture:** 沿用现有四层链路：`MediaService`（窄类型 + SDK 调用 + snake_case→视图形状）→ `AdminFacadeService` 薄委托（`AdminFacadeDomainMethods`）→ `useAdminMedia` composable（状态与编排）→ `AdminMedia.vue` 壳 + 3 个面板组件。quota 与 purge 保留在 `AdminMaintenance.vue`，本页不重复。

**Tech Stack:** Vue 3 `<script setup>`、TypeScript、Naive UI、UnoCSS、Vitest、vue-i18n、matrix-js-sdk `AdminManager`。

## Global Constraints

- 禁止在 `src/services/matrix/admin/**` 之外直连 SDK；类型只能从 `@/services/matrix/sdk` 导入。
- 禁止硬编码颜色，统一使用 `--tjg-*` token 或 UnoCSS 主题类；图标必须 SVG。
- 新建 `.vue` 文件不得超过 400 行（`pnpm check:file-size` 对新文件红线），超过即拆分。
- 所有 pnpm 命令必须带 `PATH=/opt/homebrew/opt/node@22/bin:$PATH` 前缀（sandbox 默认 Node 26）。
- i18n 以 `locales/zh-CN/admin.json` 为基准，`locales/en/admin.json` 键必须完全对齐（缺失键 `check-i18n` 直接失败）。
- admin 仅桌面端注册：路由只加在 `src/router/routes/desktop.ts`，不得进入 `src/mobile/**`。
- 响应形状以 SDK 类型注释为准：`MediaPage.next_batch` 是字符串游标、`total` 是本页条数；`GlobalMediaQuarantineChangesResponse.next_batch` 是数值游标且不接受 `limit`；`getUserMedia` 无分页；`MediaProtectionResponse` 与 `MediaUnprotectionResponse` 不同形。

---

### Task 1: SDK 类型出口 + MediaService 补齐 18 个方法

**Files:**
- Modify: `src/services/matrix/sdk.ts`（在 admin 段追加媒体响应类型导出）
- Modify: `src/services/matrix/admin/MediaService.ts`
- Test: `src/services/matrix/admin/__tests__/MediaService.test.ts`

**Interfaces:**
- Consumes: `AdminManager` flat media 方法（`getMediaInfo` / `getMediaInfoByServer` / `deleteMediaByServer` / `deleteMediaByPolicy` / `quarantineMedia` / `unquarantineMedia` / `protectMedia` / `protectMediaById` / `unprotectMedia` / `getGlobalMediaQuarantineChanges` / `getMediaQuarantineChanges` / `getRoomMedia` / `deleteRoomMedia` / `quarantineRoomMedia` / `unquarantineRoomMedia` / `getUserMedia` / `deleteUserMedia` / `quarantineUserMedia`）。
- Produces（供 Task 2/3 使用，返回 `null` 表示调用失败而非抛错）：

```ts
getMediaInfo(mediaId: string): Promise<MediaInfo | null>
getMediaInfoByServer(serverName: string, mediaId: string): Promise<MediaInfo | null>
deleteMediaByServer(serverName: string, mediaId: string): Promise<void>
quarantineMedia(serverName: string, mediaId: string): Promise<void>
unquarantineMedia(serverName: string, mediaId: string): Promise<void>
protectMedia(serverName: string, mediaId: string): Promise<MediaProtectionResponse | null>
protectMediaById(mediaId: string): Promise<MediaProtectionResponse | null>
unprotectMedia(mediaId: string): Promise<MediaUnprotectionResponse | null>
deleteMediaByPolicy(options: { beforeTs?: number; maxSize?: number }): Promise<{ deleted: number } | null>
getGlobalQuarantineChanges(from?: number): Promise<GlobalMediaQuarantineChangesResponse | null>
getMediaQuarantineChanges(mediaId: string, since?: number): Promise<MediaQuarantineChangesResponse | null>
getRoomMedia(roomId: string, from?: string, limit?: number): Promise<RoomMediaPage | null>
deleteRoomMedia(roomId: string, mediaId: string): Promise<void>
quarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaQuarantineResponse | null>
unquarantineRoomMedia(roomId: string, userId?: string): Promise<RoomMediaUnquarantineResponse | null>
getUserMedia(userId: string): Promise<UserMediaList | null>
deleteUserMedia(userId: string): Promise<void>
quarantineUserMedia(userId: string): Promise<UserMediaQuarantineResponse | null>
```

- [ ] **Step 1: 在 `sdk.ts` 追加类型出口**

在已有 admin 类型导出块内追加（顺序按字母）：

```ts
export type {
  GlobalMediaQuarantineChange,
  GlobalMediaQuarantineChangesResponse,
  MediaInfo,
  MediaPage,
  MediaProtectionResponse,
  MediaQuarantineChange,
  MediaQuarantineChangesResponse,
  MediaUnprotectionResponse,
  RoomMediaItem,
  RoomMediaPage,
  RoomMediaQuarantineResponse,
  RoomMediaUnquarantineResponse,
  UserMediaList,
  UserMediaQuarantineResponse
} from 'matrix-js-sdk/admin'
```

- [ ] **Step 2: 写失败测试（`MediaService.test.ts` 追加）**

```ts
import { describe, expect, it, vi } from 'vitest'
import { AdminMediaService } from '../MediaService'

function makeAdmin(overrides: Record<string, unknown> = {}) {
  return {
    getMedia: vi.fn().mockResolvedValue({ media: [], total: 0, next_batch: null }),
    getMediaInfo: vi.fn().mockResolvedValue({ media_id: 'm1', media_type: 'image/png' }),
    getMediaInfoByServer: vi.fn().mockResolvedValue({ media_id: 'm1' }),
    deleteMedia: vi.fn().mockResolvedValue(undefined),
    deleteMediaByServer: vi.fn().mockResolvedValue(undefined),
    getMediaQuota: vi.fn().mockResolvedValue({}),
    purgeMediaCache: vi.fn().mockResolvedValue({ deleted: 0 }),
    deleteMediaByPolicy: vi.fn().mockResolvedValue({ deleted: 3 }),
    quarantineMedia: vi.fn().mockResolvedValue(undefined),
    unquarantineMedia: vi.fn().mockResolvedValue(undefined),
    protectMedia: vi.fn().mockResolvedValue({ stream_id: 1, protected: true }),
    protectMediaById: vi.fn().mockResolvedValue({ stream_id: 1, protected: true }),
    unprotectMedia: vi.fn().mockResolvedValue({ stream_id: 1, unprotected: true }),
    getGlobalMediaQuarantineChanges: vi.fn().mockResolvedValue({ next_batch: 0, changes: [] }),
    getMediaQuarantineChanges: vi.fn().mockResolvedValue({ changes: [], total: 0 }),
    getRoomMedia: vi.fn().mockResolvedValue({ media: [], total: 0, next_batch: null }),
    deleteRoomMedia: vi.fn().mockResolvedValue(undefined),
    quarantineRoomMedia: vi.fn().mockResolvedValue({ room_id: '!r:a', quarantined: true }),
    unquarantineRoomMedia: vi.fn().mockResolvedValue({ room_id: '!r:a', quarantined: false }),
    getUserMedia: vi.fn().mockResolvedValue({ media: [], total: 0 }),
    deleteUserMedia: vi.fn().mockResolvedValue(undefined),
    quarantineUserMedia: vi.fn().mockResolvedValue({ user_id: '@u:a', quarantined: true }),
    ...overrides
  }
}

it('getMediaInfo 出错时返回 null', async () => {
  const admin = makeAdmin({ getMediaInfo: vi.fn().mockRejectedValue(new Error('boom')) })
  const svc = new AdminMediaService(() => admin as never)
  expect(await svc.getMediaInfo('m1')).toBeNull()
})

it('quarantineMedia 透传 serverName 与 mediaId', async () => {
  const admin = makeAdmin()
  const svc = new AdminMediaService(() => admin as never)
  await svc.quarantineMedia('a.example', 'm1')
  expect(admin.quarantineMedia).toHaveBeenCalledWith('a.example', 'm1')
})

it('deleteMediaByPolicy 透传过滤条件', async () => {
  const admin = makeAdmin()
  const svc = new AdminMediaService(() => admin as never)
  expect(await svc.deleteMediaByPolicy({ beforeTs: 1000, maxSize: 2048 })).toEqual({ deleted: 3 })
  expect(admin.deleteMediaByPolicy).toHaveBeenCalledWith({ beforeTs: 1000, maxSize: 2048 })
})

it('getGlobalQuarantineChanges 默认游标为 0', async () => {
  const admin = makeAdmin()
  const svc = new AdminMediaService(() => admin as never)
  await svc.getGlobalQuarantineChanges()
  expect(admin.getGlobalMediaQuarantineChanges).toHaveBeenCalledWith({ from: 0 })
})

it('getUserMedia 出错时返回 null', async () => {
  const admin = makeAdmin({ getUserMedia: vi.fn().mockRejectedValue(new Error('boom')) })
  const svc = new AdminMediaService(() => admin as never)
  expect(await svc.getUserMedia('@u:a')).toBeNull()
})
```

- [ ] **Step 3: 运行测试确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/services/matrix/admin/__tests__/MediaService.test.ts`
Expected: FAIL，`svc.getMediaInfo is not a function` 等。

- [ ] **Step 4: 实现服务方法**

`MediaService.ts` 顶部类型改为 `Pick`：

```ts
import type {
  AdminManager,
  GlobalMediaQuarantineChangesResponse,
  MediaInfo,
  MediaPage,
  MediaProtectionResponse,
  MediaQuarantineChangesResponse,
  MediaUnprotectionResponse,
  RoomMediaPage,
  RoomMediaQuarantineResponse,
  RoomMediaUnquarantineResponse,
  UserMediaList,
  UserMediaQuarantineResponse
} from '@/services/matrix/sdk'

type MediaAdminSdk = Pick<
  AdminManager,
  | 'getMedia'
  | 'getMediaInfo'
  | 'getMediaInfoByServer'
  | 'deleteMedia'
  | 'deleteMediaByServer'
  | 'purgeMediaCache'
  | 'deleteMediaByPolicy'
  | 'quarantineMedia'
  | 'unquarantineMedia'
  | 'protectMedia'
  | 'protectMediaById'
  | 'unprotectMedia'
  | 'getGlobalMediaQuarantineChanges'
  | 'getMediaQuarantineChanges'
  | 'getRoomMedia'
  | 'deleteRoomMedia'
  | 'quarantineRoomMedia'
  | 'unquarantineRoomMedia'
  | 'getUserMedia'
  | 'deleteUserMedia'
  | 'quarantineUserMedia'
>
```

每个方法遵循同一模板（读操作降级 `null`，写操作 let 错误抛出由视图反馈；此处写操作统一 catch + logger.error 后 rethrow，保持现有 `deleteMedia` 语义）：

```ts
  async getMediaInfo(mediaId: string): Promise<MediaInfo | null> {
    try {
      const admin = await this.sdkAdmin()
      return await admin.getMediaInfo(mediaId)
    } catch (err) {
      logger.error(`[AdminMedia] 获取媒体详情失败: ${err}`)
      return null
    }
  }
```

写操作示例：

```ts
  async quarantineMedia(serverName: string, mediaId: string): Promise<void> {
    const admin = await this.sdkAdmin()
    await admin.quarantineMedia(serverName, mediaId)
  }
```

`getGlobalQuarantineChanges` 固定 `{ from: from ?? 0 }`；`getRoomMedia` 仅在 `from`/`limit` 有值时放入 options；`quarantineRoomMedia`/`unquarantineRoomMedia` 仅在 `userId` 有值时传 `{ userId }`。

- [ ] **Step 5: 运行测试确认通过**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/services/matrix/admin/__tests__/MediaService.test.ts`
Expected: PASS（原有用例 + 新增 5 条）。

- [ ] **Step 6: 提交**

```bash
git add src/services/matrix/sdk.ts src/services/matrix/admin/MediaService.ts src/services/matrix/admin/__tests__/MediaService.test.ts
git commit -m "feat(service): 补齐 Admin 媒体管理 18 个 SDK 封装方法"
```

---

### Task 2: Facade 薄委托与类型出口

**Files:**
- Modify: `src/services/matrix/admin/AdminFacadeDomainMethods.ts`（media 段，当前只有 `getMediaList`、`deleteMedia`）
- Modify: `src/services/matrix/admin/index.ts`（`AdminTypes` re-export）
- Test: `src/services/matrix/admin/__tests__/AdminFacadeService.test.ts`

**Interfaces:**
- Consumes: Task 1 的 18 个方法（`this.media.xxx`）。
- Produces: `adminService.getMediaInfo(...)` 等同名方法，签名与 Task 1 完全一致。

- [ ] **Step 1: 写失败测试（追加到 `AdminFacadeService.test.ts` 的 media describe 内）**

先在 `mockAdminManager` 中补齐被调用方法：

```ts
getMediaInfo: vi.fn().mockResolvedValue({ media_id: 'm1' }),
getMediaInfoByServer: vi.fn().mockResolvedValue({ media_id: 'm1' }),
deleteMediaByServer: vi.fn().mockResolvedValue(undefined),
deleteMediaByPolicy: vi.fn().mockResolvedValue({ deleted: 2 }),
quarantineMedia: vi.fn().mockResolvedValue(undefined),
unquarantineMedia: vi.fn().mockResolvedValue(undefined),
protectMedia: vi.fn().mockResolvedValue({ stream_id: 1, protected: true }),
protectMediaById: vi.fn().mockResolvedValue({ stream_id: 1, protected: true }),
unprotectMedia: vi.fn().mockResolvedValue({ stream_id: 1, unprotected: true }),
getGlobalMediaQuarantineChanges: vi.fn().mockResolvedValue({ next_batch: 0, changes: [] }),
getMediaQuarantineChanges: vi.fn().mockResolvedValue({ changes: [], total: 0 }),
getRoomMedia: vi.fn().mockResolvedValue({ media: [], total: 0, next_batch: null }),
deleteRoomMedia: vi.fn().mockResolvedValue(undefined),
quarantineRoomMedia: vi.fn().mockResolvedValue({ room_id: '!r:a', quarantined: true }),
unquarantineRoomMedia: vi.fn().mockResolvedValue({ room_id: '!r:a', quarantined: false }),
getUserMedia: vi.fn().mockResolvedValue({ media: [], total: 0 }),
deleteUserMedia: vi.fn().mockResolvedValue(undefined),
quarantineUserMedia: vi.fn().mockResolvedValue({ user_id: '@u:a', quarantined: true })
```

```ts
it('should quarantine media via SDK', async () => {
  await adminService.quarantineMedia('a.example', 'm1')
  expect(mockAdminManager.quarantineMedia).toHaveBeenCalledWith('a.example', 'm1')
})

it('should return null when media info fails', async () => {
  mockAdminManager.getMediaInfo.mockRejectedValueOnce(new Error('boom'))
  expect(await adminService.getMediaInfo('m1')).toBeNull()
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/services/matrix/admin/__tests__/AdminFacadeService.test.ts`
Expected: FAIL，`adminService.quarantineMedia is not a function`。

- [ ] **Step 3: 实现委托**

在 `AdminFacadeDomainMethods.ts` 的 media 段追加 18 个薄委托，全部 `return this.media.xxx(...)`；`getMediaList`/`deleteMedia`/`purgeMediaCache` 保持原位不动。

在 `index.ts` 的 `AdminTypes` 中追加 Task 1 用到的响应类型（`MediaInfo`、`MediaPage`、`UserMediaList`、`RoomMediaPage`、`MediaQuarantineChangesResponse`、`GlobalMediaQuarantineChangesResponse`、`MediaProtectionResponse`、`MediaUnprotectionResponse`、`RoomMediaQuarantineResponse`、`RoomMediaUnquarantineResponse`、`UserMediaQuarantineResponse`）。

- [ ] **Step 4: 运行测试确认通过**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/services/matrix/admin/__tests__/AdminFacadeService.test.ts`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/services/matrix/admin/AdminFacadeDomainMethods.ts src/services/matrix/admin/index.ts src/services/matrix/admin/__tests__/AdminFacadeService.test.ts
git commit -m "feat(service): 暴露 Admin 媒体管理 facade 委托"
```

---

### Task 3: useAdminMedia composable

**Files:**
- Create: `src/composables/admin/useAdminMedia.ts`
- Modify: `src/composables/admin/index.ts`
- Test: `src/composables/admin/__tests__/useAdminMedia.test.ts`

**Interfaces:**
- Consumes: `adminService` 的 Task 2 方法。
- Produces:

```ts
interface UseAdminMedia {
  library: Ref<MediaInfo[]>
  libraryNextBatch: Ref<string | null>
  libraryLoading: Ref<boolean>
  selectedMedia: Ref<MediaInfo | null>
  detailLoading: Ref<boolean>
  quarantineChanges: Ref<GlobalMediaQuarantineChange[]>
  quarantineNextBatch: Ref<number>
  quarantineLoading: Ref<boolean>
  roomMedia: Ref<RoomMediaItem[]>
  roomMediaNextBatch: Ref<string | null>
  roomMediaLoading: Ref<boolean>
  userMedia: Ref<MediaInfo[]>
  userMediaLoading: Ref<boolean>
  mutating: Ref<boolean>
  loadLibrary(reset?: boolean): Promise<void>
  loadMoreLibrary(): Promise<void>
  openMediaDetail(mediaId: string): Promise<void>
  closeMediaDetail(): void
  loadQuarantineChanges(reset?: boolean): Promise<void>
  loadMoreQuarantineChanges(): Promise<void>
  loadMediaQuarantineHistory(mediaId: string): Promise<MediaQuarantineChange[]>
  loadRoomMedia(roomId: string, reset?: boolean): Promise<void>
  loadMoreRoomMedia(): Promise<void>
  loadUserMedia(userId: string): Promise<void>
  quarantine(serverName: string, mediaId: string): Promise<void>
  unquarantine(serverName: string, mediaId: string): Promise<void>
  protect(serverName: string, mediaId: string): Promise<void>
  unprotect(mediaId: string): Promise<void>
  deleteOne(serverName: string | null, mediaId: string): Promise<void>
  deleteRoomOne(roomId: string, mediaId: string): Promise<void>
  deleteUserAll(userId: string): Promise<void>
  quarantineRoom(roomId: string, userId?: string): Promise<void>
  unquarantineRoom(roomId: string, userId?: string): Promise<void>
  quarantineUser(userId: string): Promise<void>
  deleteByPolicy(options: { beforeTs?: number; maxSize?: number }): Promise<number>
}
```

- [ ] **Step 1: 写失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { adminService } from '@/services/matrix/admin'
import { useAdminMedia } from '../useAdminMedia'

vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getMediaList: vi.fn(),
    getMediaInfo: vi.fn(),
    getGlobalQuarantineChanges: vi.fn(),
    deleteMedia: vi.fn(),
    deleteMediaByServer: vi.fn(),
    quarantineMedia: vi.fn(),
    deleteByPolicy: vi.fn()
  }
}))

describe('useAdminMedia', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loadLibrary 首次加载写入列表与游标', async () => {
    vi.mocked(adminService.getMediaList).mockResolvedValueOnce({
      media: [{ mediaId: 'm1' } as never],
      nextBatch: 'cursor-2'
    } as never)
    const c = useAdminMedia()
    await c.loadLibrary()
    expect(c.library.value).toHaveLength(1)
    expect(c.libraryNextBatch.value).toBe('cursor-2')
    expect(c.libraryLoading.value).toBe(false)
  })

  it('quarantine 失败时抛出由视图反馈', async () => {
    vi.mocked(adminService.quarantineMedia).mockRejectedValueOnce(new Error('boom'))
    await expect(useAdminMedia().quarantine('a.example', 'm1')).rejects.toThrow('boom')
  })
})
```

> 注意：`getMediaList` 的现有返回形状若为 `{ media, nextBatch }` 以实际实现为准；若字段名不同（如 `next_batch`），在 composable 内做一次归一化，不要改服务层既有返回。

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/admin/__tests__/useAdminMedia.test.ts`
Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 composable**

结构照 `useAdminMaintenance.ts`：`ref` 状态 + `async` 函数 + `try/finally` 复位 loading + 不吞异常（视图 `useActionFeedback` 统一反馈）。列表加载失败时置空并 `logger.error`，不回退到假数据。`deleteOne(serverName, mediaId)` 在 `serverName` 为空时走 `adminService.deleteMedia`，否则走 `deleteMediaByServer`。

- [ ] **Step 4: 导出并在 `index.ts` 注册**

```ts
export type { UseAdminMedia } from './useAdminMedia'
export { useAdminMedia } from './useAdminMedia'
```

- [ ] **Step 5: 运行测试确认通过并提交**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/admin/__tests__/useAdminMedia.test.ts
git add src/composables/admin/useAdminMedia.ts src/composables/admin/index.ts src/composables/admin/__tests__/useAdminMedia.test.ts
git commit -m "feat(service): 新增 useAdminMedia composable"
```

---

### Task 4: 管理页组件、路由、导航与文案

**Files:**
- Create: `src/views/admin/AdminMedia.vue`（≤120 行，仅壳 + tab 切换）
- Create: `src/components/admin/media/MediaLibraryPanel.vue`
- Create: `src/components/admin/media/MediaScopedPanel.vue`
- Create: `src/components/admin/media/MediaQuarantineChangesPanel.vue`
- Modify: `src/router/routes/desktop.ts`（在 `adminBackgroundUpdates` 附近插入）
- Modify: `src/views/admin/useAdminNav.ts`（system 分组，`/admin/media`）
- Modify: `src/views/admin/icons/adminNavIcons.ts`（新增 `media` 图标名与 SVG path）
- Modify: `locales/zh-CN/admin.json`、`locales/en/admin.json`
- Test: `src/views/admin/__tests__/AdminMedia.test.ts`

**Interfaces:**
- Consumes: `useAdminMedia`（Task 3）、`useActionFeedback`。
- Produces: 路由名 `adminMedia`，路径 `/admin/media`。

- [ ] **Step 1: 写失败测试**

参照 `src/views/admin/__tests__/AdminMaintenance.test.ts` 的 mock 手法：mock `@/composables/admin`、`useActionFeedback`、`Logger`、`naive-ui`；断言：

```ts
it('默认渲染媒体库页签并加载列表', async () => {
  mount(AdminMedia)
  await flushPromises()
  expect(loadLibraryMock).toHaveBeenCalledTimes(1)
  expect(wrapper.text()).toContain('media_id_value')
})

it('点击隔离按钮调用 quarantine 并提示成功', async () => {
  const wrapper = mount(AdminMedia)
  await flushPromises()
  const btn = wrapper.findAll('button').find((b) => b.text().includes('admin.media.action.quarantine'))
  await btn!.trigger('click')
  await flushPromises()
  expect(quarantineMock).toHaveBeenCalledWith('a.example', 'm1')
  expect(showFeedbackMock).toHaveBeenCalledWith('admin.media.feedback.quarantine_success', 'success')
})
```

- [ ] **Step 2: 运行确认失败**

Run: `PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/views/admin/__tests__/AdminMedia.test.ts`
Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现壳与三个面板**

`AdminMedia.vue`：

```vue
<template>
  <div class="admin-media">
    <n-page-header :title="t('admin.media.title')" :subtitle="t('admin.media.subtitle')" />
    <n-tabs v-model:value="tab" type="line" animated class="mt-16px">
      <n-tab-pane name="library" :tab="t('admin.media.tab.library')">
        <MediaLibraryPanel />
      </n-tab-pane>
      <n-tab-pane name="scoped" :tab="t('admin.media.tab.scoped')">
        <MediaScopedPanel />
      </n-tab-pane>
      <n-tab-pane name="quarantine" :tab="t('admin.media.tab.quarantine')">
        <MediaQuarantineChangesPanel />
      </n-tab-pane>
    </n-tabs>
  </div>
</template>
```

`MediaLibraryPanel.vue`（列表 + 行操作 + 详情抽屉 + 按策略删除对话框）：

- 列：`media_id`、`media_type`、`upload_name`、`size`（`formatBytes`）、`created_ts`（`new Date(ts).toLocaleString()`）、`quarantined`（`NTag type="warning"`）、操作列。
- 操作：详情（调 `openMediaDetail`，抽屉展示字段 + 单媒体隔离变更历史）、隔离/取消隔离、保护/取消保护、删除（`NPopconfirm`）、删除前需解析 `serverName`：

```ts
function mediaServerName(item: MediaInfo): string {
  const mxc = `mxc://`
  const server = item.media_id.includes('_') ? item.media_id.split('_')[0] : ''
  return server || clientDomain.value
}
```

> 实现时以 `MatrixClientService.getClient()?.getDomain() ?? ''` 兜底；若 media_id 无法解析 server，直接走按 id 形态（`protectMediaById` / `deleteMedia`），不要臆造域名。

- 按策略删除对话框：`beforeTs`（`NDatePicker` datetime → 毫秒）与 `maxSize`（`NInputNumber` 字节）两项，确认后 `deleteByPolicy`，成功 `showFeedback('admin.media.feedback.policy_deleted', { count })`。
- “加载更多”按钮仅在 `libraryNextBatch` 非空时渲染。

`MediaScopedPanel.vue`：两张卡片。
- 房间媒体：`NInput` 填 roomId → 加载；表格列 `media_id/upload_name/media_type/size/created_ts`；行删除 `deleteRoomOne`；卡片底部“隔离本房间媒体”“解除隔离”两个按钮（可选 `userId` 输入）。
- 用户媒体：`NInput` 填 userId → 加载；表格同列（无分页，`getUserMedia` 后端不支持分页）；行删除用 `deleteOne(null, media_id)`；卡片底部“隔离该用户全部媒体”。

`MediaQuarantineChangesPanel.vue`：全局隔离变更流列表（`origin`、`media_id`、`quarantined` 标签）+ “加载更多”（游标为 `quarantineNextBatch`，仅在 changes 非空时请求下一页）。

- [ ] **Step 4: 路由、导航、图标、i18n**

路由（插在 `background-updates` 之后）：

```ts
{
  path: 'media',
  name: 'adminMedia',
  component: () => import('@/views/admin/AdminMedia.vue'),
  meta: { requiresAdmin: true }
}
```

导航：`useAdminNav.ts` 的 `system` 分组 items 追加

```ts
{ path: '/admin/media', label: t('admin.nav.media'), icon: 'media' }
```

`adminNavIcons.ts`：在 `AdminNavIconName` 联合类型加 `'media'`，`adminNavIcons` 加一个 1.5px 线宽的 SVG（相册/图片轮廓），不要用 div 拼图标。

i18n 需新增（zh-CN 与 en 同步，en 缺失会直接失败）：

```json
"nav": { "media": "媒体管理" },
"media": {
  "title": "媒体管理",
  "subtitle": "浏览、隔离、保护与清理服务器媒体",
  "tab": { "library": "媒体库", "scoped": "按房间 / 用户", "quarantine": "隔离变更" },
  "column": { "mediaId": "媒体 ID", "type": "类型", "name": "文件名", "size": "大小", "created": "创建时间", "quarantined": "已隔离", "origin": "来源" },
  "action": { "detail": "详情", "quarantine": "隔离", "unquarantine": "取消隔离", "protect": "保护", "unprotect": "取消保护", "delete": "删除", "deleteConfirm": "确认删除该媒体？此操作不可撤销", "loadMore": "加载更多", "quarantineRoom": "隔离本房间媒体", "unquarantineRoom": "解除房间媒体隔离", "quarantineUser": "隔离该用户全部媒体", "policyDelete": "按策略批量删除" },
  "field": { "roomId": "房间 ID", "userId": "用户 ID", "before": "早于时间", "maxSize": "大于字节数", "optionalUser": "仅该用户（可选）" },
  "empty": { "library": "暂无媒体", "changes": "暂无隔离变更", "room": "输入房间 ID 后加载", "user": "输入用户 ID 后加载" },
  "detail": { "title": "媒体详情", "history": "隔离变更历史" },
  "feedback": { "quarantine_success": "已隔离", "unquarantine_success": "已取消隔离", "protect_success": "已保护", "unprotect_success": "已取消保护", "delete_success": "已删除", "policy_deleted": "已删除 {count} 条媒体", "failed": "操作失败" }
}
```

- [ ] **Step 5: 运行测试与检查**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/views/admin/__tests__/AdminMedia.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:file-size
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check
```

Expected: 测试 PASS；`check:file-size` 无新增超限；`check` 的 i18n 对齐通过。

- [ ] **Step 6: 提交**

```bash
git add src/views/admin/AdminMedia.vue src/components/admin/media src/router/routes/desktop.ts src/views/admin/useAdminNav.ts src/views/admin/icons/adminNavIcons.ts locales/zh-CN/admin.json locales/en/admin.json src/views/admin/__tests__/AdminMedia.test.ts
git commit -m "feat(ui): 新增 Admin 媒体管理页面"
```

---

### Task 5: 文档回写与全量门禁

**Files:**
- Modify: `docs/UI优化方案-v2.4.md`（§1.3 媒体行、§3.4 注 2、§5.6 第 7 条、§9 DoD 5、§1.4(3) 第 4 条）

**Interfaces:**
- Consumes: Task 1-4 全部落地。
- Produces: 文档口径与代码一致，20 条缺口归零或如实标注剩余别名形态。

- [ ] **Step 1: 回写文档**

- §1.3 媒体行：`未覆盖 24` 改为 `未覆盖 6`（preview_url 4 + download_signed 2；admin 18 条已由 `/admin/media` 页面覆盖，2 条别名形态随主形态可达）。
- §3.4 注 2：“其中 20 条无页面” 改为 “20 条已于 2026-11-03 由 `/admin/media` 覆盖（含 2 条仅作为别名形态随主形态调用）”。
- §5.6 第 7 条：标记 `已完成（2026-11-03，见 /admin/media）`。
- §9 DoD 5 与 §1.4(3) 第 4 条：同步媒体各项数字。

- [ ] **Step 2: 跑全量门禁**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test:run
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:ratchet
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-coverage
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-paths
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:sdk-boundary
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm quality:no-raw-fetch
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check
```

Expected: 全部 0 错误。若 `check:doc-coverage` 因新增方法缺 JSDoc 失败，为 `MediaService.ts` 与 `useAdminMedia.ts` 的每个导出补 `@param`/`@returns` 注释，而不是往基线里加豁免。

- [ ] **Step 3: 提交**

```bash
git add "docs/UI优化方案-v2.4.md"
git commit -m "docs(ui): 回写 Admin 媒体子域覆盖状态"
```

---

## Self-Review

**Spec coverage：** 20 条无页面端点 → 18 个新服务方法 + 2 条别名形态（`getMediaInfoByServer`/`deleteMediaByServer` 在 `deleteOne`/`getMediaInfo` 路径中按是否有 serverName 选择）；quota/purge 保留在维护页不重复；列表、详情、隔离/取消隔离、保护/取消保护、按策略删除、房间媒体、用户媒体、全局隔离变更、单媒体变更历史均有落点。

**Placeholder scan：** 无 TBD/TODO；所有方法签名、路径、i18n 键、命令均已给定。

**Type consistency：** `MediaPage.next_batch` 字符串游标、`GlobalMediaQuarantineChangesResponse.next_batch` 数值游标、`UserMediaList` 无分页、保护/取消保护响应不同形，均与 SDK d.ts 一致；`useAdminMedia` 的方法名在 Task 3/4 中保持一致。
