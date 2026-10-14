import { acquireTimerWorker, type TimerWorkerHandle } from '@/services/timerWorkerHost'

let handle: TimerWorkerHandle | null = null

/**
 * 取得聊天域共享的定时器 Worker 句柄。
 *
 * 进程内单例、永不释放（与重构前的 module 级单例生命周期一致）；实际 Worker 实例由
 * `timerWorkerHost` 统一持有，与其他消费者共享。
 */
export const getTimerWorker = (): TimerWorkerHandle => {
  if (!handle) {
    handle = acquireTimerWorker()
  }
  return handle
}
