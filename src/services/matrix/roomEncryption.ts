/**
 * 「房间是否启用加密」的**单一事实源**（同步判据）。
 *
 * 背景（2026-10-11 审计 §13）：前端长期调用 `client.isRoomEncrypted(roomId)`，
 * 但本 fork 的 `MatrixClient` 没有这个方法。可用的真实判据有两类：
 *
 *   1. `client.getCrypto()?.isEncryptionEnabledInRoom(roomId)` —— **异步**
 *      （`lib/crypto-api/index.d.ts:90`），且依赖 crypto 已完成初始化；
 *   2. `room.hasEncryptionStateEvent()` —— **同步** 布尔
 *      （`lib/models/room.d.ts:1325`），读的是 `m.room.encryption` 状态事件。
 *
 * 调用点全部需要**同步布尔**（用于列表渲染、发送前预检查），且语义是
 * 「这个房间是否被要求加密」⇒ 用状态事件判据 (2) 更准确：即使 crypto 尚未初始化、
 * 或客户端刚入房间还没拿到 crypto 上下文，状态事件也已经存在。
 *
 * 与「加密功能是否可用」是两件事：后者请看 `client.getCrypto()` / `hasCrypto`。
 */

/** 只需要 `getRoom` 的结构化类型，便于在测试里注入最小 mock。 */
interface RoomLookupClient {
  getRoom?: (roomId: string) => unknown
}

interface RoomLike {
  hasEncryptionStateEvent?: () => boolean
}

/**
 * 判断房间是否启用了加密（读 `m.room.encryption` 状态事件）。
 *
 * @returns 房间已加密 ⇒ true；房间不存在 / client 缺失 / SDK 无该方法 ⇒ false
 */
export function isRoomEncrypted(client: RoomLookupClient | null | undefined, roomId: string): boolean {
  if (!client || !roomId) return false
  let room: RoomLike | undefined
  try {
    room = client.getRoom?.(roomId) as RoomLike | undefined
  } catch {
    return false
  }
  const probe = room?.hasEncryptionStateEvent
  if (typeof probe !== 'function') return false
  try {
    return probe.call(room) === true
  } catch {
    return false
  }
}
