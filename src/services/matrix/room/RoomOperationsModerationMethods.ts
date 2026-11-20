import { CLIENT_READY_TIMEOUT_MS } from '@/common/constants'
import type { IPowerLevelsContent, MatrixClient } from '@/services/matrix/sdk'
import { HttpClient } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'
import { RoomOperationsStateMethods } from './RoomOperationsStateMethods'

const logger = createLogger('RoomOperations')

/**
 * InviteBlocklistManager 实例类型。
 *
 * 注：`matrix-js-sdk/invite-blocklist` 子路径未在 package.json exports 中暴露，
 * 这里通过 MatrixClient 的访问器返回类型派生，避免违反 SDK 边界策略。
 */
type InviteBlocklistManagerInstance = ReturnType<NonNullable<MatrixClient['getInviteBlocklistManager']>>

/** 房间权限等级内容（复用 SDK `IPowerLevelsContent`）。 */
export type RoomPowerLevelsOutcome = IPowerLevelsContent

/**
 * RoomOperations 的审核 / 生命周期 / 翻译 / 历史可见性 / 权限等级方法片段。
 *
 * 从 `RoomOperations` 抽出，承接 `RoomOperationsStateMethods`，公开方法签名保持不变。
 */
export abstract class RoomOperationsModerationMethods extends RoomOperationsStateMethods {
  // --- Moderation (was ModerationService) ---

  /**
   * 获取邀请黑名单。
   *
   * 注：SDK InviteBlocklistManager.getBlocklist 内部已捕获错误并返回缓存值（或空数组），
   * 因此 `throwOnError` 参数在此实现中不再向上抛错——保留参数仅为向后兼容签名。
   * 失败时由 SDK 记录 warn 日志并返回缓存。
   */
  async getInviteBlocklist(roomId: string, _throwOnError = false): Promise<string[]> {
    try {
      return await this.getInviteBlocklistMgr().getBlocklist(roomId)
    } catch (err) {
      // 仅在 SDK 本身抛错（如客户端未初始化）时记录
      logger.error(`获取 invite blocklist 失败: ${roomId} ${err}`)
      return []
    }
  }

  /** 覆盖写入房间的邀请黑名单。 */
  async setInviteBlocklist(roomId: string, blocked: string[]): Promise<void> {
    await this.getInviteBlocklistMgr().setBlocklist(roomId, blocked)
  }

  /**
   * 获取邀请白名单。同 getInviteBlocklist，SDK 内部已处理错误。
   */
  async getInviteAllowlist(roomId: string, _throwOnError = false): Promise<string[]> {
    try {
      return await this.getInviteBlocklistMgr().getAllowlist(roomId)
    } catch (err) {
      logger.error(`获取 invite allowlist 失败: ${roomId} ${err}`)
      return []
    }
  }

  /** 覆盖写入房间的邀请白名单。 */
  async setInviteAllowlist(roomId: string, allowed: string[]): Promise<void> {
    await this.getInviteBlocklistMgr().setAllowlist(roomId, allowed)
  }

  private getInviteBlocklistMgr(): InviteBlocklistManagerInstance {
    const client = this.getClient()
    const fn = (client as { getInviteBlocklistManager?: () => InviteBlocklistManagerInstance })
      .getInviteBlocklistManager
    if (typeof fn !== 'function') {
      throw new Error('MatrixClient.getInviteBlocklistManager is not available; SDK 未初始化')
    }
    return fn.call(client)
  }

  // --- Lifecycle (was LifecycleService) ---

  /** 取 homeserver 域名；SDK 未提供时回退 baseUrl 主机名，最终兜底 matrix.org。 */
  async getServerDomain(): Promise<string> {
    await matrixClientService.waitForClientReady({ timeoutMs: CLIENT_READY_TIMEOUT_MS })
    const client = this.getClient()
    const domain = client.getDomain()
    if (domain) return domain

    const baseUrl = (client as { baseUrl?: string }).baseUrl
    if (baseUrl) {
      try {
        const url = new URL(baseUrl)
        const hostname = url.hostname
        if (hostname && hostname !== '0.0.0.0' && hostname !== '::') {
          return hostname
        }
      } catch {
        /* not a valid URL */
      }
    }

    return 'matrix.org'
  }

  /** 把房间升级到新的房间版本，返回替代房间 ID。 */
  async upgradeRoom(roomId: string, newVersion: string): Promise<string> {
    const client = this.getClient()
    const result = await client.upgradeRoom(roomId, newVersion)
    return result.replacement_room
  }

  // --- Translate (was TranslateService) ---

  /**
   * 翻译文本：优先走后端翻译端点，失败降级到本地回退实现。
   * `throwOnErrorOrSource` 兼容旧签名（boolean = 是否抛错，string = 源语言）。
   */
  async translateText(text: string, targetLang?: string, throwOnErrorOrSource?: boolean | string): Promise<string> {
    const target = typeof targetLang === 'string' && targetLang !== '' ? targetLang : 'zh-CN'
    const throwOnError = typeof throwOnErrorOrSource === 'boolean' ? throwOnErrorOrSource : true
    const sourceLang = typeof throwOnErrorOrSource === 'string' ? throwOnErrorOrSource : undefined

    try {
      const result = await this.translateViaBackend(text, target, sourceLang)
      return result.translated_text
    } catch {
      try {
        const translated = await this.translateViaFallback(text, target)
        return translated
      } catch (fallbackErr) {
        if (throwOnError) throw fallbackErr
        return text
      }
    }
  }

  private async translateViaBackend(
    text: string,
    targetLang: string,
    sourceLang?: string
  ): Promise<{ translated_text: string }> {
    const client = this.getClient()
    return await client.getRoomManager().translateText(text, targetLang, sourceLang)
  }

  /**
   * 降级翻译：调用外部第三方 Google 翻译端点（后端 `translateText` 不可用时）。
   *
   * ⚠️ 三点须知（Batch 3.4 复核订正了本文档原先「直连、绕过管控」的表述）：
   * 1. 它**不是**裸请求 —— 走 `@/utils/HttpClient`，而后者用 `getRuntimeAwareFetch()`
   *    （即统一传输层 `runtimeFetch`，含限流包装）并带显式超时；目标域名
   *    `translate.googleapis.com` 也已在 `utils/httpAllowlistConfig.ts` 的 allowlist 里显式登记。
   * 2. 但它是**内容出境**：用户消息正文会被发送到 Google。仅在后端翻译失败时才会走到这里，
   *    若后续要加强隐私，应在这里加用户级开关或直接删除该降级路径（属产品决策，本轮保留）。
   * 3. S11 传输层收敛的**唯一保留例外**：目标是非 Matrix 的第三方端点（不属于 Matrix
   *    协议域），因此继续用 `@/utils/HttpClient` 的 allowlist 通道，而不改走 `matrixHttpClient`。
   */
  private async translateViaFallback(text: string, targetLang: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`
    // biome-ignore lint/suspicious/noExplicitAny: Google Translate API response shape is unstructured
    const translationPayload = await HttpClient.get<any>(url)
    if (translationPayload?.[0]) return translationPayload[0].map((item: unknown[]) => item[0]).join('')
    return text
  }

  // --- History Visibility ---

  /** 获取历史消息可见性
   */
  async getHistoryVisibility(roomId: string): Promise<string> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return 'shared'
    const event = room.currentState.getStateEvents('m.room.history_visibility', '')
    return (event?.getContent()?.history_visibility as string) ?? 'shared'
  }

  /** 设置历史消息可见性
   */
  async setHistoryVisibility(roomId: string, visibility: string): Promise<void> {
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.history_visibility', { history_visibility: visibility }, '')
  }

  // --- Power Levels ---

  /** 获取房间权限等级
   */
  async getPowerLevels(roomId: string): Promise<RoomPowerLevelsOutcome> {
    const client = this.getClient()
    const room = client.getRoom(roomId)
    if (!room) return {}
    const event = room.currentState.getStateEvents('m.room.power_levels', '')
    return (event?.getContent() as RoomPowerLevelsOutcome) ?? {}
  }

  /** 设置房间权限等级
   */
  async setPowerLevels(roomId: string, content: Record<string, unknown>): Promise<void> {
    const client = this.getClient()
    await client.sendStateEvent(roomId, 'm.room.power_levels', content, '')
  }
}
