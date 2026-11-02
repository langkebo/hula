/**
 * 图片下载 Worker 桥接。
 *
 * 负责单例 Worker 的生命周期、在途请求去重、单请求超时与崩溃兜底：
 * - 每个请求都有超时，Worker 卡死时调用方 Promise 不会永挂；
 * - `onerror` / 消息发送失败时丢弃 Worker 并拒绝所有在途请求，下次调用自动重建。
 */
import { useFileDownloadStore } from '@/stores/domains/widget/fileDownload'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ImageDownloader')

type WorkerResponse = {
  success: boolean
  url: string
  buffer?: ArrayBuffer
  error?: string
}

/** 单个图片下载请求的超时时间（ms）：Worker 卡死时避免调用方 Promise 永挂。 */
const WORKER_REQUEST_TIMEOUT_MS = 15_000

type WorkerRequest = {
  resolve: (value: string | null) => void
  reject: (reason?: unknown) => void
  fileName: string
  timer: ReturnType<typeof setTimeout>
}

const workerRequests = new Map<string, WorkerRequest>()
let imageDownloadWorker: Worker | null = null
const imageDownloaderWorkerUrl = new URL('../../workers/imageDownloader.ts', import.meta.url)

/** 创建不阻止进程退出的定时器（Node 测试环境支持 unref）。 */
const createUnrefTimer = (fn: () => void, ms: number): ReturnType<typeof setTimeout> => {
  const timer = setTimeout(fn, ms)
  ;(timer as { unref?: () => void }).unref?.()
  return timer
}

/** 丢弃已崩溃的 Worker，并让所有在途请求失败，下次调用自动重建。 */
const disposeWorkerWithError = (reason: Error) => {
  const worker = imageDownloadWorker
  imageDownloadWorker = null
  worker?.terminate()
  workerRequests.forEach((request, requestUrl) => {
    clearTimeout(request.timer)
    workerRequests.delete(requestUrl)
    request.reject(reason)
  })
}

const ensureWorker = () => {
  if (imageDownloadWorker || typeof window === 'undefined') return
  const worker = new Worker(imageDownloaderWorkerUrl, { type: 'module' })
  imageDownloadWorker = worker
  worker.onerror = (event) => {
    const message = (event as ErrorEvent)?.message || '图片下载 Worker 异常'
    logger.error('图片下载 Worker 异常，丢弃并等待重建:', message)
    disposeWorkerWithError(new Error(message))
  }
  worker.onmessage = async (event: MessageEvent<WorkerResponse>) => {
    const { success, url, buffer, error } = event.data
    const request = workerRequests.get(url)
    if (!request) {
      return
    }
    workerRequests.delete(url)
    clearTimeout(request.timer)

    if (!success || !buffer) {
      request.reject(new Error(error || '下载失败'))
      return
    }

    try {
      const fileDownloadStore = useFileDownloadStore()
      const absolutePath = await fileDownloadStore.saveFileFromBytes(url, request.fileName, new Uint8Array(buffer))
      request.resolve(absolutePath)
    } catch (err) {
      request.reject(err)
    }
  }
}

/** 通过 Worker 下载图片并落盘，返回本地绝对路径。 */
export const downloadImageWithWorker = (url: string, fileName: string) => {
  ensureWorker()
  if (!imageDownloadWorker) {
    return Promise.reject(new Error('Web Worker 不可用'))
  }

  const existing = workerRequests.get(url)
  if (existing) {
    return new Promise<string | null>((resolve, reject) => {
      const prevResolve = existing.resolve
      const prevReject = existing.reject
      existing.resolve = (value) => {
        prevResolve(value)
        resolve(value)
      }
      existing.reject = (reason) => {
        prevReject(reason)
        reject(reason)
      }
    })
  }

  return new Promise<string | null>((resolve, reject) => {
    const timer = createUnrefTimer(() => {
      const pending = workerRequests.get(url)
      if (!pending) return
      workerRequests.delete(url)
      pending.reject(new Error(`图片下载超时（${WORKER_REQUEST_TIMEOUT_MS}ms）`))
    }, WORKER_REQUEST_TIMEOUT_MS)
    workerRequests.set(url, { resolve, reject, fileName, timer })
    try {
      imageDownloadWorker!.postMessage({ url })
    } catch (err) {
      clearTimeout(timer)
      workerRequests.delete(url)
      reject(err instanceof Error ? err : new Error(String(err)))
    }
  })
}
