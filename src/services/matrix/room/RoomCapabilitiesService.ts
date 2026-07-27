import { createLogger } from '@/utils/Logger'
import { matrixHttpClient } from '../MatrixHttpClient'
import { MatrixRequestDeduper } from '../MatrixRequestDeduper'

const logger = createLogger('RoomCapabilitiesService')

/**
 * 契约: GET /_matrix/client/v3/rooms/{room_id}/capabilities
 * 顶层稳定字段 - room_id, room_version, capabilities, features, join_rule
 * capabilities 稳定字段 - knock, restricted, threading, read_receipts, typing_notifications
 * features 稳定字段 - encryption, federation, guest_access
 */
interface RoomCapabilitiesPayload {
  room_id: string
  room_version?: string
  capabilities?: Record<string, { enabled?: boolean }>
  features?: Record<string, { enabled?: boolean }>
  join_rule?: string
}

interface CacheEntry {
  payload: RoomCapabilitiesPayload
  expiresAt: number
}

const CAPABILITY_TTL_MS = 5 * 60 * 1000

const STABLE_CAPABILITIES = ['knock', 'restricted', 'threading', 'read_receipts', 'typing_notifications'] as const

const STABLE_FEATURES = ['encryption', 'federation', 'guest_access'] as const

type StableRoomCapabilityName = (typeof STABLE_CAPABILITIES)[number]
type StableRoomFeatureName = (typeof STABLE_FEATURES)[number]

class RoomCapabilitiesService {
  private cache = new Map<string, CacheEntry>()

  /**
   * 获取房间能力, 默认 5 分钟缓存; force=true 时绕过缓存重新拉取
   */
  async fetch(roomId: string, options: { force?: boolean } = {}): Promise<RoomCapabilitiesPayload | null> {
    if (!roomId) return null

    if (!options.force) {
      const cached = this.cache.get(roomId)
      if (cached && cached.expiresAt > Date.now()) {
        return cached.payload
      }
    }

    return MatrixRequestDeduper.dedupe(`room-capabilities:${roomId}`, async () => {
      const path = matrixHttpClient.buildRoomPath(roomId, 'capabilities')
      const result = await matrixHttpClient.get<RoomCapabilitiesPayload>(path, {
        logPrefix: 'RoomCapabilities'
      })
      if (!result) {
        logger.info(`[RoomCapabilities] ${roomId} 拉取失败, 沿用既有缓存`)
        return this.cache.get(roomId)?.payload ?? null
      }
      const payload: RoomCapabilitiesPayload = {
        room_id: result.room_id ?? roomId,
        room_version: result.room_version,
        capabilities: result.capabilities ?? {},
        features: result.features ?? {},
        join_rule: result.join_rule
      }
      this.cache.set(roomId, { payload, expiresAt: Date.now() + CAPABILITY_TTL_MS })
      return payload
    })
  }

  /**
   * 同步读取已缓存的结果, 不发起请求
   */
  peek(roomId: string): RoomCapabilitiesPayload | null {
    const cached = this.cache.get(roomId)
    if (!cached) return null
    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(roomId)
      return null
    }
    return cached.payload
  }

  /**
   * 是否启用某项稳定 capability; 缺失时默认 true(即未声明禁用即视为可用)
   */
  isCapabilityEnabled(payload: RoomCapabilitiesPayload | null | undefined, name: StableRoomCapabilityName): boolean {
    if (!payload?.capabilities) return true
    const entry = payload.capabilities[name]
    if (!entry) return true
    return entry.enabled !== false
  }

  isFeatureEnabled(payload: RoomCapabilitiesPayload | null | undefined, name: StableRoomFeatureName): boolean {
    if (!payload?.features) return true
    const entry = payload.features[name]
    if (!entry) return true
    return entry.enabled !== false
  }

  invalidate(roomId?: string): void {
    if (roomId) {
      this.cache.delete(roomId)
      return
    }
    this.cache.clear()
  }

  /** 仅供测试; 不要在业务代码中调用 */
  __test__setCache(roomId: string, payload: RoomCapabilitiesPayload, ttlMs: number = CAPABILITY_TTL_MS): void {
    this.cache.set(roomId, { payload, expiresAt: Date.now() + ttlMs })
  }
}

export const roomCapabilitiesService = new RoomCapabilitiesService()
export const ROOM_CAPABILITY_NAMES = STABLE_CAPABILITIES
const _ROOM_FEATURE_NAMES = STABLE_FEATURES

// 测试 / 诊断辅助导出
export const __ROOM_CAPABILITIES_TTL_MS__ = CAPABILITY_TTL_MS
