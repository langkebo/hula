import type { IScanQrCodeRequest, MatrixClient } from 'matrix-js-sdk'
import type { CryptoApi, VerificationRequest as SDKVerificationRequest, ShowSasCallbacks } from 'matrix-js-sdk/crypto'
import { CryptoEvent, VerificationPhase, VerificationRequestEvent } from 'matrix-js-sdk/crypto'
import type { KeyVerificationManager } from 'matrix-js-sdk/key-verification'
import type { MatrixClientExtended } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MatrixVerificationService')

export type VerificationMethod = 'm.sas.v1' | 'm.qr_code.show.v1' | 'm.reciprocate.v1'

/**
 * 验证事务的对外视图（扁平化，供 UI 列表渲染）。
 *
 * 由 SDK `VerificationRequest` 归一化而来：SDK 的字段是 `otherUserId` / `otherDeviceId`，
 * 视图统一为 `userId` / `deviceId`，UI 无需感知哪一侧是发起方。
 */
export interface VerificationTransaction {
  transactionId: string
  userId: string
  deviceId: string
  methods: VerificationMethod[]
  timestamp: number
}

/**
 * SAS 展示视图：用户需要肉眼比对的短认证字符串。
 *
 * 与 SDK `GeneratedSas` 对齐：`emoji` 是 `[emoji, name]` 元组数组，
 * `decimal` 是三个 0-8191 的数字。
 */
export interface SasVerificationView {
  emoji: ReadonlyArray<readonly [string, string]>
  decimal: readonly number[] | null
}

/** 事务注册表条目：元数据 + SDK 真身对象，二者必须成对存储 */
interface TransactionEntry {
  view: VerificationTransaction
  request: SDKVerificationRequest
}

/**
 * 设备验证服务。
 *
 * 核心不变量：**SDK 抛给我们的 `VerificationRequest` 是唯一可用于操作的对象**。
 * SDK 没有按 transactionId 反查的公开 API（`crypto.verificationRequests` 并不存在），
 * 因此本服务在收到 `VerificationRequestReceived` 时按 id 登记真身对象，
 * accept/confirm/cancel 全部从本注册表取对象——不再向 SDK 反向查询。
 */
export class VerificationService extends BaseMatrixService {
  private observedClient: MatrixClient | null = null
  private readonly transactions: Map<string, TransactionEntry> = new Map()

  /**
   * 取出已登记的 SDK 验证请求。
   *
   * @param transactionId 事务 id
   * @param action 用于错误文案的动作名
   * @throws 未登记时抛错（验证请求只在收到事件时登记）
   */
  private requireRequest(transactionId: string, action: string): SDKVerificationRequest {
    const entry = this.transactions.get(transactionId)
    if (!entry) {
      throw new Error(`Cannot ${action}: verification request ${transactionId} was not found`)
    }
    return entry.request
  }

  /** 登记一个 SDK 验证请求；同一 id 重复到达时以最新对象为准 */
  private register(request: SDKVerificationRequest): void {
    const transactionId = request?.transactionId
    if (!transactionId) return

    this.transactions.set(transactionId, {
      request,
      view: {
        transactionId,
        // SDK VerificationRequest 的对端字段是 otherUserId / otherDeviceId
        userId: request.otherUserId ?? '',
        deviceId: request.otherDeviceId ?? '',
        methods: (request.methods ?? []) as VerificationMethod[],
        timestamp: Date.now()
      }
    })
    logger.info(`[Verification] 登记验证请求: ${transactionId}`)
  }

  /** 事务进入终态后从注册表移除，避免陈旧 id 跨会话泄漏 */
  private unregister(transactionId?: string): void {
    if (!transactionId) return
    if (this.transactions.delete(transactionId)) {
      logger.info(`[Verification] 注销验证请求: ${transactionId}`)
    }
  }

  /**
   * 订阅请求生命周期事件。
   *
   * 用 SDK 的 `VerificationRequestEvent.Change` 监听阶段变化：
   * 进入 Done/Cancelled 时注销并解绑，避免监听器随请求累积。
   */
  private readonly handleRequestReceived = (request: SDKVerificationRequest): void => {
    this.register(request)

    const handleChange = (): void => {
      const phase = request.phase
      if (phase === VerificationPhase.Done || phase === VerificationPhase.Cancelled) {
        this.unregister(request.transactionId)
        request.off(VerificationRequestEvent.Change, handleChange)
      }
    }

    request.on(VerificationRequestEvent.Change, handleChange)
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

  private setupEventListeners(clientParam?: MatrixClient): void {
    const client = clientParam ?? matrixClientService.getClient()
    if (!client || this.observedClient === client) return

    if (this.observedClient) {
      this.observedClient.off(CryptoEvent.VerificationRequestReceived, this.handleRequestReceived as never)
    }

    client.on(CryptoEvent.VerificationRequestReceived, this.handleRequestReceived as never)
    this.observedClient = client
  }

  /** 仅供测试与登出清理：断开对当前 client 的事件订阅 */
  reset(): void {
    if (this.observedClient) {
      this.observedClient.off(CryptoEvent.VerificationRequestReceived, this.handleRequestReceived as never)
      this.observedClient = null
    }
    this.transactions.clear()
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

  async startSasVerification(userId: string, deviceId: string): Promise<string> {
    const client = this.getVerificationClient()
    try {
      const crypto = client.getCrypto()
      if (!crypto) {
        throw new Error(this.t('matrix_error.crypto.not_enabled'))
      }

      const verificationRequest = await crypto.requestDeviceVerification(userId, deviceId)
      const transactionId = verificationRequest?.transactionId || ''

      if (verificationRequest) {
        this.register(verificationRequest)
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
    this.getVerificationClient()
    try {
      const verification = this.requireRequest(transactionId, 'accept verification request')
      await verification.accept()
      logger.info(`[Verification] 验证请求已接受: ${transactionId}`)
    } catch (err) {
      logger.error(`[Verification] 接受验证请求失败: ${err}`)
      throw err
    }
  }

  /**
   * 取得用于比对的 SAS。
   *
   * 若事务尚未进入 Started 阶段（无可比对的 SAS），抛错而不是返回空值——
   * 否则 UI 会展示空的 emoji 网格并诱导用户确认一个不存在的 SAS。
   *
   * @param transactionId 事务 id
   */
  async getSasView(transactionId: string): Promise<SasVerificationView> {
    this.getVerificationClient()
    const verification = this.requireRequest(transactionId, 'read SAS')

    const verifier = verification.verifier
    if (!verifier) {
      throw new Error(`Cannot read SAS: verification ${transactionId} has not started a SAS method yet`)
    }

    const showSas: ShowSasCallbacks | null = verifier.getShowSasCallbacks()
    if (!showSas) {
      throw new Error(`Cannot read SAS: verification ${transactionId} has no SAS available`)
    }

    return {
      emoji: (showSas.sas.emoji ?? []).map(([emoji, name]) => [emoji, name] as const),
      decimal: showSas.sas.decimal ?? null
    }
  }

  /**
   * 用户确认 SAS 匹配。
   *
   * 必须调用 `ShowSasCallbacks.confirm()`——SDK 的 `Verifier.verify()` 只等待
   * 双方完成 MAC 交换，它本身不会确认 SAS。若没有可确认的 SAS，抛错。
   *
   * @param transactionId 事务 id
   */
  async confirmSas(transactionId: string): Promise<void> {
    this.getVerificationClient()
    try {
      const verification = this.requireRequest(transactionId, 'confirm SAS')
      const verifier = verification.verifier
      const showSas = verifier?.getShowSasCallbacks() ?? null

      if (!showSas) {
        throw new Error(`Cannot confirm SAS: verification ${transactionId} has no SAS to confirm`)
      }

      await showSas.confirm()
      logger.info(`[Verification] SAS 已确认: ${transactionId}`)
    } catch (err) {
      logger.error(`[Verification] 确认 SAS 失败: ${err}`)
      throw err
    }
  }

  /**
   * 用户判定 SAS 不匹配：发送 m.mismatched_sas 取消。
   *
   * @param transactionId 事务 id
   */
  async mismatchSas(transactionId: string): Promise<void> {
    this.getVerificationClient()
    try {
      const verification = this.requireRequest(transactionId, 'reject SAS')
      const showSas = verification.verifier?.getShowSasCallbacks() ?? null
      if (!showSas) {
        throw new Error(`Cannot reject SAS: verification ${transactionId} has no SAS to reject`)
      }
      showSas.mismatch()
      this.unregister(transactionId)
      logger.warn(`[Verification] SAS 不匹配，已取消: ${transactionId}`)
    } catch (err) {
      logger.error(`[Verification] 标记 SAS 不匹配失败: ${err}`)
      throw err
    }
  }

  async cancelVerification(transactionId: string, reason: string): Promise<void> {
    this.getVerificationClient()
    try {
      const verification = this.requireRequest(transactionId, 'cancel verification request')
      await verification.cancel({ reason })
      this.unregister(transactionId)
      logger.info(`[Verification] 验证已取消: ${transactionId}, 原因: ${reason}`)
    } catch (err) {
      logger.error(`[Verification] 取消验证失败: ${err}`)
      throw err
    }
  }

  /**
   * 列出当前待处理的验证事务。
   *
   * 仅包含本会话内通过事件登记的事务——SDK 没有可靠的跨会话反查 API，
   * 因此这里不做"猜测式"补全。
   */
  async getPendingVerifications(): Promise<VerificationTransaction[]> {
    return Array.from(this.transactions.values()).map((entry) => entry.view)
  }

  async isDeviceVerified(userId: string, deviceId: string): Promise<boolean> {
    const client = this.getVerificationClient()
    try {
      const crypto: CryptoApi | null = client.getCrypto()
      if (!crypto) {
        return false
      }

      const deviceInfo = await crypto.getDeviceVerificationStatus(userId, deviceId)
      return deviceInfo?.isVerified() ?? false
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
      await manager.scanQrCodeHttp({ qr_code: qrCodeData } as unknown as IScanQrCodeRequest)
      logger.info('[Verification] 扫描二维码成功')
      return true
    } catch (err) {
      logger.error(`[Verification] 扫描二维码失败: ${err}`)
      return false
    }
  }
}

export const matrixVerificationService = new VerificationService()
