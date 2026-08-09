import { type ShallowRef, shallowRef } from 'vue'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { matrixRoomReadFacade } from '@/services/matrix/room/ReadFacade'
import type { RoomInfo } from '@/services/types'
import { useSessionStore } from '@/stores/domains/chat/chat/session'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomStore.Tags')

type RoomTags = Record<string, { order?: number }>

export type RoomTagsContext = {
  rooms: ShallowRef<Map<string, RoomInfo>>
}

/**
 * 房间标签模块（m.favourite 置顶等）
 *
 * 含乐观更新 + 失败回滚、置顶状态与 sessionStore 联动、
 * 防抖调度与串行批量刷新（避免并发触发 429）。
 */
export function createRoomTags(ctx: RoomTagsContext) {
  const { rooms } = ctx

  const tagsByRoom = shallowRef<Record<string, RoomTags>>({})

  let tagsRefreshDebounce: ReturnType<typeof setTimeout> | null = null
  const pendingTagsRefresh = new Set<string>()

  function setTagsForRoom(roomId: string, tags: RoomTags): void {
    if (!roomId) return
    const previous = tagsByRoom.value[roomId]
    const next = { ...tags }
    if (previous && JSON.stringify(previous) === JSON.stringify(next)) return
    tagsByRoom.value = { ...tagsByRoom.value, [roomId]: next }
  }

  function getTagsForRoom(roomId: string): RoomTags {
    return tagsByRoom.value[roomId] ?? {}
  }

  function hasTag(roomId: string, tag: string): boolean {
    const tags = tagsByRoom.value[roomId]
    return !!tags && tag in tags
  }

  async function refreshRoomTags(roomId: string): Promise<RoomTags> {
    if (!roomId) return {}
    const tags = await matrixRoomReadFacade.getTags(roomId)
    setTagsForRoom(roomId, tags)
    const sessionStore = useSessionStore()
    const isTop = 'm.favourite' in tags
    sessionStore.updateSession(roomId, { top: isTop })
    return tags
  }

  function scheduleTagsRefresh(roomId: string): void {
    pendingTagsRefresh.add(roomId)
    if (tagsRefreshDebounce) {
      clearTimeout(tagsRefreshDebounce)
    }
    tagsRefreshDebounce = setTimeout(() => {
      const roomIds = Array.from(pendingTagsRefresh)
      pendingTagsRefresh.clear()
      tagsRefreshDebounce = null
      // 串行请求标签，避免并发触发 429
      ;(async () => {
        for (const id of roomIds) {
          try {
            await refreshRoomTags(id)
          } catch {
            // 标签获取失败不影响主流程
          }
          // 请求间隔 200ms，避免触发限流
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
      })()
    }, 1000)
  }

  async function batchRefreshTags(): Promise<void> {
    const roomIds = Array.from(rooms.value.keys())
    // 串行请求标签，避免并发触发 429
    for (const id of roomIds) {
      try {
        await refreshRoomTags(id)
      } catch {
        // 标签获取失败不影响主流程
      }
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  async function addRoomTag(roomId: string, tag: string, order?: number): Promise<void> {
    if (!roomId || !tag) return
    const previous = getTagsForRoom(roomId)
    setTagsForRoom(roomId, { ...previous, [tag]: order !== undefined ? { order } : {} })
    try {
      await matrixRoomActionFacade.setTag(roomId, tag, order)
      if (tag === 'm.favourite') {
        const sessionStore = useSessionStore()
        sessionStore.updateSession(roomId, { top: true })
      }
    } catch (err) {
      setTagsForRoom(roomId, previous)
      logger.error(`[RoomStore] 写入标签失败, 已回滚: ${roomId}/${tag}`)
      throw err
    }
  }

  async function removeRoomTag(roomId: string, tag: string): Promise<void> {
    if (!roomId || !tag) return
    const previous = getTagsForRoom(roomId)
    if (!(tag in previous)) return
    const next = { ...previous }
    delete next[tag]
    setTagsForRoom(roomId, next)
    try {
      await matrixRoomActionFacade.removeTag(roomId, tag)
      if (tag === 'm.favourite') {
        const sessionStore = useSessionStore()
        sessionStore.updateSession(roomId, { top: false })
      }
    } catch (err) {
      setTagsForRoom(roomId, previous)
      logger.error(`[RoomStore] 移除标签失败, 已回滚: ${roomId}/${tag}`)
      throw err
    }
  }

  return {
    tagsByRoom,
    setTagsForRoom,
    getTagsForRoom,
    hasTag,
    refreshRoomTags,
    scheduleTagsRefresh,
    batchRefreshTags,
    addRoomTag,
    removeRoomTag
  }
}
