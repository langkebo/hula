export type { DeviceInfo } from './useAccount'
export { useAccount } from './useAccount'
export type { AvatarUploadOptions } from './useAvatarUpload'
export { useAvatarUpload } from './useAvatarUpload'

// Bridge re-exports from @/hooks
export { useLoginFlow } from './useLoginFlow'
export { startPresenceHeartbeat, stopPresenceHeartbeat } from './usePresenceHeartbeat'
export type {
  MatrixCaptchaResult,
  MatrixLoginResult,
  MatrixRegisterResult,
  MatrixRequestedEmailTokenResult,
  OidcAuthorizationUrlParams,
  OidcDiscoveryDocument,
  OidcTokenResponse,
  OidcUserInfo
} from './useSessionActions'
export { useSessionActions } from './useSessionActions'
