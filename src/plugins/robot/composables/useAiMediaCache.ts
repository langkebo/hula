import { convertFileSrc } from '@tauri-apps/api/core'
import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import type { Ref } from 'vue'
import { getAiMediaExtension } from '@/plugins/robot/utils/aiMediaUrl'
import { createLogger } from '@/utils/Logger'
import { md5FromString } from '@/utils/Md5Util'
import { persistAiImageFile, resolveAiImagePath } from '@/utils/PathUtil'

const logger = createLogger('AiMediaCache')

interface NativeFetchResponseLike {
  status?: number
  statusText?: string
  ok?: boolean
  arrayBuffer?: () => Promise<unknown>
  bytes?: () => Promise<unknown>
  data?: unknown
}

interface MessageLike {
  type: string
  content: string
  imageUrl?: string
  videoUrl?: string
  audioUrl?: string
}

interface ConversationLike {
  id: string
}

interface UseAiMediaCacheOptions {
  messageList: Ref<MessageLike[]>
  currentChat: Ref<ConversationLike>
  userUid: Ref<string | undefined>
}

const aiMediaDownloadTasks = new Map<string, Promise<ArrayBuffer>>()
const MAX_MEDIA_CACHE_SIZE = 10

const convertHttpDataToArrayBuffer = (rawData: unknown): ArrayBuffer => {
  if (rawData === null || rawData === undefined) {
    throw new Error('图片数据为空')
  }

  if (rawData instanceof ArrayBuffer) {
    return rawData
  }

  if (rawData instanceof Uint8Array) {
    return rawData.slice().buffer
  }

  if (ArrayBuffer.isView(rawData)) {
    const view = rawData as ArrayBufferView
    const copy = new Uint8Array(view.byteLength)
    copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength))
    return copy.buffer
  }

  if (Array.isArray(rawData)) {
    return Uint8Array.from(rawData).buffer
  }

  if (typeof rawData === 'object') {
    const maybeData = (rawData as { data?: number[] }).data
    if (Array.isArray(maybeData)) {
      return Uint8Array.from(maybeData).buffer
    }
  }

  if (typeof rawData === 'string') {
    const binaryString = atob(rawData)
    const len = binaryString.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  throw new Error('无法解析图片数据')
}

const requestAiMediaBuffer = (url: string) => {
  if (!url) {
    return Promise.reject(new Error('图片地址无效'))
  }

  const existingTask = aiMediaDownloadTasks.get(url)
  if (existingTask) {
    return existingTask
  }

  if (aiMediaDownloadTasks.size >= MAX_MEDIA_CACHE_SIZE) {
    const firstKey = aiMediaDownloadTasks.keys().next().value
    if (firstKey) {
      aiMediaDownloadTasks.delete(firstKey)
    }
  }

  const downloadTask = (async () => {
    const response = await nativeFetch(url, {
      method: 'GET'
    })

    const anyResponse = response as NativeFetchResponseLike
    const status = typeof anyResponse.status === 'number' ? anyResponse.status : 200
    const statusText = typeof anyResponse.statusText === 'string' ? anyResponse.statusText : ''
    const ok = 'ok' in anyResponse ? Boolean(anyResponse.ok) : status >= 200 && status < 400

    if (!ok) {
      throw new Error(`下载失败: ${status} ${statusText}`.trim())
    }

    if (typeof anyResponse.arrayBuffer === 'function') {
      const buffer = await anyResponse.arrayBuffer()
      if (buffer instanceof ArrayBuffer) {
        return buffer
      }
    }

    if (typeof anyResponse.bytes === 'function') {
      const bytes = await anyResponse.bytes()
      return convertHttpDataToArrayBuffer(bytes)
    }

    if ('data' in anyResponse) {
      return convertHttpDataToArrayBuffer(anyResponse.data)
    }

    throw new Error('无法解析图片数据')
  })().finally(() => {
    aiMediaDownloadTasks.delete(url)
  })

  aiMediaDownloadTasks.set(url, downloadTask)
  return downloadTask
}

const buildAiMediaFileName = async (url: string, fallbackExt: string, prefix: string) => {
  const ext = getAiMediaExtension(url, fallbackExt)
  try {
    const hash = await md5FromString(url)
    return `${prefix}-${hash}.${ext}`
  } catch (error) {
    logger.error('生成 AI 媒体文件名失败:', error)
    return `${prefix}-${Date.now()}.${ext}`
  }
}

export const useAiMediaCache = (options: UseAiMediaCacheOptions) => {
  const { messageList, currentChat, userUid } = options

  const ensureLocalAiMedia = async (
    remoteUrl: string,
    messageIndex: number,
    mediaType: 'image' | 'video' | 'audio',
    fallbackExt: string,
    prefix: string,
    urlField: 'imageUrl' | 'videoUrl' | 'audioUrl'
  ) => {
    if (!remoteUrl || !userUid.value || !currentChat.value.id) return
    const targetMessage = messageList.value[messageIndex]
    if (targetMessage?.type !== 'assistant') return
    const isSameMedia = targetMessage[urlField]
      ? targetMessage[urlField] === remoteUrl
      : targetMessage.content === remoteUrl
    if (!isSameMedia) return
    try {
      const fileName = await buildAiMediaFileName(remoteUrl, fallbackExt, prefix)
      const existsResult = await resolveAiImagePath({
        userUid: userUid.value,
        conversationId: currentChat.value.id,
        fileName
      })
      let absolutePath = existsResult.absolutePath
      if (!existsResult.exists) {
        const buffer = await requestAiMediaBuffer(remoteUrl)
        const data = new Uint8Array(buffer)
        const saved = await persistAiImageFile({
          userUid: userUid.value,
          conversationId: currentChat.value.id,
          fileName,
          data
        })
        absolutePath = saved.absolutePath
      }
      if (messageList.value[messageIndex]) {
        const displayUrl = convertFileSrc(absolutePath)
        messageList.value[messageIndex].content = displayUrl
        messageList.value[messageIndex][urlField] = remoteUrl
      }
    } catch (error) {
      logger.error(`AI ${mediaType}本地化失败:`, error)
    }
  }

  const ensureLocalAiImage = (remoteUrl: string, messageIndex: number) =>
    ensureLocalAiMedia(remoteUrl, messageIndex, 'image', 'png', 'ai-image', 'imageUrl')

  const ensureLocalAiVideo = (remoteUrl: string, messageIndex: number) =>
    ensureLocalAiMedia(remoteUrl, messageIndex, 'video', 'mp4', 'ai-video', 'videoUrl')

  const ensureLocalAiAudio = (remoteUrl: string, messageIndex: number) =>
    ensureLocalAiMedia(remoteUrl, messageIndex, 'audio', 'mp3', 'ai-audio', 'audioUrl')

  return {
    ensureLocalAiImage,
    ensureLocalAiVideo,
    ensureLocalAiAudio
  }
}
