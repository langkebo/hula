import { onMounted, onUnmounted } from 'vue'
import { CallTypeEnum } from '@/enums'
import type { CallInfo } from '@/services/matrix/media/MatrixVoIPService'
import { matrixVoIPService } from '@/services/matrix/media/MatrixVoIPService'
import { createLogger } from '@/utils/Logger'
import { isDesktop } from '@/utils/PlatformConstants'

const logger = createLogger('VoIPIncomingCall')

/**
 * 监听来电事件并创建来电通知窗口（桌面端）或路由跳转（移动端）。
 * 在 App 层级调用一次即可。
 */
export function useVoIPIncomingCall(deps?: {
  createRtcCallWindow?: (
    isIncoming: boolean,
    remoteUserId: string,
    roomId: string,
    callType: CallTypeEnum
  ) => Promise<void>
}) {
  const handleIncomingCall = async (callInfo: CallInfo) => {
    const callerUserId = callInfo.participants?.[0]?.userId ?? ''
    if (!callerUserId || !callInfo.roomId) {
      logger.warn('来电信息不完整，跳过窗口创建', callInfo)
      return
    }

    const callType = callInfo.isVideo ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO

    if (isDesktop() && deps?.createRtcCallWindow) {
      // 桌面端：创建独立来电通知窗口
      try {
        await deps.createRtcCallWindow(true, callerUserId, callInfo.roomId, callType)
        logger.info(`来电窗口已创建: ${callerUserId} in ${callInfo.roomId}`)
      } catch (err) {
        logger.error('创建来电窗口失败:', err)
      }
    }
    // 移动端：由 RtcCallFloatCell 或路由守卫处理
  }

  onMounted(() => {
    matrixVoIPService.setIncomingCallCallback(handleIncomingCall)
    logger.info('来电监听已注册')
  })

  onUnmounted(() => {
    matrixVoIPService.setIncomingCallCallback(() => {})
  })
}
