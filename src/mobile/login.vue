<template>
  <MobileLayout :backgroundImage="'/login_bg.png'" :safeAreaTop="false" :safeAreaBottom="false">
    <div class="h-full flex-col-center gap-40px">
      <div class="flex-center absolute top-13vh left-36px">
        <p class="text-(20px [--tjg-text-primary])">{{ t('login.mobile.welcome_title') }}</p>
        <img src="@/assets/mobile/2.svg" alt="Tjg" class="w-80px h-20px" />
      </div>

      <!-- 选项卡导航 -->
      <div class="w-80% h-40px absolute top-20vh flex-center">
        <div class="flex w-200px relative">
          <div
            data-testid="tab-login"
            @click="activeTab = 'login'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'login' ? 'text-(18px [--tjg-text-primary])' : 'text-(16px [--tjg-text-secondary])'
            ]">
            {{ t('login.mobile.tabs.login') }}
          </div>
          <div
            @click="activeTab = 'register'"
            :class="[
              'z-999 w-100px text-center transition-all duration-300 ease-out',
              activeTab === 'register' ? 'text-(18px [--tjg-text-primary])' : 'text-(16px [--tjg-text-secondary])'
            ]">
            {{ t('login.mobile.tabs.register') }}
          </div>
          <div
            style="border-radius: 24px 42px 4px 24px"
            :class="[
              'z-10 absolute bottom--4px h-6px w-34px bg-[--tjg-color-primary-500] transition-all duration-300 ease-out',
              activeTab === 'login' ? 'left-[33px]' : 'left-[133px]'
            ]"></div>
        </div>
      </div>

      <!-- 头像 -->
      <img v-if="activeTab === 'login'" :src="userInfo.avatar" alt="logo" class="size-86px rounded-full" />

      <!-- 登录表单 -->
      <MobileLoginForm
        v-if="activeTab === 'login'"
        v-model:protocol="protocol"
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
  selectAccount,
  deleteAccountHistory,
  lastLoginError
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
</style>
