/**
 * 登录页 UI 编排层。
 *
 * 该 composable 仅负责表单状态、平台跳转和触发统一会话服务，
 * 不再直接承载底层 Matrix 登录、会话恢复或退出编排实现。
 */
import { invoke } from '@tauri-apps/api/core'
import { useRouter } from 'vue-router'
import { MittEnum } from '@/enums'
import { isDesktop, isMobile } from '@/utils/PlatformConstants'
import { useSettingStore } from '../stores/domains/settings/setting'
import { useUserStore } from '../stores/domains/user/user'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { UserInfoType } from '../services/types'
import { useNetwork } from '@vueuse/core'
import { useMitt } from './useMitt'
import { info as logInfo } from '@tauri-apps/plugin-log'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { useI18nGlobal } from '../services/i18n'
import { resolveMatrixEndpointConfig } from '@/services/backend'
import { matrixRuntimeSessionService } from '@/services/matrix'

export const useLoginFlow = () => {
  const settingStore = useSettingStore()
  const userStore = useUserStore()
  const matrixStore = useMatrixStore()

  const { t } = useI18nGlobal()

  let router: ReturnType<typeof useRouter> | null = null
  try {
    router = useRouter()
  } catch {
    void logInfo('[useLoginFlow] 无法获取 router 实例,可能不在组件上下文中')
  }

  const { isOnline } = useNetwork()
  const loading = ref(false)
  const loginText = ref(isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error'))
  const loginDisabled = ref(!isOnline.value)
  const matrixEndpointConfig = resolveMatrixEndpointConfig()
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

    await matrixRuntimeSessionService.applyDesktopLoginState()
  }

  const logout = async () => {
    await matrixRuntimeSessionService.logoutCurrentSession()
  }

  const init = async () => {
    await matrixRuntimeSessionService.bootstrapPostLoginState({
      account: info.value.account || userStore.userInfo?.account || userStore.userInfo?.email,
      displayName: info.value.name || userStore.userInfo?.name,
      avatar: info.value.avatar || userStore.userInfo?.avatar,
      client: isDesktop() ? 'PC' : 'MOBILE'
    })
    await setLoginState()
  }

  const routerOrOpenHomeWindow = async () => {
    if (isDesktop()) {
      await matrixRuntimeSessionService.completeDesktopLoginTransition()
    } else {
      router?.push('/mobile/home')
    }
  }

  const normalLogin = async (
    _deviceType: 'PC' | 'MOBILE',
    _syncRecentMessages: boolean,
    auto: boolean = settingStore.login.autoLogin
  ) => {
    loading.value = true
    loginText.value = t('login.status.logging_in')
    loginDisabled.value = true
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
      logInfo('自动登录信息已失效，请手动登录')
      return
    }

    if (!auto && !account) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? '登录' : '网络异常'
      logInfo('账号信息缺失，请重新输入')
      return
    }

    await ensureAppStateReady()

    try {
      if (auto && uid) {
        const tokens = await matrixRuntimeSessionService.getStoredTokens()
        if (tokens.token) {
          await matrixRuntimeSessionService.restoreWithAccessToken({
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

          await matrixRuntimeSessionService.loginWithPassword({
            username: account,
            password,
            homeserverUrl: homeserverUrl.value,
            identityServerUrl: identityServerUrl.value,
            deviceName: 'HuLa Client',
            account,
            displayName: loginInfo?.name || account,
            avatar: loginInfo?.avatar,
            client: isDesktop() ? 'PC' : 'MOBILE'
          })
        }
      } else {
        await matrixRuntimeSessionService.loginWithPassword({
          username: account,
          password,
          homeserverUrl: homeserverUrl.value,
          identityServerUrl: identityServerUrl.value,
          deviceName: 'HuLa Client',
          account,
          displayName: info.value.name || account,
          avatar: info.value.avatar,
          client: isDesktop() ? 'PC' : 'MOBILE'
        })
      }

      loginDisabled.value = true
      loading.value = false
      loginText.value = t('login.status.success_redirect')

      if (!auto && isMobile()) {
        settingStore.setAutoLogin(true)
      }

      if (isMobile()) {
        await invoke('hide_splash_screen')
      }

      useMitt.emit(MittEnum.MSG_INIT)

      if (isDesktop()) {
        await matrixRuntimeSessionService.completeDesktopLoginTransition()
      } else {
        await routerOrOpenHomeWindow()
      }
    } catch (err: unknown) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = t('login.button.login.default')
      const error = err as Error & { message?: string }
      window.$message.error(error.message || '登录失败')
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
          router?.replace('/mobile/login')
        }
      }
    }
  }

  return {
    logout,
    normalLogin,
    loading,
    loginText,
    loginDisabled,
    info,
    uiState,
    init,
    homeserverUrl,
    identityServerUrl
  }
}
