import type { MatrixClient } from '@/services/matrix/sdk'
import type { DeviceManager, MatrixClientExtended } from '@/types/matrix-extensions'
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
}

export interface AuthData {
  type: string
  user?: string
  password?: string
  session?: string
  [key: string]: unknown
}

/** UIA 密码阶段失败（403 / M_FORBIDDEN）代表密码错误；其余异常需要继续上抛。 */
function isPasswordRejectedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false
  }
  const { errcode, httpStatus } = err as { errcode?: string; httpStatus?: number }
  return errcode === 'M_FORBIDDEN' || httpStatus === 403
}

/**
 * MatrixAccountService 的资料 / 密码 / 设备方法片段。
 *
 * 从 `MatrixAccountService`（原 702 行）抽离：这些方法只操作当前账号的
 * 个人信息与设备列表，单独成混入类可把门面文件控制在 400 行门槛以内。
 */
export abstract class MatrixAccountProfileDeviceMethods extends BaseMatrixService {
  /** 更新当前账号的全局显示名称。 */
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

  /** 更新当前账号的全局头像 URL。 */
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

  /**
   * 修改账号密码（旧密码 + 新密码，可选登出其它设备）。
   * 依赖 UIA，失败时原样抛出异常，以便上层发起交互式认证。
   */
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

  /**
   * 校验当前账号密码（高风险操作前的二次确认，不改变密码）。
   *
   * Matrix 没有独立的「校验密码」端点，这里复用 SDK 的 UIA 密码阶段：
   * 以「新旧密码相同」调用 `client.setPassword`，服务端只有在旧密码正确时
   * 才会通过 UIA，密码本身保持不变。密码错误返回 false，其它异常原样抛出。
   */
  async verifyPassword(password: string): Promise<boolean> {
    const client = this.getClient()
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
      password
    }

    try {
      await client.setPassword(authData, password, false)
      logger.info('[MatrixAccount] 密码校验通过')
      return true
    } catch (err) {
      if (isPasswordRejectedError(err)) {
        logger.warn('[MatrixAccount] 密码校验失败: 密码不正确')
        return false
      }
      logger.error(`[MatrixAccount] 密码校验异常: ${err}`)
      throw err
    }
  }

  protected getDeviceMgr(): DeviceManager {
    logger.debug('[MatrixAccount] getDeviceMgr() 开始获取 DeviceManager')
    const client: MatrixClientExtended = this.getClient() as MatrixClient & MatrixClientExtended
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

  /** 获取当前账号的全部设备列表（含最后活动时间 / IP 等展示字段）。 */
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

  /** 获取指定设备的详情；设备不存在时抛错。 */
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

  /** 设置指定设备的显示名称。 */
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

  /**
   * 删除指定设备。
   * UIA 挑战（401 / M_FORBIDDEN）由上层处理交互式认证，本方法原样抛出异常。
   */
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

  /**
   * 批量删除多个设备。
   * 以对象形式传递 `devices` + `auth`——SDK 的位置参数形式会静默丢弃第二位 auth。
   */
  async deleteDevices(deviceIds: string[], authData?: AuthData): Promise<boolean> {
    logger.debug(
      `[MatrixAccount] deleteDevices() 开始: count=${deviceIds.length}, ids=[${deviceIds.join(', ')}], hasAuth=${!!authData}`
    )
    try {
      const deviceManager = this.getDeviceMgr()
      // SDK 真实签名：deleteDevices(request: string[] | { devices, auth })。
      // 只有对象形式才会读取 auth——位置参数的第二位会被静默丢弃。
      await deviceManager.deleteDevices(authData ? { devices: deviceIds, auth: authData } : { devices: deviceIds })
      logger.info(`[MatrixAccount] deleteDevices() 成功: ${deviceIds.length} 个设备已删除`)
      return true
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      const isUia = err instanceof Error && (err.message.includes('401') || err.message.includes('M_FORBIDDEN'))
      logger.error(`[MatrixAccount] deleteDevices() 失败: ${detail}${isUia ? ' [UIA 认证需要]' : ''}`)
      throw err
    }
  }
}
