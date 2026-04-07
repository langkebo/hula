import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface DeviceInfo {
  deviceId: string
  userId: string | null | undefined
  displayName: string | undefined
  lastSeenIp: string | undefined
  lastSeenTs: number | undefined
  lastSeenUserAgent: string | undefined
}

interface DeviceResponse {
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

class MatrixAccountService {
  async updateDisplayName(displayName: string): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      await client.setDisplayName(displayName)
      info(`[MatrixAccount] 更新显示名称成功: ${displayName}`)
      return true
    } catch (err) {
      error(`[MatrixAccount] 更新显示名称失败: ${err}`)
      throw err
    }
  }

  async updateAvatar(avatarUrl: string): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      await client.setAvatarUrl(avatarUrl)
      info(`[MatrixAccount] 更新头像成功`)
      return true
    } catch (err) {
      error(`[MatrixAccount] 更新头像失败: ${err}`)
      throw err
    }
  }

  async changePassword(oldPassword: string, newPassword: string, logoutDevices: boolean = false): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
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
        } as any,
        newPassword,
        logoutDevices
      )
      info('[MatrixAccount] 修改密码成功')
      return true
    } catch (err) {
      error(`[MatrixAccount] 修改密码失败: ${err}`)
      throw err
    }
  }

  async getDevices(): Promise<DeviceInfo[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      const response = await client.getDevices()
      const userId = client.getUserId()
      // getDevices() 返回数组
      const devices = Array.isArray(response) ? response : []
      info(`[MatrixAccount] 获取设备列表成功: ${devices.length} 个设备`)
      return (devices as DeviceResponse[]).map((d) => ({
        deviceId: d.device_id,
        userId: userId,
        displayName: d.display_name,
        lastSeenIp: d.last_seen_ip,
        lastSeenTs: d.last_seen_ts,
        lastSeenUserAgent: d.last_seen_user_agent
      }))
    } catch (err) {
      error(`[MatrixAccount] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  async getDevice(deviceId: string): Promise<DeviceInfo> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      const response = await client.getDevice(deviceId)
      const userId = client.getUserId()
      info(`[MatrixAccount] 获取设备信息成功: ${deviceId}`)
      return {
        deviceId: response.device_id,
        userId: userId,
        displayName: response.display_name,
        lastSeenIp: response.last_seen_ip,
        lastSeenTs: response.last_seen_ts,
        lastSeenUserAgent: response.last_seen_user_agent
      }
    } catch (err) {
      error(`[MatrixAccount] 获取设备信息失败: ${err}`)
      throw err
    }
  }

  async setDeviceName(deviceId: string, displayName: string): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      await (client as any).setDeviceName(deviceId, displayName)
      info(`[MatrixAccount] 更新设备名称成功: ${deviceId}`)
      return true
    } catch (err) {
      error(`[MatrixAccount] 更新设备名称失败: ${err}`)
      throw err
    }
  }

  async deleteDevice(deviceId: string, authData?: AuthData): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      await client.deleteDevice(deviceId, authData)
      info(`[MatrixAccount] 删除设备成功: ${deviceId}`)
      return true
    } catch (err) {
      error(`[MatrixAccount] 删除设备失败: ${err}`)
      throw err
    }
  }

  async deleteDevices(deviceIds: string[], authData?: AuthData): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      await client.deleteMultipleDevices(deviceIds, authData)
      info(`[MatrixAccount] 批量删除设备成功: ${deviceIds.length} 个`)
      return true
    } catch (err) {
      error(`[MatrixAccount] 批量删除设备失败: ${err}`)
      throw err
    }
  }

  async getThreePids(): Promise<{
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
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      const accountData = await client.getThreePids()
      info('[MatrixAccount] 获取 3PID 列表成功')
      return {
        threepids: accountData.threepids || [],
        pending3pids: []
      }
    } catch (err) {
      error(`[MatrixAccount] 获取 3PID 列表失败: ${err}`)
      throw err
    }
  }

  async deactivateAccount(authData?: AuthData, erase: boolean = false): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      await client.deactivateAccount(authData, erase)
      info('[MatrixAccount] 注销账户成功')
    } catch (err) {
      error(`[MatrixAccount] 注销账户失败: ${err}`)
      throw err
    }
  }

  async getIgnoredUsers(): Promise<string[]> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      const accountData = await (client as any).getAccountDataFromServer('m.ignored_user_list')
      const ignoredUsers = accountData?.ignored_users || []
      info(`[MatrixAccount] 获取忽略用户列表成功: ${ignoredUsers.length} 个`)
      return ignoredUsers.map((u: { user_id: string }) => u.user_id)
    } catch (err) {
      error(`[MatrixAccount] 获取忽略用户列表失败: ${err}`)
      return []
    }
  }

  async setIgnoredUsers(userIds: string[]): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      const ignoredUsers = userIds.map((userId) => ({ user_id: userId }))
      await (client as any).setAccountData('m.ignored_user_list', { ignored_users: ignoredUsers })
      info(`[MatrixAccount] 设置忽略用户列表成功: ${userIds.length} 个`)
      return true
    } catch (err) {
      error(`[MatrixAccount] 设置忽略用户列表失败: ${err}`)
      throw err
    }
  }

  async setPresence(presence: 'online' | 'offline' | 'unavailable', statusMessage?: string): Promise<boolean> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixAccount] 客户端未初始化')
    }

    try {
      await client.setPresence({ presence, status_msg: statusMessage })
      info(`[MatrixAccount] 设置在线状态成功: ${presence}`)
      return true
    } catch (err) {
      error(`[MatrixAccount] 设置在线状态失败: ${err}`)
      throw err
    }
  }
}

export const matrixAccountService = new MatrixAccountService()
export default matrixAccountService
