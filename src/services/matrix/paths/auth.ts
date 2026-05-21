export const AUTH = {
  LOGIN: '/_matrix/client/v3/login',
  LOGOUT: '/_matrix/client/v3/logout',
  REFRESH: '/_matrix/client/v3/refresh',
  REGISTER: '/_matrix/client/v3/register',
  WHOAMI: '/_matrix/client/v3/account/whoami',
  CAPABILITIES: '/_matrix/client/v3/capabilities',
  PASSWORD_CHANGE: '/_matrix/client/v3/account/password',
  DEACTIVATE: '/_matrix/client/v3/account/deactivate',
  EMAIL_REQUEST_TOKEN: '/_matrix/client/v3/account/3pid/email/requestToken',
  CAPTCHA_SEND: '/_matrix/client/v3/register/captcha/send',
  CAPTCHA_VERIFY: '/_matrix/client/v3/register/captcha/verify',
  CAPTCHA_STATUS: '/_matrix/client/v3/register/captcha/status',
  CAPTCHA_CLEAN: '/_matrix/client/v3/register/captcha/clean'
} as const
