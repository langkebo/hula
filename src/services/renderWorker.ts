import { createLogger } from '@/utils/Logger'

const logger = createLogger('RenderWorker')

class RenderWorkerClient {
  private worker: Worker | null = null
  private nextId = 0
  private pendingTasks = new Map<number, { resolve: (val: unknown) => void; reject: (err: Error) => void }>()

  private initWorker() {
    if (this.worker) return

    this.worker = new Worker(new URL('../workers/render.worker.ts', import.meta.url), {
      type: 'module'
    })

    this.worker.onmessage = (e) => {
      const { id, result, error } = e.data
      const callbacks = this.pendingTasks.get(id)
      if (callbacks) {
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
      // Worker 发生不可恢复错误：拒绝所有 pending tasks，避免内存泄漏与永久挂起的 Promise
      for (const [id, callbacks] of this.pendingTasks) {
        this.pendingTasks.delete(id)
        callbacks.reject(new Error(`Worker error: ${err.message ?? 'unknown'}`))
      }
    }
  }

  async execute<I, O>(name: string, input: I): Promise<O> {
    this.initWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(id, { resolve: resolve as (val: unknown) => void, reject: reject as (err: Error) => void })
      this.worker!.postMessage({ id, name, input })
    })
  }

  async executeWithTransfer<I, O>(name: string, input: I, transfer: Transferable[]): Promise<O> {
    this.initWorker()
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pendingTasks.set(id, { resolve: resolve as (val: unknown) => void, reject: reject as (err: Error) => void })
      this.worker!.postMessage({ id, name, input }, transfer)
    })
  }
}

export const renderWorker = new RenderWorkerClient()
