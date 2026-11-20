/**
 * 房间设置页读取结局夹具（成员历史 / 最近变更 / 权限快照 / 服务类型）。
 *
 * 类型全部从 `matrixRoomReadFacade` 的实际签名推导，避免手抄判别联合字段。
 * 这里只收口「失败分支」——`{ status: 'error' }` 无响应体，是四类结局共有的终止态。
 */
import type { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'

export type MembershipEventsOutcome = Awaited<ReturnType<typeof matrixRoomReadFacade.getMembershipEvents>>
export type RecentMemberChangesOutcome = Awaited<ReturnType<typeof matrixRoomReadFacade.getRecentMemberChanges>>
export type RoomPermissionsOutcome = Awaited<ReturnType<typeof matrixRoomReadFacade.getRoomPermissions>>
export type RoomServiceTypesOutcome = Awaited<ReturnType<typeof matrixRoomReadFacade.getRoomServiceTypes>>

export function membershipEventsError(): MembershipEventsOutcome {
  return { status: 'error' }
}

export function recentMemberChangesError(): RecentMemberChangesOutcome {
  return { status: 'error' }
}

export function roomPermissionsError(): RoomPermissionsOutcome {
  return { status: 'error' }
}

export function roomServiceTypesError(): RoomServiceTypesOutcome {
  return { status: 'error' }
}
