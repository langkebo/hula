import { type Ref, ref } from 'vue'
import { isDesktop } from '@/utils/PlatformConstants'
import type { useTimerManager } from '@/utils/TimerManager'

export function useAutoLogin(options: {
  uiState: Ref<'manual' | 'auto'>
  normalLogin: (deviceType: 'PC' | 'MOBILE', syncRecentMessages: boolean, auto?: boolean) => Promise<void>
  timerManager: ReturnType<typeof useTimerManager>
}) {
  const { uiState, normalLogin, timerManager } = options
  const isDesktopClient = isDesktop()
  const AUTO_LOGIN_DELAY_MS = 3000
  const autoLoginPending = ref(false)
  let autoLoginTimer: number | null = null

  const clearAutoLoginTimer = () => {
    if (autoLoginTimer !== null) {
      timerManager.clearTimeout(autoLoginTimer)
      autoLoginTimer = null
    }
    autoLoginPending.value = false
  }

  const startAutoLoginCountdown = () => {
    if (!isDesktopClient) {
      normalLogin('PC', true, true)
      return
    }
    clearAutoLoginTimer()
    autoLoginPending.value = true
    autoLoginTimer = timerManager.setTimeout(() => {
      autoLoginPending.value = false
      autoLoginTimer = null
      normalLogin('PC', true, true)
    }, AUTO_LOGIN_DELAY_MS)
  }

  const cancelAutoLogin = () => {
    if (!autoLoginPending.value) {
      return
    }
    clearAutoLoginTimer()
  }

  const handleAutoLoginActivity = () => {
    if (uiState.value !== 'auto' || !autoLoginPending.value) {
      return
    }
    cancelAutoLogin()
  }

  const triggerAutoLogin = () => {
    cancelAutoLogin()
    normalLogin('PC', true, true)
  }

  return {
    autoLoginPending,
    startAutoLoginCountdown,
    cancelAutoLogin,
    clearAutoLoginTimer,
    handleAutoLoginActivity,
    triggerAutoLogin
  }
}
