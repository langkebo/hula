import { error, info } from '@tauri-apps/plugin-log'
import matrixClientService from './MatrixClientService'

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

type RoomEphemeralEvent = Record<string, unknown>

export interface StickyEvent {
  event_id: string
  event_type: string
  content: Record<string, unknown>
  updated_ts: number
}

export interface RoomSummary {
  room_id: string
  room_type?: string
  name?: string
  topic?: string
  avatar_url?: string
  canonical_alias?: string
  join_rule?: string
  history_visibility?: string
  guest_access?: string
  is_direct?: boolean
  is_space?: boolean
  is_encrypted?: boolean
  member_count?: number
  joined_member_count?: number
  invited_member_count?: number
  last_event_ts?: number
  last_message_ts?: number
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
  total_state_events?: number
  total_messages: number
  total_media: number
  storage_size: number
}

export interface RoomSummaryState {
  event_type: string
  state_key: string
  event_id: string
  content: Record<string, unknown>
}

class SynapseRustExtensionsService {
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
      error('[SynapseRust] 未获取到访问令牌')
      return
    }

    info('[SynapseRust] SynapseRustExtensionsService 初始化完成')
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.baseUrl || !this.accessToken) {
      await this.initialize()
    }

    if (!this.baseUrl || !this.accessToken) {
      throw new Error('SynapseRustExtensionsService 未初始化')
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    await this.ensureInitialized()
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
      error(`[SynapseRust] API 请求失败: ${endpoint}`, data)
      throw new Error(data.message || data.error || 'API 请求失败')
    }

    return data as T
  }

  private unwrapMaybeWrappedData<T>(
    response: T | { data?: T; status?: string; code?: string; message?: string }
  ): T | undefined {
    if (response && typeof response === 'object' && 'status' in response && response.status === 'error') {
      const errorResponse = response as { message?: string }
      throw new Error(errorResponse.message || '请求失败')
    }

    if (response && typeof response === 'object' && 'data' in response) {
      return (response as { data?: T }).data
    }

    return response as T
  }

  async getFriends(): Promise<SynapseFriendInfo[]> {
    try {
      const response = await this.request<{ friends?: SynapseFriendInfo[]; data?: SynapseFriendInfo[] }>(
        '/_matrix/client/v1/friends',
        {
          method: 'GET'
        }
      )
      // 兼容多种响应格式
      if (response && typeof response === 'object') {
        if ('friends' in response) return response.friends || []
        if ('data' in response) return response.data || []
      }
      return (Array.isArray(response) ? response : []) as SynapseFriendInfo[]
    } catch (err) {
      error(`[SynapseRust] 获取好友列表失败: ${err}`)
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
      const response = await this.request<{
        request_id?: number
        status?: string
        data?: { request_id: number; status: string }
      }>('/_matrix/client/v1/friends/request', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, message })
      })

      let data: { request_id: number; status: string } | undefined
      if (response && typeof response === 'object') {
        if ('data' in response) {
          data = response.data
        } else if ('request_id' in response) {
          data = { request_id: response.request_id!, status: response.status || 'pending' }
        }
      }

      info(`[SynapseRust] 发送好友请求成功: ${userId}`)
      return data || { request_id: 0, status: 'error' }
    } catch (err) {
      error(`[SynapseRust] 发送好友请求失败: ${err}`)
      throw err
    }
  }

  async getPendingRequests(): Promise<SynapsePendingRequests> {
    try {
      const [incomingResponse, outgoingResponse] = await Promise.all([
        this.request<{ requests?: SynapseFriendRequest[]; data?: SynapseFriendRequest[] }>(
          '/_matrix/client/v1/friends/requests/incoming',
          { method: 'GET' }
        ),
        this.request<{ requests?: SynapseFriendRequest[]; data?: SynapseFriendRequest[] }>(
          '/_matrix/client/v1/friends/requests/outgoing',
          { method: 'GET' }
        )
      ])

      const extractRequests = (response: unknown): SynapseFriendRequest[] => {
        if (response && typeof response === 'object') {
          const res = response as { requests?: SynapseFriendRequest[]; data?: SynapseFriendRequest[] }
          if ('requests' in res) return res.requests || []
          if ('data' in res) return res.data || []
        }
        return Array.isArray(response) ? response : []
      }

      return {
        incoming: extractRequests(incomingResponse),
        outgoing: extractRequests(outgoingResponse)
      }
    } catch (err) {
      error(`[SynapseRust] 获取待处理请求失败: ${err}`)
      return { incoming: [], outgoing: [] }
    }
  }

  async acceptFriendRequest(userId: string): Promise<{
    status: string
    room_id: string
  }> {
    try {
      const response = await this.request<{
        status?: string
        room_id?: string
        data?: { status: string; room_id: string }
      }>(`/_matrix/client/v1/friends/request/${encodeURIComponent(userId)}/accept`, {
        method: 'POST',
        body: JSON.stringify({})
      })

      let data: { status: string; room_id: string } | undefined
      if (response && typeof response === 'object') {
        if ('data' in response) {
          data = response.data
        } else if ('status' in response) {
          data = { status: response.status!, room_id: response.room_id || '' }
        }
      }

      info(`[SynapseRust] 接受好友请求成功: ${userId}`)
      return data || { status: 'error', room_id: '' }
    } catch (err) {
      error(`[SynapseRust] 接受好友请求失败: ${err}`)
      throw err
    }
  }

  async declineFriendRequest(userId: string): Promise<void> {
    try {
      await this.request(`/_matrix/client/v1/friends/request/${encodeURIComponent(userId)}/reject`, {
        method: 'POST',
        body: JSON.stringify({})
      })
      info(`[SynapseRust] 拒绝好友请求成功: ${userId}`)
    } catch (err) {
      error(`[SynapseRust] 拒绝好友请求失败: ${err}`)
      throw err
    }
  }

  async removeFriend(userId: string): Promise<void> {
    try {
      await this.request(`/_matrix/client/v1/friends/${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      })
      info(`[SynapseRust] 删除好友成功: ${userId}`)
    } catch (err) {
      error(`[SynapseRust] 删除好友失败: ${err}`)
      throw err
    }
  }

  async setFriendNote(userId: string, note: string): Promise<void> {
    try {
      await this.request(`/_matrix/client/v1/friends/${encodeURIComponent(userId)}/note`, {
        method: 'PUT',
        body: JSON.stringify({ note })
      })
      info(`[SynapseRust] 设置好友备注成功: ${userId}`)
    } catch (err) {
      error(`[SynapseRust] 设置好友备注失败: ${err}`)
      throw err
    }
  }

  async checkFriendship(userId: string): Promise<boolean> {
    try {
      const response = await this.request<SynapseCheckFriendshipResult | { data?: SynapseCheckFriendshipResult }>(
        `/_matrix/client/v1/friends/check/${encodeURIComponent(userId)}`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      return data?.are_friends || false
    } catch (err) {
      error(`[SynapseRust] 检查好友关系失败: ${err}`)
      return false
    }
  }

  async createPrivateDm(userId: string, isPrivate = true): Promise<SynapseCreateDmResult> {
    try {
      const response = await this.request<SynapseCreateDmResult | { data?: SynapseCreateDmResult }>(
        `/_matrix/client/v1/friends/dm/${encodeURIComponent(userId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ is_private: isPrivate })
        }
      )
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 创建私密私信房间: ${userId}, isPrivate=${isPrivate}`)
      return data || { room_id: '', created: false }
    } catch (err) {
      error(`[SynapseRust] 创建私密私信房间失败: ${err}`)
      throw err
    }
  }

  async getDmRoom(userId: string): Promise<SynapseDmInfo> {
    try {
      const response = await this.request<SynapseDmInfo | { data?: SynapseDmInfo }>(
        `/_matrix/client/v1/friends/dm/${encodeURIComponent(userId)}`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      return data || { room_id: '', exists: false }
    } catch (err) {
      error(`[SynapseRust] 获取私信房间失败: ${err}`)
      return { room_id: '', exists: false }
    }
  }

  async getBurnStats(): Promise<BurnStats> {
    try {
      const response = await this.request<BurnStats | { data?: BurnStats }>('/_matrix/client/v1/user/burn/stats', {
        method: 'GET'
      })
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 获取阅后即焚统计成功: ${JSON.stringify(data)}`)
      return data || { total_burned: 0, total_pending: 0, rooms_with_burn_enabled: 0 }
    } catch (err) {
      error(`[SynapseRust] 获取阅后即焚统计失败: ${err}`)
      return { total_burned: 0, total_pending: 0, rooms_with_burn_enabled: 0 }
    }
  }

  /**
   * 为房间启用阅后即焚功能
   * @param roomId 房间 ID
   * @param enabled 是否启用
   */
  async enableBurnAfterRead(roomId: string, enabled: boolean = true): Promise<void> {
    try {
      await this.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/burn`, {
        method: 'PUT',
        body: JSON.stringify({ enabled })
      })
      info(`[SynapseRust] ${enabled ? '启用' : '禁用'}阅后即焚成功: roomId=${roomId}`)
    } catch (err) {
      error(`[SynapseRust] ${enabled ? '启用' : '禁用'}阅后即焚失败: ${err}`)
      throw err
    }
  }

  /**
   * 检查房间是否启用了阅后即焚
   * @param roomId 房间 ID
   */
  async isBurnAfterReadEnabled(roomId: string): Promise<boolean> {
    try {
      const response = await this.request<{ enabled: boolean } | { data?: { enabled: boolean } }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/burn`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      return data?.enabled || false
    } catch (err) {
      error(`[SynapseRust] 检查阅后即焚状态失败: ${err}`)
      return false
    }
  }

  /**
   * 为房间启用防截屏功能
   * @param roomId 房间 ID
   * @param enabled 是否启用
   */
  async enableAntiScreenshot(roomId: string, enabled: boolean = true): Promise<void> {
    try {
      await this.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/anti_screenshot`, {
        method: 'PUT',
        body: JSON.stringify({ enabled })
      })
      info(`[SynapseRust] ${enabled ? '启用' : '禁用'}防截屏成功: roomId=${roomId}`)
    } catch (err) {
      error(`[SynapseRust] ${enabled ? '启用' : '禁用'}防截屏失败: ${err}`)
      throw err
    }
  }

  /**
   * 检查房间是否启用了防截屏
   * @param roomId 房间 ID
   */
  async isAntiScreenshotEnabled(roomId: string): Promise<boolean> {
    try {
      const response = await this.request<{ enabled: boolean } | { data?: { enabled: boolean } }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/anti_screenshot`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      return data?.enabled || false
    } catch (err) {
      error(`[SynapseRust] 检查防截屏状态失败: ${err}`)
      return false
    }
  }

  /**
   * 创建私密聊天房间（同时启用阅后即焚和防截屏）
   * @param userIds 用户 ID 列表
   */
  async createPrivateChat(userIds: string[]): Promise<string> {
    try {
      const response = await this.request<{ room_id: string } | { data?: { room_id: string } }>(
        '/_matrix/client/v3/rooms/create_private',
        {
          method: 'POST',
          body: JSON.stringify({
            invite: userIds,
            is_direct: userIds.length === 1,
            preset: 'trusted_private_chat',
            initial_state: [
              {
                type: 'm.room.encryption',
                content: {
                  algorithm: 'm.megolm.v1.aes-sha2'
                }
              }
            ]
          })
        }
      )
      const data = this.unwrapMaybeWrappedData(response)
      const roomId = data?.room_id

      if (!roomId) {
        throw new Error('创建房间失败：未返回房间 ID')
      }

      // 启用阅后即焚和防截屏
      await this.enableBurnAfterRead(roomId, true)
      await this.enableAntiScreenshot(roomId, true)

      info(`[SynapseRust] 创建私密聊天成功: roomId=${roomId}`)
      return roomId
    } catch (err) {
      error(`[SynapseRust] 创建私密聊天失败: ${err}`)
      throw err
    }
  }

  async getInviteBlocklist(roomId: string): Promise<InviteBlocklist> {
    try {
      const response = await this.request<InviteBlocklist | { data?: InviteBlocklist }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_blocklist`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 获取邀请屏蔽列表成功: roomId=${roomId}`)
      return data || { blocked_users: [], updated_ts: 0 }
    } catch (err) {
      error(`[SynapseRust] 获取邀请屏蔽列表失败: ${err}`)
      return { blocked_users: [], updated_ts: 0 }
    }
  }

  async setInviteBlocklist(roomId: string, userIds: string[]): Promise<void> {
    try {
      await this.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_blocklist`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds })
      })
      info(`[SynapseRust] 设置邀请屏蔽列表成功: roomId=${roomId}, count=${userIds.length}`)
    } catch (err) {
      error(`[SynapseRust] 设置邀请屏蔽列表失败: ${err}`)
      throw err
    }
  }

  async getInviteAllowlist(roomId: string): Promise<InviteAllowlist> {
    try {
      const response = await this.request<InviteAllowlist | { data?: InviteAllowlist }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_allowlist`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 获取邀请白名单成功: roomId=${roomId}`)
      return data || { allowed_users: [], updated_ts: 0 }
    } catch (err) {
      error(`[SynapseRust] 获取邀请白名单失败: ${err}`)
      return { allowed_users: [], updated_ts: 0 }
    }
  }

  async setInviteAllowlist(roomId: string, userIds: string[]): Promise<void> {
    try {
      await this.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite_allowlist`, {
        method: 'POST',
        body: JSON.stringify({ user_ids: userIds })
      })
      info(`[SynapseRust] 设置邀请白名单成功: roomId=${roomId}, count=${userIds.length}`)
    } catch (err) {
      error(`[SynapseRust] 设置邀请白名单失败: ${err}`)
      throw err
    }
  }

  async getStickyEvents(roomId: string): Promise<StickyEvent[]> {
    try {
      const response = await this.request<{ events: StickyEvent[] } | { data?: { events: StickyEvent[] } }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 获取粘性事件成功: roomId=${roomId}`)
      return data?.events || []
    } catch (err) {
      error(`[SynapseRust] 获取粘性事件失败: ${err}`)
      return []
    }
  }

  async setStickyEvent(roomId: string, eventId: string, eventType: string): Promise<void> {
    try {
      await this.request(`/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events`, {
        method: 'POST',
        body: JSON.stringify({
          events: [{ event_id: eventId, event_type: eventType }]
        })
      })
      info(`[SynapseRust] 设置粘性事件成功: roomId=${roomId}, eventId=${eventId}`)
    } catch (err) {
      error(`[SynapseRust] 设置粘性事件失败: ${err}`)
      throw err
    }
  }

  async clearStickyEvent(roomId: string, eventType: string): Promise<void> {
    try {
      await this.request(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/sticky_events/${encodeURIComponent(eventType)}`,
        { method: 'DELETE' }
      )
      info(`[SynapseRust] 清除粘性事件成功: roomId=${roomId}, eventType=${eventType}`)
    } catch (err) {
      error(`[SynapseRust] 清除粘性事件失败: ${err}`)
      throw err
    }
  }

  async getRoomSummary(roomId: string, throwOnError = true): Promise<RoomSummary | null> {
    try {
      const response = await this.request<RoomSummary | { data?: RoomSummary }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 获取房间摘要成功: roomId=${roomId}`)
      return data || null
    } catch (err) {
      error(`[SynapseRust] 获取房间摘要失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return null
    }
  }

  async getRoomSummaryMembers(roomId: string, throwOnError = true): Promise<RoomSummaryMember[]> {
    try {
      const response = await this.request<RoomSummaryMember[] | { data?: RoomSummaryMember[] }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary/members`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      const members = data || []
      info(`[SynapseRust] 获取房间摘要成员成功: roomId=${roomId}, count=${members.length}`)
      return members
    } catch (err) {
      error(`[SynapseRust] 获取房间摘要成员失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return []
    }
  }

  async getRoomSummaryHeroes(roomId: string, throwOnError = true): Promise<RoomSummaryMember[]> {
    const members = await this.getRoomSummaryMembers(roomId, throwOnError)
    const heroes = members.filter((member) => member.is_hero)
    info(`[SynapseRust] 获取房间英雄成员成功: roomId=${roomId}, count=${heroes.length}`)
    return heroes
  }

  async getRoomSummaryState(roomId: string, throwOnError = true): Promise<RoomSummaryState[]> {
    try {
      const response = await this.request<RoomSummaryState[] | { data?: RoomSummaryState[] }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary/state`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      const state = data || []
      info(`[SynapseRust] 获取房间摘要状态成功: roomId=${roomId}, count=${state.length}`)
      return state
    } catch (err) {
      error(`[SynapseRust] 获取房间摘要状态失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return []
    }
  }

  async getRoomSummaryStats(roomId: string, throwOnError = true): Promise<RoomSummaryStats | null> {
    try {
      const response = await this.request<RoomSummaryStats | { data?: RoomSummaryStats }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/summary/stats`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 获取房间摘要统计成功: roomId=${roomId}`)
      return data || null
    } catch (err) {
      error(`[SynapseRust] 获取房间摘要统计失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return null
    }
  }

  async getRoomEphemeral(roomId: string, types?: string[]): Promise<RoomEphemeralEvent[]> {
    try {
      const queryParams = types ? `?types=${types.map(encodeURIComponent).join(',')}` : ''
      const response = await this.request<{ chunk: RoomEphemeralEvent[] } | { data?: { chunk: RoomEphemeralEvent[] } }>(
        `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/ephemeral${queryParams}`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 获取房间临时事件成功: roomId=${roomId}`)
      return data?.chunk || []
    } catch (err) {
      error(`[SynapseRust] 获取房间临时事件失败: ${err}`)
      return []
    }
  }

  async sendCaptcha(mobile: string, captchaType: string): Promise<{ success: boolean; captchaId?: string }> {
    try {
      const response = await this.request<
        { captcha_id: string; expires_in: number } | { data?: { captcha_id: string; expires_in: number } }
      >('/_matrix/client/r0/register/captcha/send', {
        method: 'POST',
        body: JSON.stringify({ target: mobile, captcha_type: captchaType })
      })
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 发送验证码成功: ${mobile}`)
      return {
        success: !!data?.captcha_id,
        captchaId: data?.captcha_id
      }
    } catch (err) {
      error(`[SynapseRust] 发送验证码失败: ${err}`)
      throw err
    }
  }

  async verifyCaptcha(captchaId: string, code: string): Promise<boolean> {
    try {
      const response = await this.request<{ verified: boolean } | { data?: { verified: boolean } }>(
        '/_matrix/client/r0/register/captcha/verify',
        {
          method: 'POST',
          body: JSON.stringify({ captcha_id: captchaId, code })
        }
      )
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 验证码校验成功: ${captchaId}`)
      return data?.verified ?? false
    } catch (err) {
      error(`[SynapseRust] 验证码校验失败: ${err}`)
      return false
    }
  }

  async getCaptchaStatus(captchaId: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.request<Record<string, unknown> | { data?: Record<string, unknown> }>(
        `/_matrix/client/r0/register/captcha/status?captcha_id=${encodeURIComponent(captchaId)}`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      info(`[SynapseRust] 获取验证码状态成功: ${captchaId}`)
      return data || {}
    } catch (err) {
      error(`[SynapseRust] 获取验证码状态失败: ${err}`)
      return {}
    }
  }

  async getThirdpartyProtocols(): Promise<Record<string, unknown>> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return {}
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/thirdparty/protocols')
      return (result as Record<string, unknown>) || {}
    } catch (err) {
      error(`[SynapseRust] 获取第三方协议失败: ${err}`)
      return {}
    }
  }

  async getThirdpartyLocation(
    protocol: string,
    params?: Record<string, string>
  ): Promise<Array<Record<string, unknown>>> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return []
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/thirdparty/location/${encodeURIComponent(protocol)}`,
        params
      )
      return (result as Array<Record<string, unknown>>) || []
    } catch (err) {
      error(`[SynapseRust] 获取第三方位置失败: ${err}`)
      return []
    }
  }

  async getThirdpartyUser(protocol: string, params?: Record<string, string>): Promise<Array<Record<string, unknown>>> {
    try {
      const client = matrixClientService.getClient()
      if (!client) return []
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/thirdparty/user/${encodeURIComponent(protocol)}`,
        params
      )
      return (result as Array<Record<string, unknown>>) || []
    } catch (err) {
      error(`[SynapseRust] 获取第三方用户失败: ${err}`)
      return []
    }
  }

  stop(): void {
    this.accessToken = ''
    info('[SynapseRust] SynapseRustExtensionsService 已停止')
  }
}

export const synapseRustExtensionsService = new SynapseRustExtensionsService()
export default synapseRustExtensionsService
