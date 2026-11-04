<template>
  <div class="h-full flex flex-col bg-gray-100">
    <!-- 页面全部内容 -->
    <div class="flex flex-col flex-1 items-center px-15px">
      <div class="flex flex-col w-full flex-1 flex-col rounded-15px bg-white pt-15% items-center gap-20px">
        <div class="flex flex-col items-center gap-15px">
          <img class="w-100px h-100px" :src="qrCodeIcon" :alt="t('login.qr.qr_code_alt')" />
          <div class="text-20px font-bold text-[--tjg-text-primary]">
            {{ t('login.qr.confirm_title', { server: serverName || t('login.qr.confirm_default_server') }) }}
          </div>
          <div v-if="checkCode" class="text-14px text-[--tjg-text-tertiary]">
            {{ t('login.qr.check_code') }}:
            <span class="font-mono font-bold text-[--tjg-color-primary-500]">{{ checkCode }}</span>
          </div>
        </div>

        <div class="w-80% h-1px bg-gray-100"></div>

        <div class="flex flex-col w-80% gap-20px mt-10px">
          <div class="flex justify-between w-full">
            <span>{{ t('login.qr.server') }}</span>
            <span>{{ serverName || '-' }}</span>
          </div>
          <div class="flex justify-between">
            <span>{{ t('login.qr.login_time') }}</span>
            <span>{{ nowFormatted }}</span>
          </div>
          <div class="flex justify-between">
            <span>{{ t('login.qr.status') }}</span>
            <span>{{ statusText }}</span>
          </div>
        </div>

        <div class="w-80% h-1px bg-gray-100 mt-10px"></div>

        <!-- 状态提示 -->
        <div v-if="scanError" class="text-14px text-red-500 px-20px text-center">
          {{ scanError }}
        </div>

        <!-- 登录按钮，带倒计时 -->
        <div class="flex gap-15px absolute bottom-20%">
          <van-button
            :disabled="countdown <= 0 || scanning || reciprocating"
            @click="handleConfirmLogin"
            type="primary"
            class="px-50px">
            {{
              reciprocating
                ? t('login.qr.confirming')
                : countdown > 0
                  ? t('mobile_qrcode.login_countdown', { countdown: countdown })
                  : t('mobile_qrcode.qr_code_expired_btn')
            }}
          </van-button>
          <van-button :disabled="reciprocating" @click="handleDecline" type="default" class="px-30px">
            {{ t('common.cancel') }}
          </van-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import router from '@/router'
import {
  matrixQrLoginSdkService,
  type QrLoginStatus,
  type ScannedSessionInfo
} from '@/services/matrix/auth/MatrixQrLoginSdkService'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const { t } = useI18n()
const logger = createLogger('ConfirmQRLogin')
const timerManager = useTimerManager()

const now = ref(dayjs())
const nowFormatted = computed(() => now.value.format('YYYY-MM-DD HH:mm:ss'))

// 倒计时 (MSC4108 session TTL — matches backend rendezvous_session.expires_at)
const SESSION_TTL_SECONDS = 300 // 5 minutes
const countdown = ref(SESSION_TTL_SECONDS)
let timer: number | null = null

const props = defineProps<{
  /** Base64-encoded MSC4108 QR code data (from desktop's generateQrCodeAsNewDevice). */
  qrData: string
}>()

const qrCodeIcon = ref('/logo.png')
const serverName = ref<string>('')
const checkCode = ref<string>('')
const scanning = ref(false)
const reciprocating = ref(false)
const scanError = ref<string>('')

const statusText = computed(() => {
  if (scanError.value) return t('login.qr.status_scan_failed')
  if (reciprocating.value) return t('login.qr.status_confirming')
  if (serverName.value) return t('login.qr.status_connected')
  if (scanning.value) return t('login.qr.status_connecting')
  return t('login.qr.status_waiting')
})

// Subscribe to MSC4108 status changes for UI updates.
matrixQrLoginSdkService.onStatusChange((status: QrLoginStatus, detail?: string) => {
  if (status === 'failed') {
    scanError.value = detail || t('login.qr.connect_failed')
    reciprocating.value = false
  } else if (status === 'success') {
    reciprocating.value = false
  }
})

/** 扫码并建立 MSC4108 安全通道 */
const scanAndConnect = async () => {
  if (!props.qrData) {
    scanError.value = t('login.qr.missing_qr_data')
    return
  }

  scanning.value = true
  try {
    const sessionInfo: ScannedSessionInfo = await matrixQrLoginSdkService.scanQrCode(props.qrData)
    serverName.value = sessionInfo.serverName ?? ''
    checkCode.value = sessionInfo.checkCode ?? ''
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('MSC4108 scan failed', error)
    scanError.value = t('login.qr.scan_failed_detail', { msg })
  } finally {
    scanning.value = false
  }
}

const handleConfirmLogin = async () => {
  if (reciprocating.value) return
  reciprocating.value = true
  scanError.value = ''

  try {
    // Existing device generates a short-lived login token and sends it
    // to the new device via the MSC4108 secure channel.
    await matrixQrLoginSdkService.reciprocateLogin()
    router.push('/mobile/message')
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('MSC4108 confirm login failed', error)
    scanError.value = t('login.qr.confirm_failed_detail', { msg })
  } finally {
    reciprocating.value = false
  }
}

const handleDecline = async () => {
  try {
    await matrixQrLoginSdkService.declineLogin()
  } catch (error) {
    logger.warn('MSC4108 decline failed', error)
  } finally {
    router.back()
  }
}

onMounted(async () => {
  // 开启倒计时
  timer = timerManager.setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
    } else {
      if (timer) timerManager.clearInterval(timer)
    }
  }, 1000)

  // 扫码并建立安全通道
  await scanAndConnect()
})

onBeforeUnmount(() => {
  if (timer) timerManager.clearInterval(timer)
  // Cancel any in-flight MSC4108 session when leaving the page.
  matrixQrLoginSdkService.cancel().catch((err) => {
    logger.warn('Failed to cancel MSC4108 session on unmount', err)
  })
})
</script>

<style lang="scss" scoped></style>
