/**
 * 私聊（DM）管理夹具。
 *
 * 契约来源：SDK `DirectMessageManager['list']` 的两个服务端读取方法
 * （`getDirectRoomsFromServer` / `getDmPartnerFromServer`）。
 */
import type { DirectMessageManager, DmRoomInfo } from '@/services/matrix/sdk'

export type DirectRoomsOnServer = Awaited<ReturnType<DirectMessageManager['list']['getDirectRoomsFromServer']>>
export type DmPartnerResponse = Awaited<ReturnType<DirectMessageManager['list']['getDmPartnerFromServer']>>

/** `DirectMessageManager['list']['getDmRoomInfo']` 的 DM 房间信息。 */
export function makeDmRoomInfo(overrides: Partial<DmRoomInfo> = {}): DmRoomInfo {
  return { roomId: '!dm:example.com', invitees: ['@alice:example.com'], ...overrides }
}

/** `GET /_matrix/client/.../account_data/m.direct` 的服务端直聊映射（用户 → 房间列表）。 */
export function makeDirectRoomsOnServer(overrides: DirectRoomsOnServer = {}): DirectRoomsOnServer {
  return { '@alice:example.com': ['!dm:example.com'], ...overrides }
}

/** 单个私聊房间的对方用户信息。 */
export function makeDmPartnerResponse(overrides: Partial<DmPartnerResponse> = {}): DmPartnerResponse {
  return {
    room_id: '!dm:example.com',
    user_id: '@alice:example.com',
    display_name: 'Alice',
    avatar_url: 'mxc://example.com/alice',
    ...overrides
  }
}
