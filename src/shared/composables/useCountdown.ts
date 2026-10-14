/**
 * 倒计时 composable（桌面端 + 移动端共享）。
 *
 * 基于 timer.worker.ts 实现，在组件作用域销毁时自动清理定时器并释放宿主 channel（引用计数归零时才终止 Worker）。
 * 桌面端用于注册页验证码倒计时，移动端用于验证码发送倒计时。
 */

import { onScopeDispose, ref } from 'vue'
import { acquireTimerWorker } from '@/services/timerWorkerHost'

export function useCountdown(timerId: string) {
  const timer = acquireTimerWorker()
  const countdown = ref(0)

  const stop = () => {
    timer.postMessage({ type: 'clearTimer', msgId: timerId })
    countdown.value = 0
  }

  const start = (duration = 60) => {
    countdown.value = duration
    timer.postMessage({ type: 'startTimer', msgId: timerId, duration: duration * 1000 })
  }

  timer.onMessage((event) => {
    if (event.type === 'allTimersCompleted') return
    if (event.msgId !== timerId) return
    if (event.type === 'debug') {
      countdown.value = Math.max(0, Math.ceil(event.remainingTime / 1000))
    } else if (event.type === 'timeout') {
      countdown.value = 0
    }
  })

  timer.onError(() => {
    countdown.value = 0
  })

  onScopeDispose(() => {
    stop()
    timer.release()
  })

  return { countdown, start, stop }
}
