/**
 * MatrixCryptoStateTrackerCore — crypto 状态归属、读接口与生命周期管理片段。
 *
 * 从 `MatrixCryptoStateTracker`（原 712 行）抽出：这些成员只负责状态字段、
 * 代次守卫、调试快照与重置/登出清理，单独成基类可把初始化实现文件压到 400 行门槛内。
 */

import { releaseStoppedCryptoBinding as releaseBinding } from '@/services/matrix/crypto/cryptoBindingRelease'
import {
  createInitialEventDecryptedDebugState,
  createInitialRustCryptoDebugState,
  type EventDecryptedDebugState,
  type RustCryptoDebugState
} from '@/services/matrix/crypto/cryptoDebugStateTypes'
import {
  type CryptoLifecycleDiagnostics,
  CryptoLifecycleDiagnosticsTracker
} from '@/services/matrix/crypto/cryptoLifecycleDiagnostics'
import { clearLastCryptoUser } from '@/services/matrix/crypto/cryptoLocalState'
import { clearStaleCryptoStores } from '@/services/matrix/crypto/cryptoStoreCleanup'
import type { MatrixClient, MatrixEvent } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixCrypto')

/**
 * 本文件对 `initRustCrypto` 的最小依赖面。
 *
 * 必须与 SDK 契约一致（`matrix-js-sdk/lib/client.d.ts` 的 `initRustCrypto(args?)`）：
 * 历史缺陷是本类型只声明了 `{ useIndexedDB, storagePassword }`，于是**结构上**
 * 无法传入被 SDK 文档首推的 `storageKey`，把"用慢 KDF 处理随机密钥"变成了唯一选项。
 */
export type RustCryptoCapableClient = MatrixClient & {
  getCrypto?: () => unknown
  initRustCrypto?: (args?: {
    useIndexedDB?: boolean
    cryptoDatabasePrefix?: string
    storageKey?: Uint8Array
    storagePassword?: string
    allowInMemoryStore?: boolean
  }) => Promise<void>
}

/** 状态的内部可变字段；账号/设备归属在读取时由当前 owner client 补全（D9）。 */
type CryptoDebugStateFields = Omit<RustCryptoDebugState, 'userId' | 'deviceId'>

/** 把 client 的账号与设备拼成绑定身份；缺一不可，否则无法判定归属。 */
function resolveClientIdentity(client: MatrixClient | null): string | null {
  if (!client) return null
  const userId = client.getUserId?.()
  const deviceId = client.getDeviceId?.()
  return userId && deviceId ? `${userId}:${deviceId}` : null
}

/**
 * Crypto 状态追踪器基类：状态归属、代次守卫、调试快照、重置与登出清理。
 */
export abstract class MatrixCryptoStateTrackerCore {
  protected rustCryptoDebugState: CryptoDebugStateFields = createInitialRustCryptoDebugState()

  protected eventDecryptedDebugState: EventDecryptedDebugState = {
    count: 0,
    lastEventId: null,
    lastRoomId: null,
    lastError: null
  }

  /**
   * 当前 crypto 状态所归属的 client（D9）。
   *
   * `rustCryptoDebugState` 是窗口级单例：同一页面内「登出 → 登录」会复用同一个 tracker，
   * 而后台 Web Locks 续跑任务持有旧 client 的闭包。没有归属信息时，旧 client 的
   * `initRustCrypto` 成功会把 `initialized=true` 写到新会话上，而新会话的
   * `getClient().getCrypto()` 仍为 null —— 即「状态与绑定脱钩」。
   */
  protected stateOwnerClient: MatrixClient | null = null

  /** 状态归属的账号:设备；与 {@link stateOwnerClient} 一起判定换绑（D9）。 */
  protected stateOwnerIdentity: string | null = null

  /** 状态代次：换绑 client / resetState 时递增，用于丢弃跨会话的后台续跑写入。 */
  protected stateGeneration = 0

  /** 生命周期诊断（Batch 4.1，详见 crypto/cryptoLifecycleDiagnostics.ts）：让失配在运行期可见。 */
  protected readonly lifecycle = new CryptoLifecycleDiagnosticsTracker()

  /**
   * 「解锁后补初始化」的取消订阅句柄（D9）。
   *
   * 非 null 表示当前已挂上一次性监听：storageKey 缺失导致 fail-closed 后，
   * 用户完成本地解锁时自动补一次 `ensureCrypto`，避免整个会话 E2EE 不可用。
   */
  protected disarmStorageKeyRetry: (() => void) | null = null

  /**
   * 把状态归属绑定到调用方传入的 client（D9）。
   *
   * 换绑时递增代次并清空旧状态：旧 client 的后台续跑任务持有旧代次，
   * 其结论会被 {@link writeState} 丢弃，不会污染新会话。
   */
  protected bindClient(client: MatrixClient | null): number {
    const identity = resolveClientIdentity(client)
    // 同一 client 引用但账号/设备变了（凭据被换写）同样视为换绑：
    // 否则旧账号的 initialized=true 会被当成新账号的 crypto 就绪。
    const identityChanged =
      identity !== null && this.stateOwnerIdentity !== null && identity !== this.stateOwnerIdentity

    if (client !== this.stateOwnerClient || identityChanged) {
      // 换绑后旧的「解锁补初始化」监听必然指向过期 client，先解除以免占住名额。
      this.disarmStorageKeyRetry?.()
      this.stateOwnerClient = client
      this.stateOwnerIdentity = identity
      this.stateGeneration += 1
      this.rustCryptoDebugState = createInitialRustCryptoDebugState()
    } else if (this.stateOwnerIdentity === null) {
      // 首次绑定时 client 可能尚未带上 userId/deviceId，补齐但不重置状态。
      this.stateOwnerIdentity = identity
    }
    return this.stateGeneration
  }

  /** 代次仍是当前值才允许写状态；过期任务（client 已换绑 / 已重置）一律不得回写。 */
  protected isCurrentGeneration(generation: number): boolean {
    return generation === this.stateGeneration
  }

  /** 仅当代次有效时写入状态：过期任务的结论属于已作废的 client。 */
  protected writeState(generation: number, next: CryptoDebugStateFields): void {
    if (this.isCurrentGeneration(generation)) {
      this.rustCryptoDebugState = next
    }
  }

  /**
   * 处理 Event.decrypted 事件
   *
   * 更新 eventDecryptedDebugState（count/lastEventId/lastRoomId/lastError）
   */
  handleEventDecrypted(event: MatrixEvent, err?: Error): void {
    const roomId = event.getRoomId()
    this.eventDecryptedDebugState = {
      count: this.eventDecryptedDebugState.count + 1,
      lastEventId: event.getId() ?? null,
      lastRoomId: roomId ?? null,
      lastError: err?.message ?? null
    }
  }

  /** 获取 Rust Crypto 调试状态
   */
  getRustCryptoDebugState(): RustCryptoDebugState {
    const owner = this.stateOwnerClient
    // D9：状态必须自证归属，调用方才能判断 initialized 属于当前会话还是上一个会话。
    return {
      ...this.rustCryptoDebugState,
      userId: owner?.getUserId?.() ?? null,
      deviceId: owner?.getDeviceId?.() ?? null
    }
  }

  /** 获取事件解密调试状态
   */
  getEventDecryptedDebugState(): EventDecryptedDebugState {
    return { ...this.eventDecryptedDebugState }
  }

  /**
   * 解除「已停止的 crypto 绑定」，使**同一个 client** 能重新 `initRustCrypto`。
   *
   * 只在「复用同一 client 重启 sync」的路径上需要（当前唯一调用点：
   * `MatrixClientLifecycle.forceReconnect`，系统唤醒时触发）。SDK 契约（实测
   * node_modules/matrix-js-sdk/lib/client-lifecycle-stop.js，不要凭上游印象改）：
   * `stopClient()` → `releaseCryptoBackend()` 会 `cryptoBackend.stop()` 并**清空**
   * `client.cryptoBackend`（A3）⇒ 正常时序下本方法看到 `getCrypto() === undefined`，
   * 属于 no-op 兜底；保留它是为了 SDK 若回退成「只停不清」时仍能救回 E2EE
   * （那种情况下 `initRustCrypto()` 见非空会 warn + return，静默解不开新消息）。
   *
   * ⚠️ 只应在 `client.stopClient()` **之后**调用。若 crypto 仍在运行（`stopped !== true`），
   * 本方法拒绝解除并告警 —— 否则会让活着的 OlmMachine / IndexedDB 连接泄漏。
   *
   * @returns 是否真的解除了绑定（便于调用方观测与测试）
   */
  releaseStoppedCryptoBinding(client: MatrixClient | null): boolean {
    const outcome = releaseBinding(client as { cryptoBackend?: unknown; getCrypto?: () => unknown } | null)
    if (outcome.ok) {
      this.lifecycle.recordBindingReleased()
      logger.info('已解除已停止的 crypto 绑定，允许同一 client 重新 initRustCrypto')
      return true
    }
    if (outcome.reason === 'crypto-not-stopped') {
      this.lifecycle.rejectBindingRelease(outcome.reason)
      logger.warn(
        'releaseStoppedCryptoBinding 在 crypto 未处于已停止状态时被调用，已跳过（只应在 stopClient 之后调用）'
      )
    }
    return false
  }

  /** 取 crypto 生命周期诊断快照（Batch 4.1）：供 service → store 在运行期读取，使失配不再只在日志里可见。 */
  getCryptoLifecycleDiagnostics(): CryptoLifecycleDiagnostics {
    return this.lifecycle.snapshot()
  }

  /** 重置加密状态追踪器
   */
  resetState(): void {
    // D9：重置同时解除 client 归属并推进代次，使旧 client 的后台续跑任务无法再回写状态。
    this.disarmStorageKeyRetry?.()
    this.stateOwnerClient = null
    this.stateOwnerIdentity = null
    this.stateGeneration += 1
    this.rustCryptoDebugState = createInitialRustCryptoDebugState()
    this.eventDecryptedDebugState = createInitialEventDecryptedDebugState()
    this.lifecycle.reset()
  }

  /**
   * 登出时清除 crypto store 记录。
   *
   * 清除 localStorage 中的 lastCryptoUserId 记录，
   * 并删除该用户的 crypto IndexedDB 数据库，确保下次登录时从干净状态开始。
   *
   * @param userId 登出用户的 userId
   */
  async clearCryptoStoreForLogout(userId: string): Promise<void> {
    clearLastCryptoUser()
    if (typeof globalThis.indexedDB !== 'undefined') {
      try {
        const result = await clearStaleCryptoStores(userId)
        if (result.failed > 0 || result.blocked > 0) {
          logger.warn(
            `登出清理部分失败: ${userId} (已删除=${result.deleted}, 失败=${result.failed}, 被阻塞=${result.blocked})`
          )
        } else {
          logger.info(`登出清理完成: ${userId} (已删除 ${result.deleted} 个数据库)`)
        }
      } catch (err) {
        logger.error(`登出清理 IndexedDB 异常: ${userId}`, err)
      }
    } else {
      logger.info(`登出清理完成（无 IndexedDB）: ${userId}`)
    }
  }
}
