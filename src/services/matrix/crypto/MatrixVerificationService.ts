import { error, info } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import { CryptoEvent, VerificationPhase, VerificationRequestEvent } from 'matrix-js-sdk/crypto'
import type { CryptoApi, VerificationRequest as SDKVerificationRequest } from '@/types/matrix-extensions'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

export type VerificationMethod = 'm.sas.v1' | 'm.qr_code.show.v1' | 'm.reciprocate.v1'

export interface VerificationRequest {
  transactionId: string
  userId: string
  deviceId: string
  methods: VerificationMethod[]
  timestamp: number
}

export interface SasVerification {
  transactionId: string
  userId: string
  deviceId: string
  emoji?: Array<{ emoji: string; name: string }>
  decimal?: number[]
}

export type VerificationState =
  | 'requested'
  | 'ready'
  | 'started'
  | 'keys_exchanged'
  | 'mac_sent'
  | 'accepted'
  | 'cancelled'
  | 'done'

export interface VerificationCancelReason {
  code: string
  reason: string
}

class VerificationService extends BaseMatrixService {
  private observedClient: MatrixClient | null = null
  private pendingRequests: Map<string, VerificationRequest> = new Map()

  private getExistingVerificationRequest(
    crypto: CryptoApi,
    transactionId: string,
    action: string
  ): SDKVerificationRequest {
    const verification = crypto.verificationRequests?.get(transactionId)
    if (verification) {
      return verification
    }

    if (this.pendingRequests.has(transactionId)) {
      throw new Error(`Cannot ${action}: verification request ${transactionId} is not available in active SDK requests`)
    }

    throw new Error(`Cannot ${action}: verification request ${transactionId} was not found`)
  }

  private readonly requestedListener = (event: SDKVerificationRequest): void => {
    if (event?.transactionId) {
      this.pendingRequests.set(event.transactionId, {
        transactionId: event.transactionId,
        userId: event.userId || '',
        deviceId: event.deviceId || '',
        methods: (event.methods || []) as VerificationMethod[],
        timestamp: Date.now()
      })
      info(`[Verification] 收到验证请求: ${event.transactionId}`)
    }
  }

  private readonly finishedListener = (request: SDKVerificationRequest): void => {
    if (request?.transactionId) {
      this.pendingRequests.delete(request.transactionId)
      info(`[Verification] 验证完成: ${request.transactionId}`)
    }
  }

  private readonly cancelledListener = (request: SDKVerificationRequest): void => {
    if (request?.transactionId) {
      this.pendingRequests.delete(request.transactionId)
      info(`[Verification] 验证已取消: ${request.transactionId}`)
    }
  }

  private readonly handleRequestReceived = (request: SDKVerificationRequest): void => {
    this.requestedListener(request)
    const handleChange = () => {
      const phase = (request as unknown as { phase?: VerificationPhase }).phase
      if (phase === VerificationPhase.Done) {
        this.finishedListener(request)
        ;(request as unknown as { off(ev: string, cb: () => void): void }).off(
          VerificationRequestEvent.Change,
          handleChange
        )
      } else if (phase === VerificationPhase.Cancelled) {
        this.cancelledListener(request)
        ;(request as unknown as { off(ev: string, cb: () => void): void }).off(
          VerificationRequestEvent.Change,
          handleChange
        )
      }
    }
    ;(request as unknown as { on(ev: string, cb: () => void): void }).on(VerificationRequestEvent.Change, handleChange)
  }

  initialize(): void {
    this.setupEventListeners()
    info('[Verification] 服务已初始化')
  }

  private getVerificationClient(): MatrixClient {
    const client = this.getClient()
    this.setupEventListeners(client)
    return client
  }

  getCurrentUserId(): string | null {
    try {
      const client = this.getVerificationClient()
      return client.getUserId() || null
    } catch {
      return null
    }
  }

  getCurrentDeviceId(): string | null {
    try {
      const client = this.getVerificationClient()
      return client.getDeviceId() || null
    } catch {
      return null
    }
  }

  private setupEventListeners(clientParam?: MatrixClient): void {
    const client = clientParam ?? matrixClientService.getClient()
    if (!client || this.observedClient === client) return

    const handler = this.handleRequestReceived as unknown as (...args: unknown[]) => void

    if (this.observedClient) {
      ;(this.observedClient as unknown as { off(ev: string, cb: (...a: unknown[]) => void): void }).off(
        CryptoEvent.VerificationRequestReceived,
        handler
      )
    }

    ;(client as unknown as { on(ev: string, cb: (...a: unknown[]) => void): void }).on(
      CryptoEvent.VerificationRequestReceived,
      handler
    )
    this.observedClient = client
  }

  async startSasVerification(userId: string, deviceId: string): Promise<string> {
    const client = this.getVerificationClient()
    try {
      const crypto = client.getCrypto() as CryptoApi | null
      if (!crypto) {
        throw new Error(this.t('matrix_error.crypto.not_enabled'))
      }

      const verificationRequest = await crypto.requestDeviceVerification(userId, deviceId)
      const transactionId = verificationRequest?.transactionId || ''

      if (transactionId) {
        this.pendingRequests.set(transactionId, {
          transactionId,
          userId,
          deviceId,
          methods: ['m.sas.v1'],
          timestamp: Date.now()
        })
      }

      info(`[Verification] SAS 验证已开始: ${userId}/${deviceId}`)
      return transactionId
    } catch (err) {
      error(`[Verification] 开始 SAS 验证失败: ${err}`)
      throw err
    }
  }

  async startSasVerificationWithCurrentUser(deviceId: string): Promise<string> {
    const userId = this.getCurrentUserId()
    if (!userId) {
      throw new Error(this.t('matrix_error.common.user_not_logged_in'))
    }
    return this.startSasVerification(userId, deviceId)
  }

  async acceptVerification(transactionId: string): Promise<void> {
    const client = this.getVerificationClient()
    try {
      const crypto = client.getCrypto() as CryptoApi | null
      if (!crypto) {
        throw new Error(this.t('matrix_error.crypto.not_enabled'))
      }

      const verification = this.getExistingVerificationRequest(crypto, transactionId, 'accept verification request')
      await verification.accept()
      info(`[Verification] 验证请求已接受: ${transactionId}`)
    } catch (err) {
      error(`[Verification] 接受验证请求失败: ${err}`)
      throw err
    }
  }

  async confirmSas(transactionId: string): Promise<void> {
    const client = this.getVerificationClient()
    try {
      const crypto = client.getCrypto() as CryptoApi | null
      if (!crypto) {
        throw new Error(this.t('matrix_error.crypto.not_enabled'))
      }

      const verification = this.getExistingVerificationRequest(crypto, transactionId, 'confirm SAS')
      const sasVerifier = verification.verifier
      if (sasVerifier) {
        await sasVerifier.verify()
      }

      this.pendingRequests.delete(transactionId)
      info(`[Verification] SAS 已确认: ${transactionId}`)
    } catch (err) {
      error(`[Verification] 确认 SAS 失败: ${err}`)
      throw err
    }
  }

  async cancelVerification(transactionId: string, reason: string): Promise<void> {
    const client = this.getVerificationClient()
    try {
      const crypto = client.getCrypto() as CryptoApi | null
      if (!crypto) {
        throw new Error(this.t('matrix_error.crypto.not_enabled'))
      }

      const verification = this.getExistingVerificationRequest(crypto, transactionId, 'cancel verification request')
      await verification.cancel({ reason })

      this.pendingRequests.delete(transactionId)
      info(`[Verification] 验证已取消: ${transactionId}, 原因: ${reason}`)
    } catch (err) {
      error(`[Verification] 取消验证失败: ${err}`)
      throw err
    }
  }

  async getPendingVerifications(): Promise<VerificationRequest[]> {
    try {
      return Array.from(this.pendingRequests.values())
    } catch (err) {
      error(`[Verification] 获取待处理验证请求失败: ${err}`)
      return []
    }
  }

  async isDeviceVerified(userId: string, deviceId: string): Promise<boolean> {
    const client = this.getVerificationClient()
    try {
      const crypto = client.getCrypto() as CryptoApi | null
      if (!crypto) {
        return false
      }

      const deviceInfo = await crypto.getDeviceVerificationStatus(userId, deviceId)
      return deviceInfo?.isVerified?.() || false
    } catch (err) {
      error(`[Verification] 检查设备验证状态失败: ${err}`)
      return false
    }
  }

  async isCurrentDeviceVerified(): Promise<boolean> {
    const userId = this.getCurrentUserId()
    const deviceId = this.getCurrentDeviceId()
    if (!userId || !deviceId) {
      return false
    }
    return this.isDeviceVerified(userId, deviceId)
  }

  async getVerificationRequests(): Promise<Array<Record<string, unknown>>> {
    const client = this.getVerificationClient()
    try {
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/keys/device_signing/requests')
      info('[Verification] 获取验证请求列表成功')
      return (result as { requests?: Array<Record<string, unknown>> }).requests ?? []
    } catch (err) {
      error(`[Verification] 获取验证请求列表失败: ${err}`)
      return []
    }
  }

  async getQrCodeShow(): Promise<{ qr_code: string; transaction_id: string } | null> {
    const client = this.getVerificationClient()
    try {
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/keys/qr_code/show')
      info('[Verification] 获取二维码成功')
      return result as { qr_code: string; transaction_id: string }
    } catch (err) {
      error(`[Verification] 获取二维码失败: ${err}`)
      return null
    }
  }

  async scanQrCode(qrCodeData: string): Promise<boolean> {
    const client = this.getVerificationClient()
    try {
      await client.http.authedRequest('POST', '/_matrix/client/v3/keys/qr_code/scan', undefined, {
        qr_code: qrCodeData
      })
      info('[Verification] 扫描二维码成功')
      return true
    } catch (err) {
      error(`[Verification] 扫描二维码失败: ${err}`)
      return false
    }
  }
}

export const matrixVerificationService = new VerificationService()
