<template>
  <MobileLayout>
    <div class="h-full flex flex-col">
      <!-- 页面全部内容 -->
      <div class="flex flex-col flex-1">
        <RouterView v-slot="{ Component }">
          <div class="page-view">
            <component :is="Component" :key="route.fullPath" />
          </div>
        </RouterView>
      </div>
    </div>
  </MobileLayout>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import router from '@/router'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'
import { hasOwn } from '@/utils/webCompat'

const logger = createLogger('MyLayout')
const timerManager = useTimerManager()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

interface ScanData {
  type: string // 必须有
  [key: string]: unknown // 允许有其他任意字段
}

/**
 * 处理扫码登录 — MSC4108 协议
 *
 * 桌面端（新设备）通过 `matrixQrLoginSdkService.generateQrCodeAsNewDevice()`
 * 生成 base64 编码的 MSC4108 二维码。手机端扫描后，二维码内容为 base64 字符串。
 * 扫码器将其作为 `qrData` 字段传入，本函数将其透传到 ConfirmQRLogin 页面，
 * 由该页面调用 `matrixQrLoginSdkService.scanQrCode()` 建立安全通道。
 */
const handleScanLogin = async (data: ScanData) => {
  // MSC4108 flow: scanned QR is a base64 string passed as `qrData`
  const qrData = data.qrData as string
  if (!qrData || typeof qrData !== 'string') {
    showFeedback(t('mobile_qrcode.invalid_login_qr'), 'warning')
    throw new Error(`MSC4108 QR data missing or invalid: ${JSON.stringify(data)}`)
  }

  router.push({
    name: 'mobileConfirmQRLogin',
    query: { qr_data: qrData }
  })
}

const globalStore = useGlobalStore()
const userStore = useUserStore()

const handleScanAddFriend = async (data: ScanData) => {
  logger.debug('QR scan intent: add friend')
  if (!hasOwn(data, 'uid')) {
    showFeedback(t('mobile_qrcode.qr_no_uid'), 'warning')
    throw new Error(`Login QR data missing uid: ${JSON.stringify(data)}`)
  }

  const uidStr = data.uid as string
  const uid = uidStr.split('&')[0]

  // 判断uid是不是自己的

  const selfUid = userStore.userInfo?.uid as string

  if (selfUid === uid) {
    showFeedback(t('mobile_qrcode.cannot_add_self'), 'warning')
    throw new Error(`Refused to add self as friend: ${JSON.stringify(data)}`)
  }

  globalStore.setAddFriendTarget(uid)

  timerManager.setTimeout(() => {
    router.push({ name: 'mobileConfirmAddFriend' })
  }, 100)
}

/**
 * 扫码进群
 */
const handleScanEnterGroup = async (data: ScanData) => {
  logger.debug('QR scan intent: join group', data, hasOwn(data, 'roomId'))
  if (!hasOwn(data, 'roomId')) {
    showFeedback(t('mobile_qrcode.group_qr_no_roomId'), 'warning')
    throw new Error(`Group QR data missing roomId: ${JSON.stringify(data)}`)
  }

  const roomId = data.roomId as string

  // 可能是扫码出来的
  const groupStore = useGroupStore()
  const groupDetail = await groupStore.loadGroupInfo(roomId)

  globalStore.setAddGroupTarget({
    account: roomId,
    name: groupDetail?.name || roomId,
    avatar: groupDetail?.avatar || ''
  })

  timerManager.setTimeout(() => {
    router.push({ name: 'mobileConfirmAddGroup' })
  }, 100)
}

/**
 * 监听事件扫码
 */
useMitt.on(MittEnum.QR_SCAN_EVENT, async (data: ScanData) => {
  if (!hasOwn(data, 'type')) {
    showFeedback(t('mobile_qrcode.invalid_qr_code'), 'warning')
    throw new Error(`QR data missing type field: ${JSON.stringify(data)}`)
  }

  switch (data.type) {
    case 'login':
      try {
        await handleScanLogin(data)
      } catch (error) {
        logger.debug('QR scan login failed:', error)
      }
      break
    case 'addFriend':
      try {
        await handleScanAddFriend(data)
      } catch (error) {
        logger.debug('QR scan add friend failed:', error)
      }
      break
    case 'scanEnterGroup':
      try {
        await handleScanEnterGroup(data)
      } catch (error) {
        logger.debug('QR scan join group failed:', error)
      }
      break
    default:
      showFeedback(t('mobile_qrcode.invalid_qr_code'), 'warning')
      throw new Error(`QR data missing type field: ${JSON.stringify(data)}`)
  }
})

const route = useRoute()
</script>
