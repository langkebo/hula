import { type Ref, ref } from 'vue'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { Visibility } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSpaceRooms')

export interface SpaceChildRoom {
  roomId: string
  name: string
  avatarUrl?: string | undefined
  memberCount?: number
  onlineCount?: number
  /**
   * 是否被标记为建议子房间（来自 m.space.child 状态事件的 suggested 字段）。
   * 服务端 SpaceManager 的 addChild 是 upsert 语义，前端通过 toggleSuggested
   * 走 MatrixSpaceService.setChildSuggested 修改该字段。
   */
  suggested?: boolean
  /**
   * 当前用户是否已加入该子房间。
   * 子空间里可以挂载未加入的房间（如公开房间 / 仅邀请房间），
   * 未加入时不能直接跳聊天页，需要先走加入流程。
   */
  joined?: boolean
}

interface CreateRoomInSpaceInput {
  /** 房间名称（必填，最长 255 字符） */
  name: string
  /** 房间简介（可选，最长 4096 字符） */
  topic?: string
  /** 是否作为建议子房间展示 */
  suggested?: boolean
}

export interface CreateRoomInSpaceOutcome {
  /** 已创建的房间 ID；房间本身未创建成功时为 null */
  roomId: string | null
  /**
   * 是否已挂载到空间。
   * `roomId` 非空且此处为 false 是「房间已建、未入空间」的中间态：
   * 变更只完成一半，不能按创建失败处理（否则用户重试会重复建房）。
   */
  attached: boolean
}

interface UseSpaceRoomsResult {
  rooms: Ref<SpaceChildRoom[]>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  /**
   * 变更已生效、但变更后的列表刷新失败。
   * 与 `error` 分离：列表过期不等于变更失败，调用方应做局部提示而不是把整页判为失败。
   */
  refreshError: Ref<string | null>
  load: () => Promise<void>
  addRoom: (roomId: string, options?: { via?: string[]; suggested?: boolean }) => Promise<boolean>
  removeRoom: (roomId: string) => Promise<boolean>
  /**
   * 在当前空间内创建普通子房间：先创建房间（继承空间的可见性），再挂载到当前空间，
   * 最后刷新子房间列表。
   * @returns 房间创建结果；`attached=false` 表示房间已建但挂载失败（中间态）
   */
  createRoomInSpace: (input: CreateRoomInSpaceInput) => Promise<CreateRoomInSpaceOutcome>
  /**
   * 切换子房间的建议标记：由服务层保留既有的 via / order 后 upsert m.space.child。
   * @returns 是否成功
   */
  toggleSuggested: (roomId: string, currentSuggested: boolean) => Promise<boolean>
}

export function useSpaceRooms(spaceId: () => string): UseSpaceRoomsResult {
  const rooms = ref<SpaceChildRoom[]>([])
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)
  const refreshError = ref<string | null>(null)

  /**
   * 根据空间的 join_rule 推导新房间可见性：
   * public 空间 → public 房间；其余（invite / knock / private）→ private 房间。
   */
  const resolveVisibility = (id: string): Visibility => {
    try {
      const client = matrixClientService.getClient()
      const room = client?.getRoom(id)
      const joinRule = room?.getJoinRule?.()
      return joinRule === 'public' ? Visibility.Public : Visibility.Private
    } catch (err) {
      logger.warn('resolveVisibility failed, defaulting to private', err)
      return Visibility.Private
    }
  }

  /** 读取本地同步状态判断是否已加入；客户端不可用时按未加入处理 */
  const resolveJoined = (roomId: string): boolean => {
    try {
      return matrixClientService.getClient()?.getRoom(roomId)?.getMyMembership() === 'join'
    } catch (err) {
      logger.warn('resolveJoined failed, defaulting to false', err)
      return false
    }
  }

  /** 拉取并合并子房间列表；失败时返回错误文本，不改动现有列表 */
  const fetchRooms = async (id: string): Promise<string | null> => {
    try {
      const base = await matrixSpaceService.getSpaceRooms(id)
      // getSpaceRooms 不含 suggested 标记，需从 getSpaceChildren 合并 is_suggested
      const suggestedMap = new Map<string, boolean>()
      try {
        const children = await matrixSpaceService.getSpaceChildren(id)
        for (const child of children) {
          suggestedMap.set(child.room_id, child.is_suggested ?? false)
        }
      } catch (childErr) {
        logger.warn('merge suggested flags failed, defaulting to false', childErr)
      }
      rooms.value = base.map((r) => ({
        ...r,
        suggested: suggestedMap.get(r.roomId) ?? false,
        joined: resolveJoined(r.roomId)
      }))
      return null
    } catch (err) {
      logger.error('load rooms failed', err)
      return err instanceof Error ? err.message : String(err)
    }
  }

  const load = async () => {
    const id = spaceId()
    if (!id) {
      rooms.value = []
      error.value = null
      refreshError.value = null
      return
    }
    loading.value = true
    error.value = null
    refreshError.value = null
    const message = await fetchRooms(id)
    // 已有列表时失败只代表「列表过期」：写到 refreshError，保证局部提示不被整页错误态吞掉，
    // 重试再次失败时提示仍在（整页错误态只在首屏无数据时成立）。
    if (message !== null) {
      if (rooms.value.length > 0) refreshError.value = message
      else error.value = message
    }
    loading.value = false
  }

  /**
   * 变更成功后的列表刷新：失败只写入 `refreshError`，
   * 既不把变更本身判为失败，也不覆盖 `error` 触发整页错误态。
   */
  const refreshAfterMutation = async (id: string): Promise<void> => {
    loading.value = true
    const message = await fetchRooms(id)
    loading.value = false
    refreshError.value = message
  }

  const addRoom = async (roomId: string, options?: { via?: string[]; suggested?: boolean }): Promise<boolean> => {
    const id = spaceId()
    if (!id || !roomId) return false
    mutating.value = true
    error.value = null
    refreshError.value = null
    try {
      await matrixSpaceService.addChildToSpace(id, roomId, options)
      await refreshAfterMutation(id)
      return true
    } catch (err) {
      logger.error('addRoom failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const removeRoom = async (roomId: string): Promise<boolean> => {
    const id = spaceId()
    if (!id || !roomId) return false
    mutating.value = true
    error.value = null
    refreshError.value = null
    try {
      await matrixSpaceService.removeChild(id, roomId)
      await refreshAfterMutation(id)
      return true
    } catch (err) {
      logger.error('removeRoom failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const createRoomInSpace = async (input: CreateRoomInSpaceInput): Promise<CreateRoomInSpaceOutcome> => {
    const id = spaceId()
    if (!id || !matrixClientService.getClient()) {
      error.value = 'client_unavailable'
      refreshError.value = null
      return { roomId: null, attached: false }
    }
    mutating.value = true
    error.value = null
    refreshError.value = null
    try {
      const visibility = resolveVisibility(id)
      const room = await matrixClientService.createRoom({
        name: input.name,
        visibility,
        ...(input.topic === undefined ? {} : { topic: input.topic })
      })
      // 建房成功即意味着变更已有产物：挂载失败只算中间态，不能写 `error`（房间已存在，重试会重复建房）
      try {
        await matrixSpaceService.addChildToSpace(id, room.roomId, {
          ...(input.suggested === undefined ? {} : { suggested: input.suggested })
        })
      } catch (attachErr) {
        logger.error('createRoomInSpace attach failed', attachErr)
        return { roomId: room.roomId, attached: false }
      }
      await refreshAfterMutation(id)
      return { roomId: room.roomId, attached: true }
    } catch (err) {
      logger.error('createRoomInSpace failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return { roomId: null, attached: false }
    } finally {
      mutating.value = false
    }
  }

  const toggleSuggested = async (roomId: string, currentSuggested: boolean): Promise<boolean> => {
    const id = spaceId()
    if (!id || !roomId) return false
    mutating.value = true
    error.value = null
    refreshError.value = null
    try {
      await matrixSpaceService.setChildSuggested(id, roomId, !currentSuggested)
      await refreshAfterMutation(id)
      return true
    } catch (err) {
      logger.error('toggleSuggested failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  return {
    rooms,
    loading,
    mutating,
    error,
    refreshError,
    load,
    addRoom,
    removeRoom,
    createRoomInSpace,
    toggleSuggested
  }
}
