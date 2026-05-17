export type {
  FederationDestination,
  RegistrationToken,
  Report,
  RoomInfo,
  ServerHealth,
  ServerStats,
  ServerVersion,
  UserInfo
} from '@/services/matrix/admin'
export type { AIConnectionInfo } from '@/services/matrix/ai/MatrixAIConnectionService'
export type { QRLoginResult } from '@/services/matrix/auth/MatrixQrLoginService'
export type { MatrixEncryptedAttachmentLike } from '@/services/matrix/crypto/MatrixAttachmentDecryptionService'
export type { FriendStatus } from '@/services/matrix/friends/MatrixFriendService'
export type { HulaCapability } from '@/services/matrix/MatrixCapabilityService'
export type { UrlPreview } from '@/services/matrix/media/MatrixUrlPreviewService'
export type { Thread, ThreadDisplayMessage } from '@/services/matrix/messaging/MatrixThreadService'
export type { IPusher, IPushRule, IPushRules } from '@/services/matrix/notifications/MatrixPushService'
export type { Announcement } from '@/services/matrix/room/MatrixAnnouncementService'
export type { DmRoomInfo } from '@/services/matrix/room/MatrixDirectMessageService'
export type { GroupCreateResult } from '@/services/matrix/room/MatrixGroupService'
export type { SpaceInfo, SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
export type { MatrixEvent, PushRuleKind, Room } from '@/services/matrix/sdk'
export type { DeviceInfo } from '@/services/matrix/user/MatrixAccountService'
export type { UserItem } from '@/services/matrix/user/MatrixContactService'
export type { Device } from '@/services/matrix/user/MatrixDeviceService'
export type { Widget } from '@/services/matrix/widget/MatrixWidgetService'
