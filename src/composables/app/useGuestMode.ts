/**
 * §8.6 访客模式 composable
 *
 * 封装访客登录/升级/退出的状态管理，供 Login.vue 和 GuestModeBanner.vue 使用。
 * 访客模式下用户可浏览公开房间但无法发送消息，升级后保留已加入的房间。
 */
import { ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('GuestMode')

interface GuestLoginResponse {
  access_token: string
  user_id: string
  device_id: string
}

interface IAuthDict {
  [key: string]: unknown
}

interface GuestServiceLike {
  loginGuest(deviceId?: string, initialDeviceDisplayName?: string): Promise<GuestLoginResponse>
  upgradeGuestAccount(password: string, authDict?: IAuthDict): Promise<void>
  isGuest(userId?: string): Promise<boolean>
  getGuestInfo(): unknown
}

export function useGuestMode(guestService: GuestServiceLike) {
  const isGuestMode = ref(false)
  const guestUserId = ref<string | null>(null)

  async function loginAsGuest(deviceId?: string): Promise<GuestLoginResponse> {
    try {
      const result = await guestService.loginGuest(deviceId, 'Tjg Guest')
      isGuestMode.value = true
      guestUserId.value = result.user_id
      logger.info(`访客登录成功: ${result.user_id}`)
      return result
    } catch (err) {
      isGuestMode.value = false
      guestUserId.value = null
      logger.error('访客登录失败:', err)
      throw err
    }
  }

  async function upgradeToUser(password: string, authDict?: IAuthDict): Promise<void> {
    await guestService.upgradeGuestAccount(password, authDict)
    isGuestMode.value = false
    guestUserId.value = null
    logger.info('访客账户已升级为正式用户')
  }

  function exitGuestMode(): void {
    isGuestMode.value = false
    guestUserId.value = null
    logger.info('已退出访客模式')
  }

  return {
    isGuestMode,
    guestUserId,
    loginAsGuest,
    upgradeToUser,
    exitGuestMode
  }
}
