export const AUTH = {
  /** @deprecated Use MatrixAuthService.login() instead */
  LOGIN: '/login',
  /** @deprecated Use MatrixAuthService.logout() instead */
  LOGOUT: '/logout',
  /** @deprecated Use MatrixAuthService.refreshToken() instead */
  REFRESH: '/refresh',
  /** @deprecated Use MatrixAuthService.register() instead */
  REGISTER: '/register',
  /** @deprecated Use MatrixAuthService.whoami() instead */
  WHOAMI: '/account/whoami',
  /** @deprecated Use client.getCapabilities() instead */
  CAPABILITIES: '/capabilities',
  /** @deprecated Use MatrixAuthService.changePassword() instead */
  PASSWORD_CHANGE: '/account/password',
  /** @deprecated Use MatrixAuthService.deactivate() instead */
  DEACTIVATE: '/account/deactivate',
  /** @deprecated Use MatrixAccount3PidService.requestEmailToken() instead */
  EMAIL_REQUEST_TOKEN: '/account/3pid/email/requestToken',
  /** @deprecated Unused - will be removed in a future version */
  CAPTCHA_SEND: '/register/captcha/send',
  /** @deprecated Unused - will be removed in a future version */
  CAPTCHA_VERIFY: '/register/captcha/verify',
  /** @deprecated Unused - will be removed in a future version */
  CAPTCHA_STATUS: '/register/captcha/status',
  /** @deprecated Unused - will be removed in a future version */
  CAPTCHA_CLEAN: '/register/captcha/clean'
} as const
