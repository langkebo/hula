export const GUEST = {
  /** @deprecated Use MatrixGuestService.registerGuest() instead */
  REGISTER: '/_matrix/client/v3/register/guest',
  /** @deprecated Use MatrixAuthService.login() instead */
  LOGIN: '/_matrix/client/v3/login',
  INFO: '/_matrix/client/v3/account/guest',
  /** @deprecated Unused - will be removed in a future version */
  VALIDATE: '/_matrix/client/v3/guest/validate',
  /** @deprecated Unused - will be removed in a future version */
  UPGRADE: '/_matrix/client/v3/account/guest/upgrade',
  /** @deprecated Unused - will be removed in a future version */
  ROOMS: '/_matrix/client/v3/guest/rooms'
} as const
