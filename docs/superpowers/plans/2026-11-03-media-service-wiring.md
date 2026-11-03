# 媒体子域「服务层已封 UI 未接」接线实施计划

## Goal

把媒体子域 10 条「服务层已封但无 UI 入口」端点中的 **8 条**接入用户可见入口，剩余 **2 条**登记为「无合适 UX 承载」，并把 `docs/UI优化方案-v2.4.md` 的媒体口径回写为：**已覆盖 52 / 无 UI 承载 2 / 未覆盖 6**。

接线清单：

| # | 端点 | 落点 | 任务 |
| :-- | :-- | :-- | :-- |
| 1 | `getMediaInfoByServer` | Admin 媒体库工具栏「按 server + media_id 查询详情」 | Task 1 |
| 2 | `protectMediaById` | Admin 媒体库「保护」在无服务器名时按 ID 回退 | Task 2 |
| 3 | `deleteUserMedia` | Admin 用户媒体卡片「删除该用户全部媒体」 | Task 3 |
| 4 | `setEnableCompression` | 设置 → 存储 → 上传设置（压缩开关） | Task 4/7 |
| 5 | `setCompressOptions` | 设置 → 存储 → 上传设置（压缩质量） | Task 4/7 |
| 6 | `uploadLargeFile` | `uploadFile` ≥10MB 且开关开启时走分块 | Task 6 |
| 7 | `getMediaConfig` | 设置 → 存储 → 媒体服务配置（单文件上限） | Task 7 |
| 8 | `getAuthenticatedMediaConfig` | 设置 → 存储 → 媒体服务配置（认证媒体） | Task 7 |

无 UI 承载（本次不接，仅在文档登记）：

- `MatrixMediaService.deleteMedia`：删除客户端自身媒体缺少可信的「我的媒体」列表来源，且误删不可恢复，无合适 UX。
- `MatrixMediaService.uploadContentWithId`：仅用于服务端指定 ID 的覆写上传，普通用户无自然可见场景。

## Architecture

1. **Admin 三条**：不经组件直接调 SDK，全部经 `useAdminMedia` composable → `adminService`（`src/services/matrix/admin`）。Composable 对外契约集中在 `adminMediaTypes.ts`，实现留在 `useAdminMedia.ts`。
2. **客户端只读两条**：`StorageSettings.vue` 直接调 `matrixMediaService.getMediaConfig()` / `getAuthenticatedMediaConfig()`，失败各自降级，不阻断配额展示。
3. **客户端上传策略三条**：
   - 偏好写入 `setting` store（`preferences` 下 3 个字段，`persist: true` 已开启）。
   - 新增胶水层 `src/services/matrix/media/mediaUploadPreferences.ts`，把 store 偏好施加到 `matrixMediaService`；服务层本身不 import Pinia，保持可单测。
   - 施加时机：`App.vue` `onMounted` 启动一次；`StorageSettings` 每次修改后立即施加。
   - `uploadFile` 内部按 `MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES` 分流到 `uploadLargeFile`。

## Tech Stack

Vue 3 + TypeScript + Pinia（Options API store）+ Naive UI + Vitest + vue-i18n。

## Global Constraints

- 所有 node/pnpm 命令必须带前缀 `PATH=/opt/homebrew/opt/node@22/bin:$PATH`。
- R1：不得在 `src/services/matrix/**` 之外新增 Matrix HTTP/协议实现；只能复用现有服务层方法。
- R2：本次不改 `src/mobile/**`，不新增移动端 admin/AI 可见入口。
- 颜色只用 `--tjg-*` token，禁止新增 `#xxx` / `rgb()` / `rgba()`。
- i18n 必须同时改 `locales/zh-CN/*.json` 与 `locales/en/*.json`，且只用静态 `t('literal')`（否则 `check:i18n-dead-keys` 判孤儿）。
- 每个任务先写失败测试再实现；每个任务独立 commit。
- `.vue` 不超过 800 行，新 `.ts` 不超过 400 行。

---

## Task 1：Admin 按 server + mediaId 查询媒体详情

**Files**

- Modify: `src/composables/admin/adminMediaTypes.ts`
- Modify: `src/composables/admin/useAdminMedia.ts`
- Modify: `src/components/admin/media/MediaLibraryPanel.vue`
- Modify: `src/composables/admin/__tests__/useAdminMedia.test.ts`
- Modify: `locales/zh-CN/admin.json`、`locales/en/admin.json`

**Interfaces**

```ts
// adminMediaTypes.ts
openMediaDetailByServer: (serverName: string, mediaId: string) => Promise<void>
```

**Step 1：先写失败测试**

在 `src/composables/admin/__tests__/useAdminMedia.test.ts` 的 mock 块补 `getMediaInfoByServer: vi.fn()`，并新增用例：

```ts
it('openMediaDetailByServer 走按服务器查询并写入详情', async () => {
  vi.mocked(adminService.getMediaInfoByServer).mockResolvedValueOnce({
    media_id: 'm1',
    media_type: 'image/png'
  })
  const c = useAdminMedia()
  await c.openMediaDetailByServer('hs.example', 'm1')
  expect(adminService.getMediaInfoByServer).toHaveBeenCalledWith('hs.example', 'm1')
  expect(c.selectedMedia.value).toEqual({ media_id: 'm1', media_type: 'image/png' })
})

it('openMediaDetailByServer 返回 null 时置空并记录错误', async () => {
  vi.mocked(adminService.getMediaInfoByServer).mockResolvedValueOnce(null)
  const c = useAdminMedia()
  await c.openMediaDetailByServer('hs.example', 'm1')
  expect(c.selectedMedia.value).toBeNull()
})
```

跑测试确认失败：

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/admin/__tests__/useAdminMedia.test.ts
```

**Step 2：实现 composable**

在 `useAdminMedia.ts` 的 `openMediaDetail` 之后追加：

```ts
async function openMediaDetailByServer(serverName: string, mediaId: string) {
  detailLoading.value = true
  try {
    const info = await adminService.getMediaInfoByServer(serverName, mediaId)
    selectedMedia.value = info
    if (!info) logger.error(`加载媒体详情失败: ${serverName}/${mediaId}`)
  } catch (e) {
    logger.error(`加载媒体详情失败: ${serverName}/${mediaId}`, e)
    selectedMedia.value = null
  } finally {
    detailLoading.value = false
  }
}
```

在 `return { ... }` 中补 `openMediaDetailByServer`。

**Step 3：补接口声明**

`adminMediaTypes.ts` 在 `openMediaDetail` 下一行补 `openMediaDetailByServer`。

**Step 4：UI**

`MediaLibraryPanel.vue`：

- `naive-ui` 具名导入补 `NInput`。
- 解构补 `openMediaDetailByServer`。
- 新增查询状态与处理：

```ts
const queryServerName = ref(matrixClientService.getClient()?.getDomain() ?? '')
const queryMediaId = ref('')

const handleQueryByServer = async (): Promise<void> => {
  const serverName = queryServerName.value.trim()
  const mediaId = queryMediaId.value.trim()
  if (!serverName || !mediaId) return
  detailVisible.value = true
  try {
    await openMediaDetailByServer(serverName, mediaId)
    history.value = await loadMediaQuarantineHistory(mediaId)
  } catch (error) {
    logger.error('load media detail by server failed', {
      error: error instanceof Error ? error.message : String(error)
    })
    showFeedback(t('admin.media.feedback.failed'), 'error')
  }
}
```

模板工具栏（现有 `<n-space class="mb-12px" align="center">` 内）在「刷新」后追加：

```vue
<n-input v-model:value="queryServerName" :placeholder="t('admin.media.field.serverName')" class="max-w-200px" />
<n-input v-model:value="queryMediaId" :placeholder="t('admin.media.field.mediaId')" class="max-w-200px" />
<n-button :loading="detailLoading" @click="handleQueryByServer">
  {{ t('admin.media.action.queryByServer') }}
</n-button>
```

**Step 5：i18n**

- `locales/zh-CN/admin.json` → `media.action.queryByServer`: `"按服务器查询"`；`media.field.serverName`: `"服务器名"`；`media.field.mediaId`: `"媒体 ID"`。
- `locales/en/admin.json` → `"Query by server"` / `"Server name"` / `"Media ID"`。

**Step 6：验收 + commit**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/admin/__tests__/useAdminMedia.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
```

```bash
git add src/composables/admin src/components/admin/media locales
git commit -m "feat(admin): 媒体库支持按服务器查询媒体详情"
```

---

## Task 2：Admin 保护媒体在无服务器名时按 ID 回退

**Files**

- Modify: `src/composables/admin/adminMediaTypes.ts`
- Modify: `src/composables/admin/useAdminMedia.ts`
- Modify: `src/components/admin/media/MediaLibraryPanel.vue`
- Modify: `src/composables/admin/__tests__/useAdminMedia.test.ts`

**Interfaces**

```ts
protectById: (mediaId: string) => Promise<void>
```

**Step 1：失败测试**

mock 块补 `protectMediaById: vi.fn()`，新增：

```ts
it('protectById 走按 ID 保护，返回 null 时抛出中文错误', async () => {
  vi.mocked(adminService.protectMediaById).mockResolvedValueOnce({ stream_id: 1, protected: true })
  const c = useAdminMedia()
  await c.protectById('m1')
  expect(adminService.protectMediaById).toHaveBeenCalledWith('m1')

  vi.mocked(adminService.protectMediaById).mockResolvedValueOnce(null)
  await expect(c.protectById('m2')).rejects.toThrow('保护媒体失败: m2')
})
```

**Step 2：实现**

`useAdminMedia.ts` 在 `protect` 后追加：

```ts
async function protectById(mediaId: string) {
  mutating.value = true
  try {
    const result = await adminService.protectMediaById(mediaId)
    if (!result) {
      logger.warn(`保护媒体失败: ${mediaId}`)
      throw new Error(`保护媒体失败: ${mediaId}`)
    }
  } finally {
    mutating.value = false
  }
}
```

接口与 `return` 同步补 `protectById`。

**Step 3：UI 回退**

`MediaLibraryPanel.vue` 解构补 `protectById`，改 `handleProtect`：

```ts
const handleProtect = (row: MediaLibraryItem): Promise<boolean> => {
  const serverName = resolveServerName(row.mediaId)
  return runAction(
    () => (serverName ? protect(serverName, row.mediaId) : protectById(row.mediaId)),
    t('admin.media.feedback.protect_success')
  )
}
```

**Step 4：验收 + commit**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/composables/admin/__tests__/useAdminMedia.test.ts
git add src/composables/admin src/components/admin/media
git commit -m "feat(admin): 媒体保护在缺少服务器名时按媒体 ID 回退"
```

---

## Task 3：Admin 删除某用户全部媒体

**Files**

- Modify: `src/components/admin/media/MediaScopedPanel.vue`
- Modify: `locales/zh-CN/admin.json`、`locales/en/admin.json`

**Step 1：UI**

`MediaScopedPanel.vue` 解构补 `deleteUserAll`，新增确认布尔量与处理函数：

```ts
const confirmDeleteUserAll = ref(false)

const handleDeleteUserAll = async (): Promise<void> => {
  const id = userMediaUserId.value
  if (!id) return
  const ok = await runAction(
    () => deleteUserAll(id),
    t('admin.media.feedback.delete_user_success')
  )
  confirmDeleteUserAll.value = false
  if (ok) {
    await loadUserMedia(id)
  }
}
```

用户卡片底部（现有 `<div class="flex justify-end">`）改为：

```vue
<div class="flex justify-end">
  <n-space align="center">
    <n-popconfirm v-model:show="confirmDeleteUserAll" @positive-click="handleDeleteUserAll">
      <template #trigger>
        <n-button type="error" ghost :disabled="mutating">
          {{ t('admin.media.action.deleteUserMedia') }}
        </n-button>
      </template>
      {{ t('admin.media.action.deleteUserMediaConfirm') }}
    </n-popconfirm>
    <n-button :disabled="mutating" @click="handleQuarantineUser">
      {{ t('admin.media.action.quarantineUser') }}
    </n-button>
  </n-space>
</div>
```

注意：`deleteUserMedia` 属破坏性批量操作，禁用态必须跟随 `mutating`，且必须有二次确认文案，不允许一键直删。

**Step 2：i18n**

- `zh-CN/admin.json`：`media.action.deleteUserMedia`: `"删除该用户全部媒体"`；`media.action.deleteUserMediaConfirm`: `"将删除该用户在上传过的全部媒体且不可恢复，确认继续？"`；`media.feedback.delete_user_success`: `"已删除该用户全部媒体"`。
- `en/admin.json`：`"Delete all user media"` / `"This permanently deletes all media uploaded by this user. Continue?"` / `"All media of this user deleted"`。

**Step 3：验收 + commit**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:file-size
git add src/components/admin/media locales
git commit -m "feat(admin): 用户媒体支持批量删除全部媒体"
```

---

## Task 4：上传策略偏好字段与持久化

**Files**

- Modify: `src/typings/stores.d.ts`
- Modify: `src/stores/domains/settings/settings-helpers.ts`
- Modify: `src/stores/domains/settings/setting.ts`
- Modify: `src/stores/domains/settings/__tests__/setting.test.ts`

**Interfaces**

```ts
// preferences 新增
uploadCompressEnabled: boolean   // 默认 true
uploadCompressQuality: 0.6 | 0.8 | 0.9  // 默认 0.8
uploadChunkEnabled: boolean      // 默认 true
```

**Step 1：失败测试**

`setting.test.ts` 新增：

```ts
it('上传压缩/分块偏好有默认值且可写入', () => {
  const store = useSettingStore()
  store.ensurePreferenceSettings()
  expect(store.preferences.uploadCompressEnabled).toBe(true)
  expect(store.preferences.uploadCompressQuality).toBe(0.8)
  expect(store.preferences.uploadChunkEnabled).toBe(true)

  store.setUploadCompressEnabled(false)
  store.setUploadCompressQuality(0.6)
  store.setUploadChunkEnabled(false)
  expect(store.preferences.uploadCompressEnabled).toBe(false)
  expect(store.preferences.uploadCompressQuality).toBe(0.6)
  expect(store.preferences.uploadChunkEnabled).toBe(false)
})

it('uploadCompressQuality 非法值回落到 0.8', () => {
  const store = useSettingStore()
  store.preferences.uploadCompressQuality = 0.5 as 0.6 | 0.8 | 0.9
  store.ensurePreferenceSettings()
  expect(store.preferences.uploadCompressQuality).toBe(0.8)
})
```

同时修掉 `setting.test.ts` 中整体赋值 `store.preferences = { ... }` 的用例（约 L301），补齐上面 3 个必填字段，否则 `vue-tsc` 会报缺字段。

**Step 2：类型**

`src/typings/stores.d.ts` 的 `preferences` 中，在 `showOnlineStatus: boolean` 后追加：

```ts
/** 上传前是否自动压缩图片 */
uploadCompressEnabled: boolean
/** 图片压缩质量（0.6 省流 / 0.8 标准 / 0.9 高清） */
uploadCompressQuality: 0.6 | 0.8 | 0.9
/** 是否对超过阈值的文件启用主动分块上传 */
uploadChunkEnabled: boolean
```

**Step 3：默认值与归一化**

`settings-helpers.ts` 的 `getDefaultPreferenceSettings` 中，`showOnlineStatus: true,` 后追加：

```ts
uploadCompressEnabled: true,
uploadCompressQuality: 0.8 as 0.6 | 0.8 | 0.9,
uploadChunkEnabled: true,
```

并在 `normalizeBurnDefaultDuration` 附近新增：

```ts
export const normalizeUploadCompressQuality = (value?: number): 0.6 | 0.8 | 0.9 => {
  if (value === 0.6 || value === 0.9) return value
  return 0.8
}
```

**Step 4：store**

`setting.ts`：

- getter 区（`showOnlineStatusEnabled` 后）：

```ts
uploadCompressEnabled: (state: STO.Setting) => state.preferences?.uploadCompressEnabled ?? true,
uploadCompressQuality: (state: STO.Setting) =>
  normalizeUploadCompressQuality(state.preferences?.uploadCompressQuality),
uploadChunkEnabled: (state: STO.Setting) => state.preferences?.uploadChunkEnabled ?? true,
```

- `ensurePreferenceSettings` 末尾（`strictUnverifiedRooms` 之前）补：

```ts
this.preferences.uploadCompressEnabled =
  this.preferences.uploadCompressEnabled ?? defaults.uploadCompressEnabled
this.preferences.uploadCompressQuality = normalizeUploadCompressQuality(
  this.preferences.uploadCompressQuality
)
this.preferences.uploadChunkEnabled = this.preferences.uploadChunkEnabled ?? defaults.uploadChunkEnabled
```

- actions 在 `setShowOnlineStatusEnabled` 后补：

```ts
setUploadCompressEnabled(enabled: boolean) {
  this.ensurePreferenceSettings()
  this.preferences.uploadCompressEnabled = enabled
},
setUploadCompressQuality(quality: 0.6 | 0.8 | 0.9) {
  this.ensurePreferenceSettings()
  this.preferences.uploadCompressQuality = normalizeUploadCompressQuality(quality)
},
setUploadChunkEnabled(enabled: boolean) {
  this.ensurePreferenceSettings()
  this.preferences.uploadChunkEnabled = enabled
},
```

**Step 5：验收 + commit**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/stores/domains/settings/__tests__/setting.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
git add src/typings/stores.d.ts src/stores/domains/settings
git commit -m "feat(setting): 新增媒体上传压缩与分块偏好"
```

---

## Task 5：偏好施加到媒体服务（胶水层 + 启动重放）

**Files**

- Create: `src/services/matrix/media/mediaUploadPreferences.ts`
- Create: `src/services/matrix/media/__tests__/mediaUploadPreferences.test.ts`
- Modify: `src/App.vue`

**Interfaces**

```ts
export function applyMediaUploadPreferences(): void
```

**Step 1：失败测试**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const setEnableCompression = vi.fn()
const setCompressOptions = vi.fn()
const setEnableChunkUpload = vi.fn()

vi.mock('@/services/matrix/media/MatrixMediaService', () => ({
  matrixMediaService: { setEnableCompression, setCompressOptions, setEnableChunkUpload }
}))

const preferences = {
  uploadCompressEnabled: true,
  uploadCompressQuality: 0.8 as 0.6 | 0.8 | 0.9,
  uploadChunkEnabled: true
}

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ preferences })
}))

import { applyMediaUploadPreferences } from '../mediaUploadPreferences'

describe('applyMediaUploadPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    preferences.uploadCompressEnabled = true
    preferences.uploadCompressQuality = 0.8
    preferences.uploadChunkEnabled = true
  })

  it('把三项偏好施加到媒体服务', () => {
    applyMediaUploadPreferences()
    expect(setEnableCompression).toHaveBeenCalledWith(true)
    expect(setCompressOptions).toHaveBeenCalledWith({ quality: 0.8 })
    expect(setEnableChunkUpload).toHaveBeenCalledWith(true)
  })

  it('关闭压缩与分块时同样透传', () => {
    preferences.uploadCompressEnabled = false
    preferences.uploadCompressQuality = 0.6
    preferences.uploadChunkEnabled = false
    applyMediaUploadPreferences()
    expect(setEnableCompression).toHaveBeenCalledWith(false)
    expect(setCompressOptions).toHaveBeenCalledWith({ quality: 0.6 })
    expect(setEnableChunkUpload).toHaveBeenCalledWith(false)
  })
})
```

**Step 2：实现**

```ts
import { useSettingStore } from '@/stores/domains/settings/setting'
import { matrixMediaService } from './MatrixMediaService'

/**
 * 把用户的媒体上传偏好施加到服务层。
 *
 * 服务层不 import Pinia：由 UI/启动期显式调用本胶水层，
 * 保证 `MatrixMediaService` 仍可脱离 store 单测。
 */
export function applyMediaUploadPreferences(): void {
  const settingStore = useSettingStore()
  const preferences = settingStore.preferences
  if (!preferences) return
  matrixMediaService.setEnableCompression(preferences.uploadCompressEnabled ?? true)
  matrixMediaService.setCompressOptions({
    quality: preferences.uploadCompressQuality ?? 0.8
  })
  matrixMediaService.setEnableChunkUpload(preferences.uploadChunkEnabled ?? true)
}
```

**Step 3：启动期重放**

`src/App.vue` 顶部 import：

```ts
import { applyMediaUploadPreferences } from '@/services/matrix/media/mediaUploadPreferences'
```

`onMounted` 中 `applyBubbleStyle(loadBubbleStyle())` 之后追加：

```ts
applyMediaUploadPreferences()
```

**Step 4：验收 + commit**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/services/matrix/media/__tests__/mediaUploadPreferences.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
git add src/services/matrix/media src/App.vue
git commit -m "feat(media): 启动时把上传偏好施加到媒体服务"
```

---

## Task 6：大文件上传接入主动分块

**Files**

- Modify: `src/services/matrix/media/mediaTypes.ts`
- Modify: `src/services/matrix/media/MatrixMediaService.ts`
- Modify: `src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts`

**Interfaces**

```ts
// mediaTypes.ts
export const MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES = 10 * 1024 * 1024

// MatrixMediaService
setEnableChunkUpload(enable: boolean): void
```

**Step 1：失败测试**

在 `MatrixMediaService.chunkFallback.test.ts` 追加：

```ts
it('uploadFile 在分块开启且文件达到阈值时走 uploadLargeFile', async () => {
  const service = new MatrixMediaServiceClass()
  const uploadLargeFile = vi.spyOn(service, 'uploadLargeFile').mockResolvedValue({
    contentUri: 'mxc://a/b',
    size: 10 * 1024 * 1024,
    mimetype: 'application/octet-stream'
  })
  service.setEnableChunkUpload(true)
  const file = new File([new Uint8Array(10 * 1024 * 1024)], 'big.bin')
  const result = await service.uploadFile(file)
  expect(uploadLargeFile).toHaveBeenCalled()
  expect(result.contentUri).toBe('mxc://a/b')
})

it('uploadFile 在分块关闭时走普通上传', async () => {
  const service = new MatrixMediaServiceClass()
  const uploadLargeFile = vi.spyOn(service, 'uploadLargeFile')
  service.setEnableChunkUpload(false)
  const file = new File([new Uint8Array(10 * 1024 * 1024)], 'big.bin')
  await service.uploadFile(file)
  expect(uploadLargeFile).not.toHaveBeenCalled()
})
```

（沿用该文件已有的 `MatrixMediaServiceClass` 与 `mediaUploadHelpers` / `chunkUploadService` mock harness；若类名不同，按文件现有写法对齐。）

**Step 2：常量**

`mediaTypes.ts` 追加：

```ts
/** 触发主动分块上传的文件大小阈值（10MB）。 */
export const MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES = 10 * 1024 * 1024
```

**Step 3：服务实现**

`MatrixMediaService.ts`：

```ts
import {
  MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES,
  type CompressOptions,
  DEFAULT_COMPRESS_OPTIONS,
  ...
} from './mediaTypes'
```

字段区补 `private enableChunkUpload = true`，setter 区补：

```ts
/**
 * 开启或关闭大文件主动分块上传。
 *
 * 仅作用于未加密的 `uploadFile`；加密附件走 `uploadEncryptedFile`，
 * 其密文大小与原文件不同，不能按原文件阈值分流。
 */
setEnableChunkUpload(enable: boolean) {
  this.enableChunkUpload = enable
}
```

`uploadFile` 在 `this.assertClientReady()` 之后、`try` 之前插入：

```ts
if (this.enableChunkUpload && file.size >= MEDIA_CHUNK_UPLOAD_THRESHOLD_BYTES) {
  return this.uploadLargeFile(file, onProgress)
}
```

**Step 4：验收 + commit**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/services/matrix/media/__tests__/MatrixMediaService.chunkFallback.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
git add src/services/matrix/media
git commit -m "feat(media): 大文件上传按阈值自动走分块"
```

---

## Task 7：存储设置页接入媒体配置与上传策略

**Files**

- Modify: `src/views/settingsWindow/tabs/StorageSettings.vue`
- Modify: `src/views/settingsWindow/tabs/__tests__/StorageSettings.test.ts`
- Modify: `locales/zh-CN/setting.json`、`locales/en/setting.json`

**Interfaces（UI 可见项）**

- 媒体服务配置：单文件上限（`m.upload.size`）、认证媒体状态（`authenticated_media`）。
- 上传设置：压缩开关、压缩质量（0.6 / 0.8 / 0.9）、分块开关。

**Step 1：失败测试**

`StorageSettings.test.ts`：

- `vi.hoisted` 增加 `getMediaConfig`、`getAuthenticatedMediaConfig` 两个 mock。
- mock 的 `matrixMediaService` 对象补这两个方法。
- `mountTab` 改为 `mount(StorageSettings, { global: { plugins: [createPinia()], stubs: { NDivider: true, NSwitch: true, NSelect: true } } })`。
- 新增断言：

```ts
it('展示服务端单文件上传上限与认证媒体状态', async () => {
  getMediaConfigMock.mockResolvedValue({ 'm.upload.size': 52428800 })
  getAuthenticatedMediaConfigMock.mockResolvedValue({ authenticated_media: true })
  const wrapper = mountTab()
  await flushPromises()
  expect(wrapper.find('[data-test="media-upload-limit"]').text()).toContain('50 MB')
  expect(wrapper.find('[data-test="media-auth-status"]').text()).toContain('已启用')
})
```

（`formatBytes` 的既有输出格式以现有用例 `'1 KB'` 为准；若为 `50.0 MB` 之类，按实际断言。）

**Step 2：页面实现**

`StorageSettings.vue` script 补：

```ts
import { NSelect, NSwitch } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { applyMediaUploadPreferences } from '@/services/matrix/media/mediaUploadPreferences'

const settingStore = useSettingStore()
const { preferences } = storeToRefs(settingStore)

type MediaConfigState = 'loading' | 'available' | 'unavailable'
const mediaConfigState = ref<MediaConfigState>('loading')
const maxUploadSize = ref(0)
const authState = ref<MediaConfigState>('loading')
const authenticatedMedia = ref(false)

async function loadMediaConfig(): Promise<void> {
  mediaConfigState.value = 'loading'
  authState.value = 'loading'
  const [configResult, authResult] = await Promise.allSettled([
    matrixMediaService.getMediaConfig(),
    matrixMediaService.getAuthenticatedMediaConfig()
  ])
  if (configResult.status === 'fulfilled') {
    maxUploadSize.value = Number(configResult.value['m.upload.size'] ?? 0)
    mediaConfigState.value = 'available'
  } else {
    mediaConfigState.value = 'unavailable'
  }
  if (authResult.status === 'fulfilled' && authResult.value) {
    authenticatedMedia.value = authResult.value.authenticated_media
    authState.value = 'available'
  } else {
    authState.value = 'unavailable'
  }
}

const qualityOptions = computed(() => [
  { label: t('setting.storage.quality_small'), value: 0.6 },
  { label: t('setting.storage.quality_standard'), value: 0.8 },
  { label: t('setting.storage.quality_high'), value: 0.9 }
])

function updateCompressEnabled(enabled: boolean): void {
  settingStore.setUploadCompressEnabled(enabled)
  applyMediaUploadPreferences()
}

function updateCompressQuality(quality: 0.6 | 0.8 | 0.9): void {
  settingStore.setUploadCompressQuality(quality)
  applyMediaUploadPreferences()
}

function updateChunkEnabled(enabled: boolean): void {
  settingStore.setUploadChunkEnabled(enabled)
  applyMediaUploadPreferences()
}

onMounted(() => {
  void loadStats()
  void loadQuota()
  void loadMediaConfig()
})
```

模板在「服务端媒体配额」区块之后追加：

```vue
<n-divider />

<!-- 媒体服务配置 -->
<div class="settings-section">
  <h3 class="section-title">{{ t('setting.storage.upload_settings') }}</h3>
  <p class="section-desc">{{ t('setting.storage.upload_settings_desc') }}</p>

  <div v-if="mediaConfigState === 'loading'" data-test="media-config-loading" class="quota-hint">
    {{ t('setting.storage.quota_loading') }}
  </div>
  <div v-else-if="mediaConfigState === 'unavailable'" data-test="media-config-unavailable" class="quota-hint">
    {{ t('setting.storage.config_unavailable') }}
  </div>
  <div v-else data-test="media-upload-limit" class="stat-item">
    <span class="stat-label">{{ t('setting.storage.max_upload_size') }}</span>
    <span class="stat-value">{{ formatBytes(maxUploadSize) }}</span>
  </div>

  <div data-test="media-auth-status" class="stat-item">
    <span class="stat-label">{{ t('setting.storage.authenticated_media') }}</span>
    <span class="stat-value">
      <template v-if="authState === 'unavailable'">{{ t('setting.storage.config_unavailable') }}</template>
      <template v-else-if="authenticatedMedia">{{ t('setting.storage.auth_enabled') }}</template>
      <template v-else>{{ t('setting.storage.auth_disabled') }}</template>
    </span>
  </div>
</div>

<n-divider />

<!-- 上传设置 -->
<div class="settings-section">
  <div class="stat-item">
    <span class="stat-label">{{ t('setting.storage.compress_enabled') }}</span>
    <n-switch :value="preferences.uploadCompressEnabled" @update:value="updateCompressEnabled" />
  </div>
  <div class="stat-item">
    <span class="stat-label">{{ t('setting.storage.compress_quality') }}</span>
    <n-select
      :value="preferences.uploadCompressQuality"
      :options="qualityOptions"
      :disabled="!preferences.uploadCompressEnabled"
      class="max-w-200px"
      @update:value="updateCompressQuality" />
  </div>
  <div class="stat-item">
    <span class="stat-label">{{ t('setting.storage.chunk_enabled') }}</span>
    <n-switch :value="preferences.uploadChunkEnabled" @update:value="updateChunkEnabled" />
  </div>
  <p class="quota-hint">{{ t('setting.storage.chunk_hint') }}</p>
</div>
```

注意：新增样式若需要，只能复用现有 `.stat-item / .stat-label / .stat-value / .quota-hint`，不得引入硬编码颜色。

**Step 3：i18n**

`locales/zh-CN/setting.json` 的 `storage` 块，`media_quota_desc` 后新增：

```json
"upload_settings": "媒体服务配置",
"upload_settings_desc": "来自当前服务器的媒体上传能力与本地上传策略。",
"max_upload_size": "单文件上限",
"authenticated_media": "认证媒体",
"auth_enabled": "已启用",
"auth_disabled": "未启用",
"config_unavailable": "服务器未提供该配置",
"compress_enabled": "上传前压缩图片",
"compress_quality": "压缩质量",
"quality_small": "省流（0.6）",
"quality_standard": "标准（0.8）",
"quality_high": "高清（0.9）",
"chunk_enabled": "大文件分块上传",
"chunk_hint": "开启后，超过 10MB 的文件将自动分块上传，避免单次请求被服务器拒绝。"
```

`locales/en/setting.json` 同步英文：

```json
"upload_settings": "Media service",
"upload_settings_desc": "Media upload capabilities reported by the homeserver, plus local upload policy.",
"max_upload_size": "Max file size",
"authenticated_media": "Authenticated media",
"auth_enabled": "Enabled",
"auth_disabled": "Disabled",
"config_unavailable": "Not provided by server",
"compress_enabled": "Compress images before upload",
"compress_quality": "Compression quality",
"quality_small": "Data saver (0.6)",
"quality_standard": "Standard (0.8)",
"quality_high": "High (0.9)",
"chunk_enabled": "Chunked upload for large files",
"chunk_hint": "When enabled, files over 10MB are uploaded in chunks to avoid request size limits."
```

**Step 4：验收 + commit**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vitest run src/views/settingsWindow/tabs/__tests__/StorageSettings.test.ts
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:i18n-dead-keys
git add src/views/settingsWindow/tabs locales
git commit -m "feat(setting): 存储页展示媒体服务配置与上传策略"
```

---

## Task 8：文档口径回写与全量门禁

**Files**

- Modify: `docs/UI优化方案-v2.4.md`（第 144、161、175 行附近）

**Step 1：口径回写**

- 媒体覆盖率行改为：`媒体 60 = 已覆盖 52 / 无 UI 承载 2（deleteMedia、uploadContentWithId）/ 未覆盖 6（preview_url 4 + download_signed 2）`。
- 管理族行补注：admin 媒体 3 条「仅服务层封装」已完成接线。
- 保持「未覆盖 6」明细不变，不回写其它子域。

**Step 2：全量门禁**

```bash
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm vue-tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm test:run
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:ratchet
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-coverage
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:doc-paths
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:sdk-boundary
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm quality:no-raw-fetch
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:file-size
PATH=/opt/homebrew/opt/node@22/bin:$PATH pnpm check:i18n-dead-keys
```

**Step 3：R3 三项自查（写进提交说明）**

1. 复用现有服务层：8 条全部调用既有 `MatrixMediaService` / `adminService`，无新增 HTTP 或平行客户端。
2. 移动端零 admin/AI 增量：未改 `src/mobile/**`，未新增 admin/AI 入口。
3. 移动端产物：本次仅桌面设置页与 admin 组件，前端类型检查覆盖两端；如需手机端构建，另行 `pnpm adev` / `pnpm idev` 验证。

**Step 4：commit**

```bash
git add docs/UI优化方案-v2.4.md
git commit -m "docs: 回写媒体子域覆盖口径为 52/2/6"
```

---

## 完成标准

- 8 条端点均有可点击 UI 入口，且入口行为有单测或组件测试覆盖。
- `deleteMedia`、`uploadContentWithId` 在文档中明确登记为无 UI 承载。
- 上述 10 条门禁全部通过，输出留存在提交说明或会话记录中。
