<template>
  <n-config-provider :theme="naiveTheme">
    <div
      data-tauri-drag-region
      class="login-box rounded-8px select-none flex flex-col"
      style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; box-sizing: border-box">
      <ActionBar :max-w="false" :shrink="false" proxy class="shrink-0" />

      <div
        class="flex flex-col"
        style="flex: 1 1 0%; min-height: 0; box-sizing: border-box; padding: 20px 32px; overflow: hidden">
        <ManualLoginForm
          v-if="uiState === 'manual'"
          style="width: 100%"
          v-model:login-info="loginInfo"
          v-model:protocol="protocol"
          v-model:homeserver-url="homeserverUrl"
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

        <div v-if="uiState !== 'auto'" class="w-full flex justify-center shrink-0" style="margin-top: 18px">
          <ThirdPartyLogin :login-context="loginContext" />
        </div>

        <LoginBottomBar
          class="shrink-0 w-full"
          style="margin-top: 18px"
          :mode="uiState"
          @switch-to-qr="router.push('/qrCode')"
          @cancel-auto-login="cancelAutoLoginAndShowManual"
          @remove-account="removeStoredAccount"
          @open-register="router.push('/register')"
          @open-forget-password="createWebviewWindow(t('login.option.items.forget'), 'forgetPassword', 600, 600)"
          @open-server-config="showServerConfig = true" />
      </div>

      <ServerConfigModal
        v-model:show="showServerConfig"
        v-model:homeserver-url="homeserverUrl"
        v-model:identity-server-url="identityServerUrl" />
    </div>
  </n-config-provider>
</template>

<script setup lang="ts">
import { LogicalSize } from '@tauri-apps/api/dpi'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { darkTheme, lightTheme } from 'naive-ui'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWindow } from '@/composables/common/useWindow'
import router from '@/router'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStore } from '@/stores/domains/user/user'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'
import { isDesktop } from '@/utils/PlatformConstants'
import AutoLoginForm from './AutoLoginForm.vue'
import LoginBottomBar from './LoginBottomBar.vue'
import ManualLoginForm from './ManualLoginForm.vue'
import ServerConfigModal from './ServerConfigModal.vue'
import ThirdPartyLogin, { type ThirdPartyLoginContext } from './ThirdPartyLogin.vue'
import { useLoginOrchestrator } from './useLoginOrchestrator'

const logger = createLogger('Login')
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
  // 显式设置窗口尺寸为 420x580（按原型 TJG-prototype.html），覆盖 tauri-plugin-window-state 恢复的旧尺寸
  if (isDesktop() && hasTauriRuntime()) {
    try {
      const win = getCurrentWindow()
      await win.setSize(new LogicalSize(420, 580))
    } catch (e) {
      logger.warn('设置窗口尺寸失败:', e)
    }
  }
})

onUnmounted(() => {
  cleanup()
})
</script>

<style lang="scss">
@use '@/styles/scss/global/login-bg';
@use '@/styles/scss/login';
</style>
