import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useNetwork } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useCheckUpdate } from '@/composables/common/useCheckUpdate'
import { type DriverStepConfig, useDriver } from '@/composables/common/useDriver'
import { useWindow } from '@/composables/common/useWindow'
import { useLoginFlow } from '@/composables/user/useLoginFlow'
import { useGuideStore } from '@/stores/domains/settings/guide'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime, isE2EMode } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isMac } from '@/utils/PlatformConstants'
import { useTimerManager } from '@/utils/TimerManager'
import { useAutoLogin } from './hooks/useAutoLogin'
import { useSsoCallback } from './hooks/useSsoCallback'

const logger = createLogger('LoginOrchestrator')

export function useLoginOrchestrator() {
  const { t } = useI18n()
  const timerManager = useTimerManager()
  const settingStore = useSettingStore()
  const userStore = useUserStore()
  const globalStore = useGlobalStore()
  const guideStore = useGuideStore()
  const { isTrayMenuShow } = storeToRefs(globalStore)
  const { isGuideCompleted } = storeToRefs(guideStore)
  const { isOnline } = useNetwork()
  const loginHistoriesStore = useLoginHistoriesStore()
  const { loginHistories } = storeToRefs(loginHistoriesStore)
  const { createModalWindow, getWindowPayload } = useWindow()
  const { checkUpdate, CHECK_UPDATE_LOGIN_TIME } = useCheckUpdate()

  const {
    normalLogin,
    retryLogin,
    loading,
    loginText,
    loginDisabled,
    loginStatus,
    lastLoginError,
    info: loginInfo,
    uiState,
    homeserverUrl,
    identityServerUrl
  } = useLoginFlow()

  const protocol = ref(true)
  const showServerConfig = ref(false)
  const isJumpDirectly = ref(false)
  const isDesktopClient = isDesktop()

  const { startAutoLoginCountdown, cancelAutoLogin, clearAutoLoginTimer, handleAutoLoginActivity, triggerAutoLogin } =
    useAutoLogin({
      uiState,
      normalLogin,
      timerManager
    })

  const { handleSsoLoginCallback } = useSsoCallback({
    loading,
    loginText,
    loginDisabled
  })

  const giveAccount = (item: { account?: string; password?: string; avatar: string; name?: string; uid?: string }) => {
    loginInfo.value.account = item.account || ''
    loginInfo.value.password = item.password || ''
    loginInfo.value.avatar = item.avatar
    loginInfo.value.name = item.name || ''
    loginInfo.value.uid = item.uid || ''
  }

  const cancelAutoLoginAndShowManual = () => {
    cancelAutoLogin()
    uiState.value = 'manual'
    loginHistories.value.length > 0 && giveAccount(loginHistories.value[0])
  }

  const removeStoredAccount = () => {
    const storedUserInfo = userStore.userInfo
    if (storedUserInfo) {
      const matchedHistory = loginHistories.value.find(
        (item) => item.uid === storedUserInfo.uid || item.account === storedUserInfo.account
      )
      if (matchedHistory) {
        loginHistoriesStore.removeLoginHistory(matchedHistory)
      }
    }
    localStorage.removeItem('TOKEN')
    localStorage.removeItem('REFRESH_TOKEN')
    userStore.userInfo = undefined
    settingStore.setAutoLogin(false)
    cancelAutoLoginAndShowManual()
  }

  const openRemoteLoginModal = async (ip?: string) => {
    if (!isDesktop()) {
      return
    }
    const payloadIp = ip ?? t('login.remote_login.unknown_ip')
    await createModalWindow(
      t('login.remote_login.title'),
      'modal-remoteLogin',
      350,
      310,
      'login',
      {
        ip: payloadIp
      },
      {
        minWidth: 350,
        minHeight: 310
      }
    )
  }

  const handlePendingRemoteLoginPayload = async () => {
    if (!isDesktop() || !hasTauriRuntime()) {
      return
    }
    try {
      const payload = await getWindowPayload<{ remoteLogin?: { ip?: string } }>('login')
      if (payload?.remoteLogin) {
        openRemoteLoginModal(payload.remoteLogin.ip)
      }
    } catch (error) {
      logger.error('处理异地登录载荷失败:', error)
    }
  }

  const openServiceAgreement = async () => {
    await createModalWindow(t('login.service_agreement_title'), 'modal-serviceAgreement', 600, 600, 'login')
  }

  const openPrivacyAgreement = async () => {
    await createModalWindow(t('login.privacy_policy_title'), 'modal-privacyAgreement', 600, 600, 'login')
  }

  const driverSteps = computed<DriverStepConfig[]>(() => [
    {
      element: '.welcome',
      popover: {
        title: t('login.guide.welcome.title'),
        description: t('login.guide.welcome.desc'),
        side: 'bottom',
        align: 'center'
      }
    },
    {
      element: '.agreement',
      popover: {
        title: t('login.guide.privacy.title'),
        description: t('login.guide.privacy.desc'),
        onNextClick: () => {
          if (isMac()) {
            moreShow.value = true
          }
        }
      }
    },
    {
      element: '.network',
      popover: {
        title: t('login.guide.network.title'),
        description: t('login.guide.network.desc'),
        onNextClick: () => {
          moreShow.value = true
        }
      }
    },
    {
      element: '.register',
      popover: {
        title: t('login.guide.register.title'),
        description: t('login.guide.register.desc')
      }
    }
  ])

  const driverConfig = computed(() => ({
    nextBtnText: t('login.guide.actions.next'),
    prevBtnText: t('login.guide.actions.prev'),
    doneBtnText: t('login.guide.actions.done'),
    progressText: t('login.guide.actions.progress', {
      current: '{{current}}',
      total: '{{total}}'
    })
  }))

  const moreShow = ref(false)
  const { startTour, reinitialize } = useDriver(driverSteps.value, driverConfig.value)

  watch([driverSteps, driverConfig], ([steps, config]) => {
    reinitialize(steps, config)
  })

  const timerWorker = new Worker(new URL('../../workers/timer.worker.ts', import.meta.url), { type: 'module' })

  timerWorker.onerror = (error) => {
    logger.error('Worker Error', error)
  }

  timerWorker.onmessage = (e) => {
    const { type } = e.data
    if (type === 'timeout') {
      checkUpdate('login')
    }
  }

  watchEffect(() => {
    if (uiState.value === 'auto') {
      loginDisabled.value = !isOnline.value || !userStore.userInfo?.account
      return
    }
    loginDisabled.value = !(loginInfo.value.account && loginInfo.value.password && protocol.value && isOnline.value)
  })

  watch(
    () => uiState.value,
    (state) => {
      if (state !== 'auto') {
        clearAutoLoginTimer()
      }
    }
  )

  watch(
    () => settingStore.autoLoginEnabled,
    (isAuto) => {
      if (!isAuto) {
        clearAutoLoginTimer()
      }
    }
  )

  watch(isOnline, (v) => {
    loginDisabled.value = !v
    loginText.value = v ? t('login.button.login.default') : t('login.button.login.network_error')
  })

  const enterKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !loginDisabled.value) {
      normalLogin('PC', true, false)
    }
  }

  const init = async () => {
    globalStore.updateCurrentSessionRoomId('')
    await handlePendingRemoteLoginPayload()
    isTrayMenuShow.value = false

    if (!settingStore.autoLoginEnabled) {
      uiState.value = 'manual'
      localStorage.removeItem('TOKEN')
      localStorage.removeItem('REFRESH_TOKEN')
    }
  }

  const mount = async () => {
    if (!isGuideCompleted.value && !isE2EMode()) {
      startTour()
    }

    if (hasTauriRuntime()) {
      const currentWindow = getCurrentWebviewWindow()
      if (!isJumpDirectly.value && currentWindow.label === 'login') {
        await currentWindow.show()
      }
    }

    if (await handleSsoLoginCallback()) {
      return
    }

    if (settingStore.autoLoginEnabled) {
      uiState.value = 'auto'
      startAutoLoginCountdown()
    } else {
      uiState.value = 'manual'
      loginHistories.value.length > 0 && giveAccount(loginHistories.value[0])
    }

    window.addEventListener('keyup', enterKey)
    if (isDesktopClient) {
      window.addEventListener('pointerdown', handleAutoLoginActivity, true)
      window.addEventListener('keydown', handleAutoLoginActivity, true)
    }
    await checkUpdate('login', true)
    timerWorker.postMessage({
      type: 'startTimer',
      msgId: 'checkUpdate',
      duration: CHECK_UPDATE_LOGIN_TIME
    })
  }

  const cleanup = () => {
    window.removeEventListener('keyup', enterKey)
    if (isDesktopClient) {
      window.removeEventListener('pointerdown', handleAutoLoginActivity, true)
      window.removeEventListener('keydown', handleAutoLoginActivity, true)
    }
    clearAutoLoginTimer()
    timerWorker.postMessage({
      type: 'clearTimer',
      msgId: 'checkUpdate'
    })
    timerWorker.terminate()
  }

  return {
    normalLogin,
    retryLogin,
    loading,
    loginText,
    loginDisabled,
    loginStatus,
    lastLoginError,
    loginInfo,
    uiState,
    protocol,
    homeserverUrl,
    identityServerUrl,
    showServerConfig,
    moreShow,
    triggerAutoLogin,
    cancelAutoLoginAndShowManual,
    removeStoredAccount,
    giveAccount,
    openServiceAgreement,
    openPrivacyAgreement,
    init,
    mount,
    cleanup
  }
}
