<template>
  <n-config-provider :theme="naiveTheme" data-tauri-drag-region class="login-box size-full rounded-8px select-none">
    <ActionBar :max-w="false" :shrink="false" proxy />

    <ManualLoginForm
      v-if="uiState === 'manual'"
      v-model:login-info="loginInfo"
      v-model:protocol="protocol"
      :loading="loading"
      :login-disabled="loginDisabled"
      :login-text="loginText"
      :login-status="loginStatus"
      :last-login-error="lastLoginError"
      @login="normalLogin('PC', true, false)"
      @retry="retryLogin"
      @open-service-agreement="openServiceAgreement"
      @open-privacy-agreement="openPrivacyAgreement" />

    <AutoLoginForm
      v-else-if="uiState === 'auto'"
      :loading="loading"
      :login-disabled="loginDisabled"
      :login-text="loginText"
      :user-info="userStore.userInfo"
      @login="triggerAutoLogin" />

    <div v-if="uiState !== 'auto'" class="w-full pb-22px pt-3px">
      <ThirdPartyLogin :login-context="loginContext" />
    </div>

    <LoginBottomBar
      :mode="uiState"
      @switch-to-qr="router.push('/qrCode')"
      @cancel-auto-login="cancelAutoLoginAndShowManual"
      @remove-account="removeStoredAccount"
      @open-register="router.push('/register')"
      @open-forget-password="createWebviewWindow(t('login.option.items.forget'), 'forgetPassword', 600, 600)"
      @open-server-config="showServerConfig = true" />

    <ServerConfigModal
      v-model:show="showServerConfig"
      v-model:homeserver-url="homeserverUrl"
      v-model:identity-server-url="identityServerUrl" />
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme, lightTheme } from 'naive-ui'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindow } from '@/composables/common/useWindow'
import router from '@/router'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import AutoLoginForm from './AutoLoginForm.vue'
import LoginBottomBar from './LoginBottomBar.vue'
import ManualLoginForm from './ManualLoginForm.vue'
import ServerConfigModal from './ServerConfigModal.vue'
import ThirdPartyLogin, { type ThirdPartyLoginContext } from './ThirdPartyLogin.vue'
import { useLoginOrchestrator } from './useLoginOrchestrator'

const { t } = useI18n()
const settingStore = useSettingStore()
const userStore = useUserStore()
const naiveTheme = computed(() => (settingStore.themeContent === 'dark' ? darkTheme : lightTheme))
const { createWebviewWindow } = useWindow()

const {
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
  triggerAutoLogin,
  cancelAutoLoginAndShowManual,
  removeStoredAccount,
  openServiceAgreement,
  openPrivacyAgreement,
  init,
  mount,
  cleanup
} = useLoginOrchestrator()

const loginContext: ThirdPartyLoginContext = {
  homeserverUrl: homeserverUrl as Ref<string>,
  identityServerUrl: identityServerUrl as Ref<string>,
  loading,
  loginDisabled
}

onBeforeMount(async () => {
  await init()
})

onMounted(async () => {
  await mount()
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
@use '@/styles/scss/login';
</style>
