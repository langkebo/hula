import { PREFIX_V1 } from './prefixes'

/**
 * 认证相关路径常量。
 *
 * MSC4108（QR 登录的 rendezvous 传输）已由 SDK `MSC4108RendezvousSession` 内部实现，
 * Tjg 侧不再保留对应路径常量。此处仅保留 SDK 未覆盖的 `login/qr_token`。
 */
export const AUTH = {
  /** POST — generate a short-lived login token (existing device, authenticated). */
  QR_GENERATE_TOKEN: `${PREFIX_V1}/login/qr_token`
} as const
