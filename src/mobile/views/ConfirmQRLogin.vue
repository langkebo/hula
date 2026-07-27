<template>
  <div class="h-full flex flex-col bg-gray-100">
    <!-- 页面全部内容 -->
    <div class="flex flex-col flex-1 items-center px-15px">
      <div class="flex flex-col w-full flex-1 flex-col rounded-15px bg-white pt-15% items-center gap-20px">
        <div class="flex flex-col items-center gap-15px">
          <img class="w-100px h-100px" :src="qrCodeIcon" alt="二维码" />
          <div class="text-20px font-bold text-[--hula-text-primary]">
            登录
            <span class="text-[--hula-color-primary-500]">{{ serverName || 'HULA' }}</span>
            &nbsp;的HULA
          </div>
          <div v-if="checkCode" class="text-14px text-[--hula-text-tertiary]">
            校验码:
            <span class="font-mono font-bold text-[--hula-color-primary-500]">{{ checkCode }}</span>
          </div>
        </div>

        <div class="w-80% h-1px bg-gray-100"></div>

        <div class="flex flex-col w-80% gap-20px mt-10px">
          <div class="flex justify-between w-full">
            <span>服务器</span>
            <span>{{ serverName || '-' }}</span>
          </div>
          <div class="flex justify-between">
            <span>登录时间</span>
            <span>{{ nowFormatted }}</span>
          </div>
          <div class="flex justify-between">
            <span>状态</span>
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
                ? '确认中...'
                : countdown > 0
                  ? t('mobile_qrcode.login_countdown', { countdown: countdown })
                  : t('mobile_qrcode.qr_code_expired_btn')
            }}
          </van-button>
          <van-button :disabled="reciprocating" @click="handleDecline" type="default" class="px-30px">取消</van-button>
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
  if (scanError.value) return '扫码失败'
  if (reciprocating.value) return '确认中'
  if (serverName.value) return '已连接'
  if (scanning.value) return '连接中'
  return '等待连接'
})

// Subscribe to MSC4108 status changes for UI updates.
matrixQrLoginSdkService.onStatusChange((status: QrLoginStatus, detail?: string) => {
  if (status === 'failed') {
    scanError.value = detail || '连接失败'
    reciprocating.value = false
  } else if (status === 'success') {
    reciprocating.value = false
  }
})

/** 扫码并建立 MSC4108 安全通道 */
const scanAndConnect = async () => {
  if (!props.qrData) {
    scanError.value = '未收到二维码数据'
    return
  }

  scanning.value = true
  try {
    const sessionInfo: ScannedSessionInfo = await matrixQrLoginSdkService.scanQrCode(props.qrData)
    serverName.value = sessionInfo.serverName ?? ''
    checkCode.value = sessionInfo.checkCode ?? ''
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('MSC4108 扫码失败:', error)
    scanError.value = `扫码失败: ${msg}`
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
    logger.error('MSC4108 确认登录出错:', error)
    scanError.value = `确认登录失败: ${msg}`
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
