import type { MatrixClient } from 'matrix-js-sdk'
import type { RoomRetentionPolicy, RetentionPolicy as SdkRetentionPolicy } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import type { RetentionPolicy, RoomRetention } from './AdminTypes'

const logger = createLogger('RetentionService')

type RetentionDomainSdkGetter = () => Promise<import('matrix-js-sdk/admin').AdminManager>
type GetClientGetter = () => MatrixClient

/**
 * 保留策略列表条目。
 *
 * `getRetentionPolicy()` 返回的是全局策略（无 `room_id`），列表渲染沿用房间策略的字段形态，
 * 故在 SDK `RetentionPolicy` 之上把 `room_id` 放宽为可选。
 */
export type RetentionPolicyListEntry = SdkRetentionPolicy & { room_id?: string }

/** 保留任务最近一次执行摘要（`GET /_synapse/admin/v1/retention/status` 的 `last_run`）。 */
export interface RetentionStatusLastRun {
  started_ts?: number
  completed_ts?: number
  duration_ms?: number
  expired_events_deleted?: number
  expired_beacons_deleted?: number
  expired_uploads_deleted?: number
  expired_audit_events_deleted?: number
  failed_tasks?: number
}

/** 保留策略运行状态。字段随 homeserver 版本扩展，界面按可选字段消费。 */
export interface RetentionStatusResponse {
  running?: boolean
  server_policy_enabled?: boolean
  rooms_with_custom_policy?: number
  lifecycle_cleanup_enabled?: boolean
  audit_retention_days?: number
  last_run?: RetentionStatusLastRun | null
}

export class AdminRetentionService {
  constructor(
    private readonly sdkAdmin: RetentionDomainSdkGetter,
    private readonly getClient?: GetClientGetter
  ) {}

  /**
   * 获取保留策略列表。
   * @returns 策略数组（服务端当前最多返回一条）与可选分页 token；失败时返回空列表。
   */
  async getRetentionPolicies(): Promise<{
    policies: RetentionPolicyListEntry[]
    nextToken?: string | undefined
  }> {
    try {
      const admin = await this.sdkAdmin()
      const policy = unknownToObject<SdkRetentionPolicy>(await admin.getRetentionPolicy())
      return {
        policies: policy ? [policy] : [],
        nextToken: undefined
      }
    } catch (err) {
      logger.error(`[AdminRetention] 获取保留策略列表失败: ${err}`)
      return { policies: [] }
    }
  }

  async getRetentionPolicy(roomId: string): Promise<RoomRetentionPolicy | null> {
    try {
      const admin = await this.sdkAdmin()
      const policy = await admin.getRoomRetentionPolicy(roomId)
      return unknownToObject<RoomRetentionPolicy>(policy)
    } catch (err) {
      logger.error(`[AdminRetention] 获取房间保留策略失败: ${err}`)
      return null
    }
  }

  async setRetentionPolicy(roomId: string, maxLifetime?: number, minLifetime?: number): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      const policy: { max_lifetime?: number; min_lifetime?: number } = {}
      if (maxLifetime !== undefined) policy.max_lifetime = maxLifetime
      if (minLifetime !== undefined) policy.min_lifetime = minLifetime
      await admin.setRoomRetentionPolicy(roomId, policy)
      logger.info(`[AdminRetention] 设置保留策略: ${roomId}`)
    } catch (err) {
      logger.error(`[AdminRetention] 设置保留策略失败: ${err}`)
      throw err
    }
  }

  async runRetentionTask(): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.runRetention()
      logger.info('[AdminRetention] 保留策略任务已启动')
    } catch (err) {
      logger.error(`[AdminRetention] 启动保留策略任务失败: ${err}`)
      throw err
    }
  }

  async getRetentionStatus(): Promise<RetentionStatusResponse> {
    try {
      const admin = await this.sdkAdmin()
      const status = await admin.getRetentionStatus()
      return unknownToObject<RetentionStatusResponse>(status) ?? {}
    } catch (err) {
      logger.error(`[AdminRetention] 获取保留策略状态失败: ${err}`)
      return {}
    }
  }

  // ==================== Client API Retention ====================

  async getRoomRetention(roomId: string): Promise<RoomRetention> {
    if (!this.getClient) throw new Error('[AdminRetention] getClient not provided')
    const client = this.getClient()
    try {
      const policy = await client.getStateEvent(roomId, 'm.room.retention', '')
      return {
        roomId,
        policy: policy
          ? {
              min_lifetime: policy.min_lifetime as number | undefined,
              max_lifetime: policy.max_lifetime as number | undefined
            }
          : undefined
      }
    } catch (err) {
      logger.error(`[AdminRetention] 获取保留策略失败: ${err}`)
      return { roomId }
    }
  }

  async setRoomRetention(roomId: string, policy: RetentionPolicy): Promise<void> {
    if (!this.getClient) throw new Error('[AdminRetention] getClient not provided')
    const client = this.getClient()
    try {
      await client.sendStateEvent(roomId, 'm.room.retention', policy, '')
      logger.info(`[AdminRetention] 设置保留策略成功: ${roomId}`)
    } catch (err) {
      logger.error(`[AdminRetention] 设置保留策略失败: ${err}`)
      throw err
    }
  }

  async deleteRoomRetention(roomId: string): Promise<void> {
    if (!this.getClient) throw new Error('[AdminRetention] getClient not provided')
    const client = this.getClient()
    try {
      // 保留策略是 `m.room.retention` **状态事件**：删除 = 写入空 content。
      // 旧代码调用幻影方法 `client.redact(roomId, '')`（相当于"撤回一个空 eventId"），
      // 既不存在也不表达"删除策略"的语义。
      await client.sendStateEvent(roomId, 'm.room.retention', {}, '')
      logger.info(`[AdminRetention] 删除保留策略成功: ${roomId}`)
    } catch (err) {
      logger.error(`[AdminRetention] 删除保留策略失败: ${err}`)
      throw err
    }
  }

  async getDefaultRetention(): Promise<RetentionPolicy | null> {
    if (!this.getClient) throw new Error('[AdminRetention] getClient not provided')
    const client = this.getClient()
    try {
      const config = await client.getServerRetention()
      return config || null
    } catch (err) {
      logger.error(`[AdminRetention] 获取默认保留策略失败: ${err}`)
      return null
    }
  }
}
