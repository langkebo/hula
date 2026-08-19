import { authedRequestWithPath } from '@/services/matrix/MatrixHttpClient'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import type { DeviceManager, MatrixClientExtended } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import { PREFIX_VENDOR_V1 } from '../paths/prefixes'

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
}

interface AuthData {
  type: string
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
    logger.debug(`[MatrixAccount] changePassword() 开始: logoutDevices=${logoutDevices}`)

    try {
      const userId = client.getUserId()
      if (!userId) {
        logger.error('[MatrixAccount] changePassword() 失败: 无法获取 userId')
        throw new Error(this.t('matrix_error.account.cannot_get_user_id'))
      }
      logger.debug(`[MatrixAccount] changePassword() userId=${userId}, 调用 client.setPassword()`)

      const authData: Parameters<typeof client.setPassword>[0] = {
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: userId
        },
        password: oldPassword
      }

      await client.setPassword(authData, newPassword, logoutDevices)
      logger.info('[MatrixAccount] changePassword() 成功')
      return true
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      logger.error(`[MatrixAccount] changePassword() 失败: ${detail}`)
      throw err
    }
  }

  private getDeviceMgr(): DeviceManager {
    logger.debug('[MatrixAccount] getDeviceMgr() 开始获取 DeviceManager')
    const client = this.getClient() as unknown as MatrixClientExtended
    logger.debug(
      `[MatrixAccount] getDeviceMgr() client 已获取, getDeviceManager 方法存在: ${typeof client.getDeviceManager === 'function'}`
    )
    const deviceManager = client.getDeviceManager?.()
    if (!deviceManager) {
      logger.error(
        '[MatrixAccount] getDeviceMgr() DeviceManager 不可用 — SDK 扩展可能未初始化 (initializeManagerExtensions 未调用或 MatrixClient 未通过 createClient 创建)'
      )
      throw new Error('DeviceManager is not available. SDK extensions may not be initialized.')
    }
    logger.debug('[MatrixAccount] getDeviceMgr() DeviceManager 获取成功')
    return deviceManager
  }

  async getDevices(): Promise<DeviceInfo[]> {
    const client = this.getClient()
    logger.debug('[MatrixAccount] getDevices() 开始获取设备列表')

    try {
      const deviceManager = this.getDeviceMgr()
      logger.debug('[MatrixAccount] getDevices() 调用 deviceManager.getDevices()')
      const response = await deviceManager.getDevices()
      const userId = client.getUserId()
      const devices = Array.isArray(response) ? response : []
      logger.info(`[MatrixAccount] getDevices() 成功: ${devices.length} 个设备, userId=${userId}`)
      const result = (devices as DeviceResponse[]).map((d) => ({
        deviceId: d.device_id,
        userId: userId,
        displayName: d.display_name,
        lastSeenIp: d.last_seen_ip,
        lastSeenTs: d.last_seen_ts,
        lastSeenUserAgent: undefined
      }))
      logger.debug(`[MatrixAccount] getDevices() 设备ID列表: ${result.map((d) => d.deviceId).join(', ') || '(空)'}`)
      return result
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      logger.error(`[MatrixAccount] getDevices() 失败: ${detail}`)
      if (err instanceof Error && err.stack) {
        logger.error(`[MatrixAccount] getDevices() 堆栈: ${err.stack}`)
      }
      throw err
    }
  }

  async getDevice(deviceId: string): Promise<DeviceInfo> {
    const client = this.getClient()
    logger.debug(`[MatrixAccount] getDevice() 开始获取设备: deviceId=${deviceId}`)

    try {
      const deviceManager = this.getDeviceMgr()
      const response = (await deviceManager.getDevice(deviceId)) as DeviceResponse | null
      if (!response) {
        logger.warn(`[MatrixAccount] getDevice() 设备不存在: ${deviceId}`)
        throw new Error(`Device not found: ${deviceId}`)
      }
      const userId = client.getUserId()
      logger.info(`[MatrixAccount] getDevice() 成功: deviceId=${deviceId}, name=${response.display_name ?? '(未命名)'}`)
      return {
        deviceId: response.device_id,
        userId: userId,
        displayName: response.display_name,
        lastSeenIp: response.last_seen_ip,
        lastSeenTs: response.last_seen_ts,
        lastSeenUserAgent: undefined
      }
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      logger.error(`[MatrixAccount] getDevice() 失败: deviceId=${deviceId}, ${detail}`)
      throw err
    }
  }

  async setDeviceName(deviceId: string, displayName: string): Promise<boolean> {
    logger.debug(`[MatrixAccount] setDeviceName() 开始: deviceId=${deviceId}, displayName=${displayName}`)
    try {
      const deviceManager = this.getDeviceMgr()
      await deviceManager.updateDevice(deviceId, { display_name: displayName })
      logger.info(`[MatrixAccount] setDeviceName() 成功: deviceId=${deviceId}`)
      return true
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      logger.error(`[MatrixAccount] setDeviceName() 失败: deviceId=${deviceId}, ${detail}`)
      throw err
    }
  }

  async deleteDevice(deviceId: string, authData?: AuthData): Promise<boolean> {
    logger.debug(`[MatrixAccount] deleteDevice() 开始: deviceId=${deviceId}, hasAuth=${!!authData}`)
    try {
      const deviceManager = this.getDeviceMgr()
      await deviceManager.deleteDevice(deviceId, authData)
      logger.info(`[MatrixAccount] deleteDevice() 成功: deviceId=${deviceId}`)
      return true
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      // 401/UIA 错误需要上层处理交互式认证
      const isUia = err instanceof Error && (err.message.includes('401') || err.message.includes('M_FORBIDDEN'))
      logger.error(
        `[MatrixAccount] deleteDevice() 失败: deviceId=${deviceId}, ${detail}${isUia ? ' [UIA 认证需要]' : ''}`
      )
      throw err
    }
  }

  async deleteDevices(deviceIds: string[], authData?: AuthData): Promise<boolean> {
    logger.debug(
      `[MatrixAccount] deleteDevices() 开始: count=${deviceIds.length}, ids=[${deviceIds.join(', ')}], hasAuth=${!!authData}`
    )
    try {
      const deviceManager = this.getDeviceMgr()
      await deviceManager.deleteDevices(deviceIds, authData)
      logger.info(`[MatrixAccount] deleteDevices() 成功: ${deviceIds.length} 个设备已删除`)
      return true
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      const isUia = err instanceof Error && (err.message.includes('401') || err.message.includes('M_FORBIDDEN'))
      logger.error(`[MatrixAccount] deleteDevices() 失败: ${detail}${isUia ? ' [UIA 认证需要]' : ''}`)
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
      const accountData = await client.getThreePidsManager().getThreePids()
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

  async addThreePid(sid: string, clientSecret: string, _bind?: boolean): Promise<void> {
    const client = this.getClient()

    try {
      // 后端 /account/3pid/add 只读 sid+client_secret；bind 参数历史遗留（add/bind 同 handler），已忽略
      await client.getThreePidsManager().addThreePidOnly(clientSecret, sid)
      logger.info(`[MatrixAccount] 添加 3PID 成功: ${sid}`)
    } catch (err) {
      logger.error(`[MatrixAccount] 添加 3PID 失败: ${err}`)
      throw err
    }
  }

  async bindThreePid(sid: string, clientSecret: string, medium: string, address: string): Promise<void> {
    const client = this.getClient()

    try {
      // 后端 /account/3pid/bind 与 /add 同一 handler，只读 sid+client_secret；medium/address 仅用于日志
      await client.getThreePidsManager().addThreePidOnly(clientSecret, sid)
      logger.info(`[MatrixAccount] 绑定 3PID 成功: ${medium}:${address}`)
    } catch (err) {
      logger.error(`[MatrixAccount] 绑定 3PID 失败: ${err}`)
      throw err
    }
  }

  async deleteThreePid(medium: string, address: string): Promise<void> {
    const client = this.getClient()

    try {
      await client.getThreePidsManager().deleteThreePid(medium, address)
      logger.info(`[MatrixAccount] 删除 3PID 成功: ${medium}:${address}`)
    } catch (err) {
      logger.error(`[MatrixAccount] 删除 3PID 失败: ${err}`)
      throw err
    }
  }

  async unbindThreePid(medium: string, address: string): Promise<void> {
    const client = this.getClient()

    try {
      await client.getThreePidsManager().unbindThreePid(medium, address)
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

  async getAccountData<T = Record<string, unknown>>(eventType: string): Promise<T | null> {
    const client = this.getClient()

    try {
      const event = client.getAccountData(eventType)
      return (event?.getContent() as T) ?? null
    } catch (_err) {
      logger.error(`[MatrixAccount] 获取账户数据失败: ${eventType}`)
      return null
    }
  }

  async setAccountData(eventType: string, content: unknown): Promise<void> {
    const client = this.getClient()

    try {
      await client.setAccountData(eventType, content)
      logger.info(`[MatrixAccount] 设置账户数据成功: ${eventType}`)
    } catch (err) {
      logger.error(`[MatrixAccount] 设置账户数据失败: ${eventType}: ${err}`)
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
    logger.debug(`[MatrixAccount] getCapabilities() 开始: workerStarted=${matrixWorkerHost.isStarted}`)

    // Worker 路径：在 worker 线程发起单次请求，避免阻塞主线程
    if (matrixWorkerHost.isStarted) {
      const accessToken = client.getAccessToken()
      if (accessToken) {
        try {
          logger.debug('[MatrixAccount] getCapabilities() 通过 worker 获取')
          const result = await matrixWorkerHost.getCapabilities(client.getHomeserverUrl(), accessToken)
          logger.debug('[MatrixAccount] getCapabilities() 成功（worker）')
          return result
        } catch (err) {
          const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
          logger.warn(`[MatrixAccount] getCapabilities() 失败（worker）: ${detail}, 降级到 authedRequest`)
        }
      } else {
        logger.warn('[MatrixAccount] getCapabilities() worker 已启动但无 accessToken, 降级到 authedRequest')
      }
    }

    // 非 worker 路径：通过 SDK authedRequest 发起单次请求，返回完整响应体（含 unstable_features）。
    // 注意：不能用 client.getCapabilities()，它只返回 IServerCapabilities（丢弃 unstable_features），
    // 会导致需要第二次 HTTP 请求补充获取 unstable_features（如 io.hula.friends）。
    try {
      const result = await authedRequestWithPath<Record<string, unknown>>(client, 'GET', '/capabilities')
      logger.debug('[MatrixAccount] getCapabilities() 成功（authedRequest）')
      return result
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      logger.error(`[MatrixAccount] getCapabilities() 失败: ${detail}`)
      return {}
    }
  }

  async getThirdPartyProtocols(): Promise<Record<string, unknown>> {
    const client = this.getClient()

    try {
      const result = await client.getThirdpartyProtocols()
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
   * 注意：`/_matrix/vendor/v1/my_rooms` 并非标准 Matrix Spec 端点，
   * 是 synapse-rust 私有端点（ISSUE-13 vendor 命名空间）。
   * 当该端点不可用时，自动降级为 SDK 的标准 `getJoinedRooms()` 方法。
   */
  async getMyRooms(): Promise<string[]> {
    const client = this.getClient()

    try {
      const result = await authedRequestWithPath<{ room_ids?: string[] }>(client, 'GET', `${PREFIX_VENDOR_V1}/my_rooms`)
      return result.room_ids ?? []
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
      const result = await authedRequestWithPath<Record<string, unknown>>(client, 'GET', '/events', queryParams)
      return result
    } catch (err) {
      logger.error(`[MatrixAccount] 获取事件流失败: ${err}`)
      return {}
    }
  }
}

export const matrixAccountService = new MatrixAccountService()
