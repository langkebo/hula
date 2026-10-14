/**
 * `timer.worker.ts` 的主线程宿主：同一 JS realm（Tauri 窗口）内所有消费者共享一个定时器 Worker。
 *
 * 背景：该 Worker 原被 7 处各自 `new Worker` 实例化。直接改用共享单例会产生语义冲突——
 * 任一消费者 `terminate()` 或 `onmessage =` 独占覆写都会波及他人。本宿主以「channel 命名空间
 * + 引用计数」解决：每个消费者 `acquire()` 得到独立 channel，发送时把 `msgId` 改写为
 * `${channelId}\u0000${msgId}`，Worker 回包时按前缀路由回原 channel 并还原 `msgId`；
 * 因此同一 `msgId`（如 `checkUpdate`）在不同消费者间互不串扰；全部 channel `release()` 后
 * Worker 才终止，下一次 `acquire()` 懒重建。
 */
import { createLogger } from '@/utils/Logger'

const logger = createLogger('TimerWorkerHost')

/** channel 前缀分隔符（非可见字符，不会与业务 msgId 冲突）。 */
const CHANNEL_SEP = '\u0000'

/** 宿主接受的定时器请求（当前生产方只用 `startTimer` / `clearTimer`，且均带 `msgId`）。 */
export interface TimerWorkerRequest {
  /** 请求类型。 */
  type: 'startTimer' | 'clearTimer'
  /** 定时器标识；同一消费者的同一 `msgId` 会覆盖重设。 */
  msgId: string
  /** 仅 `startTimer` 使用：毫秒时长。 */
  duration?: number
}

/** 宿主向下分发的 Worker 事件，`msgId` 已还原为消费者发送时的原值。 */
export type TimerWorkerEvent =
  | { type: 'timeout'; msgId: string }
  | { type: 'debug'; msgId: string; remainingTime: number; timestamp: number }
  | { type: 'allTimersCompleted' }

/** 单个消费者持有的定时器 Worker 句柄。 */
export interface TimerWorkerHandle {
  /** 发送请求；宿主自动为 `msgId` 加上 channel 前缀。 */
  postMessage(request: TimerWorkerRequest): void
  /** 订阅本 channel 的事件；返回取消订阅函数。 */
  onMessage(handler: (event: TimerWorkerEvent) => void): () => void
  /** 订阅 Worker 级错误；返回取消订阅函数。 */
  onError(handler: (event: ErrorEvent) => void): () => void
  /** 释放本 channel；引用计数归零时终止底层 Worker。幂等。 */
  release(): void
}

interface ChannelState {
  messageHandlers: Set<(event: TimerWorkerEvent) => void>
  errorHandlers: Set<(event: ErrorEvent) => void>
}

let worker: Worker | null = null
let refCount = 0
let channelSeq = 0
const channels = new Map<number, ChannelState>()

function ensureWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('../workers/timer.worker.ts', import.meta.url), { type: 'module' })

  worker.onmessage = (e: MessageEvent) => {
    const data = e.data as { type?: string; msgId?: unknown }
    if (data?.type === 'allTimersCompleted') {
      for (const channel of channels.values()) {
        for (const handler of channel.messageHandlers) handler({ type: 'allTimersCompleted' })
      }
      return
    }
    if (typeof data?.msgId !== 'string') return
    const sep = data.msgId.indexOf(CHANNEL_SEP)
    if (sep < 0) return
    const channel = channels.get(Number(data.msgId.slice(0, sep)))
    if (!channel) return
    const event = { ...(data as TimerWorkerEvent), msgId: data.msgId.slice(sep + 1) }
    for (const handler of channel.messageHandlers) handler(event)
  }

  worker.onerror = (event: ErrorEvent) => {
    logger.error('Worker Error', event)
    for (const channel of channels.values()) {
      for (const handler of channel.errorHandlers) handler(event)
    }
  }

  return worker
}

/**
 * 取得一个定时器 Worker 句柄。同一 JS realm 内所有句柄共享同一个底层 Worker，
 * 消费完毕必须调用 `release()`。
 */
export function acquireTimerWorker(): TimerWorkerHandle {
  const instance = ensureWorker()
  refCount++
  const channelId = ++channelSeq
  const channel: ChannelState = { messageHandlers: new Set(), errorHandlers: new Set() }
  channels.set(channelId, channel)
  let released = false

  return {
    postMessage(request) {
      if (released) return
      instance.postMessage({ ...request, msgId: `${channelId}${CHANNEL_SEP}${request.msgId}` })
    },
    onMessage(handler) {
      channel.messageHandlers.add(handler)
      return () => channel.messageHandlers.delete(handler)
    },
    onError(handler) {
      channel.errorHandlers.add(handler)
      return () => channel.errorHandlers.delete(handler)
    },
    release() {
      if (released) return
      released = true
      channels.delete(channelId)
      channel.messageHandlers.clear()
      channel.errorHandlers.clear()
      refCount--
      if (refCount <= 0 && worker) {
        worker.terminate()
        worker = null
      }
    }
  }
}
