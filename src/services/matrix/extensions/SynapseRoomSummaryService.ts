import { createLogger } from '@/utils/Logger'
import endpointCapabilityService from '../EndpointCapabilityService'
import { PREFIX_V3 } from '../paths/prefixes'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseRoomSummaryService')

/**
 * 房间摘要英雄成员（与 SDK `RoomSummaryManager` 返回的 `RoomSummaryHero` 同形）。
 */
export interface RoomSummaryHero {
  user_id: string
  display_name?: string
  avatar_url?: string
}

/**
 * 房间摘要（形状对齐 SDK `RoomSummaryManager.getRoomSummary()` 的返回值）。
 */
export interface RoomSummary {
  room_id: string
  room_type?: string
  name?: string
  topic?: string
  avatar_url?: string
  canonical_alias?: string
  join_rule?: string
  history_visibility?: string
  guest_access?: string
  is_direct?: boolean
  is_space?: boolean
  is_encrypted?: boolean
  member_count?: number
  joined_member_count?: number
  invited_member_count?: number
  last_event_ts?: number
  last_message_ts?: number
  heroes: RoomSummaryHero[]
}

export type RoomEphemeralEvent = Record<string, unknown>

/**
 * synapse-rust 房间摘要 / 临时事件扩展。
 *
 * ⚠️ **房间摘要已收敛到 SDK 的 `RoomSummaryManager`**（`client.getRoomSummaryManager()`）：
 * summary / members / state / stats 四条路径由 SDK 侧门禁（path-contract、wire-format）
 * 保证与后端契约一致，本服务**不再**自行拼接这些路径。历史 404 证据见
 * `scripts/bare-matrix-paths-baseline.json` 的 `history`（L-D05~L-D08：曾误用 client/v3，
 * 后端只在 vendor/v1 与 client/v1 注册，无 v3）。
 *
 * 本服务只保留 SDK 尚未封装的 synapse-rust 扩展端点（room ephemeral）。
 */
class SynapseRoomSummaryService extends SynapseExtensionHttpBase {
  /**
   * 获取房间摘要（委托 SDK `RoomSummaryManager`）。
   *
   * `forceRefresh=true`：保持本服务原有的「每次直连拉取、不读缓存」语义
   * （SDK manager 默认会走自己的 summaryCache）。
   */
  async getRoomSummary(roomId: string, throwOnError = true): Promise<RoomSummary | null> {
    try {
      const summary = await this.getClient()
        .getRoomSummaryManager()
        .getRoomSummary(roomId, undefined, true, throwOnError)
      if (!summary) {
        return null
      }
      logger.info(`[SynapseRust] 获取房间摘要成功: roomId=${roomId}`)
      return summary
    } catch (err) {
      logger.error(`[SynapseRust] 获取房间摘要失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return null
    }
  }

  /** 获取房间临时事件（SDK 未封装的 synapse-rust 扩展端点）。
   */
  async getRoomEphemeral(roomId: string, types?: string[]): Promise<RoomEphemeralEvent[]> {
    try {
      const path = `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/ephemeral`
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        logger.warn('[SynapseRust] 房间临时事件端点不可用')
        return []
      }

      const queryParams = types ? `?types=${types.map(encodeURIComponent).join(',')}` : ''
      const response = await this.request<{ chunk: RoomEphemeralEvent[] } | { data?: { chunk: RoomEphemeralEvent[] } }>(
        `${path}${queryParams}`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 获取房间临时事件成功: roomId=${roomId}`)
      return data?.chunk || []
    } catch (err) {
      logger.error(`[SynapseRust] 获取房间临时事件失败: ${err}`)
      return []
    }
  }
}

export const synapseRoomSummaryService = new SynapseRoomSummaryService()
