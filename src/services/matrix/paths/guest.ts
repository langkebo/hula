export const GUEST = {
  /** @deprecated Use MatrixGuestService.registerGuest() instead */
  REGISTER: '/register/guest',
  /** @deprecated Use MatrixAuthService.login() instead */
  LOGIN: '/login',
  INFO: '/account/guest',
  /** @deprecated Unused - will be removed in a future version */
  VALIDATE: '/guest/validate',
  /** @deprecated Unused - will be removed in a future version */
  UPGRADE: '/account/guest/upgrade',
  /** @deprecated Unused - will be removed in a future version */
  ROOMS: '/guest/rooms'
} as const
