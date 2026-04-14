import type { ExtendedMatrixClientForAccount, PasswordAuthData } from '@/types/matrix-api'
import matrixClientService from './MatrixClientService'
import matrixPresenceService from './MatrixPresenceService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

export interface DeviceInfo {
  deviceId: string
  userId: string | null | undefined
  displayName: string | undefined
  lastSeenIp: string | undefined
  lastSeenTs: number | undefined
  lastSeenUserAgent: string | undefined
}

interface SdkDevice {
  device_id: string
  display_name?: string
  last_seen_ip?: string
  last_seen_ts?: number
  last_seen_user_agent?: string
}

interface AuthData {
  type?: string
  user?: string
  password?: string
  session?: string
  [key: string]: unknown
}

class MatrixAccountService extends BaseManager {
  private getDeviceManager() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }
    const manager = (client as any).getDeviceManager()
    if (!manager) {
      throw new Error('[MatrixAccount] DeviceManager 不可用')
    }
    return manager
  }

  private mapDeviceToInfo(device: SdkDevice): DeviceInfo {
    const client = matrixClientService.getClient()
    return {
      deviceId: device.device_id,
      userId: client?.getUserId(),
      displayName: device.display_name,
      lastSeenIp: device.last_seen_ip,
      lastSeenTs: device.last_seen_ts,
      lastSeenUserAgent: device.last_seen_user_agent
    }
  }

  async updateDisplayName(displayName: string, throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixAccount] 客户端未初始化')
      }
      await client.setDisplayName(displayName)
      info(`[MatrixAccount] 更新显示名称成功: ${displayName}`)
      return true
    } catch (error) {
      return this.handleError(error, 'updateDisplayName', false, throwOnError)
    }
  }

  async updateAvatar(avatarUrl: string, throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixAccount] 客户端未初始化')
      }
      await client.setAvatarUrl(avatarUrl)
      info('[MatrixAccount] 更新头像成功')
      return true
    } catch (error) {
      return this.handleError(error, 'updateAvatar', false, throwOnError)
    }
  }

  async changePassword(
    oldPassword: string,
    newPassword: string,
    logoutDevices: boolean = false,
    throwOnError = false
  ): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixAccount] 客户端未初始化')
      }
      const userId = client.getUserId()
      if (!userId) {
        throw new Error('[MatrixAccount] 无法获取用户ID')
      }

      await client.setPassword(
        {
          identifier: {
            type: 'm.id.user',
            user: userId
          },
          password: oldPassword
        } as PasswordAuthData,
        newPassword,
        logoutDevices
      )
      info('[MatrixAccount] 修改密码成功')
      return true
    } catch (error) {
      return this.handleError(error, 'changePassword', false, throwOnError)
    }
  }

  async getDevices(throwOnError = true): Promise<DeviceInfo[]> {
    try {
      const manager = this.getDeviceManager()
      const devices: SdkDevice[] = await manager.getDevices()
      info(`[MatrixAccount] 获取设备列表成功: ${devices.length} 个设备`)
      return devices.map((d: SdkDevice) => this.mapDeviceToInfo(d))
    } catch (error) {
      return this.handleError(error, 'getDevices', [] as DeviceInfo[], throwOnError)
    }
  }

  async getDevice(deviceId: string, throwOnError = true): Promise<DeviceInfo | null> {
    try {
      const manager = this.getDeviceManager()
      const device: SdkDevice = await manager.getDevice(deviceId)
      info(`[MatrixAccount] 获取设备信息成功: ${deviceId}`)
      return this.mapDeviceToInfo(device)
    } catch (error) {
      return this.handleError(error, 'getDevice', null, throwOnError)
    }
  }

  async setDeviceName(deviceId: string, displayName: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getDeviceManager()
      await manager.renameDevice(deviceId, displayName)
      info(`[MatrixAccount] 更新设备名称成功: ${deviceId}`)
      return true
    } catch (error) {
      return this.handleError(error, 'setDeviceName', false, throwOnError)
    }
  }

  async deleteDevice(deviceId: string, authData?: AuthData, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getDeviceManager()
      await manager.deleteDevice(deviceId, authData)
      info(`[MatrixAccount] 删除设备成功: ${deviceId}`)
      return true
    } catch (error) {
      return this.handleError(error, 'deleteDevice', false, throwOnError)
    }
  }

  async deleteDevices(deviceIds: string[], authData?: AuthData, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getDeviceManager()
      await manager.deleteDevices({ devices: deviceIds, auth: authData })
      info(`[MatrixAccount] 批量删除设备成功: ${deviceIds.length} 个`)
      return true
    } catch (error) {
      return this.handleError(error, 'deleteDevices', false, throwOnError)
    }
  }

  async getThreePids(throwOnError = true): Promise<{
    threepids: Array<{
      medium: string
      address: string
      validated_at: number
      added_at: number
    }>
    pending3pids: Array<{
      medium: string
      address: string
      validated_at: number
      added_at: number
    }>
  }> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixAccount] 客户端未初始化')
      }
      const accountData = await client.getThreePids()
      info('[MatrixAccount] 获取 3PID 列表成功')
      return {
        threepids: accountData.threepids || [],
        pending3pids: []
      }
    } catch (error) {
      return this.handleError(error, 'getThreePids', { threepids: [], pending3pids: [] }, throwOnError)
    }
  }

  async deactivateAccount(authData?: AuthData, erase: boolean = false, throwOnError = false): Promise<void> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixAccount] 客户端未初始化')
      }
      await client.deactivateAccount(authData, erase)
      info('[MatrixAccount] 注销账户成功')
    } catch (error) {
      this.handleError(error, 'deactivateAccount', undefined, throwOnError)
    }
  }

  async getIgnoredUsers(throwOnError = true): Promise<string[]> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixAccount] 客户端未初始化')
      }

      const extendedClient = client as unknown as ExtendedMatrixClientForAccount
      const accountData = (await extendedClient.getAccountDataFromServer?.('m.ignored_user_list')) as
        | { ignored_users?: Array<{ user_id: string }> }
        | undefined
      const ignoredUsers = accountData?.ignored_users || []
      info(`[MatrixAccount] 获取忽略用户列表成功: ${ignoredUsers.length} 个`)
      return ignoredUsers.map((u: { user_id: string }) => u.user_id)
    } catch (error) {
      return this.handleError(error, 'getIgnoredUsers', [] as string[], throwOnError)
    }
  }

  async setIgnoredUsers(userIds: string[], throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixAccount] 客户端未初始化')
      }
      const ignoredUsers = userIds.map((userId) => ({ user_id: userId }))
      const extendedClient = client as unknown as ExtendedMatrixClientForAccount
      await extendedClient.setAccountData?.('m.ignored_user_list', { ignored_users: ignoredUsers })
      info(`[MatrixAccount] 设置忽略用户列表成功: ${userIds.length} 个`)
      return true
    } catch (error) {
      return this.handleError(error, 'setIgnoredUsers', false, throwOnError)
    }
  }

  async addThreePid(params: { medium: string; address: string }, throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixAccount] 客户端未初始化')
      }
      await client.addThreePid(params)
      info(`[MatrixAccount] 添加 3PID 成功: ${params.medium} ${params.address}`)
      return true
    } catch (error) {
      return this.handleError(error, 'addThreePid', false, throwOnError)
    }
  }

  async deleteThreePid(params: { medium: string; address: string }, throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('[MatrixAccount] 客户端未初始化')
      }
      await client.deleteThreePid(params)
      info(`[MatrixAccount] 删除 3PID 成功: ${params.medium} ${params.address}`)
      return true
    } catch (error) {
      return this.handleError(error, 'deleteThreePid', false, throwOnError)
    }
  }

  getCurrentDeviceId(): string | null {
    return matrixClientService.getDeviceId()
  }

  getCurrentUserId(): string | null {
    return matrixClientService.getUserId()
  }

  async setPresence(
    presence: 'online' | 'offline' | 'unavailable',
    statusMessage?: string,
    throwOnError = false
  ): Promise<boolean> {
    try {
      await matrixPresenceService.setPresence(presence, statusMessage)
      info(`[MatrixAccount] 设置在线状态成功: ${presence}`)
      return true
    } catch (error) {
      return this.handleError(error, 'setPresence', false, throwOnError)
    }
  }
}

export const matrixAccountService = new MatrixAccountService()
export default matrixAccountService
