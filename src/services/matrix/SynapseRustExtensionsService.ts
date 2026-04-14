import { info } from '@tauri-apps/plugin-log'
import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'

export interface SynapseFriendInfo {
  user_id: string
  display_name?: string
  avatar_url?: string
  since: number
  status?: string
  last_active?: number
  note?: string
  dm_room_id?: string
  is_private?: boolean
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

export interface SynapseCreateDmResult {
  room_id: string
  created: boolean
}

export interface SynapseDmInfo {
  room_id: string
  exists: boolean
}

export interface SynapseCheckFriendshipResult {
  are_friends: boolean
}

export interface SynapseFriendNoteResult {
  status: string
}

export interface BurnStats {
  total_burned: number
  total_pending: number
  rooms_with_burn_enabled: number
}

export interface InviteBlocklist {
  blocked_users: string[]
  updated_ts: number
}

export interface InviteAllowlist {
  allowed_users: string[]
  updated_ts: number
}

export interface StickyEvent {
  event_id: string
  event_type: string
  content: Record<string, unknown>
  updated_ts: number
}

export interface RoomSummary {
  room_id: string
  name?: string
  topic?: string
  avatar_url?: string
  heroes: RoomSummaryMember[]
  stats: RoomSummaryStats
}

export interface RoomSummaryMember {
  user_id: string
  display_name?: string
  avatar_url?: string
  membership: string
  is_hero: boolean
}

export interface RoomSummaryStats {
  room_id: string
  total_events: number
  total_messages: number
  total_media: number
  storage_size: number
}

class SynapseRustExtensionsService extends BaseManager {
  private baseUrl: string = ''
  private accessToken: string = ''

  async initialize(): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }

    this.baseUrl = client.getHomeserverUrl()
    this.accessToken = client.getAccessToken() || ''

    if (!this.accessToken) {
      return
    }

    info('[SynapseRust] SynapseRustExtensionsService 初始化完成')
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...options.headers
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || data.error || 'API 请求失败')
    }

    return data as T
  }

  private getData<T>(response: { data?: T; status: string; code?: string; message?: string }): T {
    if (response.status === 'error') {
      throw new Error(response.message || '请求失败')
    }
    return response.data as T
  }

  async getFriends(): Promise<SynapseFriendInfo[]> {
    try {
      const response = await this.request<{ data?: SynapseFriendInfo[] }>('/_matrix/client/v1/friends', {
        method: 'GET'
      })
      return this.getData({ ...response, status: 'ok' }) || []
    } catch (_err) {
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
    const response = await this.request<{
      data?: { request_id: number; status: string }
    }>('/_matrix/client/v1/friends/request', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, message })
    })
    const data = this.getData({ ...response, status: 'ok' })
    info(`[SynapseRust] 发送好友请求成功: ${userId}`)
    return data || { request_id: 0, status: 'error' }
  }

  async getPendingRequests(): Promise<SynapsePendingRequests> {
    try {
      const response = await this.request<{
        data?: SynapseFriendRequest[]
      }>('/_matrix/client/v1/friends/requests', { method: 'GET' })
      const requests = this.getData({ ...response, status: 'ok' }) || []

      const currentUserId = matrixClientService.getClient()?.getUserId()

      return {
        incoming: requests.filter((r) => r.recipient === currentUserId),
        outgoing: requests.filter((r) => r.requester === currentUserId)
      }
    } catch (_err) {
      return { incoming: [], outgoing: [] }
    }
  }

  async acceptFriendRequest(requestId: number): Promise<{
    status: string
    dm_room_id: string
    friend: SynapseFriendInfo
  }> {
    const response = await this.request<{
      data?: {
        status: string
        dm_room_id: string
        friend: SynapseFriendInfo
      }
    }>(`/_matrix/client/v1/friends/request/${requestId}/accept`, { method: 'POST', body: JSON.stringify({}) })
    const data = this.getData({ ...response, status: 'ok' })
    info(`[SynapseRust] 接受好友请求成功: ${requestId}`)
    return data || { status: 'error', dm_room_id: '', friend: {} as SynapseFriendInfo }
  }

  async declineFriendRequest(requestId: number): Promise<void> {
    await this.request(`/_matrix/client/v1/friends/request/${requestId}/decline`, {
      method: 'POST',
      body: JSON.stringify({})
    })
    info(`[SynapseRust] 拒绝好友请求成功: ${requestId}`)
  }

  async removeFriend(userId: string): Promise<void> {
    await this.request('/_matrix/client/v1/friends', {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId })
    })
    info(`[SynapseRust] 删除好友成功: ${userId}`)
  }

  async setFriendNote(userId: string, note: string): Promise<void> {
    await this.request('/_matrix/client/v1/friends/note', {
      method: 'PUT',
      body: JSON.stringify({ user_id: userId, note })
    })
    info(`[SynapseRust] 设置好友备注成功: ${userId}`)
  }

  async checkFriendship(userId: string): Promise<boolean> {
    try {
      const response = await this.request<{
        data?: SynapseCheckFriendshipResult
      }>(`/_matrix/client/v1/friends/check/${encodeURIComponent(userId)}`, { method: 'GET' })
      const data = this.getData({ ...response, status: 'ok' })
      return data?.are_friends || false
    } catch (_err) {
      return false
    }
  }

  async createPrivateDm(userId: string, isPrivate = true): Promise<SynapseCreateDmResult> {
    const response = await this.request<{
      data?: SynapseCreateDmResult
    }>(`/_matrix/client/v1/friends/dm/${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify({ is_private: isPrivate })
    })
    const data = this.getData({ ...response, status: 'ok' })
    info(`[SynapseRust] 创建私密私信房间: ${userId}, isPrivate=${isPrivate}`)
    return data || { room_id: '', created: false }
  }

  async getDmRoom(userId: string): Promise<SynapseDmInfo> {
    try {
      const response = await this.request<{
        data?: SynapseDmInfo
      }>(`/_matrix/client/v1/friends/dm/${encodeURIComponent(userId)}`, { method: 'GET' })
      const data = this.getData({ ...response, status: 'ok' })
      return data || { room_id: '', exists: false }
    } catch (_err) {
      return { room_id: '', exists: false }
    }
  }

  async getBurnStats(): Promise<BurnStats> {
    try {
      const response = await this.request<{
        data?: BurnStats
      }>('/_matrix/client/v1/user/burn/stats', { method: 'GET' })
      const data = this.getData({ ...response, status: 'ok' })
      info(`[SynapseRust] 获取阅后即焚统计成功: ${JSON.stringify(data)}`)
      return data || { total_burned: 0, total_pending: 0, rooms_with_burn_enabled: 0 }
    } catch (_err) {
      return { total_burned: 0, total_pending: 0, rooms_with_burn_enabled: 0 }
    }
  }

  async getInviteBlocklist(roomId: string): Promise<InviteBlocklist> {
    try {
      const response = await this.request<{
        data?: InviteBlocklist
      }>(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_blocklist`, { method: 'GET' })
      const data = this.getData({ ...response, status: 'ok' })
      info(`[SynapseRust] 获取邀请屏蔽列表成功: roomId=${roomId}`)
      return data || { blocked_users: [], updated_ts: 0 }
    } catch (_err) {
      return { blocked_users: [], updated_ts: 0 }
    }
  }

  async setInviteBlocklist(roomId: string, userIds: string[]): Promise<void> {
    await this.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_blocklist`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds })
    })
    info(`[SynapseRust] 设置邀请屏蔽列表成功: roomId=${roomId}, count=${userIds.length}`)
  }

  async getInviteAllowlist(roomId: string): Promise<InviteAllowlist> {
    try {
      const response = await this.request<{
        data?: InviteAllowlist
      }>(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_allowlist`, { method: 'GET' })
      const data = this.getData({ ...response, status: 'ok' })
      info(`[SynapseRust] 获取邀请白名单成功: roomId=${roomId}`)
      return data || { allowed_users: [], updated_ts: 0 }
    } catch (_err) {
      return { allowed_users: [], updated_ts: 0 }
    }
  }

  async setInviteAllowlist(roomId: string, userIds: string[]): Promise<void> {
    await this.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_allowlist`, {
      method: 'POST',
      body: JSON.stringify({ user_ids: userIds })
    })
    info(`[SynapseRust] 设置邀请白名单成功: roomId=${roomId}, count=${userIds.length}`)
  }

  async getStickyEvents(roomId: string): Promise<StickyEvent[]> {
    try {
      const response = await this.request<{
        data?: StickyEvent[]
      }>(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events`, { method: 'GET' })
      const data = this.getData({ ...response, status: 'ok' })
      info(`[SynapseRust] 获取粘性事件成功: roomId=${roomId}`)
      return data || []
    } catch (_err) {
      return []
    }
  }

  async setStickyEvent(roomId: string, eventId: string, eventType: string): Promise<void> {
    await this.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events`, {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, event_type: eventType })
    })
    info(`[SynapseRust] 设置粘性事件成功: roomId=${roomId}, eventId=${eventId}`)
  }

  async clearStickyEvent(roomId: string, eventType: string): Promise<void> {
    await this.request(
      `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events/${encodeURIComponent(eventType)}`,
      { method: 'DELETE' }
    )
    info(`[SynapseRust] 清除粘性事件成功: roomId=${roomId}, eventType=${eventType}`)
  }

  async getRoomSummary(roomId: string): Promise<RoomSummary | null> {
    try {
      const response = await this.request<{
        data?: RoomSummary
      }>(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary`, { method: 'GET' })
      const data = this.getData({ ...response, status: 'ok' })
      info(`[SynapseRust] 获取房间摘要成功: roomId=${roomId}`)
      return data || null
    } catch (_err) {
      return null
    }
  }

  async getRoomSummaryHeroes(roomId: string): Promise<RoomSummaryMember[]> {
    try {
      const response = await this.request<{
        data?: RoomSummaryMember[]
      }>(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary/members`, { method: 'GET' })
      const data = this.getData({ ...response, status: 'ok' })
      const heroes = (data || []).filter((m: RoomSummaryMember) => m.is_hero)
      info(`[SynapseRust] 获取房间英雄成员成功: roomId=${roomId}, count=${heroes.length}`)
      return heroes
    } catch (_err) {
      return []
    }
  }

  async getRoomSummaryStats(roomId: string): Promise<RoomSummaryStats | null> {
    try {
      const response = await this.request<{
        data?: RoomSummaryStats
      }>(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary/stats`, { method: 'GET' })
      const data = this.getData({ ...response, status: 'ok' })
      info(`[SynapseRust] 获取房间摘要统计成功: roomId=${roomId}`)
      return data || null
    } catch (_err) {
      return null
    }
  }

  stop(): void {
    this.accessToken = ''
    info('[SynapseRust] SynapseRustExtensionsService 已停止')
  }
}

export const synapseRustExtensionsService = new SynapseRustExtensionsService()
export default synapseRustExtensionsService
