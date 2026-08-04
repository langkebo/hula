import type { MatrixClient } from 'matrix-js-sdk'
import type {
  GuestManager,
  IAuthDict,
  IGuestInfo,
  IGuestLoginResponse,
  IGuestRegisterResponse,
  IServerGuestInfo,
  IUpgradeGuestRequest,
  IUpgradeGuestResponse
} from 'matrix-js-sdk/guest'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MatrixGuestService')

type GuestManagerCompat = GuestManager & {
  registerGuestOnServer?: (deviceId?: string, initialDeviceDisplayName?: string) => Promise<IGuestRegisterResponse>
  upgradeGuestAccountOnServer?: (request: IUpgradeGuestRequest) => Promise<IUpgradeGuestResponse>
  getGuestInfoFromServer?: () => Promise<IServerGuestInfo>
}

class MatrixGuestService extends BaseMatrixService {
  private guestManager: GuestManagerCompat | null = null
  private observedClient: MatrixClient | null = null

  private getGuestManager(client: MatrixClient): GuestManagerCompat | null {
    const clientWithMethods = client as unknown as Record<string, unknown>
    if (typeof clientWithMethods.getGuestManager === 'function') {
      try {
        const manager = clientWithMethods.getGuestManager()
        if (manager && typeof (manager as GuestManager).registerGuest === 'function') {
          return manager as GuestManagerCompat
        }
      } catch {
        // getGuestManager() 可能抛出异常
      }
    }
    return null
  }

  private syncGuestManager(): GuestManagerCompat | null {
    const client = this.getClient()
    const manager = this.getGuestManager(client)

    if (this.observedClient !== client || this.guestManager !== manager) {
      this.guestManager = manager
      this.observedClient = client
    }

    return manager
  }

  private async requireGuestManager(): Promise<GuestManagerCompat> {
    const manager = this.syncGuestManager()
    if (!manager) {
      throw new Error(this.t('matrix_error.guest.manager_not_initialized'))
    }
    return manager
  }

  async registerGuest(deviceId?: string, initialDeviceDisplayName?: string): Promise<IGuestRegisterResponse> {
    try {
      const manager = await this.requireGuestManager()
      const result = await manager.registerGuest(deviceId, initialDeviceDisplayName)
      logger.info(`[MatrixGuest] 访客注册成功: ${result.user_id}`)
      return result
    } catch (err) {
      logger.error(`[MatrixGuest] 访客注册失败: ${err}`)
      throw err
    }
  }

  async registerGuestOnServer(deviceId?: string, initialDeviceDisplayName?: string): Promise<IGuestRegisterResponse> {
    try {
      const manager = await this.requireGuestManager()
      if (typeof manager.registerGuestOnServer === 'function') {
        const result = await manager.registerGuestOnServer(deviceId, initialDeviceDisplayName)
        logger.info(`[MatrixGuest] 服务端访客注册成功: ${result.user_id}`)
        return result
      }
      // 回退到 registerGuest
      return await this.registerGuest(deviceId, initialDeviceDisplayName)
    } catch (err) {
      logger.error(`[MatrixGuest] 服务端访客注册失败: ${err}`)
      throw err
    }
  }

  async loginGuest(deviceId?: string, initialDeviceDisplayName?: string): Promise<IGuestLoginResponse> {
    try {
      const manager = await this.requireGuestManager()
      const result = await manager.loginGuest(deviceId, initialDeviceDisplayName)
      logger.info(`[MatrixGuest] 访客登录成功: ${result.user_id}`)
      return result
    } catch (err) {
      logger.error(`[MatrixGuest] 访客登录失败: ${err}`)
      throw err
    }
  }

  async isGuest(userId?: string): Promise<boolean> {
    try {
      const manager = await this.requireGuestManager()
      return await manager.isGuest(userId)
    } catch (err) {
      logger.error(`[MatrixGuest] 检查访客状态失败: ${err}`)
      return false
    }
  }

  async getGuestAccessToken(): Promise<string | null> {
    try {
      const manager = await this.requireGuestManager()
      return await manager.getGuestAccessToken()
    } catch (err) {
      logger.error(`[MatrixGuest] 获取访客令牌失败: ${err}`)
      return null
    }
  }

  getGuestInfo(): IGuestInfo | null {
    try {
      const manager = this.syncGuestManager()
      return manager?.getGuestInfo?.() ?? null
    } catch (err) {
      logger.error(`[MatrixGuest] 获取访客信息失败: ${err}`)
      return null
    }
  }

  async getGuestInfoFromServer(): Promise<IServerGuestInfo> {
    const manager = await this.requireGuestManager()
    if (typeof manager.getGuestInfoFromServer !== 'function') {
      throw new Error(this.t('matrix_error.guest.manager_not_initialized'))
    }
    try {
      const result = await manager.getGuestInfoFromServer()
      logger.info(`[MatrixGuest] 从服务端获取访客信息成功`)
      return result
    } catch (err) {
      logger.error(`[MatrixGuest] 从服务端获取访客信息失败: ${err}`)
      throw err
    }
  }

  async upgradeGuestAccount(password: string, authDict?: IAuthDict): Promise<void> {
    try {
      const manager = await this.requireGuestManager()
      await manager.upgradeGuestAccount(password, authDict)
      logger.info('[MatrixGuest] 访客账户升级成功')
    } catch (err) {
      logger.error(`[MatrixGuest] 访客账户升级失败: ${err}`)
      throw err
    }
  }

  async upgradeGuestAccountOnServer(request: IUpgradeGuestRequest): Promise<IUpgradeGuestResponse> {
    try {
      const manager = await this.requireGuestManager()
      if (typeof manager.upgradeGuestAccountOnServer === 'function') {
        const result = await manager.upgradeGuestAccountOnServer(request)
        logger.info(`[MatrixGuest] 服务端访客账户升级成功: ${result.user_id}`)
        return result
      }
      // 回退到 upgradeGuestAccount
      await this.upgradeGuestAccount(request.password, request.auth)
      return { success: true, user_id: '', access_token: '' }
    } catch (err) {
      logger.error(`[MatrixGuest] 服务端访客账户升级失败: ${err}`)
      throw err
    }
  }

  async getGuestRooms(): Promise<string[]> {
    try {
      const manager = await this.requireGuestManager()
      return await manager.getGuestRooms()
    } catch (err) {
      logger.error(`[MatrixGuest] 获取访客房间列表失败: ${err}`)
      return []
    }
  }

  async joinRoomAsGuest(roomIdOrAlias: string): Promise<{ roomId: string }> {
    try {
      const manager = await this.requireGuestManager()
      const result = await manager.joinRoomAsGuest(roomIdOrAlias)
      logger.info(`[MatrixGuest] 访客加入房间成功: ${result.roomId}`)
      return result
    } catch (err) {
      logger.error(`[MatrixGuest] 访客加入房间失败: ${err}`)
      throw err
    }
  }

  async canJoinRoom(roomIdOrAlias: string): Promise<boolean> {
    try {
      const manager = await this.requireGuestManager()
      return await manager.canJoinRoom(roomIdOrAlias)
    } catch (err) {
      logger.error(`[MatrixGuest] 检查访客能否加入房间失败: ${err}`)
      return false
    }
  }

  isGuestTokenValid(): boolean {
    try {
      const manager = this.syncGuestManager()
      return manager?.isGuestTokenValid?.() ?? false
    } catch (err) {
      logger.error(`[MatrixGuest] 检查访客令牌有效性失败: ${err}`)
      return false
    }
  }

  clearGuestInfo(): void {
    try {
      const manager = this.syncGuestManager()
      manager?.clearGuestInfo?.()
      logger.info('[MatrixGuest] 访客信息已清除')
    } catch (err) {
      logger.error(`[MatrixGuest] 清除访客信息失败: ${err}`)
    }
  }

  stop(): void {
    if (this.guestManager) {
      this.guestManager.stop()
      this.guestManager = null
    }
    this.observedClient = null
    logger.info('[MatrixGuest] GuestService 已停止')
  }
}

export const matrixGuestService = new MatrixGuestService()
