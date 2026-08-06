import { PREFIX_V1 } from './prefixes'

/**
 * MSC4108 unstable namespace for sign-in-with-QR rendezvous transport.
 *
 * The SDK's `MSC4108RendezvousSession` polls these endpoints with
 * `text/plain` bodies and `ETag`-based conditional requests.
 */
const MSC4108_UNSTABLE_PREFIX = '/_matrix/client/unstable/org.matrix.msc4108'

export const AUTH = {
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
