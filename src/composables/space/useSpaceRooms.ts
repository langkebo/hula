import { Visibility } from 'matrix-js-sdk'
import { type Ref, ref } from 'vue'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useSpaceRooms')

export interface SpaceChildRoom {
  roomId: string
  name: string
  avatarUrl?: string
  memberCount?: number
  onlineCount?: number
  /**
   * 是否被标记为建议子房间（来自 m.space.child 状态事件的 suggested 字段）。
   * 服务端 SpaceManager 的 addChild 是 upsert 语义，前端通过 toggleSuggested 直接发送
   * 状态事件修改该字段。
   */
  suggested?: boolean
}

export interface CreateRoomInSpaceInput {
  /** 房间名称（必填，最长 255 字符） */
  name: string
  /** 房间简介（可选，最长 4096 字符） */
  topic?: string
  /** 是否作为建议子房间展示 */
  suggested?: boolean
}

interface UseSpaceRoomsResult {
  rooms: Ref<SpaceChildRoom[]>
  loading: Ref<boolean>
  mutating: Ref<boolean>
  error: Ref<string | null>
  load: () => Promise<void>
  addRoom: (roomId: string, options?: { via?: string[]; suggested?: boolean }) => Promise<boolean>
  removeRoom: (roomId: string) => Promise<boolean>
  /**
   * 在当前空间内创建普通子房间：先创建房间（继承空间的可见性），再挂载到当前空间，
   * 最后刷新子房间列表。
   * @returns 新房间 ID；失败（含客户端不可用）返回 null
   */
  createRoomInSpace: (input: CreateRoomInSpaceInput) => Promise<string | null>
  /**
   * 切换子房间的建议标记：直接发送 m.space.child 状态事件，保留既有的 via / order。
   * @returns 是否成功
   */
  toggleSuggested: (roomId: string, currentSuggested: boolean) => Promise<boolean>
}

export function useSpaceRooms(spaceId: () => string): UseSpaceRoomsResult {
  const rooms = ref<SpaceChildRoom[]>([])
  const loading = ref(false)
  const mutating = ref(false)
  const error = ref<string | null>(null)

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

  const load = async () => {
    const id = spaceId()
    if (!id) {
      rooms.value = []
      return
    }
    loading.value = true
    error.value = null
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
        suggested: suggestedMap.get(r.roomId) ?? false
      }))
    } catch (err) {
      logger.error('load rooms failed', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
    }
  }

  const addRoom = async (roomId: string, options?: { via?: string[]; suggested?: boolean }): Promise<boolean> => {
    const id = spaceId()
    if (!id || !roomId) return false
    mutating.value = true
    error.value = null
    try {
      await matrixSpaceService.addChildToSpace(id, roomId, options)
      await load()
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
    try {
      await matrixSpaceService.removeChildFromSpace(id, roomId)
      await load()
      return true
    } catch (err) {
      logger.error('removeRoom failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  const createRoomInSpace = async (input: CreateRoomInSpaceInput): Promise<string | null> => {
    const id = spaceId()
    const client = matrixClientService.getClient()
    if (!id || !client) {
      error.value = 'client_unavailable'
      return null
    }
    mutating.value = true
    error.value = null
    try {
      const visibility = resolveVisibility(id)
      const { room_id } = await client.createRoom({
        name: input.name,
        topic: input.topic,
        visibility
      })
      await matrixSpaceService.addChildToSpace(id, room_id, { suggested: input.suggested })
      await load()
      return room_id
    } catch (err) {
      logger.error('createRoomInSpace failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return null
    } finally {
      mutating.value = false
    }
  }

  const toggleSuggested = async (roomId: string, currentSuggested: boolean): Promise<boolean> => {
    const id = spaceId()
    const client = matrixClientService.getClient()
    if (!id || !roomId || !client) return false
    mutating.value = true
    error.value = null
    try {
      // 读取既有 child 状态以保留 via / order（upsert 语义，不覆盖未提供的字段）
      let via: string[] = []
      let order: string | undefined
      try {
        const children = await matrixSpaceService.getSpaceChildren(id)
        const child = children.find((c) => c.room_id === roomId)
        if (child) {
          via = child.via_servers ?? []
          order = child.order
        }
      } catch {
        /* 保留默认空值 */
      }
      await client.sendStateEvent(id, 'm.space.child', { suggested: !currentSuggested, via, order }, roomId)
      await load()
      return true
    } catch (err) {
      logger.error('toggleSuggested failed', err)
      error.value = err instanceof Error ? err.message : String(err)
      return false
    } finally {
      mutating.value = false
    }
  }

  return { rooms, loading, mutating, error, load, addRoom, removeRoom, createRoomInSpace, toggleSuggested }
}
