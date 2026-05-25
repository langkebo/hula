import { createLogger } from '@/utils/Logger'

const logger = createLogger('OpenClawAssistantRoomService')

/**
 * OpenClaw Assistant 房间服务（OpenClawX 后端已移除，该服务为无操作桩）
 */
class OpenClawAssistantRoomService {
  private registered = false

  ensureRegistered(): void {
    if (this.registered) {
      return
    }
    logger.info('OpenClaw Assistant 不再可用（OpenClawX 后端已移除）')
    this.registered = true
  }
}

export const openClawAssistantRoomService = new OpenClawAssistantRoomService()
