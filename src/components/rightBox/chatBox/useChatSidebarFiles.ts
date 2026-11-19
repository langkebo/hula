import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { matrixMediaService } from '@/services/matrix/media/MatrixMediaService'
import { matrixRoomTimelineService } from '@/services/matrix/room/TimelineService'
import type { RoomFileEntry } from '@/services/matrix/room/timelineFileOutcomes'
import { useFileDownloadStore } from '@/stores/domains/widget/fileDownload'
import { formatChatTime } from '@/utils/ComputedTime'
import { formatBytes } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ChatSidebarFiles')

const FILE_ICONS: Record<RoomFileEntry['kind'], string> = {
  file: '#file2',
  image: '#photo',
  video: '#video-one',
  audio: '#Music'
}

/**
 * 侧栏「文件」列表的数据与动作。
 *
 * 面板可见时才扫描；分页沿 `nextToken` 向更早翻页，切房间后丢弃在途响应。
 * 组件只负责渲染，所有取数 / 下载 / 跳转逻辑收敛在这里。
 */
export function useChatSidebarFiles(options: { active: () => boolean; roomId: () => string | undefined }) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

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

  /**
   * 拉取文件列表。
   *
   * - `more=false`：从最新处重新扫描首页；
   * - `more=true`：沿 `nextToken` 向更早翻页并追加（按事件 ID 去重）。
   *
   * 空页但仍有 `nextToken` 是合法状态（本页全是文本消息），不当作「房间没有文件」。
   */
  const loadFiles = async (more: boolean): Promise<void> => {
    const roomId = options.roomId()
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
    () => [options.active(), options.roomId()] as const,
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
    const roomId = options.roomId()
    if (!roomId) return
    useMitt.emit(MittEnum.NAVIGATE_TO_MESSAGE, { roomId, eventId: file.eventId })
  }

  return {
    files,
    thumbnails,
    downloadingIds,
    nextToken,
    filesLoading,
    filesLoaded,
    filesError,
    filesUnsupported,
    loadFiles,
    fileIcon,
    fileMeta,
    markThumbnailFailed,
    downloadFileEntry,
    jumpToMessage
  }
}
