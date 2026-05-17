import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists, writeFile } from '@tauri-apps/plugin-fs'
import pLimit from 'p-limit'
import { defineStore } from 'pinia'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { StoresEnum } from '@/enums'
import { matrixEmojiService } from '@/services/matrix/messaging/MatrixEmojiService'
import type { EmojiItem as EmojiItemType } from '@/services/types'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import { md5FromString } from '@/utils/Md5Util'
import { detectRemoteFileType, getUserEmojiDir } from '@/utils/PathUtil'
import { isMobile } from '@/utils/PlatformConstants'

const logger = createLogger('EmojiStore')
const SUPPORTED_EMOJI_MIME_TYPES = ['image/png', 'image/gif', 'image/webp'] as const
const MIME_TYPE_BY_EXTENSION: Record<string, (typeof SUPPORTED_EMOJI_MIME_TYPES)[number]> = {
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
}

export const useEmojiStore = defineStore(StoresEnum.EMOJI, () => {
  const { showFeedback } = useActionFeedback()
  const isLoading = ref(false) // 是否正在加载
  const isPrefetching = ref(false)
  const userStore = useUserStore()
  const emojiList = shallowRef<EmojiItemType[]>([])
  const currentEmojiOwnerUid = ref<string | null>(null)
  let emojiWorker: Worker | null = null

  const resetEmojiState = () => {
    emojiList.value = []
    isLoading.value = false
    isPrefetching.value = false
    if (emojiWorker) {
      emojiWorker.terminate()
      emojiWorker = null
    }
  }

  watch(
    () => userStore.userInfo?.uid ?? null,
    (latestUid) => {
      if (currentEmojiOwnerUid.value === latestUid) return
      currentEmojiOwnerUid.value = latestUid
      resetEmojiState()
    },
    { immediate: true }
  )

  const getEmojiWorker = () => {
    if (typeof Worker === 'undefined') {
      return null
    }
    if (!emojiWorker) {
      emojiWorker = new Worker(new URL('@/workers/imageDownloader.ts', import.meta.url), { type: 'module' })
    }
    return emojiWorker
  }

  const downloadEmoji = async (url: string) => {
    const worker = getEmojiWorker()
    if (!worker) {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`下载表情失败: ${response.status} ${response.statusText}`)
      }
      return new Uint8Array(await response.arrayBuffer())
    }

    return await new Promise<Uint8Array>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<unknown>) => {
        const data = event.data as Record<string, unknown>
        if (!data || data.url !== url) return
        cleanup()
        if (data.success && data.buffer) {
          resolve(new Uint8Array(data.buffer as ArrayBuffer))
        } else {
          reject(new Error((data.error as string) || '下载表情失败'))
        }
      }
      const handleError = (event: ErrorEvent) => {
        cleanup()
        reject(new Error(event.message))
      }
      const cleanup = () => {
        worker.removeEventListener('message', handleMessage)
        worker.removeEventListener('error', handleError)
      }
      worker.addEventListener('message', handleMessage)
      worker.addEventListener('error', handleError)
      worker.postMessage({ url })
    })
  }

  const resolveEmojiExt = async (url: string) => {
    const match = url.match(/\\.([a-zA-Z0-9]+)(?:\\?|$)/)
    if (match?.[1]) {
      return match[1].toLowerCase()
    }
    try {
      const info = await detectRemoteFileType({ url, fileSize: null })
      if (info?.ext) return info.ext
    } catch (error) {
      logger.warn('识别表情类型失败:', error)
    }
    return 'png'
  }

  const buildFileName = async (url: string) => {
    const hash = await md5FromString(url)
    const ext = await resolveEmojiExt(url)
    return `${hash}.${ext}`
  }

  const resolveEmojiMimeType = async (url: string, remoteMimeType?: string | null) => {
    if (
      remoteMimeType &&
      SUPPORTED_EMOJI_MIME_TYPES.includes(remoteMimeType as (typeof SUPPORTED_EMOJI_MIME_TYPES)[number])
    ) {
      return remoteMimeType
    }

    const ext = await resolveEmojiExt(url)
    return MIME_TYPE_BY_EXTENSION[ext] || 'image/png'
  }

  const createUploadFileFromUrl = async (url: string) => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`下载表情失败: ${response.status} ${response.statusText}`)
    }

    const blob = await response.blob()
    const mimeType = await resolveEmojiMimeType(url, blob.type || response.headers.get('content-type'))
    const ext = Object.entries(MIME_TYPE_BY_EXTENSION).find(([, value]) => value === mimeType)?.[0] || 'png'
    return new File([blob], `custom_emoji.${ext}`, { type: mimeType })
  }

  const ensureEmojiCached = async (
    emoji: EmojiItemType,
    emojiDir: string,
    baseDir: BaseDirectory,
    baseDirPath: string
  ) => {
    const fileName = await buildFileName(emoji.expressionUrl)
    const relativePath = await join(emojiDir, fileName)
    const absolutePath = await join(baseDirPath, relativePath)
    const hasFile = await exists(relativePath, { baseDir })
    // 如果本地文件不存在，先移除失效的本地链接，后续使用服务器URL渲染
    if (!hasFile && emoji.localUrl) {
      setLocalUrl(emoji.id, null)
    }
    if (!hasFile) {
      const bytes = await downloadEmoji(emoji.expressionUrl)
      await writeFile(relativePath, bytes, { baseDir })
    }
    const localUrl = convertFileSrc(absolutePath)
    setLocalUrl(emoji.id, localUrl)
    return localUrl
  }

  const prefetchEmojiToLocal = async (concurrency = 4) => {
    if (isPrefetching.value) return
    const { uid } = userStore.userInfo || {}
    if (!uid || emojiList.value.length === 0) return
    isPrefetching.value = true
    try {
      const emojiDir = await getUserEmojiDir(uid)
      const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
      const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
      const limit = pLimit(concurrency)

      await Promise.allSettled(
        emojiList.value.map((emoji) =>
          limit(() =>
            ensureEmojiCached(emoji, emojiDir, baseDir, baseDirPath).catch((error) => {
              logger.error('缓存失败:', emoji.expressionUrl, error)
            })
          )
        )
      )
    } finally {
      isPrefetching.value = false
    }
  }

  const initEmojis = async () => {
    await getEmojiList()
    await prefetchEmojiToLocal()
  }

  /**
   * 获取我的全部表情
   */
  const getEmojiList = async () => {
    isLoading.value = true
    const requestUid = userStore.userInfo?.uid ?? null
    if (!requestUid) {
      emojiList.value = []
      isLoading.value = false
      return
    }
    const localUrlCache = emojiList.value.reduce<Record<string, string>>((acc, item) => {
      if (item.localUrl) {
        acc[item.id] = item.localUrl
      }
      return acc
    }, {})
    try {
      const packs = await matrixEmojiService.emojiList({ userId: requestUid })
      if (requestUid === currentEmojiOwnerUid.value) {
        const items: EmojiItemType[] = []
        for (const pack of packs) {
          for (const item of pack.items) {
            const localUrl = localUrlCache[item.id]
            items.push(localUrl ? { ...item, expressionUrl: item.url, localUrl } : { ...item, expressionUrl: item.url })
          }
        }
        emojiList.value = items
      }
    } catch (error) {
      logger.error('获取表情列表失败:', error)
    }
    isLoading.value = false
    if (requestUid !== currentEmojiOwnerUid.value) {
      return
    }
  }

  /**
   * 添加表情
   */
  const addEmoji = async (emojiUrl: string) => {
    const { uid } = userStore.userInfo!
    if (!uid || !emojiUrl) return false
    try {
      const uploadFile = await createUploadFileFromUrl(emojiUrl)
      await matrixEmojiService.emojiUpload(uploadFile, 'custom_emoji')
      showFeedback('添加表情成功', 'success')
      await getEmojiList()
      return true
    } catch (error) {
      logger.error('添加表情失败:', error)
      return false
    }
  }

  /**
   * 删除表情
   */
  const deleteEmoji = async (id: string) => {
    if (!id) return false
    try {
      await matrixEmojiService.emojiDelete(id)
      await getEmojiList()
      return true
    } catch (error) {
      logger.error('删除表情失败:', error)
      return false
    }
  }

  /**
   * 记录表情对应的本地缓存地址
   */
  const setLocalUrl = (id: string, localUrl: string | null | undefined) => {
    if (!id) return
    const index = emojiList.value.findIndex((item) => item.id === id)
    if (index !== -1) {
      if (!localUrl) {
        const { localUrl: omitted, ...rest } = emojiList.value[index]
        void omitted
        emojiList.value[index] = rest as EmojiItemType
      } else {
        emojiList.value[index] = { ...emojiList.value[index], localUrl }
      }
      triggerRef(emojiList)
    }
  }

  return {
    emojiList,
    addEmoji,
    getEmojiList,
    deleteEmoji,
    setLocalUrl,
    isLoading,
    initEmojis,
    prefetchEmojiToLocal
  }
})
