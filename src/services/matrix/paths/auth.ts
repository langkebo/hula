export const AUTH = {
  /** @deprecated Use MatrixAuthService.login() instead */
  LOGIN: '/_matrix/client/v3/login',
  /** @deprecated Use MatrixAuthService.logout() instead */
  LOGOUT: '/_matrix/client/v3/logout',
  /** @deprecated Use MatrixAuthService.refreshToken() instead */
  REFRESH: '/_matrix/client/v3/refresh',
  /** @deprecated Use MatrixAuthService.register() instead */
  REGISTER: '/_matrix/client/v3/register',
  /** @deprecated Use MatrixAuthService.whoami() instead */
  WHOAMI: '/_matrix/client/v3/account/whoami',
  /** @deprecated Use client.getCapabilities() instead */
  CAPABILITIES: '/_matrix/client/v3/capabilities',
  /** @deprecated Use MatrixAuthService.changePassword() instead */
  PASSWORD_CHANGE: '/_matrix/client/v3/account/password',
  /** @deprecated Use MatrixAuthService.deactivate() instead */
  DEACTIVATE: '/_matrix/client/v3/account/deactivate',
  /** @deprecated Use MatrixAccount3PidService.requestEmailToken() instead */
  EMAIL_REQUEST_TOKEN: '/_matrix/client/v3/account/3pid/email/requestToken',
  /** @deprecated Unused - will be removed in a future version */
  CAPTCHA_SEND: '/_matrix/client/v3/register/captcha/send',
  /** @deprecated Unused - will be removed in a future version */
  CAPTCHA_VERIFY: '/_matrix/client/v3/register/captcha/verify',
  /** @deprecated Unused - will be removed in a future version */
  CAPTCHA_STATUS: '/_matrix/client/v3/register/captcha/status',
  /** @deprecated Unused - will be removed in a future version */
  CAPTCHA_CLEAN: '/_matrix/client/v3/register/captcha/clean'
} as const
