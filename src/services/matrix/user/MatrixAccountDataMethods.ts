import { authedRequestWithPath } from '@/services/matrix/MatrixHttpClient'
import { matrixWorkerHost } from '@/services/matrix/MatrixWorkerHost'
import { getMatrixAccessToken } from '@/services/matrix/matrixClientAccessor'
import type { Capabilities, IContent, IProtocol, MatrixClient } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import {
  cacheInvitePolicy,
  INVITE_POLICY_ACCOUNT_DATA_TYPE,
  type InvitePolicy,
  normalizeInvitePolicy
} from './invitePolicy'
import { type AuthData, MatrixAccountProfileDeviceMethods } from './MatrixAccountProfileDeviceMethods'

const logger = createLogger('MatrixAccountService')

/** 旧版本账号级策略 key；与后端房间级表名同名，仅用于一次性迁移读取。 */
const LEGACY_INVITE_POLICY_ACCOUNT_DATA_TYPE = 'im.hula.invite_blocklist'

/** 我的房间条目：SDK `/my_rooms` 视图归一后的前端模型。 */
export interface MyRoomEntry {
  roomId: string
  name?: string | undefined
  avatarUrl?: string | undefined
  membership: 'join' | 'invite' | 'leave' | string
}

/**
 * `/events` 返回的原始客户端事件条目：字段随事件类型变化，属真·动态包。
 */
interface EventStreamChunkItem {
  type?: string
  sender?: string
  event_id?: string
  origin_server_ts?: number
  content?: IContent
  [field: string]: unknown
}

/**
 * `GET /events` 长轮询响应。
 * `chunk` 为原始客户端事件 JSON（字段随事件类型变化，保持开放），
 * 失败时本服务返回空对象，故全部字段可选。
 */
interface EventStreamResponse {
  chunk?: EventStreamChunkItem[]
  start?: string
  end?: string
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

/** SDK `/my_rooms` 返回的原始房间条目：字段类型不保证，逐项校验。 */
interface RawMyRoomEntry {
  room_id?: unknown
  membership?: unknown
  join_state?: unknown
  name?: unknown
  avatar_url?: unknown
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
    const record = room as RawMyRoomEntry
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

/**
 * MatrixAccountService 的账号数据 / 邀请策略 / 能力表 / 房间列表方法片段。
 *
 * 从 `MatrixAccountService`（原 702 行）抽离，单独成混入类可把门面文件
 * 控制在 400 行门槛以内；方法签名与日志 tag 保持不变。
 */
export abstract class MatrixAccountDataMethods extends MatrixAccountProfileDeviceMethods {
  async getAccountData<T = IContent>(eventType: string): Promise<T | null> {
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
  async getCapabilities(): Promise<Capabilities> {
    const client = this.getClient()
    logger.debug(`[MatrixAccount] getCapabilities() 开始: workerStarted=${matrixWorkerHost.isStarted}`)

    // Worker 路径：在 worker 线程发起单次请求，避免阻塞主线程
    if (matrixWorkerHost.isStarted) {
      // token 走唯一读入口（AR-07b）：直读 `client.getAccessToken()` 会让
      // check-matrix-layering 记一条新的 token_read_site，且刷新后可能拿到陈旧值
      // （MatrixTokenManager 只回写 Rust 侧）。
      const accessToken = getMatrixAccessToken()
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
      const result: Capabilities = { ...capabilities }
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
  async getThirdPartyProtocols(): Promise<Record<string, IProtocol>> {
    const client = this.getClient()

    try {
      const result = await client.getThirdpartyProtocols()
      logger.info('[MatrixAccount] 获取第三方协议成功')
      return result
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
  async getEventStream(from?: string, timeout: number = 30000): Promise<EventStreamResponse> {
    const client = this.getClient()

    try {
      const queryParams: Record<string, string> = { timeout: String(timeout) }
      if (from) queryParams.from = from
      const result = await authedRequestWithPath<EventStreamResponse>(client, 'GET', '/events', queryParams)
      return result
    } catch (err) {
      logger.error(`[MatrixAccount] 获取事件流失败: ${err}`)
      return {}
    }
  }
}
