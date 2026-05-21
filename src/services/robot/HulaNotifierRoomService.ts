import { useRobotCenterStore } from '@/stores/domains/robot/center'
import { createLogger } from '@/utils/Logger'
import { robotDispatchService } from './RobotDispatchService'
import { robotMessageProtocolService } from './RobotMessageProtocolService'
import type { RobotDispatchMessage, RobotDispatchResult } from './types'

const logger = createLogger('HulaNotifierRoomService')
const HULA_NOTIFIER_BOT_ID = 'hula-notifier'

class HulaNotifierRoomService {
  private registered = false

  ensureRegistered(): void {
    if (this.registered) {
      return
    }
    robotDispatchService.register(HULA_NOTIFIER_BOT_ID, async (message) => this.handleDispatch(message))
    this.registered = true
  }

  private buildStatusBody(roomId: string): string {
    const robotCenterStore = useRobotCenterStore()
    const instances = robotCenterStore.listRoomInstances(roomId)
    if (!instances.length) {
      return '当前房间尚未部署机器人。'
    }

    const statusLines = instances.map((instance, index) => {
      const definition = robotCenterStore.listDefinitions().find((item) => item.id === instance.botId)
      const name = definition?.name || instance.botId
      return `${index + 1}. ${name} · ${instance.status}`
    })

    return ['当前房间机器人状态：', ...statusLines].join('\n')
  }

  private async handleDispatch(message: RobotDispatchMessage): Promise<RobotDispatchResult> {
    try {
      const command = typeof message.metadata?.command === 'string' ? message.metadata.command : ''
      const body =
        command === 'status'
          ? this.buildStatusBody(message.roomId)
          : message.body.trim() || 'HuLa Notifier 已完成本次机器人通知。'

      const envelope = robotMessageProtocolService.buildEnvelope(message, {
        botName: 'HuLa Notifier',
        deliveryMode: message.metadata?.sourceEventId ? 'reply' : 'room',
        securityLevel: 'room'
      })

      const eventId = await robotMessageProtocolService.sendRoomNotice(message.roomId, envelope, body)
      return {
        traceId: message.traceId,
        roomId: message.roomId,
        botId: message.botId,
        delivered: true,
        eventId
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'HuLa Notifier 发送失败'
      logger.error(`[HulaNotifier] dispatch failed: ${messageText}`, error)
      return {
        traceId: message.traceId,
        roomId: message.roomId,
        botId: message.botId,
        delivered: false,
        error: messageText
      }
    }
  }
}

export const hulaNotifierRoomService = new HulaNotifierRoomService()
