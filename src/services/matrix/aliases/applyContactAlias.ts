import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import { getContactAlias, loadContactAliases } from './contactAliasRegistry'

const logger = createLogger('ContactAliasApply')

/**
 * 别名投递（F-6）：把我的**房间级**成员资料写成别名。
 *
 * ## 为什么靠房间级 `m.room.member`
 *
 * 对方客户端渲染名字读的是 `room.getMember(userId).rawDisplayName`
 * （本仓 `RoomOperations.ts` 同源逻辑），也就是房间级 `m.room.member.displayname`。
 * 改它，**对方无需升级客户端**就能看到别名。
 *
 * ## 为什么必须硬校验「就我们俩」
 *
 * 房间级资料对该房间**所有成员**生效。若在群聊里应用，会变成
 * 「我在这个群对所有人群改名」——那不是「对某个联系人的别名」。
 * 所以这里在写之前硬校验成员构成，不满足直接返回 false，绝不"尽力而为"。
 */

/** 房间最小依赖面：只需要已加入成员的 userId 列表（SDK `Room` 结构上可赋值给它） */
export interface RoomMembersView {
  getJoinedMembers: () => Array<{ userId: string }>
}

/**
 * 该房间是否是「我和对方」的一对一房间。
 *
 * 判据用**已加入成员**而不是 `m.direct`：`m.direct` 是客户端账本，可能没写、
 * 可能写错；成员构成是服务端事实。两者不一致时以事实为准。
 *
 * 参数用**结构化**视图（只要求 `getJoinedMembers`）：SDK `Room` 与测试里的对象字面量都能
 * 直接传入，不需要任何类型断言 —— 双重断言在 ratchet 里是零容忍项。
 */
export function isOneToOneRoom(
  room: RoomMembersView | null | undefined,
  myUserId: string,
  peerUserId: string
): boolean {
  if (!room) return false
  const members = room.getJoinedMembers()
  if (members.length !== 2) return false
  const ids = new Set(members.map((m) => m.userId))
  return ids.has(myUserId) && ids.has(peerUserId)
}

/**
 * 把别名写到与 `peerUserId` 的单聊房间（房间级成员资料）。
 *
 * @returns 是否真的写入（false = 没有单聊房间 / 房间不是一对一，未写入）
 */
export async function applyAliasToDmRoom(peerUserId: string): Promise<boolean> {
  const matrixClient = matrixClientService.getClient()
  const myUserId = matrixClientService.getUserId()
  if (!matrixClient || !myUserId) return false

  await loadContactAliases()
  const alias = getContactAlias(peerUserId)
  if (!alias) {
    // 没有别名可写：这不是错误，调用方可能刚清除别名
    return false
  }

  const roomId = resolveDmRoomId(peerUserId)
  if (!roomId) {
    logger.info(`未找到与 ${peerUserId} 的单聊房间，别名暂存 account data`)
    return false
  }

  const room = matrixClient.getRoom(roomId)
  if (!isOneToOneRoom(room, myUserId, peerUserId)) {
    // 群聊/多人房一律不写：会让所有成员都看到别名
    logger.warn(`房间 ${roomId} 不是与 ${peerUserId} 的一对一房间，拒绝写别名`)
    return false
  }

  await matrixClient.sendStateEvent(
    roomId,
    'm.room.member',
    {
      membership: 'join',
      displayname: alias.displayName,
      ...(alias.avatarMxc ? { avatar_url: alias.avatarMxc } : {})
    },
    myUserId
  )
  logger.info(`别名已投递到单聊 ${roomId}`)
  return true
}

/**
 * 清除别名投递：把房间级 displayname / avatar_url 写成空串，回落到全局资料。
 *
 * ⚠️ 必须**真的写空串**。只删本地记录的话，对方仍看到旧别名 ——
 * 「我改了但对方没变」是最招骂的一类 bug。
 */
export async function clearAliasFromDmRoom(peerUserId: string): Promise<boolean> {
  const matrixClient = matrixClientService.getClient()
  const myUserId = matrixClientService.getUserId()
  if (!matrixClient || !myUserId) return false

  const roomId = resolveDmRoomId(peerUserId)
  if (!roomId) return false

  const room = matrixClient.getRoom(roomId)
  if (!isOneToOneRoom(room, myUserId, peerUserId)) return false

  await matrixClient.sendStateEvent(
    roomId,
    'm.room.member',
    { membership: 'join', displayname: '', avatar_url: '' },
    myUserId
  )
  logger.info(`别名已从单聊 ${roomId} 清除`)
  return true
}

/**
 * 查找与某人的单聊房间 id。
 *
 * 优先 `m.direct`（客户端账本），再用「成员构成」兜底扫一遍 ——
 * 通知点击 / 换设备后 `m.direct` 可能还没同步到。
 */
export function resolveDmRoomId(peerUserId: string): string | null {
  const matrixClient = matrixClientService.getClient()
  if (!matrixClient) return null

  try {
    const direct = matrixClient.getAccountData('m.direct' as never)?.getContent() as
      | Record<string, string[]>
      | undefined
    const candidates = direct?.[peerUserId]
    if (Array.isArray(candidates)) {
      const existing = candidates.find((id) => Boolean(matrixClient.getRoom(id)))
      if (existing) return existing
    }
  } catch {
    // 忽略：回落到成员构成扫描
  }

  const myUserId = matrixClientService.getUserId()
  if (!myUserId) return null
  for (const room of matrixClient.getRooms() ?? []) {
    if (isOneToOneRoom(room, myUserId, peerUserId)) {
      const roomId = room.roomId
      if (roomId) return roomId
    }
  }
  return null
}

/**
 * 登录后对账：把已存在的别名重新投递一遍。
 *
 * 房间级状态不会随 account data 跨设备同步，换设备后必须重放。
 * 单个失败不影响其他联系人。
 */
export async function reconcileContactAliases(): Promise<void> {
  await loadContactAliases()
  const matrixClient = matrixClientService.getClient()
  if (!matrixClient) return

  const myUserId = matrixClientService.getUserId()
  if (!myUserId) return

  for (const room of matrixClient.getRooms() ?? []) {
    const members = room.getJoinedMembers?.() ?? []
    if (members.length !== 2) continue
    const peer = members.find((m) => m.userId !== myUserId)
    if (!peer) continue
    try {
      await applyAliasToDmRoom(peer.userId)
    } catch (err) {
      logger.warn(`对账别名失败（${peer.userId}）:`, err)
    }
  }
}
