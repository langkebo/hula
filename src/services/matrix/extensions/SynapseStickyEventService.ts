import { createLogger } from '@/utils/Logger'
import endpointCapabilityService from '../EndpointCapabilityService'
import { PREFIX_UNSTABLE } from '../paths/prefixes'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseStickyEventService')

/**
 * MSC4354 粘性事件（sticky events）的 unstable 前缀。
 *
 * ⚠️ 前缀口径（2026-10-11 修正 404，见 `scripts/bare-matrix-paths-baseline.json` L-D03/L-D04）：
 * 后端**只**在 `/_matrix/client/unstable/org.matrix.msc4354/...` 注册该路由
 * （`synapse-web/src/routes/derived_route_table_always.inc.rs:207`），client/v3 形态零命中。
 * SDK 侧同口径（`room-summary/room-summary-base-manager.ts` 的 `roomPathMsc4354`）。
 */
const MSC4354_PREFIX = `${PREFIX_UNSTABLE}/org.matrix.msc4354`

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
      const path = `${MSC4354_PREFIX}/rooms/${encodeURIComponent(roomId)}/sticky_events`
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
      await this.request(`${MSC4354_PREFIX}/rooms/${encodeURIComponent(roomId)}/sticky_events`, {
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
        `${MSC4354_PREFIX}/rooms/${encodeURIComponent(roomId)}/sticky_events/${encodeURIComponent(eventType)}`,
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
