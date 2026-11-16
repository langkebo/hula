import type { SessionEventStrategy } from '@/platform/contracts'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileSessionEvent')

/**
 * 移动端会话事件策略。
 * 来电统一走 Matrix Call.incoming（useVoIPIncomingCall → RtcCallFloatCell），旧 WS 链路忽略；
 * 远端登录失效原地弹 Vant 对话框并回到移动端登录页。
 */
export const mobileSessionEventStrategy: SessionEventStrategy = {
  handleLegacyVideoCall: () => {},

  handleRemoteLoginExpired: async ({ logout, onLoggedOut }) => {
    try {
      await logout()
      onLoggedOut()
      logger.info('账号在其他设备登录')
      const router = await import('@/router')
      await router.default.replace('/mobile/login')
      const { showDialog } = await import('vant')
      await import('vant/es/dialog/style')
      showDialog({
        title: '登录失效',
        message: '您的账号已在其他设备登录，请重新登录',
        confirmButtonText: '我知道了',
        showCancelButton: false,
        closeOnClickOverlay: false,
        closeOnPopstate: false,
        allowHtml: false
      })
    } catch (error) {
      logger.error('处理token过期失败：', error)
    }
  }
}
