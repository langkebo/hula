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
import { createLogger } from '@/utils/Logger'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import router from '@/router'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { useUserStore } from '@/stores/domains/user/user'
import { useGroupStore } from '@/stores/domains/chat/group'
import { matrixQrLoginService } from '@/services/matrix'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('MyLayout')
const timerManager = useTimerManager()

interface ScanData {
  type: string // 必须有
  [key: string]: unknown // 允许有其他任意字段
}

const handleScanLogin = async (data: ScanData) => {
  if (!Object.hasOwn(data, 'qrId')) {
    window.$message.warning('登录二维码不存在qrId')
    throw new Error(`登录二维码不存在qrId: ${JSON.stringify(data)}`)
  }

  const { qrId } = data

  const qrResult = await matrixQrLoginService.handleScan(qrId as string)
  if (!qrResult) {
    window.$message.warning('登录二维码已失效')
    throw new Error('二维码登录会话不存在或已失效')
  }

  router.push({
    name: 'mobileConfirmQRLogin',
    params: {
      ip: qrResult?.ip || '',
      expireTime: qrResult?.expireTime || '',
      deviceType: qrResult?.deviceType || '',
      locPlace: qrResult?.locPlace || '',
      qrId: qrId as string
    }
  })
}

const globalStore = useGlobalStore()
const userStore = useUserStore()

const handleScanAddFriend = async (data: ScanData) => {
  logger.debug('尝试扫码添加好友')
  if (!Object.hasOwn(data, 'uid')) {
    window.$message.warning('登录二维码不存在uid')
    throw new Error(`登录二维码不存在uid: ${JSON.stringify(data)}`)
  }

  const uidStr = data.uid as string
  const uid = uidStr.split('&')[0]

  // 判断uid是不是自己的

  const selfUid = userStore.userInfo?.uid as string

  if (selfUid === uid) {
    window.$message.warning('不能添加自己为好友哦~', { duration: 4000 })
    throw new Error(`用户尝试扫自己二维码添加好友但被拒绝: ${JSON.stringify(data)}`)
  }

  globalStore.addFriendModalInfo.uid = uid

  timerManager.setTimeout(() => {
    router.push({ name: 'mobileConfirmAddFriend' })
  }, 100)
}

/**
 * 扫码进群
 */
const handleScanEnterGroup = async (data: ScanData) => {
  logger.debug('尝试扫码加群', data, Object.hasOwn(data, 'roomId'))
  if (!Object.hasOwn(data, 'roomId')) {
    window.$message.warning('加群二维码不存在roomId')
    throw new Error(`加群二维码不存在roomId: ${JSON.stringify(data)}`)
  }

  const roomId = data.roomId as string

  // 可能是扫码出来的
  const groupStore = useGroupStore()
  const groupDetail = await groupStore.loadGroupInfo(roomId)

  globalStore.addGroupModalInfo.account = roomId
  globalStore.addGroupModalInfo.name = groupDetail?.name || roomId
  globalStore.addGroupModalInfo.avatar = groupDetail?.avatar || ''

  timerManager.setTimeout(() => {
    router.push({ name: 'mobileConfirmAddGroup' })
  }, 100)
}

/**
 * 监听事件扫码
 */
useMitt.on(MittEnum.QR_SCAN_EVENT, async (data: ScanData) => {
  if (!Object.hasOwn(data, 'type')) {
    window.$message.warning('识别不到正确的二维码')
    throw new Error(`二维码缺少type字段: ${JSON.stringify(data)}`)
  }

  switch (data.type) {
    case 'login':
      try {
        await handleScanLogin(data)
      } catch (error) {
        logger.debug('扫码尝试获取Token失败:', error)
      }
      break
    case 'addFriend':
      try {
        await handleScanAddFriend(data)
      } catch (error) {
        logger.debug('扫码添加好友失败:', error)
      }
      break
    case 'scanEnterGroup':
      try {
        await handleScanEnterGroup(data)
      } catch (error) {
        logger.debug('扫码加入群失败:', error)
      }
      break
    default:
      window.$message.warning('识别不到正确的二维码')
      throw new Error(`二维码缺少type字段: ${JSON.stringify(data)}`)
  }
})

const route = useRoute()
</script>
