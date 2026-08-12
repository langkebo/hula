/**
 * MSC4108 QR 登录 — 类型定义模块。
 *
 * 从 MatrixQrLoginSdkService 抽离，包含 payload 类型和公共 API 类型。
 */

// ── MSC4108 payload types ──

export interface ProtocolsPayload {
  type: 'm.login.protocols'
  protocols: string[]
  homeserver: string
}

export interface ProtocolPayload {
  type: 'm.login.protocol'
  protocol: 'm.login.token'
  device_id: string
}

export interface LoginTokenPayload {
  type: 'm.login.secrets'
  login_token: string
  homeserver_url: string
  user_id: string
  device_id: string
  expires_at: number
}

export interface SuccessPayload {
  type: 'm.login.success'
  user_id: string
  device_id: string
}

export interface FailurePayload {
  type: 'm.login.failure'
  reason: string
  detail?: string
}

export type MSC4108Payload = ProtocolsPayload | ProtocolPayload | LoginTokenPayload | SuccessPayload | FailurePayload

export const PROTOCOL_NAME = 'm.login.token' as const

// ── Public API types ──

export type QrLoginStatus =
  | 'idle'
  | 'generating'
  | 'waiting_scan'
  | 'waiting_confirm'
  | 'success'
  | 'expired'
  | 'failed'
  | 'cancelled'

export interface QrCodeData {
  qrCodeBase64: string
  checkCode?: string
  rendezvousUrl?: string
}

export interface ScannedSessionInfo {
  serverName?: string
  checkCode?: string
}

export interface NewDeviceLoginResult {
  user_id: string
  access_token: string
  device_id: string
  refresh_token?: string
  expires_in?: number
  homeserver_url: string
}

export interface ExistingDeviceReciprocateResult {
  user_id: string
  device_id: string
}

export type StatusListener = (status: QrLoginStatus, detail?: string) => void

// ── SDK instance types ──

export interface RendezvousSessionInstance {
  url?: string
  ready: boolean
  cancelled: boolean
  send(data: string): Promise<void>
  receive(): Promise<string | undefined>
  cancel(reason: unknown): Promise<void>
  close(): Promise<void>
}

export interface SecureChannelInstance {
  generateCode(mode: unknown, serverName?: string): Promise<Uint8Array>
  getCheckCode(): string | undefined
  connect(): Promise<void>
  secureSend<T extends { type: string }>(payload: T): Promise<void>
  secureReceive<T extends MSC4108Payload>(): Promise<Partial<T> | undefined>
  close(): Promise<void>
  cancel(reason: unknown): Promise<void>
  cancelled: boolean
}

export interface SdkRendezvousModule {
  MSC4108RendezvousSession: typeof import('matrix-js-sdk/rendezvous').MSC4108RendezvousSession
  MSC4108SecureChannel: typeof import('matrix-js-sdk/rendezvous').MSC4108SecureChannel
}
