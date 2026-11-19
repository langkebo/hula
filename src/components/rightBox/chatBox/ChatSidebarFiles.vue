<template>
  <div v-show="active" class="flex-1 min-h-0 flex flex-col">
    <!-- 首次取数中：给骨架屏，避免把「还没取到」渲染成「没有配额」 -->
    <template v-if="!loaded">
      <n-flex
        align="center"
        justify="space-between"
        class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
        <n-skeleton height="12px" width="32px" :sharp="false" />
        <n-skeleton height="12px" width="72px" :sharp="false" />
      </n-flex>
      <div class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
        <n-skeleton height="4px" :sharp="false" />
      </div>
    </template>
    <!-- 配额统计：数据来自 media 配额接口；取不到就整块隐藏，绝不显示假数字 -->
    <template v-else-if="quota">
      <n-flex
        align="center"
        justify="space-between"
        class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
        <span class="text-[var(--text-xs)] font-medium color-[--tjg-text-tertiary]">
          {{ t('home.chat_sidebar.quota.title') }}
        </span>
        <span class="text-[var(--text-xs)] color-[--tjg-color-primary-500]" data-test="chat-sidebar-quota-text">
          {{ quotaText }}
        </span>
      </n-flex>
      <!-- 配额进度条 -->
      <div class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
        <n-progress
          type="line"
          :percentage="quotaPercent"
          :height="4"
          :show-indicator="false"
          color="var(--tjg-color-primary-500)" />
      </div>
    </template>
    <!-- 服务端有配额接口但这次没取到：如实说「暂不可用」并给重试入口，不把失败画成用量 0 -->
    <div v-else-if="quotaUnavailable" class="px-8px py-6px shrink-0 border-b border-[--tjg-border-default]">
      <PartialStateBanner
        compact
        data-testid="chat-sidebar-quota-partial"
        :message="t('home.chat_sidebar.quota.unavailable_hint')"
        :retry-text="t('home.chat_sidebar.actions.retry')"
        @retry="loadQuota" />
    </div>

    <div class="flex-1 min-h-0 flex flex-col">
      <!-- 没有选中会话：文件是房间维度的，先让用户选房间 -->
      <div v-if="!roomId" class="flex-1 flex items-center justify-center">
        <EmptyState
          illustration="no-conversations"
          :description="t('home.chat_sidebar.empty.no_chat_selected')"
          data-test="chat-sidebar-files-no-room" />
      </div>
      <!-- 服务端不支持分页读消息：如实说明能力缺失，不伪装成「暂无文件」 -->
      <div v-else-if="filesUnsupported" class="flex-1 flex items-center justify-center">
        <EmptyState
          illustration="server-unavailable"
          :description="t('home.chat_sidebar.empty.files_unsupported')"
          data-test="chat-sidebar-files-unsupported" />
      </div>
      <!-- 首次扫描中 -->
      <div v-else-if="!filesLoaded" class="px-12px py-8px" data-test="chat-sidebar-files-loading">
        <n-skeleton text :repeat="3" :sharp="false" />
      </div>
      <!-- 扫描失败：给可重试的局部失败信号，不把失败画成空态 -->
      <div v-else-if="filesError" class="px-8px py-6px shrink-0">
        <PartialStateBanner
          compact
          data-testid="chat-sidebar-files-partial"
          :message="t('home.chat_sidebar.files.load_failed')"
          :retry-text="t('home.chat_sidebar.actions.retry')"
          @retry="loadFiles(false)" />
      </div>
      <template v-else>
        <!-- 空态：已到房间开头才算「没有文件」；还有更早历史时如实说明只扫描了当前一页 -->
        <div v-if="files.length === 0" class="flex-1 flex flex-col items-center justify-center px-12px">
          <EmptyState
            compact
            illustration="no-results"
            :description="t('home.chat_sidebar.empty.files')"
            data-test="chat-sidebar-files-empty" />
          <p
            v-if="nextToken"
            class="mt-4px mb-0 text-[var(--text-xs)] color-[--tjg-text-quaternary]"
            data-test="chat-sidebar-files-scope-hint">
            {{ t('home.chat_sidebar.files.scope_hint') }}
          </p>
        </div>
        <div v-else class="flex-1 min-h-0 overflow-y-auto px-6px py-4px">
          <div
            v-for="file in files"
            :key="file.eventId"
            class="flex items-center gap-8px px-8px py-6px mb-4px rounded-8px bg-[--tjg-surface-search]"
            data-test="chat-sidebar-file-item">
            <!-- 图片走服务端缩略图；加密附件与解析失败回落类型图标，不显示破图 -->
            <img
              v-if="thumbnails[file.eventId]"
              :src="thumbnails[file.eventId]"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              class="size-32px shrink-0 rounded-4px object-cover"
              data-test="chat-sidebar-file-thumb"
              @error="markThumbnailFailed(file.eventId)" />
            <svg v-else class="size-20px shrink-0 color-[--tjg-text-secondary]" aria-hidden="true">
              <use :href="fileIcon(file.kind)"></use>
            </svg>
            <div class="flex-1 min-w-0">
              <p
                class="mb-0 text-[var(--text-xs)] color-[--tjg-text-primary] truncate"
                :title="file.name || file.eventId">
                {{ file.name || t('home.chat_sidebar.files.unnamed') }}
              </p>
              <p class="mb-0 text-[10px] color-[--tjg-text-tertiary] truncate">
                {{ fileMeta(file) }}
              </p>
            </div>
            <svg v-if="file.encrypted" class="size-12px shrink-0 color-[--tjg-text-quaternary]" aria-hidden="true">
              <use href="#lock"></use>
            </svg>
            <button
              type="button"
              class="shrink-0 p-2px rounded-4px bg-transparent border-none cursor-pointer color-[--tjg-text-tertiary] hover:color-[--tjg-color-primary-500] hover:bg-[--tjg-surface-sidebar-hover] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[--tjg-color-primary-500]"
              :title="t('home.chat_sidebar.files.jump_to_message')"
              :aria-label="t('home.chat_sidebar.files.jump_to_message')"
              data-test="chat-sidebar-file-jump"
              @click="jumpToMessage(file)">
              <svg class="size-14px" aria-hidden="true"><use href="#message"></use></svg>
            </button>
            <button
              type="button"
              class="shrink-0 p-2px rounded-4px bg-transparent border-none cursor-pointer color-[--tjg-text-tertiary] hover:color-[--tjg-color-primary-500] hover:bg-[--tjg-surface-sidebar-hover] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[--tjg-color-primary-500] disabled:opacity-50 disabled:cursor-not-allowed"
              :title="t('home.chat_sidebar.files.download')"
              :aria-label="t('home.chat_sidebar.files.download')"
              :disabled="downloadingIds.includes(file.eventId)"
              data-test="chat-sidebar-file-download"
              @click="downloadFileEntry(file)">
              <svg class="size-14px" aria-hidden="true"><use href="#download"></use></svg>
            </button>
          </div>
        </div>
        <!-- 还有更早历史：允许继续翻页，扫描是分页的，不宣称一次就扫完整个房间 -->
        <div v-if="nextToken" class="shrink-0 px-12px py-8px border-t border-[--tjg-border-default]">
          <n-button
            size="tiny"
            block
            quaternary
            :loading="filesLoading"
            data-test="chat-sidebar-files-more"
            @click="loadFiles(true)">
            {{ t('home.chat_sidebar.files.load_more') }}
          </n-button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import type { MediaQuotaStats } from '@/services/matrix/media/mediaConfigOps'
import { onMediaQuotaChanged } from '@/services/matrix/media/mediaQuotaEvents'
import { matrixRoomTimelineService } from '@/services/matrix/room/TimelineService'
import type { RoomFileEntry } from '@/services/matrix/room/timelineOutcomes'
import { useFileDownloadStore } from '@/stores/domains/widget/fileDownload'
import { formatChatTime } from '@/utils/ComputedTime'
import { formatBytes } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

const props = defineProps<{ active: boolean; roomId?: string }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const logger = createLogger('ChatSidebarFiles')

const quota = ref<MediaQuotaStats | null>(null)
/** 接口存在但本次取不到（鉴权 / 网络 / 5xx）：显示「暂不可用」；服务端无此接口时为 false（整块隐藏） */
const quotaUnavailable = ref(false)
const loading = ref(false)
/** 首次探测结束（成功或失败）—— 避免「还没请求」时就把空态当成结果 */
const loaded = ref(false)
/** 上次取数时刻：配额变化不频繁，60s 内重复切面板不再打接口；取数失败则不缓存，下次可见即可重试 */
const QUOTA_TTL_MS = 60_000
let lastFetchedAt = 0
/** 取数期间又收到「配额已变化」通知：等本次结束后补一次，避免上传后仍显示旧值 */
let reloadQueued = false

/**
 * 取数结果分三态：
 * - 成功 → 展示真实用量；
 * - `unsupported`（服务端没有配额接口）→ 整块隐藏，因为「配额」这个概念不存在；
 * - `unavailable`（接口在但本次失败）→ 显示「暂不可用」，绝不显示 0 或占位数字。
 */
const loadQuota = async (): Promise<void> => {
  if (loading.value) {
    reloadQueued = true
    return
  }
  loading.value = true
  // `getQuotaStats()` 内部已吞错并返回 `{ ok, reason }`，这里不需要 try/catch。
  const result = await matrixMediaService.getQuotaStats()
  if (result.ok) {
    quota.value = result.stats
    quotaUnavailable.value = false
    lastFetchedAt = Date.now()
  } else {
    quota.value = null
    quotaUnavailable.value = result.reason === 'unavailable'
    // 本次失败不写缓存：下次面板可见时立刻重试
    lastFetchedAt = result.reason === 'unsupported' ? Date.now() : 0
  }
  loading.value = false
  loaded.value = true
  if (reloadQueued) {
    reloadQueued = false
    void loadQuota()
  }
}

const quotaText = computed(() => {
  const stats = quota.value
  if (!stats) return ''
  const used = formatBytes(stats.storageBytes)
  // 服务端没给上限（limitBytes=0）时只报用量，不编造分母
  return stats.limitBytes > 0 ? `${used} / ${formatBytes(stats.limitBytes)}` : used
})

const quotaPercent = computed(() => {
  const stats = quota.value
  if (!stats || stats.limitBytes <= 0) return 0
  return Math.min(100, Math.round((stats.storageBytes / stats.limitBytes) * 100))
})

// 只在面板首次可见时拉一次，避免隐藏状态下白打接口
watch(
  () => props.active,
  (active) => {
    if (!active) return
    const stale = Date.now() - lastFetchedAt > QUOTA_TTL_MS
    if (!loaded.value || stale) void loadQuota()
  },
  { immediate: true }
)

/** 文件列表：分页扫描出的附件消息，以及是否还有更早历史 */
const files = ref<RoomFileEntry[]>([])
/** 图片缩略图（eventId → URL）；加密附件不在此列，模板回落到类型图标 */
const thumbnails = ref<Record<string, string>>({})
/** 正在下载的文件，避免同一行被重复点击 */
const downloadingIds = ref<string[]>([])
const nextToken = ref<string | null>(null)
const filesLoading = ref(false)
const filesLoaded = ref(false)
const filesError = ref(false)
const filesUnsupported = ref(false)
/** 已加载过首屏的房间，避免可见性来回切换时重复扫描 */
let loadedRoomId = ''
/** 请求序号：切换房间后丢弃在途的旧响应，防止把 A 房间的文件写进 B 房间 */
let filesRequestId = 0

const resetFiles = (): void => {
  filesRequestId += 1
  files.value = []
  thumbnails.value = {}
  nextToken.value = null
  filesLoaded.value = false
  filesError.value = false
  filesUnsupported.value = false
  filesLoading.value = false
}

/**
 * 拉取文件列表。
 *
 * - `more=false`：从最新处重新扫描首页；
 * - `more=true`：沿 `nextToken` 向更早翻页并追加（按事件 ID 去重）。
 *
 * 空页但仍有 `nextToken` 是合法状态（本页全是文本消息），不当作「房间没有文件」。
 */
const loadFiles = async (more: boolean): Promise<void> => {
  const roomId = props.roomId
  if (!roomId) return
  const from = more ? nextToken.value : null
  if (more && !from) return

  const requestId = ++filesRequestId
  filesLoading.value = true
  filesError.value = false
  const result = await matrixRoomTimelineService.getRoomFiles(roomId, from ? { from } : undefined)
  // 期间切换了房间或发起了新请求：丢弃过期响应
  if (requestId !== filesRequestId) return

  if (result.status === 'ok') {
    const appended = more
      ? result.page.files.filter((entry) => !files.value.some((existing) => existing.eventId === entry.eventId))
      : result.page.files
    files.value = more ? [...files.value, ...appended] : appended
    refreshThumbnails()
    nextToken.value = result.page.nextToken
    filesUnsupported.value = false
  } else if (result.status === 'unsupported') {
    filesUnsupported.value = true
    nextToken.value = null
  } else {
    filesError.value = true
  }
  filesLoading.value = false
  filesLoaded.value = true
}

watch(
  () => [props.active, props.roomId] as const,
  ([active, roomId]) => {
    if (!active) return
    if (!roomId) {
      resetFiles()
      loadedRoomId = ''
      filesLoaded.value = true
      return
    }
    // 同一房间已加载或正在加载：不重复扫描
    if (loadedRoomId === roomId && (filesLoaded.value || filesLoading.value)) return
    resetFiles()
    loadedRoomId = roomId
    void loadFiles(false)
  },
  { immediate: true }
)

const FILE_ICONS: Record<RoomFileEntry['kind'], string> = {
  file: '#file2',
  image: '#photo',
  video: '#video-one',
  audio: '#Music'
}

const fileIcon = (kind: RoomFileEntry['kind']): string => FILE_ICONS[kind]

/** 元信息行：尺寸未知时省略（不写 0 B），时间缺失时省略 */
const fileMeta = (file: RoomFileEntry): string => {
  const parts: string[] = []
  if (file.size !== null) parts.push(formatBytes(file.size))
  if (file.timestamp !== null) {
    const time = formatChatTime(file.timestamp)
    if (time) parts.push(time)
  }
  return parts.join(' · ')
}

/**
 * 缩略图只对「未加密的图片」生成：加密附件必须先解密才能出图，
 * 为列表预取解密成本过高，回落到类型图标更诚实。解析失败也走同一回落。
 */
const refreshThumbnails = (): void => {
  const next: Record<string, string> = {}
  for (const file of files.value) {
    if (file.kind !== 'image' || file.encrypted) continue
    const thumbnail = matrixMediaService.getThumbnailUrl(file.url, 64, 64)
    if (thumbnail) next[file.eventId] = thumbnail
  }
  thumbnails.value = next
}

/** 缩略图加载失败（mxc 解析结果不可用）：移除该项，模板自动回落类型图标，不显示破图 */
const markThumbnailFailed = (eventId: string): void => {
  if (!(eventId in thumbnails.value)) return
  const next = { ...thumbnails.value }
  delete next[eventId]
  thumbnails.value = next
}

const fileDisplayName = (file: RoomFileEntry): string => file.name || t('home.chat_sidebar.files.unnamed')

/**
 * 下载文件。
 *
 * 复用 `fileDownload` store 的既有链路（签名媒体 / 加密媒体都由它处理），
 * 这里只负责「加密附件必须带解密描述符」「普通附件必须有可访问 HTTP 地址」的前置判断，
 * 以及下载成功后在文件夹中定位。
 */
const downloadFileEntry = async (file: RoomFileEntry): Promise<void> => {
  if (downloadingIds.value.includes(file.eventId)) return

  if ((file.encrypted && !file.encryptedFile) || (!file.encrypted && !file.httpUrl)) {
    showFeedback(t('home.chat_sidebar.files.download_unavailable'), 'error')
    return
  }

  downloadingIds.value = [...downloadingIds.value, file.eventId]
  try {
    const fileDownloadStore = useFileDownloadStore()
    const fileName = fileDisplayName(file)
    let absolutePath: string | null
    if (file.encrypted && file.encryptedFile) {
      absolutePath = await fileDownloadStore.downloadEncryptedFile(file.url, fileName, file.encryptedFile)
    } else if (file.httpUrl) {
      absolutePath = await fileDownloadStore.downloadFile(file.httpUrl, fileName)
    } else {
      absolutePath = null
    }
    // 失败时 store 内部已给出提示，这里只处理成功反馈
    if (!absolutePath) return

    showFeedback(t('home.chat_sidebar.files.download_success'), 'success')
    try {
      await revealItemInDir(absolutePath)
    } catch (error) {
      logger.warn(`[ChatSidebarFiles] reveal file in folder failed: ${(error as Error)?.message ?? error}`)
      showFeedback(t('home.chat_sidebar.files.reveal_failed'), 'warning')
    }
  } finally {
    downloadingIds.value = downloadingIds.value.filter((id) => id !== file.eventId)
  }
}

/** 跳转原消息：由 ChatMain 的 `useMessageJump` 负责历史翻页定位与高亮 */
const jumpToMessage = (file: RoomFileEntry): void => {
  const roomId = props.roomId
  if (!roomId) return
  useMitt.emit(MittEnum.NAVIGATE_TO_MESSAGE, { roomId, eventId: file.eventId })
}

// 上传 / 删除成功会让服务端配额变化：可见时立即重取；隐藏时清掉缓存，下次可见即重取。
let unsubscribeQuota = (): void => {}
onMounted(() => {
  unsubscribeQuota = onMediaQuotaChanged(() => {
    if (!props.active) {
      lastFetchedAt = 0
      return
    }
    void loadQuota()
  })
})
onBeforeUnmount(() => unsubscribeQuota())
</script>
