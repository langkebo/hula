import { createLogger } from '@/utils/Logger'
import endpointCapabilityService from '../EndpointCapabilityService'
import { matrixCapabilityService } from '../MatrixCapabilityService'
import { MATRIX_PATHS } from '../paths'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseFriendExtensionService')

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

function normalizeFriendInfo(friend: SynapseFriendInfo): SynapseFriendInfo {
  const displayName = friend.display_name || friend.displayname || friend.username || friend.user_id
  return {
    ...friend,
    display_name: displayName,
    displayname: displayName,
    username: friend.username || displayName
  }
}

function normalizeFriendInfoList(friends: SynapseFriendInfo[]): SynapseFriendInfo[] {
  return friends.map(normalizeFriendInfo)
}

export interface SynapseFriendRequest {
  request_id: number
  requester: string
  recipient: string
  message?: string
  status: 'pending' | 'accepted' | 'declined'
  created_ts: number
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

/**
 * synapse-rust 好友关系扩展（/_matrix/client/v1/friends/*）。
 * 从 SynapseRustExtensionsService 拆分而来，仅承载好友域方法。
 */
class SynapseFriendExtensionService extends SynapseExtensionHttpBase {
  private hasLoggedFriendsBeforeClientReady = false

  override clear(): void {
    super.clear()
    endpointCapabilityService.clear('friends')
  }

  private async isFriendEndpointAvailable(): Promise<boolean> {
    // 优先使用声明式能力检测（通过 /_matrix/client/versions 的 io.hula.friends 特性标志）
    // 这比 HEAD 请求探测更可靠，尤其在 Tauri 环境中 WKWebView 可能限制直接 fetch
    if (matrixCapabilityService.canUseFriendList()) {
      return true
    }
    // 声明式检测不可用时，回退到 HEAD 请求探测
    return await endpointCapabilityService.check('GET', MATRIX_PATHS.FRIENDS.LIST)
  }

  async getFriends(): Promise<SynapseFriendInfo[]> {
    try {
      if (!(await this.isFriendEndpointAvailable())) {
        logger.info('[SynapseRust] 好友端点不可用，已降级')
        return []
      }

      const response = await this.request<{
        friends?: SynapseFriendInfo[]
        items?: SynapseFriendInfo[]
        data?: SynapseFriendInfo[]
      }>(MATRIX_PATHS.FRIENDS.LIST, {
        method: 'GET'
      })
      if (response && typeof response === 'object') {
        // FT-092: 后端 GET /friends 已移除冗余 items 字段，优先使用 friends 字段
        const arrayField = response.friends ?? response.items ?? response.data
        if (Array.isArray(arrayField)) {
          // 按 user_id 去重，防止后端返回重复数据
          const seen = new Set<string>()
          const deduped = arrayField.filter((f: SynapseFriendInfo) => {
            if (!f.user_id || seen.has(f.user_id)) return false
            seen.add(f.user_id)
            return true
          })
          return normalizeFriendInfoList(deduped)
        }
        if (Array.isArray(response)) {
          return response
        }
      }
      this.hasLoggedFriendsBeforeClientReady = false
      return normalizeFriendInfoList((Array.isArray(response) ? response : []) as SynapseFriendInfo[])
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

  async sendFriendRequest(
    userId: string,
    message?: string
  ): Promise<{
    request_id: number
    status: string
  }> {
    try {
      if (!(await this.isFriendEndpointAvailable())) return { request_id: 0, status: 'unavailable' }
      const response = await this.request<{
        request_id?: number
        status?: string
        data?: { request_id: number; status: string }
      }>(MATRIX_PATHS.FRIENDS.REQUEST, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, message })
      })

      let data: { request_id: number; status: string } | undefined
      if (response && typeof response === 'object') {
        if ('data' in response && response.data) {
          data = response.data
        } else if ('request_id' in response) {
          data = { request_id: response.request_id!, status: response.status || 'pending' }
        }
      }

      logger.info(`[SynapseRust] 发送好友请求成功: ${userId}`)
      return data || { request_id: 0, status: 'error' }
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
