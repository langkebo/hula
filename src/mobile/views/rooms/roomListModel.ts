/**
 * 移动端房间列表的数据装配与过滤逻辑。
 *
 * 数据来源约束：
 * - 房间静态信息来自 `matrixRoomQueryFacade.getRooms()`（SDK 房间状态）。
 * - 未读数 / 最后消息 / 最后活跃时间来自 chat store 的 SessionItem，
 *   不在本模块内另建接口或做协议推断。
 */

export type RoomFilter = 'all' | 'public' | 'private' | 'owned'

export interface RoomSessionSnapshot {
  unreadCount: number
  activeTime: number
  text?: string | undefined
}

export interface RoomListSource {
  roomId: string
  name: string
  avatarUrl: string
  memberCount: number
  joinRule: string
  isEncrypted: boolean
  creatorId: string | null
  memberNames: string[]
}

export interface RoomCardModel extends RoomListSource {
  isPublic: boolean
  isOwned: boolean
  unreadCount: number
  summary: string
  activeTime: number
}

const pad2 = (value: number): string => String(value).padStart(2, '0')

const startOfLocalDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

const normalizeSummary = (text?: string): string => (text ?? '').replace(/\s+/g, ' ').trim()

/**
 * 合并房间静态信息与会话动态信息。
 *
 * 房间不在会话列表中时（例如尚未产生任何同步数据），未读按 0、摘要为空、
 * 时间为 0，交由 UI 显示占位，不伪造内容。
 */
export function buildRoomCardModels(
  rooms: RoomListSource[],
  sessions: Record<string, RoomSessionSnapshot | undefined>,
  isSelf: (userId: string) => boolean = () => false
): RoomCardModel[] {
  return rooms.map((room) => {
    const session = sessions[room.roomId]
    return {
      ...room,
      isPublic: room.joinRule === 'public',
      isOwned: Boolean(room.creatorId && isSelf(room.creatorId)),
      unreadCount: Math.max(0, session?.unreadCount ?? 0),
      summary: normalizeSummary(session?.text),
      activeTime: session?.activeTime ?? 0
    }
  })
}

/** 未读角标文案：>99 显示 99+，0 返回空串（不渲染角标）。 */
export function formatUnreadCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) {
    return ''
  }
  return count > 99 ? '99+' : String(count)
}

/**
 * 相对活跃时间：
 * - 今天：HH:mm
 * - 昨天：yesterdayLabel（由调用方注入 i18n 文案）
 * - 更早：同年 MM-DD，跨年 YYYY-MM-DD
 */
export function formatRoomActiveTime(timestamp: number, yesterdayLabel: string, now = Date.now()): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return ''
  }

  const target = new Date(timestamp)
  const current = new Date(now)
  const targetDay = startOfLocalDay(target)
  const today = startOfLocalDay(current)
  const yesterday = startOfLocalDay(new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1))

  if (targetDay === today) {
    return `${pad2(target.getHours())}:${pad2(target.getMinutes())}`
  }
  if (targetDay === yesterday) {
    return yesterdayLabel
  }

  const monthDay = `${pad2(target.getMonth() + 1)}-${pad2(target.getDate())}`
  if (target.getFullYear() === current.getFullYear()) {
    return monthDay
  }
  return `${target.getFullYear()}-${monthDay}`
}

/**
 * 只暴露当前数据能支撑的筛选项：
 * 公开/私有由 joinRule 决定；「我创建的」仅在至少一个房间能解析出创建者时出现。
 */
export function resolveAvailableRoomFilters(items: RoomCardModel[]): RoomFilter[] {
  const filters: RoomFilter[] = ['all', 'public', 'private']
  if (items.some((item) => item.creatorId)) {
    filters.push('owned')
  }
  return filters
}

/** 按房间名 / 成员名做本地搜索，并叠加筛选条件。 */
export function filterRoomCards(items: RoomCardModel[], query: string, filter: RoomFilter): RoomCardModel[] {
  const keyword = query.trim().toLowerCase()

  return items.filter((item) => {
    if (filter === 'public' && !item.isPublic) {
      return false
    }
    if (filter === 'private' && item.isPublic) {
      return false
    }
    if (filter === 'owned' && !item.isOwned) {
      return false
    }
    if (!keyword) {
      return true
    }
    if (item.name.toLowerCase().includes(keyword)) {
      return true
    }
    return item.memberNames.some((name) => name.toLowerCase().includes(keyword))
  })
}
