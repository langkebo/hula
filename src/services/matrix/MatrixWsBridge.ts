import { useMitt } from '@/composables/common/useMitt'
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
import { WsResponseMessageType, type WsTokenExpire } from '@/services/wsType'
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

  private readonly onRedaction = (event: MatrixEvent, room: Room) => {
    const redactsId =
      (event as unknown as { event?: { redacts?: string } }).event?.redacts ??
      (event.getContent() as { redacts?: string })?.redacts
    if (!redactsId) return

    const payload: RevokedMsgType = {
      msgId: redactsId,
      roomId: room.roomId,
      recallUid: event.getSender() ?? undefined
    }
    useMitt.emit(WsResponseMessageType.MSG_RECALL, payload)
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
    client.on(RoomStateEvent.Events, this.onRoomStateEvent as never)
    this.started = true
    logger.info('MatrixWsBridge 已启动')
  }

  stop(): void {
    if (!this.started || !this.client) return
    this.client.off(ClientEvent.Sync, this.onSync as never)
    this.client.off(RoomEvent.Redaction, this.onRedaction as never)
    this.client.off(RoomStateEvent.Events, this.onRoomStateEvent as never)
    this.client = null
    this.started = false
    logger.info('MatrixWsBridge 已停止')
  }
}

export const matrixWsBridge = new MatrixWsBridge()
export default matrixWsBridge
