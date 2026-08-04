import { appDataDir, join, resourceDir } from '@tauri-apps/api/path'
import { BaseDirectory, exists, mkdir, remove, writeFile } from '@tauri-apps/plugin-fs'
import { defineStore } from 'pinia'
import { MessageStatusEnum, StoresEnum, TauriCommand } from '@/enums'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useUserStore } from '@/stores/domains/user/user'
import type { CacheMetadata } from '@/stores/domains/widget/thumbnailCacheJanitor'
import { ThumbnailCacheJanitor } from '@/stores/domains/widget/thumbnailCacheJanitor'
import { md5FromString } from '@/utils/Md5Util'
import { detectRemoteFileType } from '@/utils/PathUtil'
import { isMobile } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

type TaskKind = 'image' | 'video' | 'emoji'

type Task = {
  url: string
  msgId: string
  roomId: string
  kind: TaskKind
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  retries: number
  path?: string
  error?: string
}

/** localStorage 元数据持久化键 */
const METADATA_STORAGE_KEY = 'tjg:thumbnail-cache-metadata'
/** 每多少次入队触发一次 TTL 清理 */
const CLEANUP_INTERVAL = 100

const loadMetadataFromStorage = (): Map<string, CacheMetadata> => {
  try {
    const raw = localStorage.getItem(METADATA_STORAGE_KEY)
    if (!raw) return new Map()
    const obj = JSON.parse(raw) as Record<string, CacheMetadata>
    return new Map(Object.entries(obj))
  } catch {
    return new Map()
  }
}

const saveMetadataToStorage = (metadata: Map<string, CacheMetadata>) => {
  try {
    const obj = Object.fromEntries(metadata.entries())
    localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(obj))
  } catch {
    // 忽略配额或序列化错误
  }
}

const deleteThumbnailFile = async (relPath: string): Promise<boolean> => {
  try {
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
    await remove(relPath, { baseDir })
    return true
  } catch {
    return false
  }
}

export const useThumbnailCacheStore = defineStore(StoresEnum.THUMBNAIL_CACHE, () => {
  const userStore = useUserStore()
  const chatStore = useChatStore()

  const maxConcurrency = 4
  const queue: Task[] = []
  let active = 0
  const statusMap = shallowRef<Record<string, Task>>({})
  const worker = new Worker(new URL('@/workers/imageDownloader.ts', import.meta.url), { type: 'module' })
  const waiterMap = new Map<string, Array<(path: string | null) => void>>()

  // 缓存清理器：7 天 TTL + 500MB LRU 淘汰
  const janitor = new ThumbnailCacheJanitor({
    deleteFile: deleteThumbnailFile,
    loadMetadata: loadMetadataFromStorage,
    saveMetadata: saveMetadataToStorage
  })
  // 启动时清理过期项（异步，不阻塞渲染）
  void janitor.cleanupExpired()
  let enqueueSinceLastCleanup = 0

  const notifyWaiters = (url: string, path: string | null) => {
    const waiters = waiterMap.get(url)
    if (waiters?.length) {
      waiters.forEach((resolve) => resolve(path))
      waiterMap.delete(url)
    }
  }

  const buildUpdatedBody = (task: Task, currentBody: Record<string, unknown>, abs: string) => {
    if (task.kind === 'emoji') {
      return { ...currentBody, localPath: abs }
    }
    return { ...currentBody, thumbnailPath: abs }
  }

  const persistMessage = async (task: Task, abs: string) => {
    const msg = chatStore.getMessage(task.msgId)
    if (!msg) return
    const nextBody = buildUpdatedBody(task, msg.message.body || {}, abs)
    chatStore.updateMsg({
      msgId: task.msgId,
      status: msg.message.status ?? MessageStatusEnum.SUCCESS,
      body: nextBody
    })
    const updated = { ...msg, message: { ...msg.message, body: nextBody } }
    await invokeSilently(TauriCommand.SAVE_MSG, { data: updated as Record<string, unknown> })
  }

  const ensureCacheDir = async (kind: TaskKind) => {
    const dir = await userStore.getUserRoomDir()
    const folder = kind === 'emoji' ? 'emojis' : 'thumbnails'
    const target = await join(dir, folder)
    const baseDir = isMobile() ? BaseDirectory.AppData : BaseDirectory.Resource
    const ok = await exists(target, { baseDir })
    if (!ok) {
      await mkdir(target, { baseDir, recursive: true })
    }
    return { relativeDir: target, baseDir }
  }

  const decideExt = async (url: string) => {
    const match = url.match(/\\.([a-zA-Z0-9]+)(?:\\?|$)/)
    if (match?.[1]) {
      return match[1].toLowerCase()
    }
    const info = await detectRemoteFileType({ url, fileSize: null })
    return info?.ext ? info.ext : 'jpg'
  }

  const getAbsolute = async (relativePath: string) => {
    const baseDirPath = isMobile() ? await appDataDir() : await resourceDir()
    return await join(baseDirPath, relativePath)
  }

  const dispatchNext = async () => {
    if (active >= maxConcurrency) return
    const next = queue.shift()
    if (!next) return
    active++
    await processTask(next)
    active--
    void dispatchNext()
  }

  const processTask = async (task: Task) => {
    try {
      task.status = 'downloading'
      statusMap.value[task.url] = task
      triggerRef(statusMap)
      const { relativeDir, baseDir } = await ensureCacheDir(task.kind)
      const hash = await md5FromString(task.url)
      const ext = await decideExt(task.url)
      const fileName = `${hash}.${ext}`
      const relPath = await join(relativeDir, fileName)
      const existsFlag = await exists(relPath, { baseDir })
      if (existsFlag && janitor.isFresh(relPath)) {
        // 缓存命中且未过期：更新最近访问时间并复用本地文件
        janitor.touch(relPath)
        const abs = await getAbsolute(relPath)
        task.status = 'completed'
        task.path = abs
        statusMap.value[task.url] = task
        triggerRef(statusMap)
        notifyWaiters(task.url, abs)
        await persistMessage(task, abs)
        return
      }
      // 文件不存在或已过期：若过期则尝试删除陈旧文件并清理元数据，随后重新下载
      if (existsFlag) {
        janitor.forget(relPath)
        await deleteThumbnailFile(relPath)
      }

      const buffer: ArrayBuffer = await new Promise((resolve, reject) => {
        const handler = (e: MessageEvent<unknown>) => {
          const data = e.data as Record<string, unknown>
          if (data?.url !== task.url) return
          worker.removeEventListener('message', handler as EventListener)
          if (data.success) resolve(data.buffer as ArrayBuffer)
          else reject(new Error(((data as Record<string, unknown>).error as string) || 'download failed'))
        }
        worker.addEventListener('message', handler as EventListener)
        worker.postMessage({ url: task.url })
      })

      const bytes = new Uint8Array(buffer)
      await writeFile(relPath, bytes, { baseDir })
      // 记录缓存元数据并按需执行 LRU 淘汰
      await janitor.add(relPath, bytes.byteLength)
      const abs = await getAbsolute(relPath)
      task.status = 'completed'
      task.path = abs
      statusMap.value[task.url] = task
      triggerRef(statusMap)
      notifyWaiters(task.url, abs)
      await persistMessage(task, abs)
    } catch (err: unknown) {
      task.retries += 1
      task.error = String((err as Error)?.message || err)
      statusMap.value[task.url] = task
      triggerRef(statusMap)
      if (task.retries < 3) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** (task.retries - 1)))
        queue.unshift(task)
      } else {
        task.status = 'failed'
        notifyWaiters(task.url, null)
      }
    }
  }

  const enqueueThumbnail = async (options: { url: string; msgId: string; roomId: string; kind: TaskKind }) => {
    // 周期性触发 TTL 清理，避免长期堆积过期文件
    enqueueSinceLastCleanup += 1
    if (enqueueSinceLastCleanup >= CLEANUP_INTERVAL) {
      enqueueSinceLastCleanup = 0
      void janitor.cleanupExpired()
    }

    const existsTask = statusMap.value[options.url]
    if (existsTask?.status === 'completed') {
      return Promise.resolve(existsTask.path ?? null)
    }

    const promise = new Promise<string | null>((resolve) => {
      const waiters = waiterMap.get(options.url)
      if (waiters) {
        waiters.push(resolve)
      } else {
        waiterMap.set(options.url, [resolve])
      }
    })

    if (!existsTask || existsTask.status === 'failed') {
      const t: Task = { ...options, status: 'pending', retries: 0 }
      statusMap.value[options.url] = t
      triggerRef(statusMap)
      queue.push(t)
      void dispatchNext()
    }

    return promise
  }

  const invalidate = (url: string) => {
    if (!url) return
    if (statusMap.value[url]) {
      delete statusMap.value[url]
      triggerRef(statusMap)
    }
    waiterMap.delete(url)
  }

  const getStatus = (url: string) => statusMap.value[url]

  return { enqueueThumbnail, getStatus, invalidate }
})
