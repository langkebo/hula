import type { MatrixClient } from 'matrix-js-sdk'
import type {
  CryptoApi,
  VerificationRequest as SDKVerificationRequest,
  ShowSasCallbacks,
  Verifier
} from 'matrix-js-sdk/crypto'
import { CryptoEvent, VerificationPhase, VerificationRequestEvent } from 'matrix-js-sdk/crypto'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MatrixVerificationService')

/** confirm() 之后等待对端 MAC 的上限；超时只告警，不把验证判死 */
const VERIFY_SETTLE_TIMEOUT_MS = 15_000

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
  /** 每个事务的 `Verifier.verify()` 进行中 Promise，用于确认后等待 MAC 交换结束 */
  private readonly verifyPromises: Map<string, Promise<void>> = new Map()
  /** 每个请求对象上的 change 处理器缓存（WeakMap 避免请求终态后仍被持有） */
  private readonly changeHandlers = new WeakMap<SDKVerificationRequest, Map<string, () => void>>()

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

  /** 事务进入终态后从注册表移除，避免陈旧 id 跨会话泄漏 */
  private unregister(transactionId?: string): void {
    if (!transactionId) return
    if (this.transactions.delete(transactionId)) {
      logger.info(`[Verification] 注销验证请求: ${transactionId}`)
    }
  }

  /** 登记一个 SDK 验证请求，并接管其阶段变化；同一 id 重复到达时以最新对象为准 */
  private register(request: SDKVerificationRequest): void {
    const transactionId = request?.transactionId
    if (!transactionId) return

    const existing = this.transactions.get(transactionId)
    if (existing?.request === request) return
    existing?.request.off(VerificationRequestEvent.Change, this.getChangeHandler(transactionId, existing.request))

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

    request.on(VerificationRequestEvent.Change, this.getChangeHandler(transactionId, request))
    logger.info(`[Verification] 登记验证请求: ${transactionId}`)
  }

  /** 每个请求独立的 change 处理器（需要同时拿到 request 才能解绑） */
  private getChangeHandler(transactionId: string, request: SDKVerificationRequest): () => void {
    const handlers = this.changeHandlers.get(request) ?? new Map<string, () => void>()
    const cached = handlers.get(transactionId)
    if (cached) return cached

    const handler = (): void => this.handlePhaseChange(transactionId, request, handler)
    handlers.set(transactionId, handler)
    this.changeHandlers.set(request, handlers)
    return handler
  }

  /**
   * 事务阶段变化：终态注销，Started 自动 `verify()`，Ready 且已知对端设备时自动选 SAS。
   *
   * 自动驱动的原因：SDK 的 `Verifier.verify()` 只等待双方 MAC 交换，**不会**自己发起；
   * 若任一端不调用，SAS 永远不产生，界面就会卡在「等待对方」。参见 D10。
   */
  private handlePhaseChange(transactionId: string, request: SDKVerificationRequest, handler: () => void): void {
    const phase = request.phase

    if (phase === VerificationPhase.Done || phase === VerificationPhase.Cancelled) {
      request.off(VerificationRequestEvent.Change, handler)
      this.changeHandlers.delete(request)
      this.verifyPromises.delete(transactionId)
      this.unregister(transactionId)
      return
    }

    if (phase === VerificationPhase.Started && request.verifier) {
      this.driveVerifier(transactionId, request.verifier)
      return
    }

    // Ready 表示本端已发出 m.key.verification.ready（接收方即"已接受"，发起方即"对端已接受"）。
    // rust-crypto 的发起方在 Ready 阶段经常拿不到 otherDeviceId（SDK 未回填 other_device_id），
    // 此时 startVerification() 必抛「other device is unknown」；接收方的 otherDeviceId 则是已知的。
    // 因此两侧都可以启动 SAS，由 SDK 自身处理同时 start 的 tie-break（D10）。
    if (phase === VerificationPhase.Ready && request.otherDeviceId && request.otherPartySupportsMethod('m.sas.v1')) {
      void this.startSasForRequest(transactionId).catch((err: unknown) => {
        logger.warn(`[Verification] 自动启动 SAS 失败: ${transactionId}: ${err}`)
      })
    }
  }

  /** 对已创建的 verifier 调用 `verify()`（幂等：同一事务只驱动一次） */
  private driveVerifier(transactionId: string, verifier: Verifier): void {
    if (this.verifyPromises.has(transactionId)) return

    const promise = verifier
      .verify()
      .then(() => logger.info(`[Verification] 验证完成: ${transactionId}`))
      .catch((err: unknown) => {
        logger.warn(`[Verification] verify() 未正常结束: ${transactionId}: ${err}`)
      })
      .finally(() => this.verifyPromises.delete(transactionId))

    this.verifyPromises.set(transactionId, promise)
  }

  /** 本端作为发起方在对端接受后选择 SAS 方法，并驱动 `verify()` */
  private async startSasForRequest(transactionId: string): Promise<void> {
    const request = this.requireRequest(transactionId, 'start SAS verification')
    if (request.verifier) {
      this.driveVerifier(transactionId, request.verifier)
      return
    }

    logger.info(`[Verification] 对端已接受，启动 m.sas.v1: ${transactionId}`)
    const verifier = await request.startVerification('m.sas.v1')
    this.driveVerifier(transactionId, verifier)
  }

  /**
   * 订阅请求生命周期事件。
   */
  private readonly handleRequestReceived = (request: SDKVerificationRequest): void => {
    this.register(request)
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

  private setupEventListeners(clientParam?: MatrixClient): void {
    const client = clientParam ?? matrixClientService.getClient()
    if (!client || this.observedClient === client) return

    if (this.observedClient) {
      this.observedClient.off(CryptoEvent.VerificationRequestReceived, this.handleRequestReceived as never)
      // 换 client（登出/换账号）时旧事务不可再操作，必须一并丢弃（D11）
      this.clearTransactions()
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
    this.clearTransactions()
  }

  /** 丢弃所有已登记事务与进行中的 verify()，避免陈旧事务跨账号/跨会话残留 */
  private clearTransactions(): void {
    for (const entry of this.transactions.values()) {
      entry.request.off(VerificationRequestEvent.Change, this.getChangeHandler(entry.view.transactionId, entry.request))
    }
    this.transactions.clear()
    this.verifyPromises.clear()
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
      if (verification.phase === VerificationPhase.Done || verification.phase === VerificationPhase.Cancelled) {
        throw new Error(`Cannot accept verification request: ${transactionId} is already closed`)
      }
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
   * 等待 SAS 就绪后再返回。
   *
   * 为什么必须等：`startSasVerification` 只是**发出请求**，SAS 要等对端接受后才产生。
   * 若发完立刻读 SAS，只能拿到 null —— 这正是历史上 PC 端「没有 emoji 也比对成功」的成因。
   * SDK 没有对外暴露「SAS 可用」事件，因此只能轮询。
   *
   * @param transactionId 事务 id
   * @param options.timeoutMs 最长等待（默认 120s，需覆盖对端人工点接受的时间）
   * @param options.intervalMs 轮询间隔（默认 500ms）
   * @param options.shouldAbort 返回 true 时立即中止（用户取消/关闭对话框），抛错由调用方忽略
   */
  async waitForSasView(
    transactionId: string,
    options: { timeoutMs?: number; intervalMs?: number; shouldAbort?: () => boolean } = {}
  ): Promise<SasVerificationView> {
    const timeoutMs = options.timeoutMs ?? 120_000
    const intervalMs = options.intervalMs ?? 500
    const deadline = Date.now() + timeoutMs
    let lastError: unknown = null

    while (Date.now() < deadline) {
      if (options.shouldAbort?.()) {
        throw new Error(`SAS wait aborted: ${transactionId}`)
      }
      try {
        return await this.getSasView(transactionId)
      } catch (err) {
        lastError = err
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }

    throw lastError instanceof Error ? lastError : new Error(`Timed out waiting for SAS: ${transactionId}`)
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
      await this.waitForVerifySettle(transactionId)
    } catch (err) {
      logger.error(`[Verification] 确认 SAS 失败: ${err}`)
      throw err
    }
  }

  /**
   * 等待 `Verifier.verify()` 收尾（双方 MAC 交换完成）。
   *
   * 本端 confirm() 只发送自己的 MAC，仍需对端确认；这里给一个上限，
   * 超时只告警不抛错，避免对端稍晚确认时被误判为失败。
   */
  private async waitForVerifySettle(transactionId: string): Promise<void> {
    const pending = this.verifyPromises.get(transactionId)
    if (!pending) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(() => resolve(), VERIFY_SETTLE_TIMEOUT_MS)
    })
    await Promise.race([pending, timeout])
    if (timer) clearTimeout(timer)
    if (this.verifyPromises.has(transactionId)) {
      logger.warn(`[Verification] verify() 仍在等待对端确认: ${transactionId}`)
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
   * 因此这里不做"猜测式"补全。已进入终态的事务在返回前顺手注销，
   * 避免调用方「取第一条」时选中已经结束的旧事务（D11）。
   */
  async getPendingVerifications(): Promise<VerificationTransaction[]> {
    const pending: VerificationTransaction[] = []

    for (const [transactionId, entry] of this.transactions) {
      const { phase } = entry.request
      if (phase === VerificationPhase.Done || phase === VerificationPhase.Cancelled) {
        this.unregister(transactionId)
        continue
      }
      pending.push(entry.view)
    }

    return pending.sort((a, b) => b.timestamp - a.timestamp)
  }

  async isDeviceVerified(userId: string, deviceId: string): Promise<boolean> {
    const client = this.getVerificationClient()
    try {
      const crypto: CryptoApi | undefined = client.getCrypto()
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
}

export const matrixVerificationService = new VerificationService()
