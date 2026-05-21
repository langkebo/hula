import type { Room } from 'matrix-js-sdk'
import type { RoomInfo } from '@/services/types'
import { BaseMatrixService } from '../BaseMatrixService'
import { type MatrixRoomActionFacade, matrixRoomActionFacade } from './ActionFacade'
import { matrixRoomCreationService } from './CreationService'
import { matrixRoomLifecycleService } from './LifecycleService'
import { type MatrixRoomMemberFacade, matrixRoomMemberFacade } from './MemberFacade'
import { type MatrixRoomQueryFacade, matrixRoomQueryFacade } from './QueryFacade'
import { type MatrixRoomReadFacade, matrixRoomReadFacade } from './ReadFacade'
import { type MatrixRoomRealtimeFacade, matrixRoomRealtimeFacade } from './RealtimeFacade'
import { matrixRoomTranslateService } from './TranslateService'

/**
 * Matrix 房间服务
 *
 * 提供房间管理功能，包括创建、加入、离开房间，以及成员管理等操作。
 *
 * @example
 * ```typescript
 * import { matrixRoomService } from '@/services/matrix/room/MatrixRoomService'
 *
 * // 获取所有房间
 * const rooms = await matrixRoomService.getRooms()
 *
 * // 创建房间
 * const room = await matrixRoomService.createRoom({
 *   name: 'My Room',
 *   preset: 'private_chat'
 * })
 *
 * // 邀请用户
 * await matrixRoomService.inviteUser(room.roomId, '@user:example.org')
 * ```
 */
class MatrixRoomService
  extends BaseMatrixService
  implements
    MatrixRoomQueryFacade,
    MatrixRoomReadFacade,
    MatrixRoomRealtimeFacade,
    MatrixRoomActionFacade,
    MatrixRoomMemberFacade
{
  getRooms!: MatrixRoomQueryFacade['getRooms']
  getRoom!: MatrixRoomQueryFacade['getRoom']
  getMembers!: MatrixRoomQueryFacade['getMembers']
  getRoomState!: MatrixRoomReadFacade['getRoomState']
  getRoomSummary!: MatrixRoomReadFacade['getRoomSummary']
  getRoomSummaries!: MatrixRoomReadFacade['getRoomSummaries']
  getRoomAliases!: MatrixRoomReadFacade['getRoomAliases']
  getEventContext!: MatrixRoomReadFacade['getEventContext']
  getRoomVersion!: MatrixRoomReadFacade['getRoomVersion']
  getRoomCapabilities!: MatrixRoomReadFacade['getRoomCapabilities']
  getRoomTimeline!: MatrixRoomReadFacade['getRoomTimeline']
  getRoomUnreadCount!: MatrixRoomReadFacade['getRoomUnreadCount']
  getRoomAccountData!: MatrixRoomReadFacade['getRoomAccountData']
  getRoomMetadata!: MatrixRoomReadFacade['getRoomMetadata']
  getRoomTurnServer!: MatrixRoomReadFacade['getRoomTurnServer']
  getPinnedEvents!: MatrixRoomReadFacade['getPinnedEvents']
  getInviteBlocklist!: MatrixRoomReadFacade['getInviteBlocklist']
  getInviteAllowlist!: MatrixRoomReadFacade['getInviteAllowlist']
  getStickyEvents!: MatrixRoomReadFacade['getStickyEvents']
  timestampToEvent!: MatrixRoomReadFacade['timestampToEvent']
  getRoomCall!: MatrixRoomReadFacade['getRoomCall']
  getRoomSync!: MatrixRoomReadFacade['getRoomSync']
  getTags!: MatrixRoomReadFacade['getTags']
  getReportScannerInfo!: MatrixRoomReadFacade['getReportScannerInfo']
  getExternalServices!: MatrixRoomReadFacade['getExternalServices']
  getRoomNotifications!: MatrixRoomReadFacade['getRoomNotifications']
  getRoomPermissions!: MatrixRoomReadFacade['getRoomPermissions']
  convertRoomToSession!: MatrixRoomRealtimeFacade['convertRoomToSession']
  onTimelineEvent!: MatrixRoomRealtimeFacade['onTimelineEvent']
  onRoomNameChange!: MatrixRoomRealtimeFacade['onRoomNameChange']
  onRoomAvatarChange!: MatrixRoomRealtimeFacade['onRoomAvatarChange']
  onRoomMemberChange!: MatrixRoomRealtimeFacade['onRoomMemberChange']
  getRoomName!: MatrixRoomRealtimeFacade['getRoomName']
  getRoomAvatarUrl!: MatrixRoomRealtimeFacade['getRoomAvatarUrl']
  getVisibleRoomSessions!: MatrixRoomRealtimeFacade['getVisibleRoomSessions']
  getAllRoomInfos!: MatrixRoomRealtimeFacade['getAllRoomInfos']
  createRoom!: MatrixRoomActionFacade['createRoom']
  createGroupRoom!: MatrixRoomActionFacade['createGroupRoom']
  createDirectRoom!: MatrixRoomActionFacade['createDirectRoom']
  joinRoom!: MatrixRoomActionFacade['joinRoom']
  leaveRoom!: MatrixRoomActionFacade['leaveRoom']
  inviteUser!: MatrixRoomActionFacade['inviteUser']
  kickUser!: MatrixRoomActionFacade['kickUser']
  banUser!: MatrixRoomActionFacade['banUser']
  unbanUser!: MatrixRoomActionFacade['unbanUser']
  setRoomName!: MatrixRoomActionFacade['setRoomName']
  setRoomTopic!: MatrixRoomActionFacade['setRoomTopic']
  setRoomAvatar!: MatrixRoomActionFacade['setRoomAvatar']
  setPushRule!: MatrixRoomActionFacade['setPushRule']
  setDirectRoom!: MatrixRoomActionFacade['setDirectRoom']
  incrementUnread!: MatrixRoomActionFacade['incrementUnread']
  clearUnread!: MatrixRoomActionFacade['clearUnread']
  forgetRoom!: MatrixRoomActionFacade['forgetRoom']
  upgradeRoom!: MatrixRoomActionFacade['upgradeRoom']
  knockRoom!: MatrixRoomActionFacade['knockRoom']
  setRoomAlias!: MatrixRoomActionFacade['setRoomAlias']
  deleteRoomAlias!: MatrixRoomActionFacade['deleteRoomAlias']
  setRoomAccountData!: MatrixRoomActionFacade['setRoomAccountData']
  setPinnedEvents!: MatrixRoomActionFacade['setPinnedEvents']
  setInviteBlocklist!: MatrixRoomActionFacade['setInviteBlocklist']
  setInviteAllowlist!: MatrixRoomActionFacade['setInviteAllowlist']
  setStickyEvents!: MatrixRoomActionFacade['setStickyEvents']
  setTag!: MatrixRoomActionFacade['setTag']
  removeTag!: MatrixRoomActionFacade['removeTag']
  setReadLifetime!: MatrixRoomActionFacade['setReadLifetime']
  pinEvent!: MatrixRoomActionFacade['pinEvent']
  unpinEvent!: MatrixRoomActionFacade['unpinEvent']
  joinRoomByAlias!: MatrixRoomActionFacade['joinRoomByAlias']
  setMemberDisplayName!: MatrixRoomMemberFacade['setMemberDisplayName']
  getMemberDisplayName!: MatrixRoomMemberFacade['getMemberDisplayName']
  setMemberPowerLevel!: MatrixRoomMemberFacade['setMemberPowerLevel']
  setMemberAsAdmin!: MatrixRoomMemberFacade['setMemberAsAdmin']
  removeMemberAsAdmin!: MatrixRoomMemberFacade['removeMemberAsAdmin']

  async getServerDomain(): Promise<string> {
    return matrixRoomLifecycleService.getServerDomain()
  }

  async translateText(text: string, targetLanguage: string): Promise<string> {
    return matrixRoomTranslateService.translateText(text, targetLanguage)
  }

  convertRoomToRoomInfo(room: Room): RoomInfo {
    return matrixRoomCreationService.convertRoomToRoomInfo(room)
  }

  async joinRoomAndGetInfo(roomId: string): Promise<RoomInfo> {
    return matrixRoomCreationService.joinRoomAndGetInfo(roomId)
  }
}

Object.assign(
  MatrixRoomService.prototype,
  matrixRoomQueryFacade,
  matrixRoomReadFacade,
  matrixRoomRealtimeFacade,
  matrixRoomActionFacade,
  matrixRoomMemberFacade
)

export const matrixRoomService = new MatrixRoomService()
export default matrixRoomService
