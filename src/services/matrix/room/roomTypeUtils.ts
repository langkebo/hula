import type { MatrixClient, Room } from 'matrix-js-sdk'

/**
 * 判断房间是否为 DM（直接消息）房间。
 *
 * 统一封装 m.direct account data 检查逻辑，避免在 RealtimeService、useRoomType、
 * RoomOperations 等多处重复实现。
 *
 * @param client Matrix 客户端实例
 * @param roomId 房间 ID
 * @returns 是否为 DM 房间
 */
export function isDirectMessageRoom(client: MatrixClient | null | undefined, roomId: string): boolean {
  if (!client || !roomId) return false

  // 1. 检查 m.direct account data
  const directAccount = client.getAccountData('m.direct')
  const directMap = directAccount?.getContent() as Record<string, { room_id: string }[]> | undefined
  if (directMap) {
    const isDm = Object.values(directMap).some((rooms) => rooms?.some((r) => r?.room_id === roomId))
    if (isDm) return true
  }

  // 2. 检查 Room 对象的 DM 标记（SDK 内部状态）
  const room = client.getRoom(roomId)
  if (room) {
    const dmInviter = room.getDMInviter?.()
    if (dmInviter) return true
  }

  return false
}

/**
 * 从 Room 成员中解析「除自己外的另一名成员」（DM counterpart）。
 *
 * 优先级：
 *   1. 已加入（join）且非自己的成员；
 *   2. 受邀（invite）且非自己的成员（对方尚未 join 的新建 DM）；
 *   3. 任意非自己的成员（成员状态未完整同步时的兜底）。
 *
 * 数据源优先取 `getMembers()`（含全部 membership 状态），SDK 老版本或
 * 测试 mock 仅暴露 `getJoinedMembers()`/`getMembersWithMembership()` 时回退到两者。
 *
 * 供 buildSessionFromRoom / convertRoomToSession 填充 detailId/account 使用，
 * 保证下游按 counterpart 的会话去重能正确合并同一联系人的多个历史 DM 房间，
 * 避免消息列表出现重复成员。
 */
export function findDmCounterpart(room: Room | null | undefined, selfId?: string | null): string | undefined {
  if (!room) {
    return undefined
  }
  // memo：同一 Room 实例且房间版本号(getVersion)未变时直接返回缓存，
  // 否则重新扫描成员。房间成员变化会 bump getVersion，从而自动失效。
  // 用 WeakMap 以 Room 对象为键（而非 roomId），避免单测里 roomId 为 undefined 的跨用例串扰，
  // 也随房间实例被 GC 自动回收，不会随会话数量增长而泄漏。
  const version = typeof room.getVersion === 'function' ? room.getVersion() : ''
  const selfKey = selfId ?? ''
  const roomCache = counterpartCache.get(room)
  const cached = roomCache?.get(selfKey)
  if (cached && cached.version === version) {
    return cached.result
  }
  const result = resolveDmCounterpart(room, selfId)
  if (roomCache) {
    roomCache.set(selfKey, { version, result })
  } else {
    counterpartCache.set(room, new Map([[selfKey, { version, result }]]))
  }
  return result
}

const counterpartCache = new WeakMap<Room, Map<string, { version: string; result: string | undefined }>>()

/**
 * 从 Room 成员中解析「除自己外的另一名成员」（DM counterpart）的内部实现（无缓存）。
 *
 * 优先级：
 *   1. 已加入（join）且非自己的成员；
 * 2. 受邀（invite）且非自己的成员（对方尚未 join 的新建 DM）；
 *   3. 任意非自己的成员（成员状态未完整同步时的兜底）。
 *
 * 数据源优先取 `getMembers()`（含全部 membership 状态），SDK 老版本或
 * 测试 mock 仅暴露 `getJoinedMembers()`/`getMembersWithMembership()` 时回退到两者。
 *
 * 供 buildSessionFromRoom / convertRoomToSession 填充 detailId/account 使用，
 * 保证下游按 counterpart 的会话去重能正确合并同一联系人的多个历史 DM 房间，
 * 避免消息列表出现重复成员。缓存层见 findDmCounterpart。
 */
function resolveDmCounterpart(room: Room, selfId?: string | null): string | undefined {
  const collectMembers = (): Array<{ userId?: string | null; membership?: string | null }> => {
    if (typeof room.getMembers === 'function') {
      const all = room.getMembers() ?? []
      if (all.length) return all
    }
    const joined = typeof room.getJoinedMembers === 'function' ? (room.getJoinedMembers() ?? []) : []
    // SDK 无 getInvitedMembers()，用 getMembersWithMembership('invite') 兜底
    const invited =
      typeof room.getMembersWithMembership === 'function' ? (room.getMembersWithMembership('invite') ?? []) : []
    return [...joined, ...invited]
  }
  try {
    const members = collectMembers()
    if (!members.length) {
      return undefined
    }
    const isNotSelf = (userId?: string | null): userId is string => !!userId && userId !== selfId
    const pick = (m?: { userId?: string | null }): string | undefined => {
      const uid = m?.userId
      return isNotSelf(uid) ? uid : undefined
    }
    // 按 membership 分优先级的两次扫描：join 优先、invite 其次、任意非自己兜底。
    // 每次都要在「同一 membership」内排除自己，避免「self(join) + 对方(invite)」
    // 的常见新建 DM 被误判为无 counterpart。
    return (
      pick(members.find((m) => m.membership === 'join' && isNotSelf(m.userId))) ??
      pick(members.find((m) => m.membership === 'invite' && isNotSelf(m.userId))) ??
      members.map((m) => m.userId).find(isNotSelf)
    )
  } catch {
    return undefined
  }
}

/**
 * 判断房间是否为 DM 房间（基于 Room 对象）。
 * 用于 convertRoomToSession 等场景，已有 Room 对象时无需再查 client。
 */
export function isDirectMessageRoomFromRoom(client: MatrixClient | null | undefined, room: Room): boolean {
  if (!client) return false

  // 1. 检查 m.direct account data
  const directAccount = client.getAccountData('m.direct')
  const directMap = directAccount?.getContent() as Record<string, { room_id: string }[]> | undefined
  if (directMap) {
    const isDm = Object.values(directMap).some((rooms) => rooms?.some((r) => r?.room_id === room.roomId))
    if (isDm) return true
  }

  // 2. 检查 Room 对象的 DM 标记
  const dmInviter = room.getDMInviter?.()
  if (dmInviter) return true

  return false
}
