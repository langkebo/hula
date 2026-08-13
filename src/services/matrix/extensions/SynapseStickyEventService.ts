import { createLogger } from '@/utils/Logger'
import endpointCapabilityService from '../EndpointCapabilityService'
import { PREFIX_V3 } from '../paths'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseStickyEventService')

export interface StickyEvent {
  event_id: string
  event_type: string
  content: Record<string, unknown>
  updated_ts: number
}

/**
 * synapse-rust 粘性事件（sticky events）扩展。
 * 从 SynapseRustExtensionsService 拆分而来。
 */
class SynapseStickyEventService extends SynapseExtensionHttpBase {
  /** 获取置顶事件列表
   */
  async getStickyEvents(roomId: string): Promise<StickyEvent[]> {
    try {
      const path = `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/sticky_events`
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        logger.warn('[SynapseRust] 粘性事件端点不可用')
        return []
      }

      const response = await this.request<{ events: StickyEvent[] } | { data?: { events: StickyEvent[] } }>(path, {
        method: 'GET'
      })
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 获取粘性事件成功: roomId=${roomId}`)
      return data?.events || []
    } catch (err) {
      logger.error(`[SynapseRust] 获取粘性事件失败: ${err}`)
      return []
    }
  }

  /** 设置置顶事件
   */
  async setStickyEvent(roomId: string, eventId: string, eventType: string): Promise<void> {
    try {
      await this.request(`${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/sticky_events`, {
        method: 'POST',
        body: JSON.stringify({
          events: [{ event_id: eventId, event_type: eventType }]
        })
      })
      logger.info(`[SynapseRust] 设置粘性事件成功: roomId=${roomId}, eventId=${eventId}`)
    } catch (err) {
      logger.error(`[SynapseRust] 设置粘性事件失败: ${err}`)
      throw err
    }
  }

  /** 清除置顶事件
   */
  async clearStickyEvent(roomId: string, eventType: string): Promise<void> {
    try {
      await this.request(
        `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/sticky_events/${encodeURIComponent(eventType)}`,
        { method: 'DELETE' }
      )
      logger.info(`[SynapseRust] 清除粘性事件成功: roomId=${roomId}, eventType=${eventType}`)
    } catch (err) {
      logger.error(`[SynapseRust] 清除粘性事件失败: ${err}`)
      throw err
    }
  }
}

export const synapseStickyEventService = new SynapseStickyEventService()
