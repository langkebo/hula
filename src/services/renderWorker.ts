import { createLogger } from '@/utils/Logger'

const logger = createLogger('RenderWorker')

/** 单个渲染任务的超时（ms）：worker 卡死时调用方 Promise 不应永挂（H-13）。 */
const RENDER_TASK_TIMEOUT_MS = 15_000

/** 创建不阻止进程退出的定时器（Node 测试环境支持 unref）。 */
function createUnrefTimer(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
  const timer = setTimeout(fn, ms)
  ;(timer as { unref?: () => void }).unref?.()
  return timer
}

interface PendingTask {
  resolve: (val: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

class RenderWorkerClient {
  private worker: Worker | null = null
  private nextId = 0
  private pendingTasks = new Map<number, PendingTask>()

  private initWorker() {
    if (this.worker) return

    this.worker = new Worker(new URL('../workers/render.worker.ts', import.meta.url), {
      type: 'module'
    })

    this.worker.onmessage = (e) => {
      const { id, result, error } = e.data
      const callbacks = this.pendingTasks.get(id)
      if (callbacks) {
        clearTimeout(callbacks.timer)
        this.pendingTasks.delete(id)
        if (error) {
          callbacks.reject(new Error(error))
        } else {
          callbacks.resolve(result)
        }
      }
    }

    this.worker.onerror = (err) => {
      logger.error('Worker error:', err)
      // Worker 发生不可恢复错误：拒绝所有 pending tasks，避免内存泄漏与永久挂起的 Promise；
      // 同时丢弃实例，下次 execute 会重建 Worker（H-13/H-14）。
      const broken = this.worker
      this.worker = null
      broken?.terminate()
      for (const [id, callbacks] of this.pendingTasks) {
        clearTimeout(callbacks.timer)
        this.pendingTasks.delete(id)
        callbacks.reject(new Error(`Worker error: ${err.message ?? 'unknown'}`))
      }
    }
  }

  private post<I, O>(name: string, input: I, transfer?: Transferable[]): Promise<O> {
    this.initWorker()
    const id = this.nextId++
    return new Promise<O>((resolve, reject) => {
      const timer = createUnrefTimer(() => {
        if (!this.pendingTasks.delete(id)) return
        reject(new Error(`Render worker task '${name}' timed out after ${RENDER_TASK_TIMEOUT_MS}ms`))
      }, RENDER_TASK_TIMEOUT_MS)

      this.pendingTasks.set(id, {
        resolve: resolve as (val: unknown) => void,
        reject: reject as (err: Error) => void,
        timer
      })

      try {
        if (transfer) {
          this.worker!.postMessage({ id, name, input }, transfer)
        } else {
          this.worker!.postMessage({ id, name, input })
        }
      } catch (err) {
        clearTimeout(timer)
        this.pendingTasks.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })
  }

  async execute<I, O>(name: string, input: I): Promise<O> {
    return this.post<I, O>(name, input)
  }

  async executeWithTransfer<I, O>(name: string, input: I, transfer: Transferable[]): Promise<O> {
    return this.post<I, O>(name, input, transfer)
  }
}

export const renderWorker = new RenderWorkerClient()
