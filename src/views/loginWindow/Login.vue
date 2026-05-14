<template>
  <!-- 单独使用n-config-provider来包裹不需要主题切换的界面 -->
  <n-config-provider :theme="naiveTheme" data-tauri-drag-region class="login-box size-full rounded-8px select-none">
    <!--顶部操作栏-->
    <ActionBar :max-w="false" :shrink="false" proxy />

    <!--  手动登录样式  -->
    <n-flex vertical :size="22" v-if="uiState === 'manual'">
      <!-- 头像 -->
      <n-flex justify="center" class="w-full pt-12px" data-tauri-drag-region>
        <n-avatar
          class="welcome size-80px rounded-50% border-(2px solid [--login-avatar-border])"
          :color="'var(--login-avatar-bg)'"
          :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
          :src="AvatarUtils.getAvatarUrl(loginInfo.avatar)" />
      </n-flex>

      <!-- 登录菜单 -->
      <n-flex class="ma text-center h-full w-260px" vertical :size="16">
        <n-input
          :class="{ 'pl-16px': loginHistories.length > 0 }"
          size="large"
          v-model:value="loginInfo.account"
          type="text"
          :placeholder="accountPH"
          @focus="accountPH = ''"
          @blur="accountPH = t('login.input.account.placeholder')"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          clearable>
          <template #suffix>
            <n-flex v-if="loginHistories.length > 0" @click="arrowStatus = !arrowStatus">
              <svg v-if="!arrowStatus" class="down w-18px h-18px color-[--hula-text-secondary] cursor-pointer">
                <use href="#down"></use>
              </svg>
              <svg v-else class="down w-18px h-18px color-[--hula-text-secondary] cursor-pointer">
                <use href="#up"></use>
              </svg>
            </n-flex>
          </template>
        </n-input>

        <!-- 账号选择框-->
        <div
          style="border: 1px solid var(--login-dropdown-border)"
          v-if="loginHistories.length > 0 && arrowStatus"
          class="account-box absolute w-260px max-h-140px bg-[--login-dropdown-bg] backdrop-blur-sm mt-45px z-99 rounded-8px p-8px box-border">
          <n-scrollbar style="max-height: 120px" trigger="none">
            <n-flex
              vertical
              v-for="item in loginHistories"
              :key="item.account"
              @click="giveAccount(item)"
              class="p-8px cursor-pointer hover:bg-[--hula-text-tertiary]20 dark:hover:bg-[--hula-text-tertiary]30 hover:rounded-6px">
              <div class="flex-between-center">
                <n-avatar
                  :src="AvatarUtils.getAvatarUrl(item.avatar)"
                  :color="'var(--login-avatar-bg)'"
                  class="size-28px rounded-50%" />
                <p class="text-14px color-[--hula-text-secondary]">{{ item.account }}</p>
                <svg @click.stop="delAccount(item)" class="w-12px h-12px color-[--hula-text-secondary]">
                  <use href="#close"></use>
                </svg>
              </div>
            </n-flex>
          </n-scrollbar>
        </div>

        <n-input
          class="pl-16px"
          maxlength="16"
          minlength="6"
          size="large"
          show-password-on="click"
          v-model:value="loginInfo.password"
          type="password"
          spellCheck="false"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          :placeholder="passwordPH"
          @focus="passwordPH = ''"
          @blur="passwordPH = t('login.input.pass.placeholder')"
          clearable />

        <!-- 协议 -->
        <n-flex align="center" justify="center" :size="6">
          <n-checkbox v-model:checked="protocol" />
          <div class="text-12px color-[--hula-text-tertiary] cursor-default lh-14px agreement">
            <span>{{ t('login.term.checkout.text1') }}</span>
            <span class="color-[--color-primary] cursor-pointer" @click.stop="openServiceAgreement">
              {{ t('login.term.checkout.text2') }}
            </span>
            <span>{{ t('login.term.checkout.text3') }}</span>
            <span class="color-[--color-primary] cursor-pointer" @click.stop="openPrivacyAgreement">
              {{ t('login.term.checkout.text4') }}
            </span>
          </div>
        </n-flex>

        <n-button
          :loading="loading"
          :disabled="loginDisabled"
          tertiary
          style="color: var(--hula-text-inverse)"
          class="gradient-button w-full mt-8px mb-10px"
          @click="normalLogin('PC', true, false)">
          <span>{{ loginText }}</span>
        </n-button>
      </n-flex>
    </n-flex>

    <!-- 自动登录样式 -->
    <n-flex v-else-if="uiState === 'auto'" vertical :size="29" data-tauri-drag-region>
      <n-flex justify="center" class="mt-15px">
        <img src="/hula.png" class="w-140px h-60px" alt="" />
      </n-flex>
      <n-flex :size="30" vertical>
        <!-- 头像 -->
        <n-flex justify="center">
          <n-avatar
            round
            :size="110"
            :color="'var(--login-avatar-bg)'"
            :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
            :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ?? '')" />
        </n-flex>

        <n-flex justify="center">
          <n-ellipsis style="max-width: 200px" class="text-(18px [--hula-text-secondary])">
            {{ userStore.userInfo?.name || '' }}
          </n-ellipsis>
        </n-flex>
      </n-flex>

      <n-flex justify="center">
        <n-button
          :loading="loading"
          :disabled="loginDisabled"
          tertiary
          style="color: var(--hula-text-inverse)"
          class="gradient-button w-200px mt-12px mb-40px"
          @click="triggerAutoLogin">
          <span>{{ loginText }}</span>
        </n-button>
      </n-flex>
    </n-flex>

    <!-- 第三方登录 -->
    <div v-if="uiState !== 'auto'" class="w-full pb-22px pt-3px">
      <ThirdPartyLogin :login-context="loginContext" />
    </div>

    <!-- 底部操作栏 -->
    <div
      v-if="uiState === 'auto'"
      class="text-14px grid grid-cols-[1fr_auto_1fr] items-center gap-x-12px w-full"
      id="bottomBar">
      <div
        class="color-[--color-primary] cursor-pointer justify-self-end text-right"
        :title="cancelLoginTitle"
        @click="cancelAutoLoginAndShowManual">
        {{ cancelLoginLabel }}
      </div>
      <div class="w-1px h-14px bg-#ccc dark:bg-#707070 justify-self-center"></div>
      <div
        class="color-[--color-primary] cursor-pointer justify-self-start text-left"
        :title="removeAccountTitle"
        @click="removeStoredAccount">
        {{ removeAccountLabel }}
      </div>
    </div>
    <div v-else class="text-14px grid grid-cols-[1fr_auto_1fr] items-center gap-x-12px w-full" id="bottomBar">
      <div
        class="color-[--color-primary] cursor-pointer justify-self-end text-right"
        :title="qrCodeTitle"
        @click="router.push('/qrCode')">
        {{ qrCodeLabel }}
      </div>
      <div class="w-1px h-14px bg-#ccc dark:bg-#707070 justify-self-center"></div>
      <div class="justify-self-start text-left">
        <n-popover
          trigger="click"
          id="moreShow"
          class="bg-[--login-dropdown-bg]! backdrop-blur-sm"
          v-model:show="moreShow"
          :show-checkmark="false"
          :show-arrow="false">
          <template #trigger>
            <div class="color-[--color-primary] cursor-pointer" :title="moreTitle">{{ moreLabel }}</div>
          </template>
          <n-flex vertical :size="2">
            <div
              class="register text-14px cursor-pointer hover:bg-[--hula-text-tertiary]30 hover:rounded-6px p-8px"
              @click="router.push('/register')">
              {{ t('login.register') }}
            </div>
            <div
              class="text-14px cursor-pointer hover:bg-[--hula-text-tertiary]30 hover:rounded-6px p-8px"
              @click="createWebviewWindow('忘记密码', 'forgetPassword', 600, 600)">
              {{ t('login.option.items.forget') }}
            </div>
            <div
              v-if="!isCompatibility()"
              @click="showServerConfig = true"
              :class="{ network: isMac() }"
              class="text-14px cursor-pointer hover:bg-[--hula-text-tertiary]30 hover:rounded-6px p-8px">
              {{ t('login.option.items.network_setting') }}
            </div>
          </n-flex>
        </n-popover>
      </div>
    </div>

    <n-modal
      v-model:show="showServerConfig"
      preset="card"
      :title="t('login.server_config.title')"
      :style="{ width: '400px' }">
      <n-flex vertical :size="12">
        <n-form-item label="Homeserver URL">
          <n-input v-model:value="homeserverUrl" :placeholder="DEFAULT_MATRIX_HOMESERVER_URL" clearable />
        </n-form-item>
        <n-form-item label="Identity Server URL">
          <n-input
            v-model:value="identityServerUrl"
            :placeholder="DEFAULT_MATRIX_IDENTITY_SERVER_URL || t('login.server_config.identity_placeholder')"
            clearable />
        </n-form-item>
        <n-alert type="info" :bordered="false">{{ t('login.server_config.restart_hint') }}</n-alert>
        <n-flex justify="end">
          <n-button @click="resetServerConfig">{{ t('login.server_config.reset') }}</n-button>
          <n-button @click="showServerConfig = false">{{ t('login.server_config.cancel') }}</n-button>
          <n-button type="primary" @click="saveServerConfig">{{ t('login.server_config.save') }}</n-button>
        </n-flex>
      </n-flex>
    </n-modal>
  </n-config-provider>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useNetwork } from '@vueuse/core'
import { darkTheme, lightTheme } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { MittEnum, ThemeEnum } from '@/enums'
import { useCheckUpdate } from '@/hooks/useCheckUpdate'
import { type DriverStepConfig, useDriver } from '@/hooks/useDriver'
import { useLoginFlow } from '@/hooks/useLoginFlow'
import { useMitt } from '@/hooks/useMitt'
import { useWindow } from '@/hooks/useWindow.ts'
import router from '@/router'
import {
  DEFAULT_MATRIX_HOMESERVER_URL,
  DEFAULT_MATRIX_IDENTITY_SERVER_URL,
  discoverAndSaveMatrixEndpoints,
  isValidHttpUrl,
  saveMatrixHomeserverUrl,
  saveMatrixIdentityServerUrl
} from '@/services/backend'
import { sessionOrchestrator } from '@/services/matrix/auth/SessionOrchestrator'
import type { UserInfoType } from '@/services/types.ts'
import { useGuideStore } from '@/stores/domains/settings/guide'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatBottomText } from '@/utils/Formatting'
import { createLogger } from '@/utils/Logger'
import { isCompatibility, isDesktop, isMac } from '@/utils/PlatformConstants'
import { useTimerManager } from '@/utils/TimerManager'
import ThirdPartyLogin, { type ThirdPartyLoginContext } from './ThirdPartyLogin.vue'

const { t } = useI18n()
const logger = createLogger('Login')
const timerManager = useTimerManager()

const settingStore = useSettingStore()
const naiveTheme = computed(() => (settingStore.themeContent === 'dark' ? darkTheme : lightTheme))
const userStore = useUserStore()
const globalStore = useGlobalStore()
const guideStore = useGuideStore()
const { isTrayMenuShow } = storeToRefs(globalStore)
const { isGuideCompleted } = storeToRefs(guideStore)
const { isOnline } = useNetwork()
const loginHistoriesStore = useLoginHistoriesStore()
const { loginHistories } = storeToRefs(loginHistoriesStore)
const protocol = ref(true)
const arrowStatus = ref(false)
const moreShow = ref(false)
const showServerConfig = ref(false)
const { createWebviewWindow, createModalWindow, getWindowPayload } = useWindow()
const { checkUpdate, CHECK_UPDATE_LOGIN_TIME } = useCheckUpdate()
const {
  normalLogin,
  loading,
  loginText,
  loginDisabled,
  info: loginInfo,
  uiState,
  homeserverUrl,
  identityServerUrl
} = useLoginFlow()
const loginContext: ThirdPartyLoginContext = {
  giteeLogin: () => {},
  githubLogin: () => {},
  homeserverUrl,
  identityServerUrl,
  loading,
  loginDisabled
}
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

const isPotentialHomeserverInput = (value: string): boolean => {
  return isValidHttpUrl(value) || isValidHttpUrl(`http://${value}`) || /^[^/\s]+\.[^/\s]+$/.test(value)
}

const saveServerConfig = () => {
  const rawHomeserverValue = (homeserverUrl.value || DEFAULT_MATRIX_HOMESERVER_URL).trim()
  const rawIdentityServerUrl = identityServerUrl.value.trim()

  if (!isPotentialHomeserverInput(rawHomeserverValue)) {
    window.$message.error(t('login.server_config.homeserver_invalid'))
    return
  }

  if (
    rawIdentityServerUrl &&
    !isValidHttpUrl(rawIdentityServerUrl) &&
    !isValidHttpUrl(`http://${rawIdentityServerUrl}`)
  ) {
    window.$message.error(t('login.server_config.identity_invalid'))
    return
  }

  void (async () => {
    try {
      const discovery = await discoverAndSaveMatrixEndpoints(rawHomeserverValue, {
        homeserverUrl: DEFAULT_MATRIX_HOMESERVER_URL,
        identityServerUrl: rawIdentityServerUrl || DEFAULT_MATRIX_IDENTITY_SERVER_URL
      })
      homeserverUrl.value = discovery.homeserverUrl
      identityServerUrl.value = rawIdentityServerUrl
        ? saveMatrixIdentityServerUrl(rawIdentityServerUrl)
        : discovery.identityServerUrl
      showServerConfig.value = false
      window.$message.success(t('login.server_config.save_success'))
    } catch (error) {
      logger.error('Failed to save homeserver config', error)
      window.$message.error(t('login.server_config.save_failed'))
    }
  })()
}

const resetServerConfig = () => {
  homeserverUrl.value = saveMatrixHomeserverUrl(DEFAULT_MATRIX_HOMESERVER_URL)
  identityServerUrl.value = saveMatrixIdentityServerUrl(DEFAULT_MATRIX_IDENTITY_SERVER_URL)
  window.$message.success(t('login.server_config.reset_success'))
}

const cancelAutoLoginAndShowManual = () => {
  cancelAutoLogin()
  uiState.value = 'manual'
  loginHistories.value.length > 0 && giveAccount(loginHistories.value[0])
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

const { startTour, reinitialize } = useDriver(driverSteps.value, driverConfig.value)

watch([driverSteps, driverConfig], ([steps, config]) => {
  reinitialize(steps, config)
})

const accountPH = ref(t('login.input.account.placeholder'))
const passwordPH = ref(t('login.input.pass.placeholder'))

const MAX_BOTTOM_TEXT_LEN = 6
const qrCodeText = computed(() => t('login.button.qr_code'))
const moreText = computed(() => t('login.option.more'))
const removeAccountText = computed(() => t('login.button.remove_account'))
const cancelLoginText = computed(() => t('login.button.cancel_login'))
const qrCodeLabel = computed(() => formatBottomText(qrCodeText.value, MAX_BOTTOM_TEXT_LEN))
const moreLabel = computed(() => formatBottomText(moreText.value, MAX_BOTTOM_TEXT_LEN))
const removeAccountLabel = computed(() => formatBottomText(removeAccountText.value, MAX_BOTTOM_TEXT_LEN))
const cancelLoginLabel = computed(() => formatBottomText(cancelLoginText.value, MAX_BOTTOM_TEXT_LEN))
const qrCodeTitle = computed(() => (qrCodeLabel.value !== qrCodeText.value ? qrCodeText.value : undefined))
const moreTitle = computed(() => (moreLabel.value !== moreText.value ? moreText.value : undefined))
const removeAccountTitle = computed(() =>
  removeAccountLabel.value !== removeAccountText.value ? removeAccountText.value : undefined
)
const cancelLoginTitle = computed(() =>
  cancelLoginLabel.value !== cancelLoginText.value ? cancelLoginText.value : undefined
)

const isJumpDirectly = ref(false)

const handleSsoLoginCallback = async (): Promise<boolean> => {
  const urlParams = new URLSearchParams(window.location.search)
  const loginToken = urlParams.get('loginToken') || urlParams.get('login_token')
  if (!loginToken) {
    return false
  }

  loading.value = true
  loginText.value = t('login.status.logging_in')
  loginDisabled.value = true

  try {
    await sessionOrchestrator.loginWithSsoToken({
      loginToken,
      client: isDesktop() ? 'PC' : 'MOBILE'
    })

    useMitt.emit(MittEnum.MSG_INIT)

    const callbackUrl = new URL(window.location.href)
    callbackUrl.searchParams.delete('loginToken')
    callbackUrl.searchParams.delete('login_token')
    window.history.replaceState({}, '', callbackUrl.toString())

    if (isDesktop()) {
      await sessionOrchestrator.completeDesktopLoginTransition()
    } else {
      await router.push('/mobile/home')
    }
    return true
  } catch (error) {
    logger.error('Failed to complete SSO login callback', error)
    window.$message.error(t('login.sso_login_failed'))
    loading.value = false
    loginDisabled.value = false
    loginText.value = t('login.button.login.default')
    return false
  }
}

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

watch(
  () => loginInfo.value.account,
  (newAccount) => {
    if (!newAccount) {
      loginInfo.value.avatar = '/logoD.png'
      return
    }

    const matchedAccount = loginHistories.value.find(
      (history) => history.account === newAccount || history.email === newAccount
    )
    if (matchedAccount) {
      loginInfo.value.avatar = matchedAccount.avatar
    } else {
      loginInfo.value.avatar = '/logoD.png'
    }
  }
)

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
  if (!isDesktop()) {
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

const delAccount = (item: UserInfoType) => {
  const lengthBeforeDelete = loginHistories.value.length
  loginHistoriesStore.removeLoginHistory(item)
  if (lengthBeforeDelete === 1 && loginHistories.value.length === 0) {
    arrowStatus.value = false
  }
  loginInfo.value.account = ''
  loginInfo.value.password = ''
  loginInfo.value.avatar = '/logoD.png'
}

const giveAccount = (item: UserInfoType) => {
  const { account, password, avatar, name, uid } = item
  loginInfo.value.account = account || ''
  loginInfo.value.password = password || ''
  loginInfo.value.avatar = avatar
  loginInfo.value.name = name
  loginInfo.value.uid = uid
  arrowStatus.value = false
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

const openServiceAgreement = async () => {
  await createModalWindow(t('login.service_agreement_title'), 'modal-serviceAgreement', 600, 600, 'login')
}

const openPrivacyAgreement = async () => {
  await createModalWindow(t('login.privacy_policy_title'), 'modal-privacyAgreement', 600, 600, 'login')
}

const closeMenu = (event: MouseEvent) => {
  const target = event.target as Element
  if (!target.matches('.account-box, .account-box *, .down')) {
    arrowStatus.value = false
  }
  if (!target.matches('#moreShow')) {
    moreShow.value = false
  }
}

const enterKey = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !loginDisabled.value) {
    normalLogin('PC', true, false)
  }
}

onBeforeMount(async () => {
  globalStore.updateCurrentSessionRoomId('')
  await handlePendingRemoteLoginPayload()
  isTrayMenuShow.value = false

  if (!settingStore.autoLoginEnabled) {
    uiState.value = 'manual'
    localStorage.removeItem('TOKEN')
    localStorage.removeItem('REFRESH_TOKEN')
    return
  }
})

onMounted(async () => {
  if (!isGuideCompleted.value) {
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

  window.addEventListener('click', closeMenu, true)
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
})

onUnmounted(() => {
  window.removeEventListener('click', closeMenu, true)
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
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
@use '@/styles/scss/login';
</style>
