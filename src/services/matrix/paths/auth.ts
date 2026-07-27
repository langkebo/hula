import { PREFIX_V1 } from './prefixes'

/**
 * MSC4108 unstable namespace for sign-in-with-QR rendezvous transport.
 *
 * The SDK's `MSC4108RendezvousSession` polls these endpoints with
 * `text/plain` bodies and `ETag`-based conditional requests.
 */
const MSC4108_UNSTABLE_PREFIX = '/_matrix/client/unstable/org.matrix.msc4108'

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

  // ── MSC4108: Sign in with QR code ──────────────────────────────────────
  // Existing device (authenticated) generates a short-lived login token;
  // the new device exchanges it via m.login.token after the secure
  // rendezvous channel is established.
  /** POST — generate a short-lived login token (existing device, authenticated). */
  QR_GENERATE_TOKEN: `${PREFIX_V1}/login/qr_token`,
  /** POST — create a new MSC4108 rendezvous session (returns `{ url }`). */
  MSC4108_CREATE_RENDEZVOUS: `${MSC4108_UNSTABLE_PREFIX}/rendezvous`,
  /** Build the per-session rendezvous URL (GET/PUT/DELETE). */
  MSC4108_RENDEZVOUS_SESSION: (sessionId: string) =>
    `${MSC4108_UNSTABLE_PREFIX}/rendezvous/${encodeURIComponent(sessionId)}`
} as const
