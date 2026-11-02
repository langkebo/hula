import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'
import type { SendMessagePayload } from './MatrixMessageService'
import { buildSendContent } from './messageContentBuilder'

const logger = createLogger('MatrixDelayedEvents')

/** MSC4140 unstable feature name（SDK 内部管理器使用同一字符串）。 */
const UNSTABLE_MSC4140 = 'org.matrix.msc4140'

/** 后端限制：delay_ms 必须为正整数且不超过 24 小时。 */
export const MAX_DELAYED_EVENT_MS = 24 * 60 * 60 * 1000

/** 服务端返回的延迟事件（归一化为 UI 可直接消费的字段）。 */
export interface DelayedMessageInfo {
  delayId: number
  roomId: string
  type: string
  delayMs: number
  /** 调度时刻（毫秒时间戳，服务端字段 delayed_since_ts）。 */
  scheduledAt: number
  content: Record<string, unknown>
}

export type DelayedEventErrorReason = 'offline' | 'unsupported' | 'invalid_delay' | 'not_found' | 'unknown'

/** 延迟事件操作的可判别错误，UI 据此给出明确提示（不使用含糊的“网络错误”）。 */
export class DelayedEventError extends Error {
  constructor(readonly reason: DelayedEventErrorReason) {
    super(reason)
    this.name = 'DelayedEventError'
  }
}

interface RawDelayedEventInfo {
  delay_id: number
  room_id: string
  type: string
  delay_ms: number
  delayed_since_ts: number
  content: Record<string, unknown>
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { errcode?: unknown; message?: unknown }
  if (candidate.errcode === 'M_NOT_FOUND') return true
  return typeof candidate.message === 'string' && candidate.message.includes('M_NOT_FOUND')
}

function normalizeError(error: unknown): DelayedEventError {
  if (error instanceof DelayedEventError) return error
  if (isNotFoundError(error)) return new DelayedEventError('not_found')
  return new DelayedEventError('unknown')
}

/**
 * MSC4140 延迟事件服务。
 *
 * 只做三件事：能力探测、请求参数校验与错误归一化；所有协议调用都委托给
 * SDK 的 `DelayedEventsManager`（`client.getDelayedEventsManager()`），
 * 不另行拼装 HTTP 请求，遵守 SDK 优先约束。
 */
class MatrixDelayedEventsService extends BaseMatrixService {
  private supportCache: boolean | null = null

  /** 服务端是否声明支持 MSC4140；探测失败按不支持处理，避免暴露必然失败的入口。 */
  async isSupported(force = false): Promise<boolean> {
    if (!force && this.supportCache !== null) return this.supportCache
    try {
      const client = this.getClient()
      const supported = Boolean(await client.doesServerSupportUnstableFeature(UNSTABLE_MSC4140))
      this.supportCache = supported
      return supported
    } catch (error) {
      logger.info(`Delayed events capability probe failed: ${String(error)}`)
      this.supportCache = false
      return false
    }
  }

  /** 会话切换后能力可能变化（如升级账号），允许调用方清理缓存重新探测。 */
  resetSupportCache(): void {
    this.supportCache = null
  }

  private getManager() {
    const client = this.getClient()
    const manager = client.getDelayedEventsManager()
    if (!manager) throw new DelayedEventError('unsupported')
    return manager
  }

  private async assertSupported(): Promise<void> {
    if (!(await this.isSupported())) throw new DelayedEventError('unsupported')
  }

  /**
   * 调度一条延迟消息。离线、延迟非法或服务端不支持时抛出可判别错误，
   * 绝不返回本地伪 ID 假装调度成功。
   */
  async scheduleMessage(roomId: string, content: Record<string, unknown>, delayMs: number): Promise<number> {
    if (!navigator.onLine) throw new DelayedEventError('offline')
    if (!roomId?.trim()) throw new DelayedEventError('invalid_delay')
    if (!Number.isInteger(delayMs) || delayMs <= 0 || delayMs > MAX_DELAYED_EVENT_MS) {
      throw new DelayedEventError('invalid_delay')
    }
    await this.assertSupported()

    const txnId = `delayed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    try {
      const response = await this.getManager().scheduleDelayedEvent(roomId, 'm.room.message', txnId, {
        delay_ms: delayMs,
        content
      })
      if (!response?.delay_id) throw new DelayedEventError('unknown')
      logger.info(`Delayed message scheduled in ${roomId}, delay_id=${response.delay_id}`)
      return response.delay_id
    } catch (error) {
      logger.error(`Failed to schedule delayed message in ${roomId}: ${String(error)}`)
      throw normalizeError(error)
    }
  }

  /**
   * 调度一条业务消息：先按消息类型构建 Matrix content，再交给 {@link scheduleMessage}。
   *
   * 失败语义与 `scheduleMessage` 完全一致：离线直接抛错，不进入离线队列
   * （队列恢复后发送会丢失“定时”语义，属于假装成功）。
   */
  async scheduleMessagePayload(payload: SendMessagePayload, delayMs: number): Promise<number> {
    return this.scheduleMessage(payload.roomId, buildSendContent(payload), delayMs)
  }

  /** 列出本人全部待发延迟事件，按计划发送时间升序。 */
  async listPending(): Promise<DelayedMessageInfo[]> {
    if (!navigator.onLine) throw new DelayedEventError('offline')
    await this.assertSupported()
    try {
      const events = (await this.getManager().listScheduledDelayedEvents()) as RawDelayedEventInfo[]
      return (events ?? [])
        .map((event) => ({
          delayId: event.delay_id,
          roomId: event.room_id,
          type: event.type,
          delayMs: event.delay_ms,
          scheduledAt: event.delayed_since_ts,
          content: event.content ?? {}
        }))
        .sort((a, b) => a.scheduledAt + a.delayMs - (b.scheduledAt + b.delayMs))
    } catch (error) {
      logger.error(`Failed to list delayed messages: ${String(error)}`)
      throw normalizeError(error)
    }
  }

  /** 取消待发消息；失败时抛出 not_found/unknown，调用方保留原任务并提示。 */
  async cancel(delayId: number): Promise<void> {
    if (!navigator.onLine) throw new DelayedEventError('offline')
    await this.assertSupported()
    try {
      await this.getManager().cancelScheduledDelayedEvent(delayId)
      logger.info(`Delayed message cancelled, delay_id=${delayId}`)
    } catch (error) {
      logger.error(`Failed to cancel delayed message ${delayId}: ${String(error)}`)
      throw normalizeError(error)
    }
  }

  /** 立即发送待发消息。 */
  async sendNow(delayId: number): Promise<void> {
    if (!navigator.onLine) throw new DelayedEventError('offline')
    await this.assertSupported()
    try {
      await this.getManager().sendScheduledDelayedEvent(delayId)
      logger.info(`Delayed message sent immediately, delay_id=${delayId}`)
    } catch (error) {
      logger.error(`Failed to send delayed message ${delayId} immediately: ${String(error)}`)
      throw normalizeError(error)
    }
  }

  /**
   * 改期：MSC4140 无独立 update 动作，按 cancel + 重新调度实现。
   * 取消成功后才创建新任务；取消失败直接抛出，原任务保留在服务端。
   */
  async reschedule(delayId: number, newDelayMs: number): Promise<number> {
    if (!navigator.onLine) throw new DelayedEventError('offline')
    if (!Number.isInteger(newDelayMs) || newDelayMs <= 0 || newDelayMs > MAX_DELAYED_EVENT_MS) {
      throw new DelayedEventError('invalid_delay')
    }
    await this.assertSupported()

    let original: RawDelayedEventInfo
    try {
      original = (await this.getManager().getScheduledDelayedEvent(delayId)) as RawDelayedEventInfo
    } catch (error) {
      logger.error(`Failed to read delayed message ${delayId} before reschedule: ${String(error)}`)
      throw normalizeError(error)
    }

    await this.cancel(delayId)
    try {
      return await this.scheduleMessage(original.room_id, original.content, newDelayMs)
    } catch (error) {
      logger.error(`Reschedule cancelled ${delayId} but failed to create replacement: ${String(error)}`)
      throw normalizeError(error)
    }
  }
}

export const matrixDelayedEventsService = new MatrixDelayedEventsService()
export default matrixDelayedEventsService
