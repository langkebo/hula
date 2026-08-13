import { createLogger } from '@/utils/Logger'
import endpointCapabilityService from '../EndpointCapabilityService'
import { PREFIX_V3 } from '../paths'
import { SynapseExtensionHttpBase } from './SynapseExtensionHttpBase'

const logger = createLogger('SynapseRoomSummaryService')

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
  heroes: RoomSummaryMember[]
  stats: RoomSummaryStats
}

export interface RoomSummaryMember {
  user_id: string
  display_name?: string
  avatar_url?: string
  membership: string
  is_hero: boolean
}

export interface RoomSummaryStats {
  room_id: string
  total_events: number
  total_state_events?: number
  total_messages: number
  total_media: number
  storage_size: number
}

export interface RoomSummaryState {
  event_type: string
  state_key: string
  event_id: string
  content: Record<string, unknown>
}

export type RoomEphemeralEvent = Record<string, unknown>

/**
 * synapse-rust 房间摘要/临时事件扩展。
 * 从 SynapseRustExtensionsService 拆分而来。
 */
class SynapseRoomSummaryService extends SynapseExtensionHttpBase {
  /** 获取房间摘要
   */
  async getRoomSummary(roomId: string, throwOnError = true): Promise<RoomSummary | null> {
    try {
      const path = `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/summary`
      const available = await endpointCapabilityService.check('GET', path)
      if (!available) {
        logger.warn('[SynapseRust] 房间摘要端点不可用')
        return null
      }

      const response = await this.request<RoomSummary | { data?: RoomSummary }>(path, { method: 'GET' })
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 获取房间摘要成功: roomId=${roomId}`)
      return data || null
    } catch (err) {
      logger.error(`[SynapseRust] 获取房间摘要失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return null
    }
  }

  /** 获取房间摘要成员列表
   */
  async getRoomSummaryMembers(roomId: string, throwOnError = true): Promise<RoomSummaryMember[]> {
    try {
      const response = await this.request<RoomSummaryMember[] | { data?: RoomSummaryMember[] }>(
        `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/summary/members`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      const members = data || []
      logger.info(`[SynapseRust] 获取房间摘要成员成功: roomId=${roomId}, count=${members.length}`)
      return members
    } catch (err) {
      logger.error(`[SynapseRust] 获取房间摘要成员失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return []
    }
  }

  /** 获取房间摘要英雄成员
   */
  async getRoomSummaryHeroes(roomId: string, throwOnError = true): Promise<RoomSummaryMember[]> {
    const members = await this.getRoomSummaryMembers(roomId, throwOnError)
    const heroes = members.filter((member) => member.is_hero)
    logger.info(`[SynapseRust] 获取房间英雄成员成功: roomId=${roomId}, count=${heroes.length}`)
    return heroes
  }

  /** 获取房间摘要状态事件
   */
  async getRoomSummaryState(roomId: string, throwOnError = true): Promise<RoomSummaryState[]> {
    try {
      const response = await this.request<RoomSummaryState[] | { data?: RoomSummaryState[] }>(
        `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/summary/state`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      const state = data || []
      logger.info(`[SynapseRust] 获取房间摘要状态成功: roomId=${roomId}, count=${state.length}`)
      return state
    } catch (err) {
      logger.error(`[SynapseRust] 获取房间摘要状态失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return []
    }
  }

  /** 获取房间摘要统计数据
   */
  async getRoomSummaryStats(roomId: string, throwOnError = true): Promise<RoomSummaryStats | null> {
    try {
      const response = await this.request<RoomSummaryStats | { data?: RoomSummaryStats }>(
        `${PREFIX_V3}/rooms/${encodeURIComponent(roomId)}/summary/stats`,
        { method: 'GET' }
      )
      const data = this.unwrapMaybeWrappedData(response)
      logger.info(`[SynapseRust] 获取房间摘要统计成功: roomId=${roomId}`)
      return data || null
    } catch (err) {
      logger.error(`[SynapseRust] 获取房间摘要统计失败: ${err}`)
      if (throwOnError) {
        throw err
      }
      return null
    }
  }

  /** 获取房间临时事件
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
