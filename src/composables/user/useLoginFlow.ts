/**
 * 登录页 UI 编排层。
 *
 * 该 composable 仅负责表单状态、平台跳转和触发统一会话服务，
 * 不再直接承载底层 Matrix 登录、会话恢复或退出编排实现。
 */

import { useNetwork } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { translateMatrixError } from '@/common/matrixErrorTranslator'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MittEnum } from '@/enums'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend'
import { useI18nGlobal } from '@/services/i18n'
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import type { UserInfoType } from '@/services/types'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { createLogger } from '@/utils/Logger'
import { isDesktop, isMobile } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { useMitt } from '../common/useMitt'

const logger = createLogger('useLoginFlow')

export const useLoginFlow = () => {
  const settingStore = useSettingStore()
  const userStore = useUserStore()
  const matrixStore = useMatrixStore()

  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()

  let router: ReturnType<typeof useRouter> | null = null
  try {
    router = useRouter()
  } catch {
    void logger.info('[useLoginFlow] 无法获取 router 实例,可能不在组件上下文中')
  }

  const { isOnline } = useNetwork()
  const loading = ref(false)
  const loginText = ref(isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error'))
  const loginDisabled = ref(!isOnline.value)
  /** 登录状态：idle（空闲）/ connecting（连接中）/ success（成功）/ failed（失败） */
  const loginStatus = ref<'idle' | 'connecting' | 'success' | 'failed'>('idle')
  /** 最近一次登录错误信息，用于失败时展示重试选项 */
  const lastLoginError = ref<string | null>(null)
  /** 登录整体超时句柄，防止 SDK 卡住导致按钮永远显示"登录中" */
  let loginTimeoutHandle: ReturnType<typeof setTimeout> | undefined
  const LOGIN_TIMEOUT_MS = 30_000
  const matrixEndpointConfig = resolveMatrixRuntimeEndpointConfig()
  const info = ref({
    account: '',
    password: '',
    avatar: '',
    name: '',
    uid: ''
  })
  const uiState = ref<'manual' | 'auto'>('manual')
  const homeserverUrl = ref(matrixEndpointConfig.homeserverUrl)
  const identityServerUrl = ref(matrixEndpointConfig.identityServerUrl)

  const setLoginState = async () => {
    if (isMobile()) {
      return
    }

    await sessionOrchestrator.applyDesktopLoginState()
  }

  const logout = async () => {
    await sessionOrchestrator.logoutCurrentSession()
  }

  const init = async () => {
    await sessionOrchestrator.bootstrapPostLoginState({
      account: info.value.account || userStore.userInfo?.account || userStore.userInfo?.email,
      displayName: info.value.name || userStore.userInfo?.name,
      avatar: info.value.avatar || userStore.userInfo?.avatar,
      client: isDesktop() ? 'PC' : 'MOBILE'
    })
    await setLoginState()
  }

  const routerOrOpenHomeWindow = async () => {
    if (isDesktop() && hasTauriRuntime()) {
      await sessionOrchestrator.completeDesktopLoginTransition()
    } else if (isDesktop()) {
      // 浏览器环境（非 Tauri）下 isDesktop() 也为 true，但无法打开 Tauri 窗口，
      // 需通过路由跳转到 PC 端主页。
      router?.push('/home')
    } else {
      router?.push('/mobile/home')
    }
  }

  const normalLogin = async (
    _deviceType: 'PC' | 'MOBILE',
    _syncRecentMessages: boolean,
    auto: boolean = settingStore.autoLoginEnabled
  ) => {
    loading.value = true
    loginText.value = t('login.status.logging_in')
    loginDisabled.value = true
    loginStatus.value = 'connecting'
    lastLoginError.value = null

    // 整体超时保护：防止 SDK login/startClient 卡住导致按钮永远显示"登录中"
    if (loginTimeoutHandle) clearTimeout(loginTimeoutHandle)
    loginTimeoutHandle = setTimeout(() => {
      if (loginStatus.value === 'connecting') {
        logger.warn(`登录整体超时 ${LOGIN_TIMEOUT_MS}ms，强制复位为失败状态`)
        loading.value = false
        loginDisabled.value = false
        loginText.value = t('login.button.login.default')
        loginStatus.value = 'failed'
        lastLoginError.value = t('login.status.timeout')
        // 通过状态机更新连接状态，避免直接赋值绕过状态机约束
        matrixClientService.updateConnectionState('DISCONNECTED')
        // 清理底层会话：超时后底层 loginWithPassword 可能仍在运行，
        // client 可能已 startClient，需要 stopClient 清理资源。
        matrixClientService.stopClient().catch((err) => {
          logger.warn('登录超时后清理 client 失败:', err)
        })
        showFeedback(t('login.status.timeout'), 'error')
      }
    }, LOGIN_TIMEOUT_MS)
    const loginInfo = auto && userStore.userInfo ? (userStore.userInfo as UserInfoType) : info.value
    const account = loginInfo?.account
    const password = loginInfo?.password ?? info.value.password
    const uid = loginInfo?.uid || userStore.userInfo?.uid || matrixStore.userId || ''

    if (auto && !uid && !account) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error')
      uiState.value = 'manual'
      settingStore.setAutoLogin(false)
      logger.info('自动登录信息已失效，请手动登录')
      if (isMobile()) {
        await invokeSilently('hide_splash_screen')
        router?.replace('/mobile/login')
      }
      return
    }

    if (!auto && !account) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? '登录' : '网络异常'
      logger.info('账号信息缺失，请重新输入')
      return
    }

    await ensureAppStateReady()

    try {
      if (auto && uid) {
        const tokens = await sessionOrchestrator.getStoredTokens()
        if (tokens.token) {
          await sessionOrchestrator.restoreWithAccessToken({
            uid,
            accessToken: tokens.token,
            refreshToken: tokens.refreshToken ?? undefined,
            displayName: loginInfo?.name || account,
            account,
            avatar: loginInfo?.avatar,
            client: isDesktop() ? 'PC' : 'MOBILE',
            bootstrapAfterRestore: true
          })
        } else {
          if (!account) {
            throw new Error('缺少账号信息，无法自动登录')
          }
          if (!password) {
            throw new Error('缺少访问令牌和密码，无法自动登录')
          }

          await sessionOrchestrator.loginWithPassword({
            username: account,
            password,
            homeserverUrl: homeserverUrl.value,
            identityServerUrl: identityServerUrl.value,
            deviceName: 'Tjg Client',
            account,
            displayName: loginInfo?.name || account,
            avatar: loginInfo?.avatar,
            client: isDesktop() ? 'PC' : 'MOBILE'
          })
        }
      } else {
        await sessionOrchestrator.loginWithPassword({
          username: account,
          password,
          homeserverUrl: homeserverUrl.value,
          identityServerUrl: identityServerUrl.value,
          deviceName: 'Tjg Client',
          account,
          displayName: info.value.name || account,
          avatar: info.value.avatar,
          client: isDesktop() ? 'PC' : 'MOBILE'
        })
      }

      loginDisabled.value = true
      loading.value = false
      loginText.value = t('login.status.success_redirect')
      loginStatus.value = 'success'
      if (loginTimeoutHandle) {
        clearTimeout(loginTimeoutHandle)
        loginTimeoutHandle = undefined
      }

      if (!auto && isMobile()) {
        settingStore.setAutoLogin(true)
      }

      if (isMobile()) {
        await invokeSilently('hide_splash_screen')
      }

      useMitt.emit(MittEnum.MSG_INIT)

      if (isDesktop() && hasTauriRuntime()) {
        await sessionOrchestrator.completeDesktopLoginTransition()
      } else {
        await routerOrOpenHomeWindow()
      }
    } catch (err: unknown) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = t('login.button.login.default')
      loginStatus.value = 'failed'
      if (loginTimeoutHandle) {
        clearTimeout(loginTimeoutHandle)
        loginTimeoutHandle = undefined
      }
      // 登录失败时重置连接状态，避免 ConnectionStatusBanner 一直显示"正在重新连接"
      // matrixStore.connectionState 可能在 login()/startClient() 过程中被设为
      // 'CONNECTING' 或因 SDK sync 事件变为 'RECONNECTING'，失败后必须复位
      matrixStore.connectionState = 'DISCONNECTED'
      const matrixErr = err as Error & { errcode?: string; httpStatus?: number; message?: string }
      const translated = translateMatrixError(matrixErr, { context: 'login' })
      const userMessage =
        translated.userMessage !== 'error.matrix.unknown'
          ? t(translated.userMessage)
          : matrixErr.message || t('matrix_error.auth.login_failed_check_network')
      lastLoginError.value = userMessage
      showFeedback(userMessage, 'error')
      if (auto) {
        uiState.value = 'manual'
        settingStore.setAutoLogin(false)
        if (userStore.userInfo) {
          info.value.account = userStore.userInfo.account || userStore.userInfo.email || ''
          info.value.avatar = userStore.userInfo.avatar
          info.value.name = userStore.userInfo.name
          info.value.uid = userStore.userInfo.uid
        }
        if (isMobile()) {
          await invokeSilently('hide_splash_screen')
          router?.replace('/mobile/login')
        }
      }
    }
  }

  /** 重试最近一次失败的登录 */
  const retryLogin = async () => {
    if (loginStatus.value !== 'failed') return
    loginStatus.value = 'idle'
    lastLoginError.value = null
    await normalLogin('PC', true, false)
  }

  return {
    logout,
    normalLogin,
    retryLogin,
    loading,
    loginText,
    loginDisabled,
    loginStatus,
    lastLoginError,
    info,
    uiState,
    init,
    homeserverUrl,
    identityServerUrl
  }
}
