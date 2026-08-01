import type { FeatureFlag } from 'matrix-js-sdk/admin'
import { createLogger } from '@/utils/Logger'
import type { FederationDestination } from './AdminTypes'

const logger = createLogger('SecurityService')

type SecurityDomainSdkGetter = () => Promise<import('matrix-js-sdk/admin').AdminManager>

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

export class AdminSecurityService {
  constructor(private readonly sdkAdmin: SecurityDomainSdkGetter) {}

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
    limit = 50,
    from?: string,
    userId?: string,
    eventType?: string
  ): Promise<{
    logs: Array<Record<string, unknown>>
    next_batch?: string
  }> {
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
        logs: (result?.events ?? []).map((e) => ({ ...e }) as Record<string, unknown>),
        next_batch: result?.next_token != null ? String(result.next_token) : undefined
      }
    } catch (err) {
      logger.error(`[Admin] 获取审计日志失败: ${err}`)
      return { logs: [] }
    }
  }

  async getSamlConfig(): Promise<Record<string, unknown>> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      return (await (admin as any).getSamlConfig()) ?? {}
    } catch (err) {
      logger.error(`[MatrixAdmin] 获取 SAML 配置失败: ${err}`)
      return {}
    }
  }

  async getSamlMetadata(): Promise<Record<string, unknown>> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      return (await (admin as any).getSamlMetadata()) ?? {}
    } catch (err) {
      logger.error(`[MatrixAdmin] 获取 SAML 元数据失败: ${err}`)
      return {}
    }
  }

  async getSpMetadata(): Promise<Blob | string | null> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      return (await (admin as any).getSpMetadata()) ?? null
    } catch (err) {
      logger.error(`[MatrixAdmin] 获取 SP 元数据失败: ${err}`)
      return null
    }
  }

  async updateSamlConfig(config: Record<string, unknown>): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      await (admin as any).updateSamlConfig(config)
      logger.info('[MatrixAdmin] 更新 SAML 配置成功')
    } catch (err) {
      logger.error(`[MatrixAdmin] 更新 SAML 配置失败: ${err}`)
      throw err
    }
  }

  async refreshIdpMetadata(): Promise<Record<string, unknown>> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      const metadata = await (admin as any).refreshIdpMetadata()
      logger.info('[MatrixAdmin] 刷新 SAML IdP 元数据成功')
      return metadata ?? {}
    } catch (err) {
      logger.error(`[MatrixAdmin] 刷新 SAML IdP 元数据失败: ${err}`)
      throw err
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

  async getExperimentalFeatures(): Promise<Record<string, unknown>> {
    const flags = await this.listFeatureFlagsDetailed()
    const out: Record<string, unknown> = {}
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

  async getBackups(): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.listBackups()
      return (result?.backups ?? []) as Array<Record<string, unknown>>
    } catch (err) {
      logger.error(`[Admin] 获取备份信息失败: ${err}`)
      return []
    }
  }

  async getFederationServerStatus(serverName: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getFederationDestination(serverName, false)
      return (result as Record<string, unknown>) ?? null
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

  async getAuditEvent(eventId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getAuditEvent(eventId)
      return result ? ({ ...result } as Record<string, unknown>) : null
    } catch (err) {
      logger.error(`[Admin] 获取审计事件详情失败: ${err}`)
      return null
    }
  }

  async getSamlMappings(
    limit = 50,
    from?: string
  ): Promise<{
    mappings: Array<Record<string, unknown>>
    nextToken?: string
  }> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      const result = await (admin as any).listSamlMappings({ limit, from })
      return {
        mappings: result?.mappings ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      logger.error(`[Admin] 获取SAML映射失败: ${err}`)
      return { mappings: [] }
    }
  }

  async getSamlMapping(nameId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      return (await (admin as any).getSamlMapping(nameId)) ?? null
    } catch (err) {
      logger.error(`[Admin] 获取SAML映射详情失败: ${err}`)
      return null
    }
  }

  async updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      await (admin as any).updateSamlMapping(nameId, updates)
      logger.info(`[Admin] 更新SAML映射: ${nameId}`)
    } catch (err) {
      logger.error(`[Admin] 更新SAML映射失败: ${err}`)
      throw err
    }
  }

  async deleteSamlMapping(nameId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      await (admin as any).deleteSamlMapping(nameId)
      logger.info(`[Admin] 删除SAML映射: ${nameId}`)
    } catch (err) {
      logger.error(`[Admin] 删除SAML映射失败: ${err}`)
      throw err
    }
  }

  async samlLogout(userId: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      await (admin as any).samlLogout(userId)
      logger.info(`[Admin] SAML登出: ${userId}`)
    } catch (err) {
      logger.error(`[Admin] SAML登出失败: ${err}`)
      throw err
    }
  }

  async getSecurityEvents(
    limit = 100,
    from?: string,
    filters?: Record<string, unknown>
  ): Promise<{ events: Array<Record<string, unknown>>; nextToken?: string } | null> {
    try {
      const admin = await this.sdkAdmin()
      const params: Record<string, unknown> = { limit }
      if (from) params.from = from
      if (filters) Object.assign(params, filters)
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      const result = await (admin as any).listSecurityEvents(params)
      return {
        events: result?.events ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      logger.error(`[Admin] 获取安全事件失败: ${err}`)
      return null
    }
  }

  async getIpBlocks(): Promise<Array<Record<string, unknown>> | null> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      return (await (admin as any).listIpBlocks()) ?? null
    } catch (err) {
      logger.error(`[Admin] 获取IP封禁列表失败: ${err}`)
      return null
    }
  }

  async blockIp(
    ip: string,
    options?: { cidr?: number; expireAt?: number; reason?: string }
  ): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      const sdkOptions: { cidr?: number; expire_at?: number; reason?: string } = {}
      if (options?.cidr !== undefined) sdkOptions.cidr = options.cidr
      if (options?.expireAt !== undefined) sdkOptions.expire_at = options.expireAt
      if (options?.reason !== undefined) sdkOptions.reason = options.reason
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      return (await (admin as any).blockIp(ip, sdkOptions)) ?? null
    } catch (err) {
      logger.error(`[Admin] 封禁IP失败: ${err}`)
      return null
    }
  }

  async unblockIp(ip: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      await (admin as any).unblockIp(ip)
    } catch (err) {
      logger.error(`[Admin] 解除IP封禁失败: ${err}`)
      throw err
    }
  }

  async getIpReputation(ip: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = await this.sdkAdmin()
      // biome-ignore lint/suspicious/noExplicitAny: SDK AdminManager lacks type definitions for synapse-rust extensions
      return (await (admin as any).getIpReputation(ip)) ?? null
    } catch (err) {
      logger.error(`[Admin] 获取IP声誉失败: ${err}`)
      return null
    }
  }

  private mapFederationDestination(
    destination: FederationDestinationSdk,
    fallbackDestination = ''
  ): FederationDestination {
    return {
      destination: destination.destination || fallbackDestination,
      retryLastTs: destination.retry_last_ts,
      retryInterval: destination.retry_interval,
      failureTs: destination.failure_ts,
      lastSuccessfulStreamOrdering: destination.last_successful_stream_ordering
    }
  }
}

type FederationDestinationSdk = {
  destination?: string
  retry_last_ts?: number
  retry_interval?: number
  failure_ts?: number
  last_successful_stream_ordering?: number
}
