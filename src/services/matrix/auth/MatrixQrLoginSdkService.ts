/**
 * Matrix QR 登录 SDK 服务（MSC4108）
 *
 * 包装 matrix-js-sdk 的 MSC4108 rendezvous 传输层（`MSC4108RendezvousSession`）
 * 与安全通道（`MSC4108SecureChannel`），在其之上实现基于 `m.login.token` 的
 * 跨设备扫码登录协议。
 *
 * 与 SDK 自带的 `MSC4108SignInWithQR` 不同：后者仅支持 OIDC
 * `device_authorization_grant` 协议；本服务对接后端 `POST /v1/login/qr_token`
 * + `m.login.token` 流程，无需 OIDC Provider。
 *
 * 协议流：
 *   Existing device (Reciprocate)            New device (Login)
 *   ─────────────────────────────            ──────────────────
 *   1. 创建 rendezvous session                |
 *   2. 生成 QR code（含 ECDH 公钥 + URL）     |
 *   3. 显示 QR，等待新设备扫码                | 4. 扫码 → 解析公钥 + URL
 *   5. channel.connect()                     | 6. channel.connect()
 *      ↘ 发送 LoginInitiate                     ↙ 接收 LoginInitiate
 *      ↙ 接收 LoginOk                           ↘ 发送 LoginOk
 *   7. 发送 ProtocolsPayload                 | 8. 接收 ProtocolsPayload
 *      (protocols: ["m.login.token"],           选择 "m.login.token"
 *       homeserver: <domain>)               | 9. 发送 ProtocolPayload
 *   10. 接收 ProtocolPayload                 |    (protocol: "m.login.token",
 *       (含 device_id)                      |     device_id: <new_device_id>)
 *   11. POST /v1/login/qr_token              |
 *       获取短时 login_token                 |
 *   12. 发送 LoginTokenPayload               | 13. 接收 LoginTokenPayload
 *       (login_token, homeserver_url,        |
 *        device_id)                          | 14. POST /v3/login
 *   15. 接收 SuccessPayload                  |     {type:"m.login.token",token}
 *       关闭 channel                         | 16. 发送 SuccessPayload
 *                                            | 17. 使用新 access_token 启动 client
 *
 * 对应后端:
 *   - synapse-rust/src/web/routes/msc4108_rendezvous.rs
 *   - synapse-rust/src/web/routes/qr_login_token.rs
 *   - synapse-rust/src/web/routes/auth_compat.rs (m.login.token 处理)
 */

import { MSC4108SignInWithQR } from 'matrix-js-sdk'
import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend/config'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { PREFIX_V3 } from '../paths'

const logger = createLogger('MatrixQrLoginSdkService')

// ── MSC4108 payload types (mirror SDK's MSC4108SignInWithQR payload shapes) ──
// We define our own payload types instead of using MSC4108SignInWithQR directly,
// because the SDK's class is hard-coded for OIDC device_authorization_grant flow.

/** Payload offering supported login protocols (existing device → new device). */
interface ProtocolsPayload {
  type: 'm.login.protocols'
  protocols: string[]
  homeserver: string
}

/** Payload selecting a specific protocol (new device → existing device). */
interface ProtocolPayload {
  type: 'm.login.protocol'
  protocol: 'm.login.token'
  device_id: string
}

/** Payload delivering the short-lived login token (existing device → new device). */
interface LoginTokenPayload {
  type: 'm.login.secrets'
  /** Short-lived login token (single-use, 60s TTL). */
  login_token: string
  /** Homeserver base URL for the new device to connect to. */
  homeserver_url: string
  /** Existing device's user_id (for new device UI display). */
  user_id: string
  /** Existing device's device_id (for new device UI display). */
  device_id: string
  /** Token expiry timestamp (ms since epoch). */
  expires_at: number
}

/** Payload confirming successful login (new device → existing device). */
interface SuccessPayload {
  type: 'm.login.success'
  user_id: string
  device_id: string
}

/** Payload reporting failure. */
interface FailurePayload {
  type: 'm.login.failure'
  reason: string
  detail?: string
}

type MSC4108Payload = ProtocolsPayload | ProtocolPayload | LoginTokenPayload | SuccessPayload | FailurePayload

const PROTOCOL_NAME = 'm.login.token' as const

// ── Public types ──

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
  /** Base64-encoded QR code bytes (suitable for string-based QR renderers). */
  qrCodeBase64: string
  /** Short numeric check code for user verification (anti-MITM). */
  checkCode?: string
  /** Rendezvous session URL (for debugging). */
  rendezvousUrl?: string
}

export interface ScannedSessionInfo {
  /** Server name parsed from QR code (for new device UI display). */
  serverName?: string
  /** Check code (for new device UI to display and confirm). */
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
  /** The new device's user_id (should match the existing device's user_id). */
  user_id: string
  /** The new device's device_id. */
  device_id: string
}

type StatusListener = (status: QrLoginStatus, detail?: string) => void

// ── Lazy SDK loader ──
// MSC4108SecureChannel imports @matrix-org/matrix-sdk-crypto-wasm; load it
// dynamically so the WASM blob stays out of the main bundle.

interface SdkRendezvousModule {
  MSC4108RendezvousSession: typeof import('matrix-js-sdk/rendezvous').MSC4108RendezvousSession
  MSC4108SecureChannel: typeof import('matrix-js-sdk/rendezvous').MSC4108SecureChannel
}

interface RendezvousSessionInstance {
  url?: string
  ready: boolean
  cancelled: boolean
  send(data: string): Promise<void>
  receive(): Promise<string | undefined>
  cancel(reason: unknown): Promise<void>
  close(): Promise<void>
}

interface SecureChannelInstance {
  generateCode(mode: unknown, serverName?: string): Promise<Uint8Array>
  getCheckCode(): string | undefined
  connect(): Promise<void>
  secureSend<T extends { type: string }>(payload: T): Promise<void>
  secureReceive<T extends MSC4108Payload>(): Promise<Partial<T> | undefined>
  close(): Promise<void>
  cancel(reason: unknown): Promise<void>
  cancelled: boolean
}

let sdkModulePromise: Promise<SdkRendezvousModule> | null = null

async function loadSdkRendezvous(): Promise<SdkRendezvousModule> {
  if (!sdkModulePromise) {
    sdkModulePromise = import('matrix-js-sdk/rendezvous').then((mod) => ({
      MSC4108RendezvousSession: mod.MSC4108RendezvousSession,
      MSC4108SecureChannel: mod.MSC4108SecureChannel
    })) as Promise<SdkRendezvousModule>
  }
  return sdkModulePromise
}

// ── Helpers ──

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function generateDeviceId(): string {
  const random = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

function resolveMatrixClientUrl(path: string): string {
  const { homeserverUrl } = resolveMatrixRuntimeEndpointConfig()
  const normalizedHomeserverUrl = homeserverUrl.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedHomeserverUrl}${normalizedPath}`
}

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const url = resolveMatrixClientUrl(path)
  const response = await getRuntimeAwareFetch()(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`MSC4108 login request failed (${response.status}): ${text}`)
  }
  const text = await response.text()
  return (text ? JSON.parse(text) : {}) as T
}

// ── Service ──

class MatrixQrLoginSdkService {
  private status: QrLoginStatus = 'idle'
  private listeners = new Set<StatusListener>()

  /** Active secure channel for the current session (either side). */
  private channel: SecureChannelInstance | null = null
  /** Active rendezvous session (either side). */
  private session: RendezvousSessionInstance | null = null

  getStatus(): QrLoginStatus {
    return this.status
  }

  private setStatus(status: QrLoginStatus, detail?: string) {
    this.status = status
    logger.info(`[MSC4108] status -> ${status}${detail ? ` (${detail})` : ''}`)
    this.listeners.forEach((l) => {
      try {
        l(status, detail)
      } catch (err) {
        logger.error('[MSC4108] status listener threw', err)
      }
    })
  }

  onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ── New device (Login) flow — generates QR for existing device to scan ─

  /**
   * Step 1-3 (new device side): Create rendezvous session on the homeserver
   * (unauthenticated), establish secure channel, generate QR code in Login
   * mode.
   *
   * The new device is NOT logged in, so no Matrix client is passed to the
   * SDK. The rendezvous session is created via a plain POST to the
   * unstable MSC4108 endpoint.
   *
   * @param homeserverUrl Homeserver base URL (from login form).
   * @returns QR code data for rendering.
   */
  async generateQrCodeAsNewDevice(homeserverUrl: string): Promise<QrCodeData> {
    if (!homeserverUrl) {
      throw new Error('Homeserver URL is required for QR login')
    }

    this.setStatus('generating')
    this.cleanupSession()

    try {
      const { MSC4108RendezvousSession, MSC4108SecureChannel } = await loadSdkRendezvous()
      const onFailure = (reason: unknown) => this.handleFailure(String(reason))

      // New device has no Matrix client; pass fallbackRzServer so the SDK
      // knows where to create the rendezvous session.
      const session = new MSC4108RendezvousSession({
        fallbackRzServer: homeserverUrl,
        fetchFn: getRuntimeAwareFetch(),
        onFailure
      })
      const channel = new MSC4108SecureChannel(session, undefined, onFailure)

      this.session = session as RendezvousSessionInstance
      this.channel = channel as SecureChannelInstance

      // Create the rendezvous session on the server.
      await session.send('')

      // QrCodeMode.Login = 0 — new device generates QR advertising itself
      // (no serverName needed; the existing device already knows its server).
      const LOGIN_MODE = 0
      const qrBytes = await channel.generateCode(LOGIN_MODE)

      this.setStatus('waiting_scan')
      return {
        qrCodeBase64: bytesToBase64(qrBytes),
        checkCode: channel.getCheckCode(),
        rendezvousUrl: session.url
      }
    } catch (err) {
      this.setStatus('failed')
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[MSC4108] generateQrCodeAsNewDevice failed:', err)
      throw new Error(`生成二维码失败: ${msg}`)
    }
  }

  /**
   * Step 5-17 (new device side): Wait for the existing device to scan the QR,
   * establish the secure channel, negotiate protocol, receive the login
   * token, and exchange it for an access token via `m.login.token`.
   *
   * This method blocks until the login completes or fails. Subscribe to
   * `onStatusChange()` for intermediate UI updates (waiting_scan →
   * waiting_confirm → success).
   *
   * @param displayName Optional initial device display name.
   */
  async waitForReciprocationAndLogin(displayName?: string): Promise<NewDeviceLoginResult> {
    if (!this.channel) {
      throw new Error('No active QR session — call generateQrCodeAsNewDevice() first')
    }
    if (!this.session) {
      throw new Error('No active rendezvous session')
    }

    try {
      // Wait for existing device to scan + send LoginInitiateMessage.
      await this.channel.connect()

      // Receive ProtocolsPayload from existing device.
      const protocolsMsg = await this.channel.secureReceive<ProtocolsPayload>()
      if (protocolsMsg?.type !== 'm.login.protocols') {
        throw new Error('未收到协议协商消息')
      }
      if (!protocolsMsg.protocols?.includes(PROTOCOL_NAME)) {
        await this.sendFailure('unsupported_protocol', 'Existing device does not offer m.login.token')
        throw new Error('现有设备未提供 m.login.token 协议')
      }

      // Select m.login.token + send our chosen device_id.
      const newDeviceId = generateDeviceId()
      await this.channel.secureSend<ProtocolPayload>({
        type: 'm.login.protocol',
        protocol: PROTOCOL_NAME,
        device_id: newDeviceId
      })

      this.setStatus('waiting_confirm')

      // Receive LoginTokenPayload.
      const secretsMsg = await this.channel.secureReceive<LoginTokenPayload>()
      if (secretsMsg?.type !== 'm.login.secrets' || !secretsMsg.login_token) {
        await this.sendFailure('login_failed', 'Did not receive login token')
        throw new Error('未收到登录令牌')
      }

      // Exchange login_token for access_token via m.login.token flow.
      const loginResult = await postJson<{
        user_id: string
        access_token: string
        device_id: string
        refresh_token?: string
        expires_in?: number
      }>(`${PREFIX_V3}/login`, {
        type: 'm.login.token',
        token: secretsMsg.login_token,
        device_id: newDeviceId,
        initial_display_name: displayName ?? 'HuLa QR Login'
      })

      // Send SuccessPayload to existing device.
      await this.channel.secureSend<SuccessPayload>({
        type: 'm.login.success',
        user_id: loginResult.user_id,
        device_id: loginResult.device_id
      })

      this.setStatus('success')
      return {
        user_id: loginResult.user_id,
        access_token: loginResult.access_token,
        device_id: loginResult.device_id,
        refresh_token: loginResult.refresh_token,
        expires_in: loginResult.expires_in,
        homeserver_url: secretsMsg.homeserver_url ?? resolveMatrixRuntimeEndpointConfig().homeserverUrl
      }
    } catch (err) {
      this.setStatus('failed')
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[MSC4108] waitForReciprocationAndLogin failed:', err)
      throw new Error(`新设备登录失败: ${msg}`)
    } finally {
      await this.closeChannelSafely()
    }
  }

  // ── Existing device (Reciprocate) flow ────────────────────────────────

  /**
   * Step 1-3: Create rendezvous session, establish secure channel, generate QR code.
   *
   * Must be called on the existing device that is already authenticated.
   * Returns base64-encoded QR bytes for rendering.
   */
  async generateQrCode(): Promise<QrCodeData> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized — existing device must be logged in')
    }

    this.setStatus('generating')
    this.cleanupSession()

    try {
      const { MSC4108RendezvousSession, MSC4108SecureChannel } = await loadSdkRendezvous()
      const onFailure = (reason: unknown) => this.handleFailure(String(reason))

      // Existing device passes `client` so the SDK can negotiate the rendezvous
      // endpoint via `doesServerSupportUnstableFeature("org.matrix.msc4108")`.
      // biome-ignore lint/suspicious/noExplicitAny: SDK rendezvous expects MatrixClient with manager property
      const session = new MSC4108RendezvousSession({
        client,
        fetchFn: getRuntimeAwareFetch(),
        onFailure
      } as ConstructorParameters<typeof MSC4108RendezvousSession>[0])
      const channel = new MSC4108SecureChannel(session, undefined, onFailure)

      this.session = session as RendezvousSessionInstance
      this.channel = channel as SecureChannelInstance

      // Create the rendezvous session on the server (POST /rendezvous).
      // The send() with empty body triggers session creation per MSC4108 transport.
      await session.send('')

      // Generate QR code in Reciprocate mode (existing device shows QR
      // advertising its homeserver so the new device knows where to log in).
      const serverName = client.getDomain()
      if (!serverName) {
        throw new Error('Cannot determine server domain from Matrix client')
      }

      // QrCodeMode.Reciprocate — enum value from matrix-sdk-crypto-wasm.
      // We pass the raw enum value (1) to avoid importing the WASM crate here.
      const RECIPROCATE_MODE = 1
      const qrBytes = await channel.generateCode(RECIPROCATE_MODE, serverName)

      this.setStatus('waiting_scan')
      return {
        qrCodeBase64: bytesToBase64(qrBytes),
        checkCode: channel.getCheckCode(),
        rendezvousUrl: session.url
      }
    } catch (err) {
      this.setStatus('failed')
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[MSC4108] generateQrCode failed:', err)
      throw new Error(`生成二维码失败: ${msg}`)
    }
  }

  /**
   * Step 5-16 (existing device side): Wait for new device to scan, negotiate
   * protocol, generate login token, deliver it, and confirm success.
   *
   * Resolves when the new device reports a successful login. The returned
   * device_id is the new device's identifier.
   */
  async reciprocateLogin(): Promise<ExistingDeviceReciprocateResult> {
    if (!this.channel) {
      throw new Error('No active QR session — call generateQrCode() or scanQrCode() first')
    }
    if (!this.session) {
      throw new Error('No active rendezvous session')
    }

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      // Step 5-6: Establish secure channel (existing device waits for
      // LoginInitiateMessage from the scanning device).
      await this.channel.connect()

      // Step 7: Send ProtocolsPayload offering m.login.token.
      const homeserver = client.getDomain()!
      await this.channel.secureSend<ProtocolsPayload>({
        type: 'm.login.protocols',
        protocols: [PROTOCOL_NAME],
        homeserver
      })

      // Step 10: Receive ProtocolPayload selecting m.login.token.
      const protocolMsg = await this.channel.secureReceive<ProtocolPayload>()
      if (protocolMsg?.type !== 'm.login.protocol' || protocolMsg.protocol !== PROTOCOL_NAME) {
        await this.sendFailure('unsupported_protocol', 'New device did not select m.login.token')
        throw new Error('协议协商失败：新设备未选择 m.login.token')
      }
      const newDeviceId = protocolMsg.device_id || generateDeviceId()

      this.setStatus('waiting_confirm')

      // Step 11: Generate short-lived login token via SDK MSC4108SignInWithQR.generateQrLoginToken().
      // This is an authenticated request — the existing device's credentials
      // authorize issuance of a token bound to its user_id.
      const qrHelper = new MSC4108SignInWithQR(null as never, true, client)
      const tokenResponse = await qrHelper.generateQrLoginToken()

      const homeserverUrl = client.getHomeserverUrl()
      const userId = (client as { getUserId(): string }).getUserId()
      const deviceId = (client as { getDeviceId(): string | null }).getDeviceId() ?? ''

      // Step 12: Deliver login token + homeserver info to new device.
      await this.channel.secureSend<LoginTokenPayload>({
        type: 'm.login.secrets',
        login_token: tokenResponse.login_token,
        homeserver_url: homeserverUrl,
        user_id: userId,
        device_id: deviceId,
        expires_at: Date.now() + (tokenResponse.expires_in_ms ?? 60000)
      })

      // Step 15: Wait for new device's SuccessPayload.
      const successMsg = await this.channel.secureReceive<SuccessPayload>()
      if (successMsg?.type !== 'm.login.success') {
        await this.sendFailure('login_failed', 'New device did not report success')
        throw new Error('新设备登录未成功完成')
      }

      this.setStatus('success')
      return {
        user_id: successMsg.user_id ?? userId,
        device_id: successMsg.device_id ?? newDeviceId
      }
    } catch (err) {
      this.setStatus('failed')
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[MSC4108] reciprocateLogin failed:', err)
      throw new Error(`扫码登录确认失败: ${msg}`)
    } finally {
      // Always close the channel after reciprocation completes (success or failure).
      await this.closeChannelSafely()
    }
  }

  /**
   * Decline the login on the existing device (user tapped "cancel").
   */
  async declineLogin(): Promise<void> {
    if (!this.channel) return
    try {
      await this.channel.secureSend<FailurePayload>({
        type: 'm.login.failure',
        reason: 'user_declined',
        detail: 'Existing device declined the login'
      })
    } catch (err) {
      logger.warn('[MSC4108] failed to send decline payload', err)
    } finally {
      this.setStatus('cancelled')
      await this.closeChannelSafely()
    }
  }

  // ── New device (Login) flow ───────────────────────────────────────────

  /**
   * Step 4 + 6: Scan QR code, parse rendezvous URL + public key, establish
   * secure channel.
   *
   * @param qrCodeBase64 Base64-encoded QR bytes from the existing device.
   * @returns ScannedSessionInfo with server name + check code for UI display.
   */
  async scanQrCode(qrCodeBase64: string): Promise<ScannedSessionInfo> {
    this.cleanupSession()
    this.setStatus('generating')

    try {
      const { MSC4108RendezvousSession, MSC4108SecureChannel } = await loadSdkRendezvous()
      const onFailure = (reason: unknown) => this.handleFailure(String(reason))

      const qrBytes = base64ToBytes(qrCodeBase64)

      // Parse QR code data to extract server name + existing device's public key.
      // We use the SDK's parser via a dynamic import of the crypto WASM crate.
      const { QrCodeData } = await import('@matrix-org/matrix-sdk-crypto-wasm')
      const parsed = QrCodeData.fromBytes(qrBytes)
      const serverName = parsed.serverName
      const theirPublicKey = parsed.publicKey
      const rendezvousUrl = parsed.rendezvousUrl

      if (!rendezvousUrl) {
        throw new Error('Invalid QR code: missing rendezvous URL')
      }

      // New device constructs a rendezvous session bound to the URL from the QR
      // code. No Matrix client is passed — the new device is not yet logged in.
      const session = new MSC4108RendezvousSession({
        url: rendezvousUrl,
        fetchFn: getRuntimeAwareFetch(),
        onFailure
      })
      const channel = new MSC4108SecureChannel(session, theirPublicKey, onFailure)

      this.session = session as RendezvousSessionInstance
      this.channel = channel as SecureChannelInstance

      // Step 6: Establish secure channel (new device sends LoginInitiateMessage).
      await channel.connect()

      this.setStatus('waiting_confirm')
      return {
        serverName: serverName ?? undefined,
        checkCode: channel.getCheckCode()
      }
    } catch (err) {
      this.setStatus('failed')
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[MSC4108] scanQrCode failed:', err)
      throw new Error(`扫码失败: ${msg}`)
    }
  }

  /**
   * Step 8-17 (new device side): Receive protocols, select m.login.token,
   * receive login token, exchange via POST /v3/login, report success.
   *
   * @param displayName Optional initial device display name.
   */
  async completeNewDeviceLogin(displayName?: string): Promise<NewDeviceLoginResult> {
    if (!this.channel) {
      throw new Error('No active QR session — call scanQrCode() first')
    }
    if (!this.session) {
      throw new Error('No active rendezvous session')
    }

    try {
      // Step 8: Receive ProtocolsPayload from existing device.
      const protocolsMsg = await this.channel.secureReceive<ProtocolsPayload>()
      if (protocolsMsg?.type !== 'm.login.protocols') {
        throw new Error('未收到协议协商消息')
      }
      if (!protocolsMsg.protocols?.includes(PROTOCOL_NAME)) {
        await this.sendFailure('unsupported_protocol', 'Existing device does not offer m.login.token')
        throw new Error('现有设备未提供 m.login.token 协议')
      }

      // Step 9: Select m.login.token + send our chosen device_id.
      const newDeviceId = generateDeviceId()
      await this.channel.secureSend<ProtocolPayload>({
        type: 'm.login.protocol',
        protocol: PROTOCOL_NAME,
        device_id: newDeviceId
      })

      // Step 13: Receive LoginTokenPayload.
      const secretsMsg = await this.channel.secureReceive<LoginTokenPayload>()
      if (secretsMsg?.type !== 'm.login.secrets' || !secretsMsg.login_token) {
        await this.sendFailure('login_failed', 'Did not receive login token')
        throw new Error('未收到登录令牌')
      }

      // Step 14: Exchange login_token for access_token via m.login.token flow.
      const loginResult = await postJson<{
        user_id: string
        access_token: string
        device_id: string
        refresh_token?: string
        expires_in?: number
      }>(`${PREFIX_V3}/login`, {
        type: 'm.login.token',
        token: secretsMsg.login_token,
        device_id: newDeviceId,
        initial_display_name: displayName ?? 'HuLa QR Login'
      })

      // Step 16: Send SuccessPayload to existing device.
      await this.channel.secureSend<SuccessPayload>({
        type: 'm.login.success',
        user_id: loginResult.user_id,
        device_id: loginResult.device_id
      })

      this.setStatus('success')
      return {
        user_id: loginResult.user_id,
        access_token: loginResult.access_token,
        device_id: loginResult.device_id,
        refresh_token: loginResult.refresh_token,
        expires_in: loginResult.expires_in,
        homeserver_url: secretsMsg.homeserver_url ?? resolveMatrixRuntimeEndpointConfig().homeserverUrl
      }
    } catch (err) {
      this.setStatus('failed')
      const msg = err instanceof Error ? err.message : String(err)
      logger.error('[MSC4108] completeNewDeviceLogin failed:', err)
      throw new Error(`新设备登录失败: ${msg}`)
    } finally {
      await this.closeChannelSafely()
    }
  }

  // ── Cancellation / cleanup ────────────────────────────────────────────

  /**
   * Cancel any in-flight session (either side).
   */
  async cancel(): Promise<void> {
    if (this.channel) {
      try {
        // reason value 4 = UserCancelled in MSC4108FailureReason
        await this.channel.cancel(4)
      } catch (err) {
        logger.warn('[MSC4108] cancel failed', err)
      }
    }
    this.setStatus('cancelled')
    this.cleanupSession()
  }

  /**
   * Reset internal state. Safe to call multiple times.
   */
  reset(): void {
    this.cleanupSession()
    this.setStatus('idle')
  }

  // ── Internal helpers ──────────────────────────────────────────────────

  private async sendFailure(reason: string, detail: string): Promise<void> {
    if (!this.channel) return
    try {
      await this.channel.secureSend<FailurePayload>({ type: 'm.login.failure', reason, detail })
    } catch (err) {
      logger.warn('[MSC4108] failed to send failure payload', err)
    }
  }

  private handleFailure(reason: string) {
    logger.warn(`[MSC4108] channel failure: ${reason}`)
    this.setStatus('failed', reason)
  }

  private async closeChannelSafely(): Promise<void> {
    if (this.channel) {
      try {
        await this.channel.close()
      } catch (err) {
        logger.warn('[MSC4108] channel close failed', err)
      }
    }
  }

  private cleanupSession() {
    this.channel = null
    this.session = null
  }
}

export const matrixQrLoginSdkService = new MatrixQrLoginSdkService()
