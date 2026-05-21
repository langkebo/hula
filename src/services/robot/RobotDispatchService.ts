import { createLogger } from '@/utils/Logger'
import type { RobotDispatchMessage, RobotDispatchResult } from './types'

const logger = createLogger('RobotDispatchService')

export type RobotDispatchHandler = (message: RobotDispatchMessage) => Promise<RobotDispatchResult>

class RobotDispatchService {
  private handlers = new Map<string, RobotDispatchHandler>()

  register(botId: string, handler: RobotDispatchHandler): void {
    this.handlers.set(botId, handler)
  }

  unregister(botId: string): void {
    this.handlers.delete(botId)
  }

  hasHandler(botId: string): boolean {
    return this.handlers.has(botId)
  }

  async dispatch(message: RobotDispatchMessage): Promise<RobotDispatchResult> {
    const handler = this.handlers.get(message.botId)
    if (!handler) {
      logger.warn(`[RobotDispatch] missing handler for ${message.botId}`)
      return {
        traceId: message.traceId,
        roomId: message.roomId,
        botId: message.botId,
        delivered: false,
        error: `No handler registered for ${message.botId}`
      }
    }
    return handler(message)
  }
}

export const robotDispatchService = new RobotDispatchService()
