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

export { matrixFriendService } from './friends/MatrixFriendService'

export { matrixRoomCreationService } from './room/CreationService'

export { matrixDirectMessageService } from './room/MatrixDirectMessageService'

export { matrixSpaceService } from './room/MatrixSpaceService'

export { profileService } from './user/MatrixProfileService'
export { userDirectoryService } from './user/MatrixUserDirectoryService'
