export { matrixClientService } from './MatrixClientService'

// ============================================================
// SDK re-exports: single choke-point for components and stores.
// Components/stores MUST NOT import from 'matrix-js-sdk' directly;
// import from '@/services/matrix' instead.
// ============================================================

export { matrixOidcService } from './auth/MatrixOidcService'
// Key Backup 服务
export { matrixKeyBackupService } from './crypto/MatrixKeyBackupService'
export { matrixFriendService } from './friends/MatrixFriendService'
// 新增：核心服务导出（文档对齐）
export { matrixVoiceService } from './media/MatrixVoiceService'
export { matrixEventReportService } from './moderation/MatrixEventReportService'
export { matrixRoomCreationService } from './room/CreationService'
export { matrixDirectMessageService } from './room/MatrixDirectMessageService'
export { matrixRoomSummaryService } from './room/MatrixRoomSummaryService'
export { matrixSpaceService } from './room/MatrixSpaceService'

export { matrixAccountService } from './user/MatrixAccountService'
export { profileService } from './user/MatrixProfileService'
export { userDirectoryService } from './user/MatrixUserDirectoryService'
