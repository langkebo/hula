<template>
  <n-config-provider :theme="naiveTheme" data-tauri-drag-region class="login-box size-full rounded-8px select-none">
    <!--顶部操作栏-->
    <ActionBar :max-w="false" :shrink="false" proxy data-tauri-drag-region />

    <n-flex justify="center" class="mt-15px" data-tauri-drag-region>
      <img src="/hula.png" class="w-100px h-40px drop-shadow-xl" alt="" data-tauri-drag-region />
    </n-flex>

    <!-- 二维码 -->
    <n-flex justify="center" class="mt-15px" data-tauri-drag-region>
      <n-skeleton v-if="loading" style="border-radius: 12px" :width="204" :height="204" :sharp="false" size="medium" />
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
          <span class="text-(14px #e3e3e3)">{{ scanStatusText }}</span>
        </n-flex>

        <n-flex
          v-if="refreshing"
          vertical
          :size="12"
          align="center"
          class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          style="pointer-events: none">
          <n-spin size="small" />
          <span class="text-(16px #e3e3e3)">{{ t('login.qr.overlay.refreshing') }}</span>
        </n-flex>
      </div>
    </n-flex>

    <n-flex justify="center" class="mt-15px text-(14px #808080)">
      {{ loadText }}
    </n-flex>

    <!-- 第三方登录 -->
    <div class="w-full pb-22px pt-14px">
      <ThirdPartyLogin :extra-disabled="thirdPartyExtraDisabled" :login-context="loginContext" />
    </div>

    <!-- 底部操作栏 -->
    <n-flex justify="center" class="text-14px" data-tauri-drag-region>
      <div class="color-#13987f cursor-pointer" @click="router.push('/login')">
        {{ t('login.qr.actions.account_login') }}
      </div>
      <div class="w-1px h-14px bg-#ccc dark:bg-#707070"></div>
      <div
        class="color-#13987f cursor-pointer"
        @click="createWebviewWindow(t('login.qr.actions.register_title'), 'register', 600, 600)">
        {{ t('login.qr.actions.register') }}
      </div>
    </n-flex>
  </n-config-provider>
</template>
<script setup lang="ts">
import { darkTheme, lightTheme } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

const logger = createLogger('QRCode')

import { TauriCommand } from '@/enums'
import { useLoginFlow } from '@/hooks/useLoginFlow'
import { useWindow } from '@/hooks/useWindow.ts'
import router from '@/router'
import { saveMatrixSessionEndpointConfig } from '@/services/backend/config'
import { getEnhancedFingerprint } from '@/services/fingerprint'
import {
  matrixQrLoginBridgeService,
  type QrCodeResult,
  type QrLoginStatusResult
} from '@/services/matrix/auth/MatrixQrLoginBridgeService'
import { matrixQrLoginService, type QRLoginResult } from '@/services/matrix/auth/MatrixQrLoginService'
import { loginCommand } from '@/services/tauriCommand'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useTimerManager } from '@/utils/TimerManager'
import ThirdPartyLogin, { type ThirdPartyLoginContext } from './ThirdPartyLogin.vue'

const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const naiveTheme = computed(() => (settingStore.themeContent === 'dark' ? darkTheme : lightTheme))
const { createWebviewWindow } = useWindow()
const { isTrayMenuShow } = storeToRefs(globalStore)
const { t } = useI18n()
type LoadTextKey = 'loading' | 'refreshing' | 'scan_hint' | 'login' | 'retry' | 'auth_pending'
type ScanStatusTextKey = 'success' | 'error' | 'auth' | 'expired' | 'fetch_failed' | 'generate_fail' | 'general_error'
const loadTextKey = ref<LoadTextKey>('loading')
const loadText = computed(() => t(`login.qr.load_text.${loadTextKey.value}`))
const loading = ref(true)
const refreshing = ref(false) // 是否正在刷新
const qrCodeValue = ref('')
const qrCodeResp = ref()
const bridgeQrData = ref<QrCodeResult | null>(null)
const useBridge = ref(false)
const qrCodeColor = ref('#000000')
const qrCodeBgColor = ref('#FFFFFF')
const qrCodeType = ref('canvas' as const)
const qrCodeIcon = ref('/logo.png')
const qrErrorCorrectionLevel = ref('H' as const)
const timerManager = useTimerManager()
const pollInterval = ref<number | null>(null)
const pollStartAt = ref<number | null>(null)
const MAX_POLL_DURATION = 5 * 60 * 1000 // 5分钟超时，防止长时间占用内存
const pollingRequesting = ref(false)
const confirmedHandled = ref(false)

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

  // 先清除之前的轮询
  if (pollInterval.value) {
    clearInterval(pollInterval.value)
    pollInterval.value = null
  }
  pollStartAt.value = null
  pollingRequesting.value = false
  confirmedHandled.value = false
  // 重新生成二维码
  handleQRCodeLogin()
}

const clearPolling = () => {
  if (pollInterval.value) {
    timerManager.clearInterval(pollInterval.value)
    pollInterval.value = null
  }
  pollStartAt.value = null
}

const handleConfirmed = async (res: QRLoginResult) => {
  if (confirmedHandled.value) {
    return
  }
  confirmedHandled.value = true
  clearPolling()
  try {
    if (!res.data) {
      throw new Error('missing data in QR login result')
    }
    await invokeWithErrorHandler(TauriCommand.UPDATE_TOKEN, {
      req: {
        uid: res.data.uid,
        token: res.data.token,
        refreshToken: res.data.refreshToken || ''
      }
    })

    if (res.data.homeserverUrl) {
      saveMatrixSessionEndpointConfig({
        homeserverUrl: res.data.homeserverUrl,
        identityServerUrl: res.data.identityServerUrl || ''
      })
    }

    await loginCommand({ uid: res.data.uid }).then(() => {
      scanStatus.value = {
        status: 'success',
        icon: 'success',
        textKey: 'success',
        show: true
      }
      loadTextKey.value = 'login'
    })
  } catch (error) {
    logger.error('获取用户详情失败:', error)
    confirmedHandled.value = false
    handleError('fetch_failed')
  }
}

const startPolling = () => {
  if (pollInterval.value) {
    timerManager.clearInterval(pollInterval.value)
  }
  pollStartAt.value = Date.now()
  pollInterval.value = timerManager.setInterval(async () => {
    if (pollStartAt.value && Date.now() - pollStartAt.value > MAX_POLL_DURATION) {
      clearPolling()
      handleError('expired')
      return
    }

    if (pollingRequesting.value || confirmedHandled.value) {
      return
    }
    pollingRequesting.value = true
    try {
      if (useBridge.value && bridgeQrData.value) {
        const res = await matrixQrLoginBridgeService.getQrStatus(bridgeQrData.value.transactionId)
        switch (res.status) {
          case 'pending':
            break
          case 'confirmed':
            await handleBridgeConfirmed(res)
            break
          case 'expired':
          case 'invalidated':
            clearPolling()
            handleError('expired')
            break
          default:
            break
        }
      } else {
        const res = await matrixQrLoginService.checkStatus()
        if (!res) {
          return
        }
        switch (res.status) {
          case 'PENDING':
            break
          case 'SCANNED':
            handleAuth()
            break
          case 'CONFIRMED':
            await handleConfirmed(res)
            break
          case 'EXPIRED':
            clearPolling()
            handleError('expired')
            break
          default:
            break
        }
      }
    } catch (error) {
      if (!confirmedHandled.value) {
        handleQRCodeLogin()
      }
    } finally {
      if (!confirmedHandled.value) {
        pollingRequesting.value = false
      }
    }
  }, 2000)
}

/** 处理二维码显示和刷新 */
const handleQRCodeLogin = async () => {
  try {
    // 优先尝试 Bridge Service（SDK 后端交互）
    try {
      const qrResult = await matrixQrLoginBridgeService.getQrCode()
      await matrixQrLoginBridgeService.startQrLogin(qrResult.transactionId)
      bridgeQrData.value = qrResult
      useBridge.value = true
      qrCodeValue.value = JSON.stringify({
        type: 'login',
        transactionId: qrResult.transactionId,
        challenge: qrResult.challenge
      })
    } catch {
      // Bridge 不可用时降级到 localStorage 模式
      useBridge.value = false
      bridgeQrData.value = null
      qrCodeResp.value = await matrixQrLoginService.generateQR()
      qrCodeValue.value = JSON.stringify({ type: 'login', qrId: qrCodeResp.value.qrId })
    }

    loadTextKey.value = 'scan_hint'
    loading.value = false
    refreshing.value = false

    if (scanStatus.value.show) {
      scanStatus.value.show = false
      scanStatus.value.textKey = ''
    }

    // 启动轮询
    confirmedHandled.value = false
    pollingRequesting.value = false
    startPolling()
  } catch (error) {
    handleError('generate_fail')
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
  // 组件卸载时清除轮询
  clearPolling()
})

/** Bridge Service 确认处理 */
const handleBridgeConfirmed = async (res: QrLoginStatusResult) => {
  if (confirmedHandled.value) {
    return
  }
  confirmedHandled.value = true
  clearPolling()
  try {
    if (!res.userId) {
      throw new Error('missing userId in QR login result')
    }

    const uid = res.userId
    await loginCommand({ uid }).then(() => {
      scanStatus.value = {
        status: 'success',
        icon: 'success',
        textKey: 'success',
        show: true
      }
      loadTextKey.value = 'login'
    })
  } catch (error) {
    logger.error('Bridge QR 登录失败:', error)
    confirmedHandled.value = false
    handleError('fetch_failed')
  }
}

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
