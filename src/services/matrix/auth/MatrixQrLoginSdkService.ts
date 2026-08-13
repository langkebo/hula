/**
 * Matrix QR 登录 SDK 服务（MSC4108）
 *
 * 包装 matrix-js-sdk 的 MSC4108 rendezvous 传输层与安全通道，
 * 在其之上实现基于 m.login.token 的跨设备扫码登录协议。
 *
 * 实现已拆分为两个子模块：
 * - qrLoginTypes：payload 类型 + 公共 API 类型 + SDK 实例接口
 * - qrLoginHelpers：base64 转换、设备 ID 生成、SDK 懒加载、HTTP 请求封装
 *
 * 本文件保留：服务类状态管理 + 协议交互逻辑。
 *
 * 协议流详见项目文档。
 */

import matrixClientService from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'
import {
  base64ToBytes,
  bytesToBase64,
  generateDeviceId,
  getRuntimeAwareFetch,
  loadSdkRendezvous,
  logger,
  postJson,
  resolveMatrixRuntimeEndpointConfig
} from './qrLoginHelpers'
import type {
  ExistingDeviceReciprocateResult,
  FailurePayload,
  LoginTokenPayload,
  NewDeviceLoginResult,
  ProtocolPayload,
  ProtocolsPayload,
  QrCodeData,
  QrLoginStatus,
  RendezvousSessionInstance,
  ScannedSessionInfo,
  SecureChannelInstance,
  StatusListener,
  SuccessPayload
} from './qrLoginTypes'
import { PROTOCOL_NAME } from './qrLoginTypes'

// Re-export public types for backward compatibility
export type {
  ExistingDeviceReciprocateResult,
  NewDeviceLoginResult,
  QrCodeData,
  QrLoginStatus,
  ScannedSessionInfo,
  StatusListener
} from './qrLoginTypes'

export class MatrixQrLoginSdkService {
  private status: QrLoginStatus = 'idle'
  private listeners = new Set<StatusListener>()

  private channel: SecureChannelInstance | null = null
  private session: RendezvousSessionInstance | null = null

  /** 获取扫码登录当前状态
   */
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

  /** 注册状态变更监听
   */
  onStatusChange(listener: StatusListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // ── New device: generate QR ──

  /** 以新设备身份生成二维码
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

      const session = new MSC4108RendezvousSession({
        fallbackRzServer: homeserverUrl,
        fetchFn: getRuntimeAwareFetch(),
        onFailure
      })
      const channel = new MSC4108SecureChannel(session, undefined, onFailure)

      this.session = session as unknown as RendezvousSessionInstance
      this.channel = channel as unknown as SecureChannelInstance

      await session.send('')

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

  // ── New device: wait + login ──

  /** 等待对端确认并完成登录
   */
  async waitForReciprocationAndLogin(displayName?: string): Promise<NewDeviceLoginResult> {
    if (!this.channel || !this.session) {
      throw new Error('No active QR session — call generateQrCodeAsNewDevice() first')
    }

    try {
      await this.channel.connect()

      const protocolsMsg = await this.channel.secureReceive<ProtocolsPayload>()
      if (protocolsMsg?.type !== 'm.login.protocols') {
        throw new Error('未收到协议协商消息')
      }
      if (!protocolsMsg.protocols?.includes(PROTOCOL_NAME)) {
        await this.sendFailure('unsupported_protocol', 'Existing device does not offer m.login.token')
        throw new Error('现有设备未提供 m.login.token 协议')
      }

      const newDeviceId = generateDeviceId()
      await this.channel.secureSend<ProtocolPayload>({
        type: 'm.login.protocol',
        protocol: PROTOCOL_NAME,
        device_id: newDeviceId
      })

      this.setStatus('waiting_confirm')

      const secretsMsg = await this.channel.secureReceive<LoginTokenPayload>()
      if (secretsMsg?.type !== 'm.login.secrets' || !secretsMsg.login_token) {
        await this.sendFailure('login_failed', 'Did not receive login token')
        throw new Error('未收到登录令牌')
      }

      const loginResult = await this.exchangeLoginToken(secretsMsg.login_token, newDeviceId, displayName)

      await this.channel.secureSend<SuccessPayload>({
        type: 'm.login.success',
        user_id: loginResult.user_id,
        device_id: loginResult.device_id
      })

      this.setStatus('success')
      return {
        ...loginResult,
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

  // ── Existing device: generate QR ──

  /** 生成扫码登录二维码
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

      const session = new MSC4108RendezvousSession({
        client,
        fetchFn: getRuntimeAwareFetch(),
        onFailure
      } as unknown as ConstructorParameters<typeof MSC4108RendezvousSession>[0])
      const channel = new MSC4108SecureChannel(session, undefined, onFailure)

      this.session = session as unknown as RendezvousSessionInstance
      this.channel = channel as unknown as SecureChannelInstance

      await session.send('')

      const serverName = client.getDomain()
      if (!serverName) {
        throw new Error('Cannot determine server domain from Matrix client')
      }

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

  // ── Existing device: reciprocate ──

  /** 确认对端登录请求
   */
  async reciprocateLogin(): Promise<ExistingDeviceReciprocateResult> {
    if (!this.channel || !this.session) {
      throw new Error('No active QR session — call generateQrCode() or scanQrCode() first')
    }

    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    try {
      await this.channel.connect()

      const homeserver = client.getDomain()!
      await this.channel.secureSend<ProtocolsPayload>({
        type: 'm.login.protocols',
        protocols: [PROTOCOL_NAME],
        homeserver
      })

      const protocolMsg = await this.channel.secureReceive<ProtocolPayload>()
      if (protocolMsg?.type !== 'm.login.protocol' || protocolMsg.protocol !== PROTOCOL_NAME) {
        await this.sendFailure('unsupported_protocol', 'New device did not select m.login.token')
        throw new Error('协议协商失败：新设备未选择 m.login.token')
      }
      const newDeviceId = protocolMsg.device_id || generateDeviceId()

      this.setStatus('waiting_confirm')

      const tokenResponse = await authedRequestWithPath<{ login_token: string; expires_in_ms: number }>(
        client,
        'POST',
        MATRIX_PATHS.AUTH.QR_GENERATE_TOKEN
      )

      const homeserverUrl = client.getHomeserverUrl()
      const userId = (client as unknown as { getUserId(): string }).getUserId()
      const deviceId = (client as unknown as { getDeviceId(): string | null }).getDeviceId() ?? ''

      await this.channel.secureSend<LoginTokenPayload>({
        type: 'm.login.secrets',
        login_token: tokenResponse.login_token,
        homeserver_url: homeserverUrl,
        user_id: userId,
        device_id: deviceId,
        expires_at: Date.now() + (tokenResponse.expires_in_ms ?? 60000)
      })

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
      await this.closeChannelSafely()
    }
  }

  /** 拒绝登录请求
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

  // ── New device: scan + complete ──

  /** 扫描二维码登录
   */
  async scanQrCode(qrCodeBase64: string): Promise<ScannedSessionInfo> {
    this.cleanupSession()
    this.setStatus('generating')

    try {
      const { MSC4108RendezvousSession, MSC4108SecureChannel } = await loadSdkRendezvous()
      const onFailure = (reason: unknown) => this.handleFailure(String(reason))

      const qrBytes = base64ToBytes(qrCodeBase64)

      const { QrCodeData } = await import('@matrix-org/matrix-sdk-crypto-wasm')
      const parsed = QrCodeData.fromBytes(qrBytes)
      const serverName = parsed.serverName
      const theirPublicKey = parsed.publicKey
      const rendezvousUrl = parsed.rendezvousUrl

      if (!rendezvousUrl) {
        throw new Error('Invalid QR code: missing rendezvous URL')
      }

      const session = new MSC4108RendezvousSession({
        url: rendezvousUrl,
        fetchFn: getRuntimeAwareFetch(),
        onFailure
      })
      const channel = new MSC4108SecureChannel(session, theirPublicKey, onFailure)

      this.session = session as unknown as RendezvousSessionInstance
      this.channel = channel as unknown as SecureChannelInstance

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

  /** 完成新设备登录
   */
  async completeNewDeviceLogin(displayName?: string): Promise<NewDeviceLoginResult> {
    if (!this.channel || !this.session) {
      throw new Error('No active QR session — call scanQrCode() first')
    }

    try {
      const protocolsMsg = await this.channel.secureReceive<ProtocolsPayload>()
      if (protocolsMsg?.type !== 'm.login.protocols') {
        throw new Error('未收到协议协商消息')
      }
      if (!protocolsMsg.protocols?.includes(PROTOCOL_NAME)) {
        await this.sendFailure('unsupported_protocol', 'Existing device does not offer m.login.token')
        throw new Error('现有设备未提供 m.login.token 协议')
      }

      const newDeviceId = generateDeviceId()
      await this.channel.secureSend<ProtocolPayload>({
        type: 'm.login.protocol',
        protocol: PROTOCOL_NAME,
        device_id: newDeviceId
      })

      const secretsMsg = await this.channel.secureReceive<LoginTokenPayload>()
      if (secretsMsg?.type !== 'm.login.secrets' || !secretsMsg.login_token) {
        await this.sendFailure('login_failed', 'Did not receive login token')
        throw new Error('未收到登录令牌')
      }

      const loginResult = await this.exchangeLoginToken(secretsMsg.login_token, newDeviceId, displayName)

      await this.channel.secureSend<SuccessPayload>({
        type: 'm.login.success',
        user_id: loginResult.user_id,
        device_id: loginResult.device_id
      })

      this.setStatus('success')
      return {
        ...loginResult,
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

  // ── Cancellation / cleanup ──

  /** 取消扫码登录流程
   */
  async cancel(): Promise<void> {
    if (this.channel) {
      try {
        await this.channel.cancel(4)
      } catch (err) {
        logger.warn('[MSC4108] cancel failed', err)
      }
    }
    this.setStatus('cancelled')
    this.cleanupSession()
  }

  /** 重置扫码登录状态
   */
  reset(): void {
    this.cleanupSession()
    this.setStatus('idle')
  }

  // ── Internal helpers ──

  private async exchangeLoginToken(
    loginToken: string,
    deviceId: string,
    displayName?: string
  ): Promise<{
    user_id: string
    access_token: string
    device_id: string
    refresh_token?: string
    expires_in?: number
  }> {
    const { PREFIX_V3 } = await import('./qrLoginHelpers')
    return postJson(`${PREFIX_V3}/login`, {
      type: 'm.login.token',
      token: loginToken,
      device_id: deviceId,
      initial_display_name: displayName ?? 'Tjg QR Login'
    })
  }

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
