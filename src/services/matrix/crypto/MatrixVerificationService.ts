import type { MatrixClient } from 'matrix-js-sdk'
import { CryptoEvent, VerificationPhase, VerificationRequestEvent } from 'matrix-js-sdk/crypto'
import type { KeyVerificationManager } from 'matrix-js-sdk/key-verification'
import type {
  CryptoApi,
  MatrixClientExtended,
  VerificationRequest as SDKVerificationRequest
} from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MatrixVerificationService')

export type VerificationMethod = 'm.sas.v1' | 'm.qr_code.show.v1' | 'm.reciprocate.v1'

export interface VerificationRequest {
  transactionId: string
  userId: string
  deviceId: string
  methods: VerificationMethod[]
  timestamp: number
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
      logger.info(`[Verification] 收到验证请求: ${event.transactionId}`)
    }
  }

  private readonly finishedListener = (request: SDKVerificationRequest): void => {
    if (request?.transactionId) {
      this.pendingRequests.delete(request.transactionId)
      logger.info(`[Verification] 验证完成: ${request.transactionId}`)
    }
  }

  private readonly cancelledListener = (request: SDKVerificationRequest): void => {
    if (request?.transactionId) {
      this.pendingRequests.delete(request.transactionId)
      logger.info(`[Verification] 验证已取消: ${request.transactionId}`)
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
    logger.info('[Verification] 服务已初始化')
  }

  private getVerificationClient(): MatrixClient {
    const client = this.getClient()
    this.setupEventListeners(client)
    return client
  }

  private getSDKKeyVerificationManager(): KeyVerificationManager | null {
    const client = this.getClient() as unknown as MatrixClientExtended
    return client.getKeyVerificationManager?.() ?? null
  }

  getCurrentUserId(): string | null {
    try {
      const client = this.getVerificationClient()
      return client.getUserId() || null
    } catch (err) {
      logger.error(`[Verification] 获取当前用户 ID 失败: ${err}`)
      return null
    }
  }

  getCurrentDeviceId(): string | null {
    try {
      const client = this.getVerificationClient()
      return client.getDeviceId() || null
    } catch (err) {
      logger.error(`[Verification] 获取当前设备 ID 失败: ${err}`)
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

      logger.info(`[Verification] SAS 验证已开始: ${userId}/${deviceId}`)
      return transactionId
    } catch (err) {
      logger.error(`[Verification] 开始 SAS 验证失败: ${err}`)
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
      logger.info(`[Verification] 验证请求已接受: ${transactionId}`)
    } catch (err) {
      logger.error(`[Verification] 接受验证请求失败: ${err}`)
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
      logger.info(`[Verification] SAS 已确认: ${transactionId}`)
    } catch (err) {
      logger.error(`[Verification] 确认 SAS 失败: ${err}`)
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
      logger.info(`[Verification] 验证已取消: ${transactionId}, 原因: ${reason}`)
    } catch (err) {
      logger.error(`[Verification] 取消验证失败: ${err}`)
      throw err
    }
  }

  async getPendingVerifications(): Promise<VerificationRequest[]> {
    try {
      return Array.from(this.pendingRequests.values())
    } catch (err) {
      logger.error(`[Verification] 获取待处理验证请求失败: ${err}`)
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
      logger.error(`[Verification] 检查设备验证状态失败: ${err}`)
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
    try {
      const manager = this.getSDKKeyVerificationManager()
      if (!manager) throw new Error('KeyVerificationManager not available')
      const result = await manager.getVerificationRequestsHttp()
      logger.info('[Verification] 获取验证请求列表成功')
      return (result.requests ?? []) as unknown as Array<Record<string, unknown>>
    } catch (err) {
      logger.error(`[Verification] 获取验证请求列表失败: ${err}`)
      return []
    }
  }

  async getQrCodeShow(): Promise<{ qr_code: string; transaction_id: string } | null> {
    try {
      const manager = this.getSDKKeyVerificationManager()
      if (!manager) throw new Error('KeyVerificationManager not available')
      const result = await manager.showQrCodeHttp()
      logger.info('[Verification] 获取二维码成功')
      return result as unknown as { qr_code: string; transaction_id: string }
    } catch (err) {
      logger.error(`[Verification] 获取二维码失败: ${err}`)
      return null
    }
  }

  async scanQrCode(qrCodeData: string): Promise<boolean> {
    try {
      const manager = this.getSDKKeyVerificationManager()
      if (!manager) throw new Error('KeyVerificationManager not available')
      // biome-ignore lint/suspicious/noExplicitAny: SDK crypto client lacks type definitions for synapse-rust extensions
      await manager.scanQrCodeHttp({ qr_code: qrCodeData } as any)
      logger.info('[Verification] 扫描二维码成功')
      return true
    } catch (err) {
      logger.error(`[Verification] 扫描二维码失败: ${err}`)
      return false
    }
  }
}

export const matrixVerificationService = new VerificationService()
