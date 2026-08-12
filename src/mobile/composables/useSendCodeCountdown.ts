/**
 * 验证码发送倒计时 composable（移动端）。
 *
 * 委托给共享的 useCountdown，保持原有 API 不变以兼容调用方。
 */
import { useCountdown } from '@/shared/composables/useCountdown'

export function useSendCodeCountdown(timerId: string) {
  const { countdown: sendCodeCountdown, start: startCountdown, stop: stopCountdown } = useCountdown(timerId)

  return { sendCodeCountdown, startCountdown, stopCountdown }
}
