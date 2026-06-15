import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('MatrixAccountService')

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

class MatrixAccountService extends BaseMatrixService {
  async updateDisplayName(displayName: string): Promise<boolean> {
    const client = this.getClient()

    try {
      await client.setDisplayName(displayName)
      logger.info(`[MatrixAccount] 更新显示名称成功: ${displayName}`)
      return true
    } catch (err) {
      logger.error(`[MatrixAccount] 更新显示名称失败: ${err}`)
      throw err
    }
  }

  async updateAvatar(avatarUrl: string): Promise<boolean> {
    const client = this.getClient()

    try {
      await client.setAvatarUrl(avatarUrl)
      logger.info(`[MatrixAccount] 更新头像成功`)
      return true
    } catch (err) {
      logger.error(`[MatrixAccount] 更新头像失败: ${err}`)
      throw err
    }
  }

  async changePassword(oldPassword: string, newPassword: string, logoutDevices: boolean = false): Promise<boolean> {
    const client = this.getClient()

    try {
      const userId = client.getUserId()
      if (!userId) {
        throw new Error(this.t('matrix_error.account.cannot_get_user_id'))
      }

      const authData: Parameters<typeof client.setPassword>[0] = {
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: userId
        },
        password: oldPassword
      }

      await client.setPassword(authData, newPassword, logoutDevices)
      logger.info('[MatrixAccount] 修改密码成功')
      return true
    } catch (err) {
      logger.error(`[MatrixAccount] 修改密码失败: ${err}`)
      throw err
    }
  }

  async getDevices(): Promise<DeviceInfo[]> {
    const client = this.getClient()

    try {
      const response = await client.getDevices()
      const userId = client.getUserId()
      // getDevices() 返回数组
      const devices = Array.isArray(response) ? response : []
      logger.info(`[MatrixAccount] 获取设备列表成功: ${devices.length} 个设备`)
      return (devices as DeviceResponse[]).map((d) => ({
        deviceId: d.device_id,
        userId: userId,
        displayName: d.display_name,
        lastSeenIp: d.last_seen_ip,
        lastSeenTs: d.last_seen_ts,
        lastSeenUserAgent: d.last_seen_user_agent
      }))
    } catch (err) {
      logger.error(`[MatrixAccount] 获取设备列表失败: ${err}`)
      throw err
    }
  }

  async getDevice(deviceId: string): Promise<DeviceInfo> {
    const client = this.getClient()

    try {
      const response = await client.getDevice(deviceId)
      const userId = client.getUserId()
      logger.info(`[MatrixAccount] 获取设备信息成功: ${deviceId}`)
      return {
        deviceId: response.device_id,
        userId: userId,
        displayName: response.display_name,
        lastSeenIp: response.last_seen_ip,
        lastSeenTs: response.last_seen_ts,
        lastSeenUserAgent: response.last_seen_user_agent
      }
    } catch (err) {
      logger.error(`[MatrixAccount] 获取设备信息失败: ${err}`)
      throw err
    }
  }

  async setDeviceName(deviceId: string, displayName: string): Promise<boolean> {
    const client = this.getClient()

    try {
      await client.setDeviceName(deviceId, displayName)
      logger.info(`[MatrixAccount] 更新设备名称成功: ${deviceId}`)
      return true
    } catch (err) {
      logger.error(`[MatrixAccount] 更新设备名称失败: ${err}`)
      throw err
    }
  }

  async deleteDevice(deviceId: string, authData?: AuthData): Promise<boolean> {
    const client = this.getClient()

    try {
      await client.deleteDevice(deviceId, authData)
      logger.info(`[MatrixAccount] 删除设备成功: ${deviceId}`)
      return true
    } catch (err) {
      logger.error(`[MatrixAccount] 删除设备失败: ${err}`)
      throw err
    }
  }

  async deleteDevices(deviceIds: string[], authData?: AuthData): Promise<boolean> {
    const client = this.getClient()

    try {
      await client.deleteMultipleDevices(deviceIds, authData)
      logger.info(`[MatrixAccount] 批量删除设备成功: ${deviceIds.length} 个`)
      return true
    } catch (err) {
      logger.error(`[MatrixAccount] 批量删除设备失败: ${err}`)
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
    const client = this.getClient()

    try {
      const accountData = await client.getThreePids()
      logger.info('[MatrixAccount] 获取 3PID 列表成功')
      return {
        threepids: accountData.threepids || [],
        pending3pids: []
      }
    } catch (err) {
      logger.error(`[MatrixAccount] 获取 3PID 列表失败: ${err}`)
      throw err
    }
  }

  async addThreePid(sid: string, clientSecret: string, bind?: boolean): Promise<void> {
    const client = this.getClient()

    try {
      await client.addThreePidOnly({ sid, client_secret: clientSecret }, bind ?? false)
      logger.info(`[MatrixAccount] 添加 3PID 成功: ${sid}`)
    } catch (err) {
      logger.error(`[MatrixAccount] 添加 3PID 失败: ${err}`)
      throw err
    }
  }

  async bindThreePid(sid: string, clientSecret: string, medium: string, address: string): Promise<void> {
    const client = this.getClient()

    try {
      await client.bindThreePid({ sid, client_secret: clientSecret, medium, address })
      logger.info(`[MatrixAccount] 绑定 3PID 成功: ${medium}:${address}`)
    } catch (err) {
      logger.error(`[MatrixAccount] 绑定 3PID 失败: ${err}`)
      throw err
    }
  }

  async deleteThreePid(medium: string, address: string): Promise<void> {
    const client = this.getClient()

    try {
      await client.deleteThreePid({ medium, address })
      logger.info(`[MatrixAccount] 删除 3PID 成功: ${medium}:${address}`)
    } catch (err) {
      logger.error(`[MatrixAccount] 删除 3PID 失败: ${err}`)
      throw err
    }
  }

  async unbindThreePid(medium: string, address: string): Promise<void> {
    const client = this.getClient()

    try {
      await client.unbindThreePid({ medium, address })
      logger.info(`[MatrixAccount] 解绑 3PID 成功: ${medium}:${address}`)
    } catch (err) {
      logger.error(`[MatrixAccount] 解绑 3PID 失败: ${err}`)
      throw err
    }
  }

  async requestEmailTokenFor3Pid(
    email: string,
    clientSecret: string,
    sendAttempt: number = 1
  ): Promise<{ sid: string }> {
    const client = this.getClient()

    try {
      const result = await client.requestAdd3pidEmailToken(clientSecret, email, sendAttempt)
      logger.info(`[MatrixAccount] 请求 3PID 邮箱验证令牌成功: ${email}`)
      return { sid: result.sid }
    } catch (err) {
      logger.error(`[MatrixAccount] 请求 3PID 邮箱验证令牌失败: ${err}`)
      throw err
    }
  }

  async requestMsisdnTokenFor3Pid(
    countryCode: string,
    phoneNumber: string,
    clientSecret: string,
    sendAttempt: number = 1
  ): Promise<{ sid: string; msisdn: string; submit_url?: string }> {
    const client = this.getClient()

    try {
      const result = await client.requestAdd3pidMsisdnToken(clientSecret, countryCode, phoneNumber, sendAttempt)
      logger.info(`[MatrixAccount] 请求 3PID 手机验证令牌成功: ${countryCode}${phoneNumber}`)
      const extra = result as unknown as Record<string, unknown>
      return {
        sid: result.sid,
        msisdn: extra.msisdn as string,
        submit_url: extra.submit_url as string | undefined
      }
    } catch (err) {
      logger.error(`[MatrixAccount] 请求 3PID 手机验证令牌失败: ${err}`)
      throw err
    }
  }

  async deactivateAccount(authData?: AuthData, erase: boolean = false): Promise<void> {
    const client = this.getClient()

    try {
      await client.deactivateAccount(authData, erase)
      logger.info('[MatrixAccount] 注销账户成功')
    } catch (err) {
      logger.error(`[MatrixAccount] 注销账户失败: ${err}`)
      throw err
    }
  }

  async getIgnoredUsers(): Promise<string[]> {
    const client = this.getClient()

    try {
      const accountData = await client.getAccountDataFromServer('m.ignored_user_list')
      const ignoredUsers = (accountData?.ignored_users as Array<{ user_id: string }> | undefined) || []
      logger.info(`[MatrixAccount] 获取忽略用户列表成功: ${ignoredUsers.length} 个`)
      return ignoredUsers.map((u) => u.user_id)
    } catch (err) {
      logger.error(`[MatrixAccount] 获取忽略用户列表失败: ${err}`)
      return []
    }
  }

  async setIgnoredUsers(userIds: string[]): Promise<boolean> {
    const client = this.getClient()

    try {
      const ignoredUsers = userIds.map((userId) => ({ user_id: userId }))
      await client.setAccountData('m.ignored_user_list', { ignored_users: ignoredUsers })
      logger.info(`[MatrixAccount] 设置忽略用户列表成功: ${userIds.length} 个`)
      return true
    } catch (err) {
      logger.error(`[MatrixAccount] 设置忽略用户列表失败: ${err}`)
      throw err
    }
  }

  async setPresence(presence: 'online' | 'offline' | 'unavailable' | 'away', statusMessage?: string): Promise<boolean> {
    const client = this.getClient()

    try {
      await client.setPresence(presence, { status_msg: statusMessage })
      logger.info(`[MatrixAccount] 设置在线状态成功: ${presence}`)
      return true
    } catch (err) {
      logger.error(`[MatrixAccount] 设置在线状态失败: ${err}`)
      throw err
    }
  }

  async getCapabilities(): Promise<Record<string, unknown>> {
    const client = this.getClient()

    if (matrixWorkerHost.isStarted) {
      const accessToken = client.getAccessToken()
      if (accessToken) {
        try {
          const result = await matrixWorkerHost.getCapabilities(client.getHomeserverUrl(), accessToken)
          logger.info('[MatrixAccount] 获取能力声明成功（worker）')
          return result
        } catch (err) {
          logger.error(`[MatrixAccount] 获取能力声明失败（worker）: ${err}`)
          return {}
        }
      }
    }

    try {
      const result = await client.http.authedRequest('GET', '/capabilities')
      logger.info('[MatrixAccount] 获取能力声明成功')
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixAccount] 获取能力声明失败: ${err}`)
      return {}
    }
  }

  async getThirdPartyProtocols(): Promise<Record<string, unknown>> {
    const client = this.getClient()

    try {
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/thirdparty/protocols')
      logger.info('[MatrixAccount] 获取第三方协议成功')
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixAccount] 获取第三方协议失败: ${err}`)
      return {}
    }
  }

  /**
   * 获取当前用户已加入的房间列表。
   *
   * 注意：`/_matrix/client/v3/my_rooms` 并非标准 Matrix Spec 端点，
   * 在某些后端（如 synapse-rust）上可能返回 404。
   * 当该端点不可用时，自动降级为 SDK 的标准 `getJoinedRooms()` 方法。
   */
  async getMyRooms(): Promise<string[]> {
    const client = this.getClient()

    try {
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/my_rooms')
      return (result as { room_ids?: string[] }).room_ids ?? []
    } catch (err) {
      // 如果返回 404，说明该非标准端点在后端不存在，降级到标准 Matrix API
      const statusCode = (err as { httpStatus?: number }).httpStatus
      if (statusCode === 404) {
        logger.info('[MatrixAccount] /my_rooms 端点不可用(404)，降级使用 getJoinedRooms()')
        try {
          const joinedRooms = await client.getJoinedRooms()
          return joinedRooms.map((room: { roomId: string }) => room.roomId)
        } catch (fallbackErr) {
          logger.error(`[MatrixAccount] 降级 getJoinedRooms() 也失败: ${fallbackErr}`)
          return []
        }
      }
      logger.error(`[MatrixAccount] 获取我的房间列表失败: ${err}`)
      return []
    }
  }

  async getEventStream(from?: string, timeout: number = 30000): Promise<Record<string, unknown>> {
    const client = this.getClient()

    try {
      const queryParams: Record<string, string> = { timeout: String(timeout) }
      if (from) queryParams.from = from
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/events', queryParams)
      return result as Record<string, unknown>
    } catch (err) {
      logger.error(`[MatrixAccount] 获取事件流失败: ${err}`)
      return {}
    }
  }
}

export const matrixAccountService = new MatrixAccountService()
export default matrixAccountService
