<template>
  <MobileLayout :safeAreaTop="false" :safeAreaBottom="false">
    <div class="login-shell h-full flex flex-col items-center gap-24px pt-[max(10vh,56px)] pb-60px overflow-y-auto">
      <div class="w-80% max-w-375px flex items-center justify-start gap-6px">
        <p class="text-(20px [--tjg-text-primary])">{{ t('login.mobile.welcome_title') }}</p>
        <img src="@/assets/mobile/2.svg" alt="Tjg" class="w-80px h-20px" />
      </div>

      <!-- 选项卡导航：原生 button 保证键盘可达，aria-pressed 表达当前选中态 -->
      <div class="w-80% max-w-375px h-40px flex-center">
        <div class="flex w-200px relative">
          <button
            type="button"
            data-testid="tab-login"
            class="login-tab z-999 w-100px text-center transition-[width,transform,opacity,color,background-color,border-color,box-shadow] duration-300 ease-out"
            :aria-pressed="activeTab === 'login'"
            :class="activeTab === 'login' ? 'text-(18px [--tjg-text-primary])' : 'text-(16px [--tjg-text-secondary])'"
            @click="activeTab = 'login'">
            {{ t('login.mobile.tabs.login') }}
          </button>
          <button
            type="button"
            data-testid="tab-register"
            class="login-tab z-999 w-100px text-center transition-[width,transform,opacity,color,background-color,border-color,box-shadow] duration-300 ease-out"
            :aria-pressed="activeTab === 'register'"
            :class="
              activeTab === 'register' ? 'text-(18px [--tjg-text-primary])' : 'text-(16px [--tjg-text-secondary])'
            "
            @click="activeTab = 'register'">
            {{ t('login.mobile.tabs.register') }}
          </button>
          <div
            aria-hidden="true"
            class="tab-indicator"
            :class="[
              'z-10 absolute bottom--4px left-[33px] h-6px w-34px bg-[--tjg-color-primary-500] transition-transform duration-300 ease-out',
              activeTab === 'login' ? 'translate-x-0' : 'translate-x-[100px]'
            ]"></div>
        </div>
      </div>

      <!-- 头像 -->
      <img v-if="activeTab === 'login'" :src="userInfo.avatar" alt="logo" class="size-86px rounded-full" />

      <!-- 登录表单 -->
      <MobileLoginForm
        v-if="activeTab === 'login'"
        v-model:protocol="protocol"
        v-model:homeserver-url="homeserverUrl"
        :user-info="userInfo"
        :loading="loading"
        :login-text="loginText"
        :login-disabled="loginDisabled"
        :active-tab="activeTab"
        @select-account="onSelectAccount"
        @delete-account="onDeleteAccount"
        @forget-password="handleForgetPassword"
        @login="onLogin"
        @to-service-agreement="toServiceAgreement"
        @to-privacy-agreement="toPrivacyAgreement" />

      <!-- 注册表单 -->
      <MobileRegisterForm
        v-if="activeTab === 'register'"
        :active-tab="activeTab"
        @registered="onRegistered"
        @to-service-agreement="toServiceAgreement"
        @to-privacy-agreement="toPrivacyAgreement" />
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { showFailToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { useMitt } from '@/composables/common/useMitt'
import { useSessionActions } from '@/composables/user/useSessionActions'
import { MittEnum } from '@/enums'
import router from '@/router'
import type { UserInfoType } from '@/services/types'
import { useLoginFlow } from '@/shared/composables/useLoginFlow'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { isIOS } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'
import { WsResponseMessageType } from '../services/legacy/wsType'
import { useSettingStore } from '../stores/domains/settings/setting'
import MobileLoginForm from './components/login/MobileLoginForm.vue'
import MobileRegisterForm from './components/login/MobileRegisterForm.vue'

const logger = createLogger('MobileLogin')
const { loginWithSsoToken } = useSessionActions()

const { t } = useI18n()
const loginHistoriesStore = useLoginHistoriesStore()
const { loginHistories } = storeToRefs(loginHistoriesStore)
const settingStore = useSettingStore()

const isJumpDirectly = ref(false)
const activeTab = ref<'login' | 'register'>('login')
const protocol = ref(true)

const {
  normalLogin,
  loading,
  loginText,
  loginDisabled,
  info: userInfo,
  homeserverUrl,
  selectAccount,
  deleteAccountHistory
} = useLoginFlow()

watchEffect(() => {
  loginDisabled.value = !(userInfo.value.account && userInfo.value.password && protocol.value)
  if (!userInfo.value.account) {
    userInfo.value.avatar = '/logo.png'
  }
})

watch(
  () => userInfo.value.account,
  (newAccount) => {
    if (!newAccount) {
      userInfo.value.avatar = '/logo.png'
      return
    }

    refreshAvatar(newAccount)
  }
)

const refreshAvatar = useDebounceFn((newAccount: string) => {
  const matchedAccount = loginHistories.value.find(
    (history) => history.account === newAccount || history.email === newAccount
  )
  if (matchedAccount) {
    userInfo.value.avatar = AvatarUtils.getAvatarUrl(matchedAccount.avatar)
  } else {
    userInfo.value.avatar = '/logo.png'
  }
}, 300)

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
    await loginWithSsoToken({
      loginToken,
      client: 'MOBILE'
    })

    useMitt.emit(MittEnum.MSG_INIT)

    const callbackUrl = new URL(window.location.href)
    callbackUrl.searchParams.delete('loginToken')
    callbackUrl.searchParams.delete('login_token')
    window.history.replaceState({}, '', callbackUrl.toString())

    await router.push('/mobile/home')
    return true
  } catch (error) {
    logger.error('Failed to complete mobile SSO login callback', error)

    const err = error as { errcode?: string; message?: string; httpStatus?: number }
    if (err.errcode === 'M_UNKNOWN_TOKEN' || err.errcode === 'M_MISSING_TOKEN' || err.httpStatus === 401) {
      showFailToast(t('error.matrix.unknown_token'))
    } else if (err.message?.includes('expired') || err.message?.includes('token')) {
      showFailToast(t('error.matrix.unknown_token'))
    } else {
      showFailToast(t('login.sso_login_failed'))
    }

    loading.value = false
    loginDisabled.value = false
    loginText.value = t('login.button.login.default')
    return false
  }
}

const onSelectAccount = (item: UserInfoType) => {
  selectAccount(item)
}

const onDeleteAccount = (item: UserInfoType) => {
  deleteAccountHistory(item)
  // 移动端默认头像
  userInfo.value.avatar = '/logo.png'
}

const onLogin = () => {
  normalLogin('MOBILE', true, false)
}

const onRegistered = (account: string) => {
  activeTab.value = 'login'
  userInfo.value.account = account
}

const handleForgetPassword = () => {
  router.push({
    name: 'mobileForgetPassword'
  })
}

const toServiceAgreement = () => {
  router.push({
    name: 'mobileServiceAgreement'
  })
}

const toPrivacyAgreement = () => {
  router.push({
    name: 'mobilePrivacyAgreement'
  })
}

onBeforeMount(async () => {
  if (!settingStore.autoLoginEnabled) {
    localStorage.removeItem('TOKEN')
    localStorage.removeItem('REFRESH_TOKEN')
    return
  }
})

onMounted(async () => {
  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: false })
  }
  if (isJumpDirectly.value) {
    loading.value = false
    router.push('/mobile/message')
    return
  }

  await invokeSilently('hide_splash_screen')

  if (await handleSsoLoginCallback()) {
    return
  }

  // 已有可用会话时不再展示登录表单：登录页可能被深链/历史回退/通知冷启动带到前台，
  // 此时留在登录页会让用户误以为掉线。直接 replace，避免登录页残留可回退的历史记录。
  const { sessionOrchestrator } = await import('@/services/matrix/auth/SessionOrchestrator')
  if (await sessionOrchestrator.hasAuthenticatedSession()) {
    loading.value = false
    router.replace('/mobile/message')
    return
  }

  useMitt.on(WsResponseMessageType.NO_INTERNET, () => {
    loginDisabled.value = true
    loginText.value = t('login.status.service_disconnected')
  })

  if (settingStore.autoLoginEnabled) {
    normalLogin('MOBILE', true, true)
  } else if (loginHistories.value.length > 0) {
    onSelectAccount(loginHistories.value[0])
  }
})

onUnmounted(() => {
  if (isIOS()) {
    invokeSilently('set_webview_keyboard_adjustment', { enabled: false })
  }
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/login';

// 登录页背景是渐变 token，不能走 `bg-[--token]`（UnoCSS 会生成 background-color，
// 渐变值被丢弃后页面退化为画布白）。这里显式用 background 承载 background-image。
.login-shell {
  background: var(--tjg-mobile-login-bg);
}

// 激活 tab 下方的指示条：非对称圆角即其造型本身。
// 4px/24px 走刻度 token；42px 属造型用的离刻度装饰值，保留字面量。
.tab-indicator {
  border-radius: var(--tjg-radius-sheet) 42px var(--tjg-radius-xs) var(--tjg-radius-sheet);
}

// tab 使用原生 button：清掉浏览器默认外观，仅保留焦点环（键盘用户可见）
.login-tab {
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  color: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 4px;
    border-radius: var(--tjg-radius-xs);
  }
}
</style>
