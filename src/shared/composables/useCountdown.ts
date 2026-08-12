/**
 * 倒计时 composable（桌面端 + 移动端共享）。
 *
 * 基于 timer.worker.ts 实现，在组件作用域销毁时自动清理定时器和 Worker。
 * 桌面端用于注册页验证码倒计时，移动端用于验证码发送倒计时。
 */

import { onScopeDispose, ref } from 'vue'

export function useCountdown(timerId: string) {
  const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url), {
    type: 'module'
  })
  const countdown = ref(0)

  const stop = () => {
    timerWorker.postMessage({ type: 'clearTimer', msgId: timerId })
    countdown.value = 0
  }

  const start = (duration = 60) => {
    countdown.value = duration
    timerWorker.postMessage({ type: 'startTimer', msgId: timerId, duration: duration * 1000 })
  }

  timerWorker.onmessage = (e: { data: { type: string; msgId: string; remainingTime: number } }) => {
    const { type, msgId, remainingTime } = e.data
    if (msgId !== timerId) return
    if (type === 'debug') {
      countdown.value = Math.max(0, Math.ceil(remainingTime / 1000))
    } else if (type === 'timeout') {
      countdown.value = 0
    }
  }

  timerWorker.onerror = () => {
    countdown.value = 0
  }

  onScopeDispose(() => {
    stop()
    timerWorker.terminate()
  })

  return { countdown, start, stop }
}
