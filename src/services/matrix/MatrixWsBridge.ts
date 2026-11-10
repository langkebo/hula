import { useMitt } from '@/composables/common/useMitt'
import { WsResponseMessageType, type WsTokenExpire } from '@/services/legacy/wsType'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import {
  ClientEvent,
  type MatrixClient,
  type MatrixEvent,
  type Room,
  RoomEvent,
  type RoomState,
  RoomStateEvent
} from '@/services/matrix/sdk'
import type { RevokedMsgType } from '@/services/types'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixWsBridge')

type SyncErrorLike = {
  errcode?: string
  data?: { errcode?: string }
}

/**
 * 把 matrix-js-sdk 的事件桥接成现有 useMitt + WsResponseMessageType.* 事件。
 * 目的：让 App.vue 中遗留的、原本依赖 WebSocket 的监听器在 Matrix 同步链路下
 * 仍然能收到等价信号，避免大规模改写 App.vue。
 *
 * 仅桥接信号源明确、行为可验证的事件，其它合成事件（好友申请、群解散、
 * 群成员变更等）依赖 synapse-rust 自定义协议，需要先确认事件 shape 再补。
 */
class MatrixWsBridge {
  private client: MatrixClient | null = null
  private started = false

  /** 撤回双通道去重窗口：SDK 的 RoomEvent.Redaction 与 timeline 兜底可能同时命中同一事件。 */
  private static readonly RECALL_DEDUPE_TTL_MS = 60_000

  /** 已上抛的撤回事件标识 → 上抛时间。 */
  private readonly handledRecalls = new Map<string, number>()

  private readonly onSync = (state: string, _prev?: string, data?: unknown) => {
    if (state !== 'ERROR') return
    const errLike = data as SyncErrorLike | undefined
    const code = errLike?.errcode ?? errLike?.data?.errcode
    if (code !== 'M_UNKNOWN_TOKEN' && code !== 'M_MISSING_TOKEN') return

    const userId = this.client?.getUserId() ?? ''
    const deviceId = this.client?.getDeviceId() ?? ''
    const payload: WsTokenExpire = {
      uid: userId,
      ip: '',
      client: deviceId
    }
    logger.warn('Matrix 同步检测到 token 失效，转发 TOKEN_EXPIRED', { code })
    useMitt.emit(WsResponseMessageType.TOKEN_EXPIRED, payload)
  }

  /**
   * 撤回统一上抛入口（双通道共用，按事件去重）。
   *
   * SDK 的 `tryApplyRedaction` 只在目标事件仍留在本窗口 timeline 中时才
   * `makeRedacted` 并 emit `RoomEvent.Redaction`；目标已滑出窗口（切换房间、
   * 长会话淘汰）时 SDK 静默跳过，而 UI 的 chatStore 仍缓存着该消息，于是
   * 「撤回不落地」（D13）。因此 timeline 里的 `m.room.redaction` 也要能上抛。
   */
  private emitRecall(event: MatrixEvent, room: Room): void {
    // SDK 统一解析 room v1-v10（事件顶层 redacts）与 room v11+（content.redacts）。
    const redactsId = event.getRedactionTargetId()
    if (!redactsId) return

    const dedupeKey = event.getId() ?? `${room.roomId}|${redactsId}|${event.getSender() ?? ''}`
    const now = Date.now()
    const lastHandledAt = this.handledRecalls.get(dedupeKey)
    if (lastHandledAt !== undefined && now - lastHandledAt < MatrixWsBridge.RECALL_DEDUPE_TTL_MS) return

    this.handledRecalls.set(dedupeKey, now)
    for (const [key, handledAt] of this.handledRecalls) {
      if (now - handledAt >= MatrixWsBridge.RECALL_DEDUPE_TTL_MS) this.handledRecalls.delete(key)
    }

    const recallUid = event.getSender() ?? undefined
    const payload: RevokedMsgType = {
      msgId: redactsId,
      roomId: room.roomId,
      ...(recallUid !== undefined ? { recallUid } : {})
    }
    useMitt.emit(WsResponseMessageType.MSG_RECALL, payload)
  }

  /** 通道一：SDK 命中目标事件后 emit 的 RoomEvent.Redaction。 */
  private readonly onRedaction = (event: MatrixEvent, room: Room) => {
    this.emitRecall(event, room)
  }

  /** 通道二：live timeline 里的 m.room.redaction（目标不在 timeline 时唯一可达的通道）。 */
  private readonly onTimelineEvent = (event: MatrixEvent, room?: Room) => {
    if (!event.isRedaction()) return
    const targetRoom = room ?? this.client?.getRoom(event.getRoomId() ?? '')
    if (!targetRoom) return
    this.emitRecall(event, targetRoom)
  }

  private readonly onRoomStateEvent = (event: MatrixEvent, state: RoomState) => {
    const type = event.getType()
    if (type !== 'm.room.name' && type !== 'm.room.avatar') return

    const room = this.client?.getRoom(state.roomId)
    const content = room ? undefined : (event.getContent() as { name?: string; url?: string })
    const payload = {
      roomId: state.roomId,
      name: room?.name ?? content?.name ?? '',
      avatar:
        (room?.getMxcAvatarUrl?.() as string | null | undefined) ?? (event.getContent() as { url?: string })?.url ?? ''
    }
    useMitt.emit(WsResponseMessageType.ROOM_INFO_CHANGE, payload)
  }

  start(): void {
    if (this.started) return
    const client = matrixClientService.getClient()
    if (!client) {
      logger.warn('start: client 未就绪，跳过桥接')
      return
    }

    this.client = client
    client.on(ClientEvent.Sync, this.onSync as never)
    client.on(RoomEvent.Redaction, this.onRedaction as never)
    client.on(RoomEvent.Timeline, this.onTimelineEvent as never)
    client.on(RoomStateEvent.Events, this.onRoomStateEvent as never)
    this.started = true
    logger.info('MatrixWsBridge 已启动')
  }

  stop(): void {
    if (!this.started || !this.client) return
    this.client.off(ClientEvent.Sync, this.onSync as never)
    this.client.off(RoomEvent.Redaction, this.onRedaction as never)
    this.client.off(RoomEvent.Timeline, this.onTimelineEvent as never)
    this.client.off(RoomStateEvent.Events, this.onRoomStateEvent as never)
    this.client = null
    this.started = false
    this.handledRecalls.clear()
    logger.info('MatrixWsBridge 已停止')
  }
}

export const matrixWsBridge = new MatrixWsBridge()
