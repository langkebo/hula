export const GUEST = {
  /** @deprecated Use MatrixGuestService.registerGuest() instead */
  REGISTER: '/register/guest',
  /** @deprecated Use MatrixAuthService.login() instead */
  LOGIN: '/login',
  INFO: '/account/guest'
} as const
