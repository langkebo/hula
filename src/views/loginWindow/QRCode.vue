<template>
  <n-config-provider :theme="naiveTheme" data-tauri-drag-region class="login-box size-full rounded-8px select-none">
    <!--顶部操作栏-->
    <ActionBar :max-w="false" :shrink="false" proxy data-tauri-drag-region />

    <n-flex justify="center" class="mt-15px" data-tauri-drag-region>
      <img src="/tjg.png" class="w-100px h-40px drop-shadow-xl" alt="Tjg" data-tauri-drag-region />
    </n-flex>

    <!-- 登录模式切换 -->
    <n-flex justify="center" class="mt-12px" data-tauri-drag-region>
      <n-button-group size="small">
        <n-button :type="loginMode === 'quick' ? 'primary' : 'default'" @click="loginMode = 'quick'">
          {{ t('login.qr.mode.quick') }}
        </n-button>
        <n-button :type="loginMode === 'rendezvous' ? 'primary' : 'default'" @click="loginMode = 'rendezvous'">
          {{ t('login.qr.mode.rendezvous') }}
        </n-button>
      </n-button-group>
    </n-flex>

    <!-- 快速登录 - 原有二维码 -->
    <template v-if="loginMode === 'quick'">
      <!-- 二维码 -->
      <n-flex justify="center" class="mt-15px" data-tauri-drag-region>
        <n-skeleton
          v-if="loading"
          style="border-radius: 12px"
          :width="204"
          :height="204"
          :sharp="false"
          size="medium" />
        <div v-else class="relative">
          <n-qr-code
            :size="180"
            class="rounded-12px"
            :class="{ blur: scanStatus.show || refreshing }"
            :value="qrCodeValue"
            :color="qrCodeColor"
            :bg-color="qrCodeBgColor"
            :type="qrCodeType"
            :icon-src="qrCodeIcon"
            :icon-size="36"
            :icon-margin="2"
            :error-correction-level="qrErrorCorrectionLevel"
            @click="refreshQRCode" />
          <!-- 二维码状态 -->
          <n-flex
            v-if="scanStatus.show"
            vertical
            :size="12"
            align="center"
            class="w-full absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style="pointer-events: none">
            <svg class="size-42px animate-pulse">
              <use :href="`#${scanStatus.icon}`"></use>
            </svg>
            <span class="text-(14px [--tjg-text-quaternary])">{{ scanStatusText }}</span>
          </n-flex>

          <n-flex
            v-if="refreshing"
            vertical
            :size="12"
            align="center"
            class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
            style="pointer-events: none">
            <n-spin size="small" />
            <span class="text-(16px [--tjg-text-quaternary])">{{ t('login.qr.overlay.refreshing') }}</span>
          </n-flex>
        </div>
      </n-flex>

      <n-flex justify="center" class="mt-15px text-(14px [--tjg-text-tertiary])">
        {{ loadText }}
      </n-flex>
    </template>

    <!-- Rendezvous 登录 - MSC3886 -->
    <template v-else>
      <n-flex justify="center" class="mt-15px" data-tauri-drag-region>
        <div class="text-center">
          <div
            class="mb-12px text-[var(--tjg-color-primary-500)] bg-[var(--tjg-surface-search)] p-16px rounded-full inline-flex">
            <Icon icon="mdi:qrcode-plus" :width="48" />
          </div>
          <p class="text-(14px [--tjg-text-tertiary])">{{ t('login.qr.rendezvous_hint') }}</p>
          <n-button type="primary" class="mt-12px" @click="showRendezvousManager = true">
            {{ t('login.qr.open_rendezvous') }}
          </n-button>
        </div>
      </n-flex>
    </template>

    <!-- 第三方登录 -->
    <div class="w-full pb-22px pt-14px">
      <ThirdPartyLogin :extra-disabled="thirdPartyExtraDisabled" :login-context="loginContext" />
    </div>

    <!-- 底部操作栏 -->
    <n-flex justify="center" class="text-14px" data-tauri-drag-region>
      <div class="color-[--tjg-color-primary-500] cursor-pointer" @click="router.push('/login')">
        {{ t('login.qr.actions.account_login') }}
      </div>
      <div class="w-1px h-14px bg-[--login-divider-color]"></div>
      <div
        class="color-[--tjg-color-primary-500] cursor-pointer"
        @click="createWebviewWindow(t('login.qr.actions.register_title'), 'register', 600, 600)">
        {{ t('login.qr.actions.register') }}
      </div>
    </n-flex>

    <!-- Rendezvous 会话管理弹窗 -->
    <RendezvousSessionManager v-model:show="showRendezvousManager" />
  </n-config-provider>
</template>
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { darkTheme, lightTheme } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import RendezvousSessionManager from '@/components/rendezvous/RendezvousSessionManager.vue'
import { createLogger } from '@/utils/Logger'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

const logger = createLogger('QRCode')

import { useWindow } from '@/composables/common/useWindow'
import { TauriCommand } from '@/enums'
import router from '@/router'
import { resolveMatrixRuntimeEndpointConfig, saveMatrixSessionEndpointConfig } from '@/services/backend/config'
import { loginCommand } from '@/services/backend/tauriCommand'
import {
  matrixQrLoginSdkService,
  type NewDeviceLoginResult,
  type QrLoginStatus
} from '@/services/matrix/auth/MatrixQrLoginSdkService'
import { getEnhancedFingerprint } from '@/services/secure/fingerprint'
import { useLoginFlow } from '@/shared/composables/useLoginFlow'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import ThirdPartyLogin, { type ThirdPartyLoginContext } from './ThirdPartyLogin.vue'

const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const naiveTheme = computed(() => (settingStore.themeContent === 'dark' ? darkTheme : lightTheme))
const { createWebviewWindow } = useWindow()
const { isTrayMenuShow } = storeToRefs(globalStore)
const { t } = useI18n()
type LoadTextKey = 'loading' | 'refreshing' | 'scan_hint' | 'login' | 'retry' | 'auth_pending'
type ScanStatusTextKey = 'success' | 'error' | 'auth' | 'expired' | 'fetch_failed' | 'generate_fail' | 'general_error'
const loginMode = ref<'quick' | 'rendezvous'>('quick')
const showRendezvousManager = ref(false)
const loadTextKey = ref<LoadTextKey>('loading')
const loadText = computed(() => t(`login.qr.load_text.${loadTextKey.value}`))
const loading = ref(true)
const refreshing = ref(false) // 是否正在刷新
const qrCodeValue = ref('')
const qrCodeColor = ref('var(--tjg-text-primary)')
const qrCodeBgColor = ref('var(--tjg-surface-panel)')
const qrCodeType = ref('canvas' as const)
const qrCodeIcon = ref('/logo.png')
const qrErrorCorrectionLevel = ref('H' as const)
const confirmedHandled = ref(false)
/** Active reciprocation task — awaited to detect login completion. */
let loginTask: Promise<NewDeviceLoginResult> | null = null

const scanStatus = ref<{
  status: 'error' | 'success' | 'auth'
  icon: 'cloudError' | 'success' | 'Security'
  textKey: ScanStatusTextKey | ''
  show: boolean
}>({ status: 'success', icon: 'success', textKey: '', show: false })

const scanStatusText = computed(() =>
  scanStatus.value.textKey ? t(`login.qr.overlay.${scanStatus.value.textKey}`) : ''
)

const { loading: loginLoading, loginDisabled } = useLoginFlow()
const loginContext: ThirdPartyLoginContext = {
  loading: loginLoading,
  loginDisabled
}
const thirdPartyExtraDisabled = computed(() => loading.value)

// Subscribe to MSC4108 status changes for UI updates.
matrixQrLoginSdkService.onStatusChange((status: QrLoginStatus) => {
  if (confirmedHandled.value) return
  switch (status) {
    case 'waiting_scan':
      loadTextKey.value = 'scan_hint'
      loading.value = false
      refreshing.value = false
      break
    case 'waiting_confirm':
      handleAuth()
      break
    case 'success':
      // handled by handleConfirmed() after the Promise resolves
      break
    case 'expired':
      handleError('expired')
      break
    case 'failed':
      handleError('general_error')
      break
    case 'cancelled':
      handleError('general_error')
      break
    default:
      break
  }
})

/** 刷新二维码 */
const refreshQRCode = () => {
  if (scanStatus.value.status !== 'error' && scanStatus.value.status !== 'auth') {
    return
  }

  refreshing.value = true
  loadTextKey.value = 'refreshing'

  scanStatus.value = {
    status: 'success',
    icon: 'success',
    textKey: '',
    show: false
  }

  confirmedHandled.value = false
  // 重新生成二维码
  handleQRCodeLogin()
}

const handleConfirmed = async (result: NewDeviceLoginResult) => {
  if (confirmedHandled.value) {
    return
  }
  confirmedHandled.value = true
  try {
    await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
      req: {
        uid: result.user_id,
        token: result.access_token,
        refreshToken: result.refresh_token || ''
      }
    })

    saveMatrixSessionEndpointConfig({
      homeserverUrl: result.homeserver_url,
      identityServerUrl: ''
    })

    await loginCommand({ uid: result.user_id }).then(() => {
      scanStatus.value = {
        status: 'success',
        icon: 'success',
        textKey: 'success',
        show: true
      }
      loadTextKey.value = 'login'
    })
  } catch (error) {
    logger.error('QR 登录失败:', error)
    confirmedHandled.value = false
    handleError('fetch_failed')
  }
}

/** 处理二维码显示和刷新 — MSC4108 Login 模式 */
const handleQRCodeLogin = async () => {
  try {
    const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
    if (!homeserverUrl) {
      throw new Error('Homeserver URL not configured')
    }

    // Step 1-3: Generate QR code via MSC4108 (new device / Login mode).
    const qrData = await matrixQrLoginSdkService.generateQrCodeAsNewDevice(homeserverUrl)
    qrCodeValue.value = qrData.qrCodeBase64

    loadTextKey.value = 'scan_hint'
    loading.value = false
    refreshing.value = false

    if (scanStatus.value.show) {
      scanStatus.value.show = false
      scanStatus.value.textKey = ''
    }

    // Step 5-17: Wait for existing device to scan + reciprocate.
    // This Promise resolves on successful login; intermediate UI updates
    // arrive via the status listener registered above.
    loginTask = matrixQrLoginSdkService.waitForReciprocationAndLogin('Tjg Desktop')
    const result = await loginTask
    await handleConfirmed(result)
  } catch (error) {
    if (scanStatus.value.status !== 'auth') {
      handleError('generate_fail')
    }
  }
}

/** 处理失败场景 */
const handleError = (key: ScanStatusTextKey = 'general_error') => {
  loading.value = false
  scanStatus.value = {
    status: 'error',
    icon: 'cloudError',
    textKey: key,
    show: true
  }
  loadTextKey.value = 'retry'
}

onUnmounted(() => {
  // Cancel any in-flight MSC4108 session when the component unmounts.
  matrixQrLoginSdkService.cancel().catch((err) => {
    logger.warn('Failed to cancel MSC4108 session on unmount', err)
  })
})

/** 处理授权场景 */
const handleAuth = () => {
  loading.value = false
  scanStatus.value = {
    status: 'auth',
    icon: 'Security',
    textKey: 'auth',
    show: true
  }
  loadTextKey.value = 'auth_pending'
}

onMounted(async () => {
  isTrayMenuShow.value = false
  // 存储此次登陆设备指纹
  const clientId = await getEnhancedFingerprint()
  localStorage.setItem('clientId', clientId)

  handleQRCodeLogin()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/global/login-bg';
</style>
