import { convertFileSrc } from '@tauri-apps/api/core'
import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists, writeFile } from '@tauri-apps/plugin-fs'
import pLimit from 'p-limit'
import type { ComponentPublicInstance } from 'vue'
import { type ComputedRef, type Ref, ref, watch } from 'vue'
import type { EmojiItem as EmojiListItem } from '@/services/types'
import type { useEmojiStore } from '@/stores/domains/chat/emoji'
import type { useUserStore } from '@/stores/domains/user/user'
import { HttpClient } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'
import { md5FromString } from '@/utils/Md5Util'
import { detectRemoteFileType, getUserEmojiDir } from '@/utils/PathUtil'
import { isMobile } from '@/utils/PlatformConstants'

const logger = createLogger('EmojiLocalCache')

type EmojiWorkerSuccessMessage = { url: string; success: true; buffer: ArrayBuffer }
type EmojiWorkerErrorMessage = { url: string; success: false; error?: string }
type EmojiWorkerMessage = EmojiWorkerSuccessMessage | EmojiWorkerErrorMessage

type EmojiCacheEnvironment = {
  uid: string
  emojiDir: string
  baseDir: BaseDirectory
  baseDirPath: string
}

interface UseEmojiLocalCacheOptions {
  isFavoritesView: ComputedRef<boolean>
  emojiStore: ReturnType<typeof useEmojiStore>
  userStore: ReturnType<typeof useUserStore>
}

export const useEmojiLocalCache = ({ isFavoritesView, emojiStore, userStore }: UseEmojiLocalCacheOptions) => {
  const emojiLocalPathMap: Ref<Record<string, string>> = ref({})
  const emojiCacheEnv = ref<EmojiCacheEnvironment | null>(null)
  const hydrateScheduled = ref(false)

  const emojiExtCache = new Map<string, string>()
  const localUrlCache = new Map<string, string>()
  const emojiUrlToLocalMap = new Map<string, string>()
  const downloadingUrls = new Set<string>()
  const cachingEmojiIds = new Set<string>()
  const emojiVisibilityTargetMap = new Map<string, Element>()

  // 关闭收藏页的 IntersectionObserver，减少滚动开销
  const enableEmojiVisibilityObserver = false
  const observeEmojiVisibility = (_el: Element, _cb: () => void) => {}
  const unobserveEmojiVisibility = (_target: Element) => {}
  const disconnectEmojiObserver = () => {}

  const emojiWorkerUrl = new URL('../../workers/imageDownloader.ts', import.meta.url)
  let emojiCacheWorker: Worker | null = null
  const downloadLimit = pLimit(3)

  const getEmojiBaseDir = () => (isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource)
  const getEmojiBaseDirPath = async () => (isMobile() ? await appDataDir() : await resourceDir())

  const getEmojiWorker = () => {
    if (!isFavoritesView.value) return null
    if (typeof window === 'undefined') return null
    if (!emojiCacheWorker) {
      emojiCacheWorker = new Worker(emojiWorkerUrl)
    }
    return emojiCacheWorker
  }

  const inferExtFromUrl = (url: string) => {
    try {
      const { pathname } = new URL(url)
      const index = pathname.lastIndexOf('.')
      if (index !== -1) return pathname.slice(index + 1)
    } catch {
      const clean = url.split('?')[0]
      const index = clean.lastIndexOf('.')
      if (index !== -1) return clean.slice(index + 1)
    }
    return null
  }

  const resolveEmojiExtension = async (url: string) => {
    if (emojiExtCache.has(url)) return emojiExtCache.get(url)!
    const inferred = inferExtFromUrl(url)
    if (inferred) {
      const ext = inferred.toLowerCase()
      emojiExtCache.set(url, ext)
      return ext
    }
    let ext = ''
    try {
      const info = await detectRemoteFileType({ url, fileSize: null })
      ext = info?.ext || ''
    } catch (error) {
      logger.warn('识别表情类型失败:', error)
    }
    if (!ext) ext = 'png'
    emojiExtCache.set(url, ext)
    return ext
  }

  const buildEmojiFileName = async (url: string) => {
    const hash = await md5FromString(url)
    const ext = await resolveEmojiExtension(url)
    return `${hash}.${ext}`
  }

  const setEmojiLocalPath = (id: string, absolutePath: string, expressionUrl?: string) => {
    const localUrl = convertFileSrc(absolutePath)
    emojiLocalPathMap.value = { ...emojiLocalPathMap.value, [id]: localUrl }
    emojiStore.setLocalUrl(id, localUrl)
    if (expressionUrl) {
      emojiUrlToLocalMap.set(expressionUrl, localUrl)
      localUrlCache.set(expressionUrl, localUrl)
    }
  }

  const clearEmojiLocalPath = (id: string, expressionUrl?: string) => {
    const next = { ...emojiLocalPathMap.value }
    delete next[id]
    emojiLocalPathMap.value = next
    emojiStore.setLocalUrl(id, null)
    if (expressionUrl) {
      emojiUrlToLocalMap.delete(expressionUrl)
      localUrlCache.delete(expressionUrl)
    }
  }

  const ensureEmojiCacheEnvironment = async () => {
    if (!isFavoritesView.value) return null
    const uid = userStore.userInfo?.uid
    if (!uid) return null
    if (emojiCacheEnv.value?.uid === uid) return emojiCacheEnv.value
    try {
      const [emojiDir, baseDirPath] = await Promise.all([getUserEmojiDir(uid), getEmojiBaseDirPath()])
      const env: EmojiCacheEnvironment = { uid, emojiDir, baseDir: getEmojiBaseDir(), baseDirPath }
      emojiCacheEnv.value = env
      return env
    } catch (error) {
      logger.error('初始化表情缓存目录失败:', error)
      return null
    }
  }

  const releaseEmojiObserver = (id: string) => {
    const target = emojiVisibilityTargetMap.get(id)
    if (target) {
      unobserveEmojiVisibility(target)
      emojiVisibilityTargetMap.delete(id)
    }
  }

  const resolveVisibilityElement = (target: Element | ComponentPublicInstance | null) => {
    if (!target) return null
    if (target instanceof Element) return target
    const el = target.$el
    return el instanceof Element ? el : null
  }

  const downloadEmojiFile = async (url: string) => {
    const worker = getEmojiWorker()
    if (!worker) {
      const buffer = await HttpClient.downloadBytes(url)
      return new Uint8Array(buffer)
    }

    return await new Promise<Uint8Array>((resolve, reject) => {
      const handleMessage = (event: MessageEvent<EmojiWorkerMessage>) => {
        const data = event.data
        if (!data || data.url !== url) return
        cleanup()
        if (data.success) {
          resolve(new Uint8Array(data.buffer))
        } else {
          reject(new Error(data.error || '下载表情失败'))
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

  const cleanupLocalEmojiMap = (validIds: string[]) => {
    const validSet = new Set(validIds)
    const nextMap = { ...emojiLocalPathMap.value }
    let changed = false
    Object.keys(nextMap).forEach((id) => {
      if (!validSet.has(id)) {
        delete nextMap[id]
        changed = true
      }
    })
    if (changed) emojiLocalPathMap.value = nextMap
  }

  const cleanupEmojiObservers = (validIds: string[]) => {
    const validSet = new Set(validIds)
    emojiVisibilityTargetMap.forEach((el, id) => {
      if (!validSet.has(id)) {
        unobserveEmojiVisibility(el)
        emojiVisibilityTargetMap.delete(id)
      }
    })
  }

  const cleanupAllEmojiCaches = () => {
    emojiLocalPathMap.value = {}
    emojiExtCache.clear()
    localUrlCache.clear()
    emojiUrlToLocalMap.clear()
    emojiVisibilityTargetMap.forEach((el) => unobserveEmojiVisibility(el))
    emojiVisibilityTargetMap.clear()
    cachingEmojiIds.clear()
    downloadingUrls.clear()
    emojiCacheEnv.value = null
  }

  const ensureEmojiCached = async (
    emojiItem: EmojiListItem,
    emojiDir: string,
    baseDir: BaseDirectory,
    baseDirPath: string
  ) => {
    const fileName = await buildEmojiFileName(emojiItem.expressionUrl)
    const relativePath = await join(emojiDir, fileName)
    const hasFile = await exists(relativePath, { baseDir })
    if (!hasFile) {
      const bytes = await downloadEmojiFile(emojiItem.expressionUrl)
      await writeFile(relativePath, bytes, { baseDir })
    }
    const absolutePath = await join(baseDirPath, relativePath)
    setEmojiLocalPath(emojiItem.id, absolutePath, emojiItem.expressionUrl)
  }

  const handleEmojiVisibility = async (emojiItem: EmojiListItem) => {
    const id = emojiItem.id
    if (emojiItem.localUrl || emojiLocalPathMap.value[id] || cachingEmojiIds.has(id)) {
      releaseEmojiObserver(id)
      return
    }
    const env = await ensureEmojiCacheEnvironment()
    if (!env) return
    cachingEmojiIds.add(id)
    try {
      await ensureEmojiCached(emojiItem, env.emojiDir, env.baseDir, env.baseDirPath)
    } catch (error) {
      logger.error('缓存表情失败:', emojiItem.expressionUrl, error)
    } finally {
      cachingEmojiIds.delete(id)
      releaseEmojiObserver(id)
    }
  }

  const registerEmojiVisibilityTarget = (
    target: Element | ComponentPublicInstance | null,
    emojiItem: EmojiListItem
  ) => {
    if (!enableEmojiVisibilityObserver) return
    releaseEmojiObserver(emojiItem.id)
    const el = resolveVisibilityElement(target)
    if (!el || !emojiItem.expressionUrl || emojiItem.localUrl || emojiLocalPathMap.value[emojiItem.id]) {
      return
    }
    emojiVisibilityTargetMap.set(emojiItem.id, el)
    observeEmojiVisibility(el, () => {
      void handleEmojiVisibility(emojiItem)
    })
  }

  const hydrateEmojiLocalCache = async () => {
    if (!isFavoritesView.value) return
    const env = await ensureEmojiCacheEnvironment()
    if (!env) return
    const downloadTasks: Promise<unknown>[] = []
    for (const item of emojiStore.emojiList) {
      const fileName = await buildEmojiFileName(item.expressionUrl)
      const relativePath = await join(env.emojiDir, fileName)
      const hasFile = await exists(relativePath, { baseDir: env.baseDir })
      const absolutePath = await join(env.baseDirPath, relativePath)

      if (!hasFile) {
        clearEmojiLocalPath(item.id, item.expressionUrl)
        if (!downloadingUrls.has(item.expressionUrl)) {
          downloadingUrls.add(item.expressionUrl)
          const task = downloadLimit(async () => {
            try {
              await ensureEmojiCached(item, env.emojiDir, env.baseDir, env.baseDirPath)
            } catch (error) {
              logger.error('重新缓存表情失败:', item.expressionUrl, error)
            } finally {
              downloadingUrls.delete(item.expressionUrl)
            }
          })
          downloadTasks.push(task)
        }
      } else {
        const localUrl = convertFileSrc(absolutePath)
        setEmojiLocalPath(item.id, absolutePath, item.expressionUrl)
        localUrlCache.set(item.expressionUrl, localUrl)
        emojiUrlToLocalMap.set(item.expressionUrl, localUrl)
      }
    }
    if (downloadTasks.length) {
      await Promise.allSettled(downloadTasks)
    }
  }

  const scheduleHydrateFavorites = () => {
    if (hydrateScheduled.value || !isFavoritesView.value) return
    hydrateScheduled.value = true
    const runner = () => {
      hydrateScheduled.value = false
      void hydrateEmojiLocalCache()
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(runner, { timeout: 800 })
    } else {
      setTimeout(runner, 80)
    }
  }

  const getEmojiRenderUrl = (item: EmojiListItem) => {
    const mapped = emojiUrlToLocalMap.get(item.expressionUrl)
    if (mapped) return mapped
    if (item.localUrl) {
      emojiUrlToLocalMap.set(item.expressionUrl, item.localUrl)
      localUrlCache.set(item.expressionUrl, item.localUrl)
      return item.localUrl
    }
    const localById = emojiLocalPathMap.value[item.id]
    if (localById) return localById
    return item.expressionUrl
  }

  const resolveCachedRenderUrl = (id: string | undefined, serverKey: string | undefined) => {
    if (id) {
      const byId = emojiLocalPathMap.value[id]
      if (byId) return byId
    }
    if (serverKey) {
      return emojiUrlToLocalMap.get(serverKey)
    }
    return undefined
  }

  const terminateWorker = () => {
    if (emojiCacheWorker) {
      emojiCacheWorker.terminate()
      emojiCacheWorker = null
    }
  }

  watch(
    () => emojiStore.emojiList.map((item) => ({ id: item.id, url: item.expressionUrl })),
    (list) => {
      if (!isFavoritesView.value) return
      const ids = list.map((item) => item.id)
      cleanupLocalEmojiMap(ids)
      cleanupEmojiObservers(ids)
      scheduleHydrateFavorites()
    },
    { immediate: false, deep: true }
  )

  watch(
    () => userStore.userInfo?.uid,
    () => {
      cleanupAllEmojiCaches()
      disconnectEmojiObserver()
      if (emojiStore.emojiList.length > 0 && userStore.userInfo?.uid && isFavoritesView.value) {
        scheduleHydrateFavorites()
      }
    },
    { immediate: false }
  )

  return {
    emojiLocalPathMap,
    getEmojiRenderUrl,
    resolveCachedRenderUrl,
    registerEmojiVisibilityTarget,
    hydrateEmojiLocalCache,
    scheduleHydrateFavorites,
    cleanupAllEmojiCaches,
    disconnectEmojiObserver,
    terminateWorker,
    emojiUrlToLocalMap,
    localUrlCache
  }
}
