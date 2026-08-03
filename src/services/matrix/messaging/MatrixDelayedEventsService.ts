/**
 * Matrix 延迟事件 L2 服务（MSC4140）
 *
 * 包装 matrix-js-sdk 的 MSC4140 unstable 延迟事件 API，提供定时消息与
 * 可撤回消息能力。所有方法均透传到 SDK 的 `_unstable_*` 实现，仅做
 * 客户端可用性校验与错误归一化，不重复实现协议细节。
 *
 * SDK 涉及方法：
 *   - `_unstable_sendDelayedEvent`           定时发送 timeline 事件
 *   - `_unstable_sendDelayedStateEvent`      定时发送 state 事件
 *   - `_unstable_sendStickyDelayedEvent`     定时发送 sticky 事件
 *   - `_unstable_getDelayedEvents`           查询延迟事件（scheduled/finalised）
 *   - `_unstable_cancelScheduledDelayedEvent`   取消尚未送达的延迟事件
 *   - `_unstable_restartScheduledDelayedEvent`  重置延迟事件的计时
 *   - `_unstable_sendScheduledDelayedEvent`     立即触发延迟事件送达
 *
 * 后端对应：synapse-rust 的 `delayed_events` 路由
 *   `GET/PUT /_matrix/client/unstable/org.matrix.msc4140/delayed_events`
 *   `PUT /_matrix/client/unstable/org.matrix.msc4140/delayed_event/{delay_id}`
 *
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4140
 */
import type {
  DelayedEventInfo,
  DelayedEventInfoItem,
  SendDelayedEventRequestOpts,
  SendDelayedEventResponse
} from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'

// Re-export SDK type for consumers that import from this service
export type { DelayedEventInfoItem }

const logger = createLogger('MatrixDelayedEvents')

/**
 * SDK MSC4140 不稳定方法的松类型视图。
 *
 * SDK 的 `_unstable_sendDelayedEvent` 等方法使用 `K extends keyof TimelineEvents`
 * 泛型约束事件类型，业务层只需以字符串 + 任意内容透传，因此定义此接口放宽泛型约束。
 */
interface DelayedEventClient {
  _unstable_sendDelayedEvent(
    roomId: string,
    delayOpts: SendDelayedEventRequestOpts,
    threadId: string | null,
    eventType: string,
    content: Record<string, unknown>,
    txnId?: string
  ): Promise<SendDelayedEventResponse>
  _unstable_sendDelayedStateEvent(
    roomId: string,
    delayOpts: SendDelayedEventRequestOpts,
    eventType: string,
    content: Record<string, unknown>,
    stateKey?: string
  ): Promise<SendDelayedEventResponse>
  _unstable_sendStickyDelayedEvent(
    roomId: string,
    stickDuration: number,
    delayOpts: SendDelayedEventRequestOpts,
    threadId: string | null,
    eventType: string,
    content: Record<string, unknown> & { msc4354_sticky_key?: string },
    txnId?: string
  ): Promise<SendDelayedEventResponse>
}

/** 定时消息/可撤回消息发送的延迟选项，与 SDK `SendDelayedEventRequestOpts` 等价。 */
export type DelayedEventOptions = SendDelayedEventRequestOpts

/** 延迟事件查询范围。 */
export type DelayedEventStatus = 'scheduled' | 'finalised'

/** 延迟事件 ID 列表或单个 ID。 */
export type DelayedEventIdQuery = string | string[]

/** 对延迟事件可执行的操作，对应 MSC4140 `UpdateDelayedEventAction`。 */
export type ScheduledDelayedEventAction = 'cancel' | 'restart' | 'send'

/** 立即/取消/重启延迟事件的结果（空对象，HTTP 200 即成功）。 */
export interface ScheduledDelayedEventResult {
  ok: boolean
}

class MatrixDelayedEventsService {
  /**
   * 调度一条定时消息：在 `delayOpts.delay` 毫秒后送达，
   * 或在 `parent_delay_id` 指定的父延迟链触发时送达。
   *
   * @param roomId 目标房间
   * @param eventType 事件类型（如 `m.room.message`）
   * @param content 事件内容
   * @param delayOpts 延迟选项
   * @param threadId 关联线程 ID（无则传 `null`）
   * @param txnId 可选事务 ID
   */
  async sendDelayedEvent(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    delayOpts: DelayedEventOptions,
    threadId: string | null = null,
    txnId?: string
  ): Promise<SendDelayedEventResponse> {
    const client = this.requireClient()
    const result = await (client as DelayedEventClient)._unstable_sendDelayedEvent(
      roomId,
      delayOpts,
      threadId,
      eventType,
      content,
      txnId
    )
    logger.info(`[sendDelayedEvent] roomId=${roomId} type=${eventType} delay_id=${result?.delay_id}`)
    return result
  }

  /**
   * 调度一条定时 state 事件（例如定时修改房间名称/权限）。
   *
   * @param roomId 目标房间
   * @param eventType state 事件类型
   * @param content state 事件内容
   * @param stateKey state key（默认空字符串）
   * @param delayOpts 延迟选项
   */
  async sendDelayedStateEvent(
    roomId: string,
    eventType: string,
    content: Record<string, unknown>,
    delayOpts: DelayedEventOptions,
    stateKey = ''
  ): Promise<SendDelayedEventResponse> {
    const client = this.requireClient()
    const result = await (client as DelayedEventClient)._unstable_sendDelayedStateEvent(
      roomId,
      delayOpts,
      eventType,
      content,
      stateKey
    )
    logger.info(
      `[sendDelayedStateEvent] roomId=${roomId} type=${eventType} stateKey=${stateKey} delay_id=${result?.delay_id}`
    )
    return result
  }

  /**
   * 调度一条 sticky 定时事件（MSC4354 sticky key）。
   *
   * @param roomId 目标房间
   * @param stickDuration sticky 持续时长（毫秒）
   * @param eventType 事件类型
   * @param content 事件内容（必须含 `msc4354_sticky_key`）
   * @param delayOpts 延迟选项
   * @param threadId 关联线程 ID（无则传 `null`）
   * @param txnId 可选事务 ID
   */
  async sendStickyDelayedEvent(
    roomId: string,
    stickDuration: number,
    eventType: string,
    content: Record<string, unknown> & { msc4354_sticky_key?: string },
    delayOpts: DelayedEventOptions,
    threadId: string | null = null,
    txnId?: string
  ): Promise<SendDelayedEventResponse> {
    const client = this.requireClient()
    const result = await (client as DelayedEventClient)._unstable_sendStickyDelayedEvent(
      roomId,
      stickDuration,
      delayOpts,
      threadId,
      eventType,
      content,
      txnId
    )
    logger.info(`[sendStickyDelayedEvent] roomId=${roomId} type=${eventType} delay_id=${result?.delay_id}`)
    return result
  }

  /**
   * 查询延迟事件列表。
   *
   * @param status 仅查询 `scheduled` 或 `finalised`；不传则查全部
   * @param delayId 限定特定 delay_id（可传数组）
   * @param fromToken 分页 token
   */
  async getDelayedEvents(
    status?: DelayedEventStatus,
    delayId?: DelayedEventIdQuery,
    fromToken?: string
  ): Promise<DelayedEventInfo> {
    const client = this.requireClient()
    const result = await client._unstable_getDelayedEvents(status, delayId, fromToken)
    const scheduledCount = result.scheduled?.length ?? 0
    const finalisedCount = result.finalised?.length ?? 0
    logger.info(`[getDelayedEvents] status=${status ?? 'all'} scheduled=${scheduledCount} finalised=${finalisedCount}`)
    return result
  }

  /**
   * 对尚未送达的延迟事件执行操作。
   *
   * @param delayId 目标延迟事件 ID
   * @param action `cancel` | `restart` | `send`
   */
  async updateScheduledDelayedEvent(
    delayId: string,
    action: ScheduledDelayedEventAction
  ): Promise<ScheduledDelayedEventResult> {
    const client = this.requireClient()
    const methodMap: Record<ScheduledDelayedEventAction, (delayId: string) => Promise<unknown>> = {
      cancel: (id) => client._unstable_cancelScheduledDelayedEvent(id),
      restart: (id) => client._unstable_restartScheduledDelayedEvent(id),
      send: (id) => client._unstable_sendScheduledDelayedEvent(id)
    }
    await methodMap[action](delayId)
    logger.info(`[updateScheduledDelayedEvent] delay_id=${delayId} action=${action}`)
    return { ok: true }
  }

  /**
   * 取消一条尚未送达的定时消息（最常用的"撤回"语义）。
   */
  async cancelScheduledDelayedEvent(delayId: string): Promise<ScheduledDelayedEventResult> {
    return this.updateScheduledDelayedEvent(delayId, 'cancel')
  }

  /**
   * 重置定时消息的计时（重新开始倒计时）。
   */
  async restartScheduledDelayedEvent(delayId: string): Promise<ScheduledDelayedEventResult> {
    return this.updateScheduledDelayedEvent(delayId, 'restart')
  }

  /**
   * 立即触发定时消息送达（不再等待倒计时）。
   */
  async sendScheduledDelayedEvent(delayId: string): Promise<ScheduledDelayedEventResult> {
    return this.updateScheduledDelayedEvent(delayId, 'send')
  }

  private requireClient() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[MatrixDelayedEvents] Matrix client not initialized')
    }
    return client
  }
}

export const matrixDelayedEventsService = new MatrixDelayedEventsService()
export default matrixDelayedEventsService
