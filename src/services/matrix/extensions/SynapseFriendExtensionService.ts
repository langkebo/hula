import { createLogger } from '@/utils/Logger'
import endpointCapabilityService from '../EndpointCapabilityService'
import { normalizeFriendInfoList } from '../friends/friendUtils'
import { matrixCapabilityService } from '../MatrixCapabilityService'
import { MATRIX_PATHS } from '../paths'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseFriendExtensionService')

/** 后端 `limit` 只接受 1..=200；页数上限防异常游标导致的无界循环。 */
const FRIEND_LIST_PAGE_SIZE = 200
const MAX_FRIEND_LIST_PAGES = 10

export interface SynapseFriendInfo {
  user_id: string
  display_name?: string
  displayname?: string
  username?: string
  avatar_url?: string
  since: number
  status?: string
  presence?: string
  online?: boolean
  last_active?: number
  last_active_ts?: number
  note?: string
  dm_room_id?: string
  is_private?: boolean
}

/**
 * 好友请求条目。真实形状以 REST 回退端点为准（实测）：
 * `{user_id, message, timestamp, status}` —— 后端按「对端视角」建模，只给对端 `user_id`。
 * 其余字段为兼容 FriendManager / 旧后端的可选历史字段。
 */
export interface SynapseFriendRequest {
  /** 对端用户 ID（incoming = 发起人；outgoing = 接收人） */
  user_id?: string
  message?: string
  /** 毫秒时间戳（REST 字段名） */
  timestamp?: number
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'declined'
  /** @deprecated 旧形状：请求序号（REST 不再返回） */
  request_id?: number | string
  /** @deprecated 旧形状：发起人（改用 `user_id`） */
  requester?: string
  /** @deprecated 旧形状：接收人（改用 `user_id`） */
  recipient?: string
  /** @deprecated 旧形状：改用 `timestamp` */
  created_ts?: number
}

export interface SynapsePendingRequests {
  incoming: SynapseFriendRequest[]
  outgoing: SynapseFriendRequest[]
}

export interface SynapseFriendSearchResult {
  user_id: string
  username?: string
  displayname?: string
  avatar_url?: string
  presence?: string
  online?: boolean
  last_active_ts?: number
  last_seen_ts?: number
  created_ts?: number
  match_score?: number
  match_type?: string
}

export interface SynapseCheckFriendshipResult {
  are_friends: boolean
}

/** synapse-rust 好友关系扩展（`/_matrix/vendor/v1/friends/*`），仅承载好友域方法。 */
class SynapseFriendExtensionService extends SynapseExtensionHttpBase {
  private hasLoggedFriendsBeforeClientReady = false

  override clear(): void {
    super.clear()
    endpointCapabilityService.clear('friends')
  }

  private async isFriendEndpointAvailable(): Promise<boolean> {
    // 优先声明式能力检测（versions 的 io.hula.friends），比 HEAD 探测可靠
    if (matrixCapabilityService.canUseFriendList()) {
      return true
    }
    return await endpointCapabilityService.check('GET', MATRIX_PATHS.FRIENDS.LIST)
  }

  /** 获取好友列表（自动翻页，跟随 `next_batch`）。
   *
   * 后端是游标分页：`limit` 默认 50、上限 200；旧实现不传不读 ⇒ 超过 50 静默截断。
   */
  async getFriends(): Promise<SynapseFriendInfo[]> {
    try {
      if (!(await this.isFriendEndpointAvailable())) {
        logger.info('[SynapseRust] 好友端点不可用，已降级')
        return []
      }

      const seen = new Set<string>()
      const collected: SynapseFriendInfo[] = []
      let from: string | undefined

      for (let page = 0; page < MAX_FRIEND_LIST_PAGES; page++) {
        const query = new URLSearchParams({ limit: String(FRIEND_LIST_PAGE_SIZE) })
        if (from) query.set('from', from)
        const response = await this.request<{
          friends?: SynapseFriendInfo[]
          items?: SynapseFriendInfo[]
          data?: SynapseFriendInfo[]
          next_batch?: string | null
        }>(`${MATRIX_PATHS.FRIENDS.LIST}?${query.toString()}`, { method: 'GET' })

        // FT-092: 后端已移除冗余 items 字段，优先 friends
        const arrayField = Array.isArray(response) ? response : (response?.friends ?? response?.items ?? response?.data)
        const list: SynapseFriendInfo[] = Array.isArray(arrayField) ? arrayField : []

        for (const friend of list) {
          if (!friend?.user_id || seen.has(friend.user_id)) continue
          seen.add(friend.user_id)
          collected.push(friend)
        }

        const nextBatch = Array.isArray(response) ? null : (response?.next_batch ?? null)
        if (!nextBatch || list.length === 0 || nextBatch === from) break
        from = nextBatch
      }

      this.hasLoggedFriendsBeforeClientReady = collected.length === 0
      return collected.length > 0 ? normalizeFriendInfoList(collected) : []
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'MatrixClient 未在指定时间内就绪' || err.message === '客户端未初始化')
      ) {
        if (!this.hasLoggedFriendsBeforeClientReady) {
          this.hasLoggedFriendsBeforeClientReady = true
          logger.info('[SynapseRust] Matrix 客户端未就绪，返回空好友列表')
        }
        return []
      }
      logger.error(`[SynapseRust] 获取好友列表失败: ${err}`)
      return []
    }
  }

  /** 发送好友请求。
   *
   * `request_id` 是**字符串**（后端 `resolve_request_id()` 返回 `X-Request-Id` 或
   * `req-<uuid>`，实测 `"82"`），不是数值主键。旧声明 `number` 与运行时不符。
   */
  async sendFriendRequest(
    userId: string,
    message?: string,
    options: { idempotencyKey?: string } = {}
  ): Promise<{
    request_id: string
    status: string
  }> {
    try {
      if (!(await this.isFriendEndpointAvailable())) return { request_id: '', status: 'unavailable' }
      // 后端读的是 `X-Request-Id`（`resolve_request_id`）⇒ 两个头都带，兼容两种实现
      const headers: Record<string, string> = {}
      if (options.idempotencyKey) {
        headers['Idempotency-Key'] = options.idempotencyKey
        headers['X-Request-Id'] = options.idempotencyKey
      }
      const response = await this.request<{
        request_id?: string | number
        status?: string
        data?: { request_id: string | number; status: string }
      }>(MATRIX_PATHS.FRIENDS.REQUEST, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, message }),
        headers
      })

      let data: { request_id: string; status: string } | undefined
      if (response && typeof response === 'object') {
        const payload = 'data' in response && response.data ? response.data : null
        const rawId = payload ? payload.request_id : response.request_id
        const rawStatus = payload ? payload.status : response.status
        if (rawId !== undefined && rawId !== null) {
          // 统一成字符串：后端可能是 `"82"`，FriendManager 可能是 `82`
          data = { request_id: String(rawId), status: rawStatus || 'pending' }
        }
      }

      return data || { request_id: '', status: 'error' }
    } catch (err) {
      logger.error(`[SynapseRust] 发送好友请求失败: ${err}`)
      throw err
    }
  }

  async searchFriends(
    query: string,
    options: { limit?: number; mode?: 'exact' | 'fuzzy' } = {}
  ): Promise<SynapseFriendSearchResult[]> {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return []
    }
    if (!(await this.isFriendEndpointAvailable())) return []

    try {
      const searchParams = new URLSearchParams({
        q: trimmedQuery,
        limit: String(options.limit ?? 20),
        mode: options.mode ?? 'fuzzy'
      })
      const response = await this.request<{
        results?: SynapseFriendSearchResult[]
        data?: SynapseFriendSearchResult[]
      }>(`${MATRIX_PATHS.FRIENDS.SEARCH}?${searchParams.toString()}`, { method: 'GET' })

      if (response && typeof response === 'object') {
        const arrayField = response.results ?? response.data
        if (Array.isArray(arrayField)) return arrayField
      }

      return Array.isArray(response) ? response : []
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'MatrixClient 未在指定时间内就绪' || err.message === '客户端未初始化')
      ) {
        if (!this.hasLoggedFriendsBeforeClientReady) {
          this.hasLoggedFriendsBeforeClientReady = true
          logger.info('[SynapseRust] Matrix 客户端未就绪，返回空好友搜索结果')
        }
        return []
      }

      this.hasLoggedFriendsBeforeClientReady = false
      logger.error(`[SynapseRust] 搜索好友失败: ${err}`)
      return []
    }
  }

  /** 获取待处理的好友请求
   */
  async getPendingRequests(): Promise<SynapsePendingRequests> {
    try {
      if (!(await this.isFriendEndpointAvailable())) return { incoming: [], outgoing: [] }
      const [incomingResult, outgoingResult] = await Promise.allSettled([
        this.request<{ requests?: SynapseFriendRequest[]; data?: SynapseFriendRequest[] }>(
          MATRIX_PATHS.FRIENDS.INCOMING_REQUESTS,
          { method: 'GET' }
        ),
        this.request<{ requests?: SynapseFriendRequest[]; data?: SynapseFriendRequest[] }>(
          MATRIX_PATHS.FRIENDS.OUTGOING_REQUESTS,
          { method: 'GET' }
        )
      ])

      const extractRequests = (response: unknown): SynapseFriendRequest[] => {
        if (response && typeof response === 'object') {
          const res = response as { requests?: SynapseFriendRequest[]; data?: SynapseFriendRequest[] }
          const arrayField = res.requests ?? res.data
          if (Array.isArray(arrayField)) return arrayField
        }
        return Array.isArray(response) ? response : []
      }

      const incomingResponse = incomingResult.status === 'fulfilled' ? incomingResult.value : null
      const outgoingResponse = outgoingResult.status === 'fulfilled' ? outgoingResult.value : null

      return {
        incoming: extractRequests(incomingResponse),
        outgoing: extractRequests(outgoingResponse)
      }
    } catch (err) {
      logger.error(`[SynapseRust] 获取待处理请求失败: ${err}`)
      return { incoming: [], outgoing: [] }
    }
  }

  /** 接受好友请求
   */
  async acceptFriendRequest(userId: string): Promise<{
    status: string
    room_id: string
  }> {
    try {
      if (!(await this.isFriendEndpointAvailable())) return { status: 'unavailable', room_id: '' }
      const response = await this.request<{
        status?: string
        room_id?: string
        data?: { status: string; room_id: string }
      }>(MATRIX_PATHS.FRIENDS.ACCEPT(encodeURIComponent(userId)), {
        method: 'POST',
        body: JSON.stringify({})
      })

      let data: { status: string; room_id: string } | undefined
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          data = response.data
        } else if ('status' in response) {
          data = { status: response.status!, room_id: response.room_id || '' }
        }
      }

      logger.info(`[SynapseRust] 接受好友请求成功: ${userId}`)
      return data || { status: 'error', room_id: '' }
    } catch (err) {
      logger.error(`[SynapseRust] 接受好友请求失败: ${err}`)
      throw err
    }
  }

  /** 拒绝好友请求
   */
  async declineFriendRequest(userId: string): Promise<void> {
    try {
      if (!(await this.isFriendEndpointAvailable())) return
      await this.request(MATRIX_PATHS.FRIENDS.REJECT(encodeURIComponent(userId)), {
        method: 'POST',
        body: JSON.stringify({})
      })
      logger.info(`[SynapseRust] 拒绝好友请求成功: ${userId}`)
    } catch (err) {
      logger.error(`[SynapseRust] 拒绝好友请求失败: ${err}`)
      throw err
    }
  }

  /** 取消好友请求
   */
  async cancelFriendRequest(userId: string): Promise<void> {
    try {
      if (!(await this.isFriendEndpointAvailable())) return
      await this.request(MATRIX_PATHS.FRIENDS.CANCEL(encodeURIComponent(userId)), {
        method: 'POST',
        body: JSON.stringify({})
      })
      logger.info(`[SynapseRust] 取消好友请求成功: ${userId}`)
    } catch (err) {
      logger.error(`[SynapseRust] 取消好友请求失败: ${err}`)
      throw err
    }
  }

  /** 删除好友
   */
  async removeFriend(userId: string): Promise<void> {
    try {
      if (!(await this.isFriendEndpointAvailable())) return
      await this.request(MATRIX_PATHS.FRIENDS.REMOVE(encodeURIComponent(userId)), {
        method: 'DELETE'
      })
      logger.info(`[SynapseRust] 删除好友成功: ${userId}`)
    } catch (err) {
      logger.error(`[SynapseRust] 删除好友失败: ${err}`)
      throw err
    }
  }

  /** 设置好友备注
   */
  async setFriendNote(userId: string, note: string): Promise<void> {
    try {
      if (!(await this.isFriendEndpointAvailable())) return
      await this.request(MATRIX_PATHS.FRIENDS.NOTE(encodeURIComponent(userId)), {
        method: 'PUT',
        body: JSON.stringify({ note })
      })
      logger.info(`[SynapseRust] 设置好友备注成功: ${userId}`)
    } catch (err) {
      logger.error(`[SynapseRust] 设置好友备注失败: ${err}`)
      throw err
    }
  }

  /** 检查好友关系状态
   */
  async checkFriendship(userId: string): Promise<boolean> {
    try {
      if (!(await this.isFriendEndpointAvailable())) return false
      const response = await this.request<SynapseCheckFriendshipResult | { data?: SynapseCheckFriendshipResult }>(
        MATRIX_PATHS.FRIENDS.CHECK(encodeURIComponent(userId)),
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      return data?.are_friends || false
    } catch (err) {
      logger.error(`[SynapseRust] 检查好友关系失败: ${err}`)
      return false
    }
  }
}

export const synapseFriendExtensionService = new SynapseFriendExtensionService()
