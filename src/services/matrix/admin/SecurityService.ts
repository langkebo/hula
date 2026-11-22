import type { FeatureFlag, FederationDestination as SdkFederationDestination } from 'matrix-js-sdk/admin'
import { DEFAULT_PAGE_LIMIT, LARGE_PAGE_LIMIT } from '@/common/constants'
import { createLogger } from '@/utils/Logger'
import { unknownToObject } from '@/utils/typeGuard'
import type {
  AdminAuditLogEntry,
  AdminAuditLogPage,
  AdminFederationServerStatus,
  AdminIpBlock,
  AdminIpReputation,
  AdminSecurityEventsPage,
  FederationDestination
} from './AdminTypes'
import { AdminSamlMethods } from './SecuritySamlMethods'

const logger = createLogger('SecurityService')

type SecurityDomainSdkGetter = () => Promise<import('matrix-js-sdk/admin').AdminManager>

/**
 * 安全事件查询参数。
 *
 * `limit` / `from` 为分页字段，其余键是后端审计接口的过滤条件（`event`、`user_id`、`room_id` 等），
 * 键集合随版本扩展，故保留索引签名。
 */
export interface SecurityEventQuery {
  limit?: number
  from?: string
  [filter: string]: unknown
}

export interface AdminFeatureFlagTarget {
  subjectType: string
  subjectId: string
}

export interface AdminFeatureFlag {
  flagKey: string
  enabled: boolean
  status: string
  description: string
  targetScope: string
  rolloutPercent: number
  expiresAt: number | null
  reason: string
  createdBy: string
  createdTs: number
  updatedTs: number
  targets: AdminFeatureFlagTarget[]
}

export interface AdminFeatureFlagInput {
  flagKey: string
  targetScope: string
  rolloutPercent: number
  expiresAt?: number | null
  reason?: string
  targets?: AdminFeatureFlagTarget[]
}

export type { SamlConfigResponse, SamlMetadataResponse } from './SecuritySamlMethods'

/** `getExperimentalFeatures` 中单个实验性开关的摘要。 */
export interface ExperimentalFeatureInfo {
  enabled: boolean
  status: string
  description: string
  targetScope: string
  rolloutPercent: number
  reason: string
  expiresAt: number | null
  updatedTs: number
  createdTs: number
  targets: AdminFeatureFlagTarget[]
}

/** 实验性功能键值映射，键为开关 key（如 `msc1234`）。 */
export interface ExperimentalFeaturesResponse {
  [flagKey: string]: ExperimentalFeatureInfo
}

export class AdminSecurityService extends AdminSamlMethods {
  protected readonly sdkAdmin: SecurityDomainSdkGetter

  constructor(sdkAdmin: SecurityDomainSdkGetter) {
    super()
    this.sdkAdmin = sdkAdmin
  }

  private normalizeFeatureFlag(flag: FeatureFlag): AdminFeatureFlag {
    const targets = Array.isArray(flag.targets)
      ? flag.targets.map((target) => {
          return {
            subjectType: target.subject_type ?? '',
            subjectId: target.subject_id ?? ''
          }
        })
      : []

    const status = String(flag.status ?? 'disabled')
    return {
      flagKey: String(flag.flag_key ?? ''),
      enabled: status === 'enabled',
      status,
      description: String(flag.reason ?? ''),
      targetScope: String(flag.target_scope ?? 'global'),
      rolloutPercent: Number(flag.rollout_percent ?? 0),
      expiresAt: flag.expires_at ?? null,
      reason: String(flag.reason ?? ''),
      createdBy: String(flag.created_by ?? ''),
      createdTs: Number(flag.created_ts ?? 0),
      updatedTs: Number(flag.updated_ts ?? 0),
      targets
    }
  }

  async getFederationDestinations(): Promise<FederationDestination[]> {
    try {
      const admin = await this.sdkAdmin()
      const destinations = await admin.getFederationDestinations()
      return (destinations ?? []).map((destination) => this.mapFederationDestination(destination))
    } catch (err) {
      logger.error(`[Admin] 获取联邦目的地失败: ${err}`)
      return []
    }
  }

  async getFederationDestination(destination: string): Promise<FederationDestination | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getFederationDestination(destination)
      return result ? this.mapFederationDestination(result, destination) : null
    } catch (err) {
      logger.error(`[Admin] 获取联邦目的地详情失败: ${err}`)
      return null
    }
  }

  async resetFederationConnection(destination: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.resetFederationConnection(destination)
      logger.info(`[Admin] 联邦连接已重置: ${destination}`)
    } catch (err) {
      logger.error(`[Admin] 重置联邦连接失败: ${err}`)
      throw err
    }
  }

  async getAuditLog(
    limit = DEFAULT_PAGE_LIMIT,
    from?: string,
    userId?: string,
    eventType?: string
  ): Promise<AdminAuditLogPage> {
    try {
      const admin = await this.sdkAdmin()
      const params: Record<string, string | number | undefined> = { limit }
      if (from !== undefined) {
        const n = Number(from)
        if (Number.isFinite(n)) params.from = n
      }
      if (userId) params.actor_id = userId
      if (eventType) params.action = eventType
      const result = await admin.listAuditEvents(params)
      return {
        logs: (result?.events ?? []).map((e) => unknownToObject<AdminAuditLogEntry>(e) ?? {}),
        next_batch: result?.next_batch != null ? String(result.next_batch) : undefined
      }
    } catch (err) {
      logger.error(`[Admin] 获取审计日志失败: ${err}`)
      return { logs: [] }
    }
  }

  async listFeatureFlagsDetailed(): Promise<AdminFeatureFlag[]> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listFeatureFlags()
      return (result?.flags ?? []).map((flag) => this.normalizeFeatureFlag(flag))
    } catch (err) {
      logger.error(`[Admin] 获取特性开关列表失败: ${err}`)
      return []
    }
  }

  async getExperimentalFeatures(): Promise<ExperimentalFeaturesResponse> {
    const flags = await this.listFeatureFlagsDetailed()
    const out: ExperimentalFeaturesResponse = {}
    for (const flag of flags) {
      out[flag.flagKey] = {
        enabled: flag.enabled,
        status: flag.status,
        description: flag.description,
        targetScope: flag.targetScope,
        rolloutPercent: flag.rolloutPercent,
        reason: flag.reason,
        expiresAt: flag.expiresAt,
        updatedTs: flag.updatedTs,
        createdTs: flag.createdTs,
        targets: flag.targets
      }
    }
    return out
  }

  async getFeatureFlagDetail(flagKey: string): Promise<AdminFeatureFlag | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getFeatureFlag(flagKey)
      return result ? this.normalizeFeatureFlag(result) : null
    } catch (err) {
      logger.error(`[Admin] 获取特性开关详情失败: ${err}`)
      return null
    }
  }

  async saveFeatureFlag(input: AdminFeatureFlagInput): Promise<AdminFeatureFlag> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.setFeatureFlag(
        input.flagKey,
        input.targetScope,
        input.rolloutPercent,
        input.expiresAt ?? null,
        input.reason ?? '',
        (input.targets ?? []).map((target) => ({
          subject_type: target.subjectType,
          subject_id: target.subjectId
        }))
      )
      return this.normalizeFeatureFlag(result)
    } catch (err) {
      logger.error(`[Admin] 保存特性开关失败: ${err}`)
      throw err
    }
  }

  async setExperimentalFeature(feature: string, enabled: boolean): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.updateFeatureFlag(feature, { status: enabled ? 'enabled' : 'disabled' })
      logger.info(`[Admin] 实验特性已${enabled ? '启用' : '禁用'}: ${feature}`)
    } catch (err) {
      logger.error(`[Admin] 设置实验特性失败: ${err}`)
      throw err
    }
  }

  async deleteFeatureFlag(flagKey: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteFeatureFlag(flagKey)
      logger.info(`[Admin] 已删除特性开关: ${flagKey}`)
    } catch (err) {
      logger.error(`[Admin] 删除特性开关失败: ${err}`)
      throw err
    }
  }

  async getFederationServerStatus(serverName: string): Promise<AdminFederationServerStatus | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getFederationDestination(serverName, false)
      return unknownToObject<AdminFederationServerStatus>(result)
    } catch (err) {
      logger.error(`[Admin] 获取联邦服务器状态失败: ${err}`)
      return null
    }
  }

  async reconnectFederation(serverName: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.resetFederationConnection(serverName)
      logger.info(`[Admin] 联邦连接已重连: ${serverName}`)
    } catch (err) {
      logger.error(`[Admin] 重连联邦连接失败: ${err}`)
      throw err
    }
  }

  async getAuditEvent(eventId: string): Promise<AdminAuditLogEntry | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getAuditEvent(eventId)
      return unknownToObject<AdminAuditLogEntry>(result)
    } catch (err) {
      logger.error(`[Admin] 获取审计事件详情失败: ${err}`)
      return null
    }
  }

  async getSecurityEvents(
    limit = LARGE_PAGE_LIMIT,
    from?: string,
    filters?: SecurityEventQuery
  ): Promise<AdminSecurityEventsPage | null> {
    try {
      const admin = await this.sdkAdmin()
      const params: SecurityEventQuery = { limit }
      if (from) params.from = from
      if (filters) Object.assign(params, filters)
      const result = await admin.listSecurityEvents(params)
      return {
        events: result?.events ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      logger.error(`[Admin] 获取安全事件失败: ${err}`)
      return null
    }
  }

  async getIpBlocks(): Promise<AdminIpBlock[] | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.listIpBlocks()) ?? null
    } catch (err) {
      logger.error(`[Admin] 获取IP封禁列表失败: ${err}`)
      return null
    }
  }

  async blockIp(
    ip: string,
    options?: { cidr?: number; expireAt?: number; reason?: string }
  ): Promise<AdminIpBlock | null> {
    try {
      const admin = await this.sdkAdmin()
      const sdkOptions: { cidr?: number; expire_at?: number; reason?: string } = {}
      if (options?.cidr !== undefined) sdkOptions.cidr = options.cidr
      if (options?.expireAt !== undefined) sdkOptions.expire_at = options.expireAt
      if (options?.reason !== undefined) sdkOptions.reason = options.reason
      return (await admin.blockIp(ip, sdkOptions)) ?? null
    } catch (err) {
      logger.error(`[Admin] 封禁IP失败: ${err}`)
      return null
    }
  }

  async unblockIp(ip: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.unblockIp(ip)
    } catch (err) {
      logger.error(`[Admin] 解除IP封禁失败: ${err}`)
      throw err
    }
  }

  async getIpReputation(ip: string): Promise<AdminIpReputation | null> {
    try {
      const admin = await this.sdkAdmin()
      return (await admin.getIpReputation(ip)) ?? null
    } catch (err) {
      logger.error(`[Admin] 获取IP声誉失败: ${err}`)
      return null
    }
  }

  private mapFederationDestination(
    destination: SdkFederationDestination,
    fallbackDestination = ''
  ): FederationDestination {
    return {
      destination: destination.destination || fallbackDestination,
      retryLastTs: destination.retry_last_ts ?? undefined,
      retryInterval: destination.retry_interval ?? undefined,
      failureTs: destination.failure_ts ?? undefined,
      lastSuccessfulTs: destination.last_successful_ts ?? undefined
    }
  }
}
