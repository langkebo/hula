/**
 * @deprecated 此文件已废弃，Matrix 使用不同的认证机制
 * 请使用 matrix-js-sdk 的 client.login() 或 SSO 登录
 * 迁移完成后此文件将被删除
 */
import { emit } from '@tauri-apps/api/event'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { invoke } from '@tauri-apps/api/core'
import { useRouter } from 'vue-router'
import { EventEnum, MittEnum } from '@/enums'
import { useWindow } from '@/hooks/useWindow.ts'
import { useGlobalStore } from '@/stores/global.ts'
import { isDesktop, isMac, isMobile } from '@/utils/PlatformConstants'
import { clearListener } from '@/utils/ReadCountQueue'
import { useSettingStore } from '../stores/setting'
import { useGroupStore } from '../stores/group'
import { useConfigStore } from '../stores/config'
import { useUserStore } from '../stores/user'
import { useLoginHistoriesStore } from '../stores/loginHistory'
import { useEmojiStore } from '@/stores/emoji'
import { useMatrixStore } from '@/stores/matrix'
import { useRoomStore } from '@/stores/room'
import { UserInfoType } from '../services/types'
import { useNetwork } from '@vueuse/core'
import { useMitt } from './useMitt'
import { info as logInfo } from '@tauri-apps/plugin-log'
import { ensureAppStateReady } from '@/utils/AppStateReady'
import { useI18nGlobal } from '../services/i18n'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { SexEnum } from '@/enums'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('Login')

export const useLogin = () => {
  const { resizeWindow } = useWindow()
  const globalStore = useGlobalStore()
  const settingStore = useSettingStore()
  const { isTrayMenuShow } = storeToRefs(globalStore)
  const groupStore = useGroupStore()
  const configStore = useConfigStore()
  const userStore = useUserStore()
  const loginHistoriesStore = useLoginHistoriesStore()
  const matrixStore = useMatrixStore()
  const roomStore = useRoomStore()
  const { createWebviewWindow } = useWindow()

  const { t } = useI18nGlobal()

  const clearUserLocalStorage = () => {
    const userScopedStoreKeys = ['chat', 'group', 'contacts', 'cached', 'sessionUnread']
    userScopedStoreKeys.forEach((key) => {
      localStorage.removeItem(key)
    })
    logger.debug('User localStorage has been cleared')
  }

  const clearMessageCache = () => {
    for (const key of Object.keys(groupStore.membersMap)) {
      delete groupStore.membersMap[key]
    }
    logger.debug('Message cache has been cleared')
  }

  let router: ReturnType<typeof useRouter> | null = null
  try {
    router = useRouter()
  } catch (_e) {
    void logInfo('[useLogin] 无法获取 router 实例,可能不在组件上下文中')
  }

  const { isOnline } = useNetwork()
  const loading = ref(false)
  const loginText = ref(isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error'))
  const loginDisabled = ref(!isOnline.value)
  const info = ref({
    account: '',
    password: '',
    avatar: '',
    name: '',
    uid: ''
  })
  const uiState = ref<'manual' | 'auto'>('manual')
  const homeserverUrl = ref(import.meta.env.VITE_HOMESERVER_URL || 'http://localhost:8008')
  const identityServerUrl = ref('https://vector.im')

  const setLoginState = async () => {
    isTrayMenuShow.value = true
    if (!isMobile()) {
      await resizeWindow('tray', 130, 356)
    }
  }

  const logout = async () => {
    globalStore.updateCurrentSessionRoomId('')

    await matrixStore.logout()

    if (isDesktop()) {
      const { createWebviewWindow } = useWindow()
      isTrayMenuShow.value = false
      try {
        await createWebviewWindow('登录', 'login', 320, 448, undefined, false, 320, 448)
        await emit(EventEnum.LOGOUT)
        await resizeWindow('tray', 130, 44)
      } catch (_error) {
        void logInfo('创建登录窗口失败')
      }
    } else {
      try {
        await emit(EventEnum.LOGOUT)
      } catch (_error) {
        void logInfo('登出失败')
        window.$message.error('登出失败')
      }
    }
  }

  const resetLoginState = async (isAutoLogin = false) => {
    clearListener()
    if (!isAutoLogin) {
      localStorage.removeItem('user')
      localStorage.removeItem('TOKEN')
      localStorage.removeItem('REFRESH_TOKEN')
    }
    settingStore.closeAutoLogin()
    globalStore.updateCurrentSessionRoomId('')
    if (isMac()) {
      const homeWindow = await WebviewWindow.getByLabel('home')
      if (homeWindow) {
        await homeWindow.setBadgeCount(undefined)
      }
    }
  }

  const init = async () => {
    const emojiStore = useEmojiStore()

    clearUserLocalStorage()
    clearMessageCache()

    roomStore.rooms.clear()
    groupStore.groupDetails.length = 0

    await roomStore.loadRooms()

    const account = {
      uid: matrixStore.userId ?? '',
      name: info.value.name || info.value.account,
      account: info.value.account,
      email: '',
      avatar: AvatarUtils.getAvatarUrl(info.value.avatar),
      modifyNameChance: 0,
      sex: SexEnum.MAN,
      userStateId: '',
      avatarUpdateTime: 0,
      client: isDesktop() ? 'PC' : 'MOBILE',
      resume: ''
    }
    userStore.userInfo = account
    loginHistoriesStore.addLoginHistory(account)

    void emojiStore.initEmojis().catch(() => {
      void logInfo('[login] 初始化表情失败')
    })

    const cachedConfig = localStorage.getItem('config')
    if (cachedConfig) {
      configStore.config = JSON.parse(cachedConfig).config
    } else {
      await configStore.initConfig()
    }

    void emojiStore.prefetchEmojiToLocal().catch(() => {
      void logInfo('[login] 预热表情缓存失败')
    })

    await setLoginState()
  }

  const routerOrOpenHomeWindow = async () => {
    if (isDesktop()) {
      const registerWindow = await WebviewWindow.getByLabel('register')
      if (registerWindow) {
        await registerWindow.close().catch(() => {
          void logInfo('关闭注册窗口失败')
        })
      }
      await createWebviewWindow('HuLa', 'home', 960, 720, 'login', true, 330, 480, undefined, false)
      globalStore.isTrayMenuShow = true
    } else {
      router?.push('/mobile/home')
    }
  }

  const completeLogin = async (params: { userId: string; accessToken: string; deviceId: string }) => {
    await init()

    const account = {
      uid: params.userId,
      name: params.userId,
      account: params.userId,
      email: '',
      avatar: '',
      modifyNameChance: 0,
      sex: SexEnum.MAN,
      userStateId: '',
      avatarUpdateTime: 0,
      client: isDesktop() ? 'PC' : 'MOBILE',
      resume: ''
    }
    userStore.userInfo = account
    loginHistoriesStore.addLoginHistory(account)

    localStorage.setItem('TOKEN', params.accessToken)
    localStorage.setItem('user', JSON.stringify(account))

    await routerOrOpenHomeWindow()
  }

  const normalLogin = async (
    _deviceType: 'PC' | 'MOBILE',
    _syncRecentMessages: boolean,
    auto: boolean = settingStore.login.autoLogin
  ) => {
    loading.value = true
    loginText.value = t('login.status.logging_in')
    loginDisabled.value = true
    const hasStoredUserInfo = !!userStore.userInfo && !!userStore.userInfo.account
    if (auto && !hasStoredUserInfo) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? t('login.button.login.default') : t('login.button.login.network_error')
      uiState.value = 'manual'
      settingStore.setAutoLogin(false)
      logInfo('自动登录信息已失效，请手动登录')
      return
    }

    const loginInfo = auto && userStore.userInfo ? (userStore.userInfo as UserInfoType) : info.value
    const account = loginInfo?.account
    const password = loginInfo?.password ?? info.value.password
    if (!account) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = isOnline.value ? '登录' : '网络异常'
      if (auto) {
        uiState.value = 'manual'
        settingStore.setAutoLogin(false)
      }
      logInfo('账号信息缺失，请重新输入')
      return
    }

    await ensureAppStateReady()

    try {
      await matrixStore.initialize({
        homeserverUrl: homeserverUrl.value,
        identityServerUrl: identityServerUrl.value
      })

      const success = await matrixStore.login(account, password, 'HuLa Client')

      if (success) {
        loginDisabled.value = true
        loading.value = false
        loginText.value = t('login.status.success_redirect')

        if (!auto && isMobile()) {
          settingStore.setAutoLogin(true)
        }

        if (isMobile()) {
          await init()
          await invoke('hide_splash_screen')
        }

        useMitt.emit(MittEnum.MSG_INIT)

        await routerOrOpenHomeWindow()
      } else {
        loading.value = false
        loginDisabled.value = false
        loginText.value = t('login.button.login.default')
        window.$message.error('登录失败，请检查账号密码')
      }
    } catch (error: any) {
      loading.value = false
      loginDisabled.value = false
      loginText.value = t('login.button.login.default')
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
    resetLoginState,
    setLoginState,
    logout,
    normalLogin,
    completeLogin,
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
