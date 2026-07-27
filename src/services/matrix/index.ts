import { MatrixAuthService } from './auth/MatrixAuthService'

export { matrixClientService } from './MatrixClientService'

const _matrixAuthService = new MatrixAuthService()

// ============================================================
// SDK re-exports: single choke-point for components and stores.
// Components/stores MUST NOT import from 'matrix-js-sdk' directly;
// import from '@/services/matrix' instead.
// ============================================================

// Key Backup 服务
export { matrixKeyBackupService } from './crypto/MatrixKeyBackupService'

// Verification 服务

export { matrixFriendService } from './friends/MatrixFriendService'

// Beacon 服务

// Location 服务

// URL 预览服务

// Rendezvous 服务

export { matrixRoomCreationService } from './room/CreationService'

export { matrixDirectMessageService } from './room/MatrixDirectMessageService'

export { matrixSpaceService } from './room/MatrixSpaceService'

// Device 服务

// Presence 服务

export { profileService } from './user/MatrixProfileService'
export { userDirectoryService } from './user/MatrixUserDirectoryService'
