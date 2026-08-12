/**
 * 验证码发送倒计时 composable，基于 timer.worker.ts 实现。
 * 在组件作用域销毁时自动清理定时器和 Worker。
 */
export function useSendCodeCountdown(timerId: string) {
  const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url), { type: 'module' })
  const sendCodeCountdown = ref(0)

  const stopCountdown = () => {
    timerWorker.postMessage({ type: 'clearTimer', msgId: timerId })
    sendCodeCountdown.value = 0
  }

  const startCountdown = (duration = 60) => {
    sendCodeCountdown.value = duration
    timerWorker.postMessage({ type: 'startTimer', msgId: timerId, duration: duration * 1000 })
  }

  timerWorker.onmessage = (e: { data: { type: string; msgId: string; remainingTime: number } }) => {
    const { type, msgId, remainingTime } = e.data
    if (msgId !== timerId) return
    if (type === 'debug') {
      sendCodeCountdown.value = Math.max(0, Math.ceil(remainingTime / 1000))
    } else if (type === 'timeout') {
      sendCodeCountdown.value = 0
    }
  }

  timerWorker.onerror = () => {
    sendCodeCountdown.value = 0
  }

  onScopeDispose(() => {
    stopCountdown()
    timerWorker.terminate()
  })

  return { sendCodeCountdown, startCountdown, stopCountdown }
}
