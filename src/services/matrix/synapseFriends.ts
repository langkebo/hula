/**
 * Synapse 好友信息接口
 *
 * 注意：`display_name` 和 `displayname` 并存是由于 Synapse API 返回字段不一致：
 * - `display_name`：部分 API 端点返回此字段
 * - `displayname`：部分 API 端点返回此字段（Synapse 原生风格）
 * 前端应通过 `normalizeFriendInfo` 统一处理，避免直接读取单一字段
 */
export interface SynapseFriendInfo {
  user_id: string
  /** 显示名称（部分 API 端点返回） */
  display_name?: string
  /** 显示名称（Synapse 原生风格，部分 API 端点返回） */
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
 * 规范化好友信息
 *
 * 策略：按优先级 `display_name` > `displayname` > `username` > `user_id` 选取显示名称，
 * 并同时回填 `display_name` 和 `displayname`，确保下游代码无论读取哪个字段都能获得一致的值。
 * `username` 仅在原始值不存在时才回填为显示名称。
 */
export function normalizeFriendInfo(friend: SynapseFriendInfo): SynapseFriendInfo {
  const displayName = friend.display_name || friend.displayname || friend.username || friend.user_id
  return {
    ...friend,
    display_name: displayName,
    displayname: displayName,
    username: friend.username || displayName
  }
}

export function normalizeFriendInfoList(friends: SynapseFriendInfo[]): SynapseFriendInfo[] {
  return friends.map(normalizeFriendInfo)
}

export interface SynapseFriendRequest {
  request_id: number
  requester: string
  recipient: string
  message?: string
  status: 'pending' | 'accepted' | 'declined' | 'rejected'
  created_ts: number
}

export interface RawFriendRequest {
  id?: number
  request_id?: number
  sender_id?: string
  requester?: string
  receiver_id?: string
  recipient?: string
  message?: string
  status?: string
  created_ts?: number
}

export function normalizeFriendRequest(raw: RawFriendRequest): SynapseFriendRequest {
  return {
    request_id: raw.request_id ?? raw.id ?? 0,
    requester: raw.requester ?? raw.sender_id ?? '',
    recipient: raw.recipient ?? raw.receiver_id ?? '',
    message: raw.message,
    status: (raw.status === 'rejected' ? 'declined' : (raw.status ?? 'pending')) as SynapseFriendRequest['status'],
    created_ts: raw.created_ts ?? 0
  }
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
  is_friend: boolean
}

export interface SynapseFriendNoteResult {
  status: string
}

export function parseFriendSearchResults(response: unknown): SynapseFriendSearchResult[] {
  if (response && typeof response === 'object') {
    const payload = response as {
      results?: SynapseFriendSearchResult[]
      data?: SynapseFriendSearchResult[]
    }
    const arrayField = payload.results ?? payload.data
    if (Array.isArray(arrayField)) {
      return arrayField
    }
  }

  return Array.isArray(response) ? (response as SynapseFriendSearchResult[]) : []
}

export function parseSendFriendRequestResponse(response: unknown): {
  request_id: number
  status: string
} {
  if (response && typeof response === 'object') {
    const payload = response as {
      request_id?: number
      status?: string
      data?: { request_id: number; status: string }
    }

    if (payload.data) {
      return payload.data
    }

    if ('request_id' in payload) {
      return {
        request_id: payload.request_id ?? 0,
        status: payload.status || 'pending'
      }
    }
  }

  return { request_id: 0, status: 'error' }
}

export function extractPendingRequests(response: unknown): SynapseFriendRequest[] {
  if (response && typeof response === 'object') {
    const payload = response as { requests?: RawFriendRequest[]; data?: RawFriendRequest[] }
    const arrayField = payload.requests ?? payload.data
    if (Array.isArray(arrayField)) {
      return arrayField.map(normalizeFriendRequest)
    }
  }

  return Array.isArray(response) ? (response as RawFriendRequest[]).map(normalizeFriendRequest) : []
}

export function parseAcceptFriendRequestResponse(response: unknown): {
  status: string
  room_id: string
} {
  if (response && typeof response === 'object') {
    const payload = response as {
      status?: string
      room_id?: string
      data?: { status: string; room_id: string }
    }

    if (payload.data) {
      return payload.data
    }

    if ('status' in payload) {
      return {
        status: payload.status || 'error',
        room_id: payload.room_id || ''
      }
    }
  }

  return { status: 'error', room_id: '' }
}

export function parseCreateDmResult(
  data: SynapseCreateDmResult | { room_id?: string; created?: boolean } | undefined
): SynapseCreateDmResult {
  if (!data) {
    return { room_id: '', created: false }
  }

  return {
    room_id: data.room_id || '',
    created: data.created ?? !!data.room_id
  }
}

export function parseDmInfo(data: SynapseDmInfo | { room_id?: string; exists?: boolean } | undefined): SynapseDmInfo {
  if (!data) {
    return { room_id: '', exists: false }
  }

  return {
    room_id: data.room_id || '',
    exists: data.exists ?? !!data.room_id
  }
}
