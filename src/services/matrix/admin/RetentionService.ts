import { error, info, warn } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import type { RetentionPolicy, RoomRetention } from './AdminTypes'

type RetentionDomainSdkGetter = () => Promise<unknown>
type GetClientGetter = () => MatrixClient

export class AdminRetentionService {
  constructor(
    private readonly sdkAdmin: RetentionDomainSdkGetter,
    private readonly getClient?: GetClientGetter
  ) {}

  async getRetentionPolicies(
    _limit = 50,
    _from?: string
  ): Promise<{ policies: Array<Record<string, unknown>>; nextToken?: string }> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRetentionPolicy(): Promise<unknown>
      }
      const policy = await admin.getRetentionPolicy()
      return {
        policies: policy ? [policy as Record<string, unknown>] : [],
        nextToken: undefined
      }
    } catch (err) {
      error(`[AdminRetention] 获取保留策略列表失败: ${err}`)
      return { policies: [] }
    }
  }

  async getRetentionPolicy(roomId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRoomRetentionPolicy(roomId: string): Promise<unknown>
      }
      const policy = await admin.getRoomRetentionPolicy(roomId)
      return (policy as Record<string, unknown>) ?? null
    } catch (err) {
      error(`[AdminRetention] 获取房间保留策略失败: ${err}`)
      return null
    }
  }

  async setRetentionPolicy(roomId: string, maxLifetime?: number, minLifetime?: number): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setRoomRetentionPolicy(
          roomId: string,
          policy: { max_lifetime?: number; min_lifetime?: number }
        ): Promise<unknown>
      }
      const policy: { max_lifetime?: number; min_lifetime?: number } = {}
      if (maxLifetime !== undefined) policy.max_lifetime = maxLifetime
      if (minLifetime !== undefined) policy.min_lifetime = minLifetime
      await admin.setRoomRetentionPolicy(roomId, policy)
      info(`[AdminRetention] 设置保留策略: ${roomId}`)
    } catch (err) {
      error(`[AdminRetention] 设置保留策略失败: ${err}`)
      throw err
    }
  }

  async deleteRetentionPolicy(_roomId: string): Promise<void> {
    warn('[AdminRetention] deleteRetentionPolicy: backend does not support deleting a retention policy; no-op.')
  }

  async runRetentionTask(): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        runRetention(roomId?: string): Promise<unknown>
      }
      await admin.runRetention()
      info('[AdminRetention] 保留策略任务已启动')
    } catch (err) {
      error(`[AdminRetention] 启动保留策略任务失败: ${err}`)
      throw err
    }
  }

  async getRetentionStatus(): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getRetentionStatus(): Promise<unknown>
      }
      const status = await admin.getRetentionStatus()
      return (status as Record<string, unknown>) ?? {}
    } catch (err) {
      error(`[AdminRetention] 获取保留策略状态失败: ${err}`)
      return {}
    }
  }

  // ==================== Client API Retention ====================

  async getRoomRetention(roomId: string): Promise<RoomRetention> {
    if (!this.getClient) throw new Error('[AdminRetention] getClient not provided')
    const client = this.getClient()
    try {
      const policy = await client.getRoomStateEvent(roomId, 'm.room.retention', '')
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
      error(`[AdminRetention] 获取保留策略失败: ${err}`)
      return { roomId }
    }
  }

  async setRoomRetention(roomId: string, policy: RetentionPolicy): Promise<void> {
    if (!this.getClient) throw new Error('[AdminRetention] getClient not provided')
    const client = this.getClient()
    try {
      await client.sendStateEvent(roomId, 'm.room.retention', policy, '')
      info(`[AdminRetention] 设置保留策略成功: ${roomId}`)
    } catch (err) {
      error(`[AdminRetention] 设置保留策略失败: ${err}`)
      throw err
    }
  }

  async deleteRoomRetention(roomId: string): Promise<void> {
    if (!this.getClient) throw new Error('[AdminRetention] getClient not provided')
    const client = this.getClient()
    try {
      await client.redact(roomId, '')
      info(`[AdminRetention] 删除保留策略成功: ${roomId}`)
    } catch (err) {
      error(`[AdminRetention] 删除保留策略失败: ${err}`)
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
      error(`[AdminRetention] 获取默认保留策略失败: ${err}`)
      return null
    }
  }
}
