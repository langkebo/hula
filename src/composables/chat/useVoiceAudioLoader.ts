import type { Ref } from 'vue'
import { ref } from 'vue'
import type { useWaveformRenderer } from '@/composables/chat/useWaveformRenderer'
import { useAudioFileManager } from '@/composables/common/useAudioFileManager'
import type { useAudioPlayback } from '@/composables/common/useAudioPlayback'
import { useIntersectionTaskQueue } from '@/composables/common/useIntersectionTaskQueue'
import { matrixVoiceService } from '@/services/matrix/media/MatrixVoiceService'
import type { VoiceBody } from '@/services/types'
import { useUserStore } from '@/stores/domains/user/user'
import { useFileDownloadStore } from '@/stores/domains/widget/fileDownload'
import type { MatrixEncryptedAttachmentLike } from '@/types/matrix-services'
import { extractFileName } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { safeExistsPath } from '@/utils/PathUtil'

const logger = createLogger('VoiceAudioLoader')

/**
 * 波形缓存上限。每条波形仅 `waveformWidth / 2`（最多 50）个浮点数，
 * 300 条占用的内存可以忽略，同时足以覆盖常见会话的滚动往返。
 */
const WAVEFORM_CACHE_LIMIT = 300

/**
 * 按音频 ID 缓存波形（模块级）。
 *
 * 波形只由音频内容与时长决定，与气泡颜色、播放进度无关；而消息列表会因滚动、
 * 切换会话反复挂载/卸载同一条语音。原实现每次挂载都要读文件 + `decodeAudioData`
 * 逐样本计算，同一音频被重复解码。这里做 LRU 缓存，并复用并发的生成任务。
 */
const waveformCache = new Map<string, number[]>()
const waveformTasks = new Map<string, Promise<number[] | null>>()

const readCachedWaveform = (key: string): number[] | null => {
  const cached = waveformCache.get(key)
  if (!cached) {
    return null
  }
  // 命中后移到队尾，维持 LRU 顺序
  waveformCache.delete(key)
  waveformCache.set(key, cached)
  return cached
}

const writeCachedWaveform = (key: string, waveform: number[]) => {
  waveformCache.delete(key)
  waveformCache.set(key, waveform)
  while (waveformCache.size > WAVEFORM_CACHE_LIMIT) {
    const oldest = waveformCache.keys().next().value
    if (oldest === undefined) {
      break
    }
    waveformCache.delete(oldest)
  }
}

type VoiceAudioLoaderOptions = {
  body: () => VoiceBody
  duration: Ref<number>
  renderer: Pick<
    ReturnType<typeof useWaveformRenderer>,
    'waveformData' | 'generateWaveformData' | 'loadPrecomputedWaveform'
  >
  playback: Pick<ReturnType<typeof useAudioPlayback>, 'audioElement' | 'createAudioElement'>
}

/**
 * 语音消息的惰性音频加载器。
 *
 * 原实现挂载即执行「检查/下载加密文件 → 读取音频 → `decodeAudioData` 逐样本算波形
 * → `new Audio()`」，长消息列表里每条语音都会在挂载瞬间做一轮重 I/O 与解码。
 * 现在拆成三段，按需推进：
 *
 * 1. 进入视口（rootMargin 300px）只解析来源并加载波形，命中缓存则直接复用；
 * 2. 首次点击播放时才创建 `Audio` 元素，避免为屏幕上所有语音提前请求/持有音频；
 * 3. 来源解析与波形生成都做 in-flight 合并，同一音频并发挂载只执行一次。
 */
export const useVoiceAudioLoader = ({ body, duration, renderer, playback }: VoiceAudioLoaderOptions) => {
  const userStore = useUserStore()
  const fileDownloadStore = useFileDownloadStore()
  const fileManager = useAudioFileManager(userStore.userInfo?.uid as string)
  const { observe, disconnect } = useIntersectionTaskQueue({ rootMargin: '300px 0px' })

  const preparing = ref(false)
  let sourceTask: Promise<string> | null = null
  let playerTask: Promise<boolean> | null = null

  const audioId = () => body().mxcUrl || body().url
  const rawAudioUrl = () => body().mxcUrl || body().url
  const fallbackUrl = () => matrixVoiceService.getPlayableUrl(body().mxcUrl, body().url)

  const hasEncryptedFile = () => {
    const encryptedFile = body().encryptedFile
    return (
      !!encryptedFile &&
      typeof encryptedFile === 'object' &&
      typeof encryptedFile.url === 'string' &&
      typeof encryptedFile.v === 'string'
    )
  }

  const resolveVoiceFileName = () => body().fileName || extractFileName(rawAudioUrl() || '') || 'voice.webm'

  /**
   * 解析波形与播放共用的一份音频来源：加密语音优先使用已有本地文件，
   * 否则走加密下载；明文语音直接使用服务层生成的可播放 URL。
   */
  const resolveSource = (): Promise<string> => {
    if (sourceTask) {
      return sourceTask
    }

    const task = (async () => {
      if (!hasEncryptedFile() || !rawAudioUrl()) {
        return fallbackUrl()
      }

      const localPath = body().localPath
      if (localPath) {
        try {
          if (await safeExistsPath(localPath)) {
            return localPath
          }
        } catch (error) {
          logger.warn('Failed to check encrypted voice local file:', error)
        }
      }

      const downloaded = await fileDownloadStore.downloadEncryptedFile(
        rawAudioUrl(),
        resolveVoiceFileName(),
        body().encryptedFile as MatrixEncryptedAttachmentLike
      )
      if (!downloaded) {
        throw new Error('Failed to download encrypted voice message')
      }
      return downloaded
    })()

    sourceTask = task
    // 失败时清空，允许后续交互重试
    task.catch(() => {
      sourceTask = null
    })
    return task
  }

  const loadWaveform = async (): Promise<number[] | null> => {
    const key = audioId()
    if (!key) {
      return null
    }

    const cached = readCachedWaveform(key)
    if (cached) {
      renderer.loadPrecomputedWaveform(cached)
      return cached
    }

    const pending = waveformTasks.get(key)
    if (pending) {
      const shared = await pending
      if (shared) {
        renderer.loadPrecomputedWaveform(shared)
      }
      return shared
    }

    const task = (async (): Promise<number[] | null> => {
      try {
        const source = await resolveSource()
        const audioBuffer = await fileManager.loadAudioWaveform(source)
        await renderer.generateWaveformData(audioBuffer)
        const waveform = renderer.waveformData.value
        return waveform.length > 0 ? waveform : null
      } catch (error) {
        logger.warn('Failed to load voice waveform:', error)
        return null
      }
    })()

    waveformTasks.set(key, task)
    const result = await task
    waveformTasks.delete(key)
    if (result) {
      writeCachedWaveform(key, result)
    }
    return result
  }

  /**
   * 首次播放前准备：确保波形已加载，并创建可播放的 Audio 元素。
   * 重复调用复用同一个 Promise，避免连点触发多次下载。
   */
  const preparePlayer = (): Promise<boolean> => {
    if (playback.audioElement.value) {
      return Promise.resolve(true)
    }
    if (playerTask) {
      return playerTask
    }

    preparing.value = true
    const task = (async () => {
      try {
        await loadWaveform()
        const source = await resolveSource()
        const playable = hasEncryptedFile() ? await fileManager.getAudioUrl(source) : fallbackUrl()
        await playback.createAudioElement(playable, duration.value)
        return true
      } catch (error) {
        logger.error('Failed to prepare voice playback:', error)
        return false
      } finally {
        preparing.value = false
        playerTask = null
      }
    })()

    playerTask = task
    return task
  }

  /**
   * 消息进入视口（含 300px 预取区）时才开始读文件/解码；不支持
   * IntersectionObserver 的环境由任务队列立即执行，行为与原实现一致。
   */
  const observeVisibility = (target: Element | null) => {
    observe(target, () => {
      void loadWaveform()
    })
  }

  const cleanup = () => {
    disconnect()
    fileManager.cleanup()
  }

  return {
    preparing,
    loadWaveform,
    preparePlayer,
    observeVisibility,
    cleanup
  }
}
