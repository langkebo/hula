import { error, info, warn } from '@tauri-apps/plugin-log'
import { MATRIX_PATHS } from './paths'
import {
  extractPendingRequests,
  normalizeFriendInfoList,
  parseAcceptFriendRequestResponse,
  parseCreateDmResult,
  parseDmInfo,
  parseFriendSearchResults,
  parseSendFriendRequestResponse,
  type SynapseCheckFriendshipResult,
  type SynapseCreateDmResult,
  type SynapseDmInfo,
  type SynapseFriendInfo,
  type SynapseFriendRequest,
  type SynapseFriendSearchResult,
  type SynapsePendingRequests
} from './synapseFriends'

type WrappedResponse<T> = T | { data?: T; status?: string; code?: string; message?: string }

export interface SynapseFriendsModuleContext {
  request: <T>(endpoint: string, options?: RequestInit) => Promise<T>
  unwrapMaybeWrappedData: <T>(response: WrappedResponse<T>) => T | undefined
  isFriendEndpointAvailable: () => Promise<boolean>
  getHasLoggedFriendsBeforeClientReady: () => boolean
  setHasLoggedFriendsBeforeClientReady: (value: boolean) => void
}

function isClientNotReadyError(err: unknown): boolean {
  return err instanceof Error && (err.message === 'MatrixClient 未在指定时间内就绪' || err.message === '客户端未初始化')
}

export function createSynapseFriendsModule(context: SynapseFriendsModuleContext) {
  return {
    async getFriends(): Promise<SynapseFriendInfo[]> {
      try {
        if (!(await context.isFriendEndpointAvailable())) {
          warn('[SynapseRust] 好友端点不可用')
          return []
        }

        const response = await context.request<{
          friends?: SynapseFriendInfo[]
          items?: SynapseFriendInfo[]
          data?: SynapseFriendInfo[]
        }>(MATRIX_PATHS.FRIENDS.LIST, {
          method: 'GET'
        })

        if (response && typeof response === 'object') {
          const arrayField = response.items ?? response.friends ?? response.data
          if (Array.isArray(arrayField)) {
            return normalizeFriendInfoList(arrayField)
          }
          if (Array.isArray(response)) {
            return response
          }
        }

        context.setHasLoggedFriendsBeforeClientReady(false)
        return normalizeFriendInfoList((Array.isArray(response) ? response : []) as SynapseFriendInfo[])
      } catch (err) {
        if (isClientNotReadyError(err)) {
          if (!context.getHasLoggedFriendsBeforeClientReady()) {
            context.setHasLoggedFriendsBeforeClientReady(true)
            info('[SynapseRust] Matrix 客户端未就绪，返回空好友列表')
          }
          return []
        }

        error(`[SynapseRust] 获取好友列表失败: ${err}`)
        return []
      }
    },

    async sendFriendRequest(
      userId: string,
      message?: string
    ): Promise<{
      request_id: number
      status: string
    }> {
      try {
        if (!(await context.isFriendEndpointAvailable())) {
          return { request_id: 0, status: 'unavailable' }
        }

        const response = await context.request<{
          request_id?: number
          status?: string
          data?: { request_id: number; status: string }
        }>(MATRIX_PATHS.FRIENDS.REQUEST, {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, message })
        })

        info(`[SynapseRust] 发送好友请求成功: ${userId}`)
        return parseSendFriendRequestResponse(response)
      } catch (err) {
        error(`[SynapseRust] 发送好友请求失败: ${err}`)
        throw err
      }
    },

    async searchFriends(
      query: string,
      options: { limit?: number; mode?: 'exact' | 'fuzzy' } = {}
    ): Promise<SynapseFriendSearchResult[]> {
      const trimmedQuery = query.trim()
      if (!trimmedQuery) {
        return []
      }

      if (!(await context.isFriendEndpointAvailable())) {
        return []
      }

      try {
        const searchParams = new URLSearchParams({
          q: trimmedQuery,
          limit: String(options.limit ?? 20),
          mode: options.mode ?? 'fuzzy'
        })
        const response = await context.request<{
          results?: SynapseFriendSearchResult[]
          data?: SynapseFriendSearchResult[]
        }>(`${MATRIX_PATHS.FRIENDS.SEARCH}?${searchParams.toString()}`, { method: 'GET' })

        return parseFriendSearchResults(response)
      } catch (err) {
        if (isClientNotReadyError(err)) {
          if (!context.getHasLoggedFriendsBeforeClientReady()) {
            context.setHasLoggedFriendsBeforeClientReady(true)
            info('[SynapseRust] Matrix 客户端未就绪，返回空好友搜索结果')
          }
          return []
        }

        context.setHasLoggedFriendsBeforeClientReady(false)
        error(`[SynapseRust] 搜索好友失败: ${err}`)
        return []
      }
    },

    async getPendingRequests(): Promise<SynapsePendingRequests> {
      try {
        if (!(await context.isFriendEndpointAvailable())) {
          return { incoming: [], outgoing: [] }
        }

        const [incomingResult, outgoingResult] = await Promise.allSettled([
          context.request<{ requests?: SynapseFriendRequest[]; data?: SynapseFriendRequest[] }>(
            MATRIX_PATHS.FRIENDS.INCOMING_REQUESTS,
            { method: 'GET' }
          ),
          context.request<{ requests?: SynapseFriendRequest[]; data?: SynapseFriendRequest[] }>(
            MATRIX_PATHS.FRIENDS.OUTGOING_REQUESTS,
            { method: 'GET' }
          )
        ])

        const incomingResponse = incomingResult.status === 'fulfilled' ? incomingResult.value : null
        const outgoingResponse = outgoingResult.status === 'fulfilled' ? outgoingResult.value : null

        return {
          incoming: extractPendingRequests(incomingResponse),
          outgoing: extractPendingRequests(outgoingResponse)
        }
      } catch (err) {
        error(`[SynapseRust] 获取待处理请求失败: ${err}`)
        return { incoming: [], outgoing: [] }
      }
    },

    async acceptFriendRequest(userId: string): Promise<{
      status: string
      room_id: string
    }> {
      try {
        if (!(await context.isFriendEndpointAvailable())) {
          return { status: 'unavailable', room_id: '' }
        }

        const response = await context.request<{
          status?: string
          room_id?: string
          data?: { status: string; room_id: string }
        }>(MATRIX_PATHS.FRIENDS.ACCEPT(encodeURIComponent(userId)), {
          method: 'POST',
          body: JSON.stringify({})
        })

        info(`[SynapseRust] 接受好友请求成功: ${userId}`)
        return parseAcceptFriendRequestResponse(response)
      } catch (err) {
        error(`[SynapseRust] 接受好友请求失败: ${err}`)
        throw err
      }
    },

    async declineFriendRequest(userId: string): Promise<void> {
      try {
        if (!(await context.isFriendEndpointAvailable())) {
          return
        }

        await context.request(MATRIX_PATHS.FRIENDS.REJECT(encodeURIComponent(userId)), {
          method: 'POST',
          body: JSON.stringify({})
        })
        info(`[SynapseRust] 拒绝好友请求成功: ${userId}`)
      } catch (err) {
        error(`[SynapseRust] 拒绝好友请求失败: ${err}`)
        throw err
      }
    },

    async removeFriend(userId: string): Promise<void> {
      try {
        if (!(await context.isFriendEndpointAvailable())) {
          return
        }

        await context.request(MATRIX_PATHS.FRIENDS.REMOVE(encodeURIComponent(userId)), {
          method: 'DELETE'
        })
        info(`[SynapseRust] 删除好友成功: ${userId}`)
      } catch (err) {
        error(`[SynapseRust] 删除好友失败: ${err}`)
        throw err
      }
    },

    async setFriendNote(userId: string, note: string): Promise<void> {
      try {
        if (!(await context.isFriendEndpointAvailable())) {
          return
        }

        await context.request(MATRIX_PATHS.FRIENDS.NOTE(encodeURIComponent(userId)), {
          method: 'PUT',
          body: JSON.stringify({ note })
        })
        info(`[SynapseRust] 设置好友备注成功: ${userId}`)
      } catch (err) {
        error(`[SynapseRust] 设置好友备注失败: ${err}`)
        throw err
      }
    },

    async checkFriendship(userId: string): Promise<boolean> {
      try {
        if (!(await context.isFriendEndpointAvailable())) {
          return false
        }

        const response = await context.request<SynapseCheckFriendshipResult | { data?: SynapseCheckFriendshipResult }>(
          MATRIX_PATHS.FRIENDS.CHECK(encodeURIComponent(userId)),
          {
            method: 'GET'
          }
        )
        const data = context.unwrapMaybeWrappedData(response)
        return data?.are_friends || data?.is_friend || false
      } catch (err) {
        error(`[SynapseRust] 检查好友关系失败: ${err}`)
        return false
      }
    },

    async createPrivateDm(userId: string, isPrivate = true): Promise<SynapseCreateDmResult> {
      try {
        const response = await context.request<
          SynapseCreateDmResult | { data?: SynapseCreateDmResult; room_id?: string; user_id?: string }
        >(MATRIX_PATHS.FRIENDS.DM(encodeURIComponent(userId)), {
          method: 'POST',
          body: JSON.stringify({ is_private: isPrivate })
        })
        const data = context.unwrapMaybeWrappedData(response) as
          | SynapseCreateDmResult
          | { room_id?: string; created?: boolean }
          | undefined
        info(`[SynapseRust] 创建私密私信房间: ${userId}, isPrivate=${isPrivate}`)
        return parseCreateDmResult(data)
      } catch (err) {
        error(`[SynapseRust] 创建私密私信房间失败: ${err}`)
        throw err
      }
    },

    async getDmRoom(userId: string): Promise<SynapseDmInfo> {
      try {
        const response = await context.request<
          SynapseDmInfo | { data?: SynapseDmInfo; room_id?: string; user_id?: string }
        >(MATRIX_PATHS.FRIENDS.DM(encodeURIComponent(userId)), {
          method: 'GET'
        })
        const data = context.unwrapMaybeWrappedData(response) as
          | SynapseDmInfo
          | { room_id?: string; exists?: boolean }
          | undefined
        return parseDmInfo(data)
      } catch (err) {
        error(`[SynapseRust] 获取私信房间失败: ${err}`)
        return { room_id: '', exists: false }
      }
    }
  }
}
