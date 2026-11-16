import { authedRequestWithPath } from '@/services/matrix/MatrixHttpClient'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import type { MatrixClient } from '@/services/matrix/sdk'
import type { DeviceManager, MatrixClientExtended } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import {
  addThreePid,
  bindThreePid,
  deleteThreePid,
  fetchThreePids,
  requestAddEmailToken as requestThreePidEmailToken,
  submitEmailToken as submitThreePidEmailToken,
  type ThreePidEmailChallenge,
  type ThreePidsResponse,
  unbindThreePid
} from './accountThreePids'
import {
  cacheInvitePolicy,
  INVITE_POLICY_ACCOUNT_DATA_TYPE,
  type InvitePolicy,
  normalizeInvitePolicy
} from './invitePolicy'

const logger = createLogger('MatrixAccountService')

/** 旧版本账号级策略 key；与后端房间级表名同名，仅用于一次性迁移读取。 */
const LEGACY_INVITE_POLICY_ACCOUNT_DATA_TYPE = 'im.hula.invite_blocklist'

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

/** 我的房间条目：SDK `/my_rooms` 视图归一后的前端模型。 */
export interface MyRoomEntry {
  roomId: string
  name?: string | undefined
  avatarUrl?: string | undefined
  membership: 'join' | 'invite' | 'leave' | string
}

interface MyRoomsSdkResponse {
  rooms?: unknown
  total?: number
}

interface MyRoomsCapableRoomManager {
  getMyRooms?: () => Promise<MyRoomsSdkResponse>
}

interface MyRoomsCapableClient {
  getRoomManager?: () => MyRoomsCapableRoomManager
}

/** SDK 返回的 room 条目字段与类型均不保证，逐项校验后映射为内部模型。 */
function toMyRoomEntries(rooms: unknown): MyRoomEntry[] {
  if (!Array.isArray(rooms)) {
    return []
  }

  const entries: MyRoomEntry[] = []
  const seen = new Set<string>()

  for (const room of rooms) {
    if (!room || typeof room !== 'object') {
      continue
    }
    const record = room as Record<string, unknown>
    const roomId = typeof record.room_id === 'string' ? record.room_id : ''
    if (!roomId || seen.has(roomId)) {
      continue
    }
    seen.add(roomId)

    const rawMembership = record.membership ?? record.join_state
    const name = typeof record.name === 'string' && record.name.trim() ? record.name : undefined
    const avatarUrl = typeof record.avatar_url === 'string' && record.avatar_url ? record.avatar_url : undefined

    entries.push({
      roomId,
      name,
      avatarUrl,
      membership: typeof rawMembership === 'string' && rawMembership ? rawMembership : 'join'
    })
  }

  return entries
}

/** UIA 密码阶段失败（403 / M_FORBIDDEN）代表密码错误；其余异常需要继续上抛。 */
function isPasswordRejectedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return false
  }
  const { errcode, httpStatus } = err as { errcode?: string; httpStatus?: number }
  return errcode === 'M_FORBIDDEN' || httpStatus === 403
}

/** 生成 3PID 验证会话的 client_secret（Web Crypto 不可用时回退随机串）。 */
function createClientSecret(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID().replace(/-/g, '')
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
}

class MatrixAccountService extends BaseMatrixService {
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

  private getDeviceMgr(): DeviceManager {
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

  /** 获取已绑定的第三方标识（3PID）列表；`pending3pids` 当前恒为空。 */
  async getThreePids(): Promise<ThreePidsResponse> {
    return fetchThreePids(() => this.getClient())
  }

  /**
   * 请求向邮箱发送「绑定 3PID」验证码。
   *
   * 返回的 `clientSecret` 需在 submit / add 阶段原样回传（服务端用它校验同一会话）。
   */
  async requestThreePidEmailToken(
    email: string,
    sendAttempt = 1
  ): Promise<ThreePidEmailChallenge & { clientSecret: string }> {
    const clientSecret = createClientSecret()
    const challenge = await requestThreePidEmailToken(() => this.getClient(), email, clientSecret, sendAttempt)
    return { ...challenge, clientSecret }
  }

  /** 提交邮箱验证码（SDK 未封装 submitToken，见 accountThreePids 注释）。 */
  async submitThreePidEmailToken(sid: string, clientSecret: string, token: string): Promise<void> {
    return submitThreePidEmailToken(() => this.getClient(), sid, clientSecret, token)
  }

  /**
   * 完成邮箱 3PID 绑定：`/account/3pid/add` 强制 UIA，
   * 这里用当前账号密码拼出 `m.login.password` 阶段一并提交。
   */
  async addThreePidWithPassword(sid: string, clientSecret: string, password: string): Promise<void> {
    const client = this.getClient()
    const userId = client.getUserId()
    if (!userId) {
      throw new Error(this.t('matrix_error.account.cannot_get_user_id'))
    }

    const authData = {
      type: 'm.login.password',
      identifier: {
        type: 'm.id.user',
        user: userId
      },
      password
    }

    return addThreePid(() => client, sid, clientSecret, authData)
  }

  /** 添加第三方标识（3PID）；`_bind` 为历史遗留参数，后端 add/bind 同 handler，已忽略。 */
  async addThreePid(sid: string, clientSecret: string, _bind?: boolean): Promise<void> {
    return addThreePid(() => this.getClient(), sid, clientSecret)
  }

  /** 绑定第三方标识（3PID）；后端与 add 同 handler，medium/address 仅用于日志。 */
  async bindThreePid(sid: string, clientSecret: string, medium: string, address: string): Promise<void> {
    return bindThreePid(() => this.getClient(), sid, clientSecret, medium, address)
  }

  /** 删除已绑定的第三方标识（3PID）。 */
  async deleteThreePid(medium: string, address: string): Promise<void> {
    return deleteThreePid(() => this.getClient(), medium, address)
  }

  /** 解绑已绑定的第三方标识（3PID）。 */
  async unbindThreePid(medium: string, address: string): Promise<void> {
    return unbindThreePid(() => this.getClient(), medium, address)
  }

  async getAccountData<T = Record<string, unknown>>(eventType: string): Promise<T | null> {
    const client = this.getClient()

    try {
      const event = client.getAccountData(eventType)
      return (event?.getContent() as T) ?? null
    } catch {
      logger.error(`[MatrixAccount] 获取账户数据失败: ${eventType}`)
      return null
    }
  }

  /** 写入账号级 account data 并异步同步到服务器。 */
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

  /** 注销当前账号（`erase` 为 true 时抹除全部内容）；依赖 UIA。 */
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

  /** 获取账号的忽略用户列表（`m.ignored_user_list`）；失败时返回空数组。 */
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

  /** 覆盖写入账号的忽略用户列表（`m.ignored_user_list`）。 */
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

  /**
   * 读取邀请策略（`im.hula.invite_policy` account data）——宽松变体，供**只读**路径使用。
   *
   * account data 是权威来源；读取失败时返回归一化后的默认值（allow_all），
   * 而不是抛错——隐私设置页拿到默认值仍可正常渲染。
   *
   * **写路径（read-modify-write）不能用这个变体**，必须用
   * `getInvitePolicyStrict()`：这里把「读取失败」和「账号上还没存过策略」
   * 都折叠成同一份默认值，调用方无法区分。若拿它当写前重读的基线，
   * 一次读取失败 + 一次成功的 PUT 就会把用户账号上已有的
   * mode/blocklist/allowlist/allowStrangers 静默删成默认值。
   *
   * 兼容旧 key：早期版本把账号级策略写在 `im.hula.invite_blocklist`，
   * 该名字与后端**房间级**表/端点同名（语义不同）。这里做一次性回退读取，
   * 避免老用户升级后策略被静默重置为 allow_all。
   */
  async getInvitePolicy(): Promise<InvitePolicy> {
    try {
      return (await this.getInvitePolicyStrict()) ?? normalizeInvitePolicy(null)
    } catch (err) {
      logger.error(`[MatrixAccount] 获取邀请策略失败（宽松回退默认值）: ${err}`)
      return normalizeInvitePolicy(null)
    }
  }

  /**
   * 读取邀请策略（`im.hula.invite_policy` account data）——严格变体，供**写路径**使用。
   *
   * 与 `getInvitePolicy()` 的唯一区别是能区分两种「拿不到策略」：
   * - 返回 `null`：新 key 与旧 key 在服务器上都确实不存在（SDK 对 404 返回 null），
   *   账号还没存过策略，调用方可以安全地以默认策略为基线创建；
   * - 抛错：读取真的失败（网络 / 鉴权等），此时**无法判断**账号上有没有策略。
   *
   * read-modify-write 的写前重读必须走这里：读取失败就中止写入并走错误反馈，
   * 绝不能回落默认值再写回——那会把用户已有的策略整份覆盖掉，
   * 而且因为随后的 PUT 成功，调用方还会以为保存成功了。
   */
  async getInvitePolicyStrict(): Promise<InvitePolicy | null> {
    const client = this.getClient()

    const accountData = await client.getAccountDataFromServer(INVITE_POLICY_ACCOUNT_DATA_TYPE)
    if (accountData) {
      const policy = normalizeInvitePolicy(accountData)
      cacheInvitePolicy(policy, client.getUserId())
      logger.info(`[MatrixAccount] 获取邀请策略成功: mode=${policy.mode}`)
      return policy
    }

    const legacy = await client.getAccountDataFromServer(LEGACY_INVITE_POLICY_ACCOUNT_DATA_TYPE)
    if (legacy) {
      const policy = normalizeInvitePolicy(legacy)
      cacheInvitePolicy(policy, client.getUserId())
      logger.info(`[MatrixAccount] 已从旧 key 迁移邀请策略: mode=${policy.mode}`)
      return policy
    }

    return null
  }

  /**
   * 写入邀请策略。
   *
   * 写入成功后同步本地缓存，保证离线/未登录时策略不回退到 allow_all。
   */
  async setInvitePolicy(policy: InvitePolicy): Promise<boolean> {
    const client = this.getClient()
    const normalized = normalizeInvitePolicy(policy)

    try {
      await client.setAccountData(INVITE_POLICY_ACCOUNT_DATA_TYPE, { ...normalized })
      cacheInvitePolicy(normalized, client.getUserId())
      logger.info(`[MatrixAccount] 设置邀请策略成功: mode=${normalized.mode}`)
      return true
    } catch (err) {
      logger.error(`[MatrixAccount] 设置邀请策略失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取 homeserver 能力表。
   * 优先经 Worker 线程单次请求以避免阻塞主线程，失败降级到 SDK（拼回 capabilities + unstable_features）。
   */
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
          logger.warn(`[MatrixAccount] getCapabilities() 失败（worker）: ${detail}, 降级到 SDK`)
        }
      } else {
        logger.warn('[MatrixAccount] getCapabilities() worker 已启动但无 accessToken, 降级到 SDK')
      }
    }

    // 非 worker 路径：回归 SDK。SDK 已把顶层 unstable_features 单独缓存
    // （`ServerCapabilities.fetchCapabilities`），因此 `getCapabilities()` 拿能力表、
    // `getUnstableFeatures()` 拿开关，两者拼回完整响应体，无需第二次 HTTP 请求。
    try {
      const capabilities = await client.getCapabilities()
      const unstableFeatures = client.getUnstableFeatures()
      const result: Record<string, unknown> = { ...capabilities }
      if (unstableFeatures) result.unstable_features = unstableFeatures
      logger.debug('[MatrixAccount] getCapabilities() 成功（SDK）')
      return result
    } catch (err) {
      const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
      logger.error(`[MatrixAccount] getCapabilities() 失败: ${detail}`)
      return {}
    }
  }

  /** 获取 homeserver 支持的第三方协议（身份服务器等）；失败返回空对象。 */
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
   * 获取当前用户的全部房间（含邀请中与已离开），按 membership 分组展示。
   *
   * 优先委托 SDK `client.getRoomManager().getMyRooms()`（命中 synapse-rust 私有端点
   * `/_matrix/vendor/v1/my_rooms`，SDK 已做 membership/join_state 归一）。
   * 当 SDK 方法不可用或端点 404 时，降级为 SDK 标准 `getJoinedRooms()`。
   */
  async getMyRooms(): Promise<MyRoomEntry[]> {
    const client = this.getClient()
    const roomManager = (client as MatrixClient & MyRoomsCapableClient).getRoomManager?.()

    if (typeof roomManager?.getMyRooms !== 'function') {
      logger.info('[MatrixAccount] SDK getMyRooms() 不可用，降级使用 getJoinedRooms()')
      return this.getJoinedRoomsAsMyRooms(client)
    }

    try {
      const response = await roomManager.getMyRooms()
      return toMyRoomEntries(response?.rooms)
    } catch (err) {
      // 降级判据（审计 §8 B-5 反例断言）：仅以 `err.httpStatus === 404` 判定，
      // 不得引入 httpStatus 之外的隐式条件（如消息文本、errcode 猜测）触发降级。
      const statusCode = (err as { httpStatus?: number }).httpStatus
      if (statusCode === 404) {
        logger.info('[MatrixAccount] /my_rooms 端点不可用(404)，降级使用 getJoinedRooms()')
        return this.getJoinedRoomsAsMyRooms(client)
      }
      logger.error(`[MatrixAccount] 获取我的房间列表失败: ${err}`)
      return []
    }
  }

  /**
   * `/my_rooms` 不可用时的降级实现：仅返回已加入房间，membership 固定为 join。
   *
   * 语义差异（审计 §8 B-5）：私有端点返回后端自定义视图（含排序与私有房间可见性），
   * 而 `getJoinedRooms()` 命中标准端点且未经排序；本降级仅保证功能可用，调用方不得依赖顺序。
   */
  private async getJoinedRoomsAsMyRooms(client: MatrixClient): Promise<MyRoomEntry[]> {
    try {
      const { joined_rooms } = await client.getJoinedRooms()
      return joined_rooms.map((roomId) => ({ roomId, membership: 'join' }))
    } catch (fallbackErr) {
      logger.error(`[MatrixAccount] 降级 getJoinedRooms() 也失败: ${fallbackErr}`)
      return []
    }
  }

  /** 拉取 `/events` 事件流（长轮询，带 timeout）；失败返回空对象。 */
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
