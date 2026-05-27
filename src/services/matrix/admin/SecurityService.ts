import { error, info } from '@tauri-apps/plugin-log'
import type { FederationDestination } from './AdminTypes'

type SecurityDomainSdkGetter = () => Promise<unknown>

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

  private normalizeFeatureFlag(flag: Record<string, unknown>): AdminFeatureFlag {
    const targets = Array.isArray(flag.targets)
      ? flag.targets.map((target) => {
          const typedTarget = (target ?? {}) as Record<string, unknown>
          return {
            subjectType: String(typedTarget.subject_type ?? typedTarget.subjectType ?? ''),
            subjectId: String(typedTarget.subject_id ?? typedTarget.subjectId ?? '')
          }
        })
      : []

    const status = String(flag.status ?? (flag.enabled ? 'enabled' : 'disabled'))
    return {
      flagKey: String(flag.flag_key ?? flag.key ?? ''),
      enabled: typeof flag.enabled === 'boolean' ? flag.enabled : status === 'enabled',
      status,
      description: String(flag.description ?? flag.reason ?? ''),
      targetScope: String(flag.target_scope ?? flag.targetScope ?? 'global'),
      rolloutPercent: Number(flag.rollout_percent ?? flag.rolloutPercent ?? 0),
      expiresAt:
        typeof flag.expires_at === 'number' ? flag.expires_at : ((flag.expiresAt as number | null | undefined) ?? null),
      reason: String(flag.reason ?? ''),
      createdBy: String(flag.created_by ?? flag.createdBy ?? ''),
      createdTs: Number(flag.created_ts ?? flag.createdTs ?? 0),
      updatedTs: Number(flag.updated_ts ?? flag.updatedTs ?? 0),
      targets
    }
  }

  async getFederationDestinations(): Promise<FederationDestination[]> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getFederationDestinations(): Promise<Array<FederationDestinationSdk>>
      }
      const destinations = await admin.getFederationDestinations()
      return (destinations ?? []).map((destination) => this.mapFederationDestination(destination))
    } catch (err) {
      error(`[Admin] 获取联邦目的地失败: ${err}`)
      return []
    }
  }

  async getFederationDestination(destination: string): Promise<FederationDestination | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getFederationDestination(destination: string, throwOnError?: boolean): Promise<FederationDestinationSdk | null>
      }
      const result = await admin.getFederationDestination(destination)
      return result ? this.mapFederationDestination(result, destination) : null
    } catch (err) {
      error(`[Admin] 获取联邦目的地详情失败: ${err}`)
      return null
    }
  }

  async resetFederationConnection(destination: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        resetFederationConnection(destination: string): Promise<void>
      }
      await admin.resetFederationConnection(destination)
      info(`[Admin] 联邦连接已重置: ${destination}`)
    } catch (err) {
      error(`[Admin] 重置联邦连接失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        listAuditEvents(params: {
          actor_id?: string
          action?: string
          resource_type?: string
          resource_id?: string
          result?: string
          limit?: number
          from?: number
        }): Promise<{ events?: Array<Record<string, unknown>>; next_batch?: string }>
      }
      const params: {
        limit?: number
        from?: number
        actor_id?: string
        action?: string
      } = { limit }
      if (from !== undefined) {
        const n = Number(from)
        if (Number.isFinite(n)) params.from = n
      }
      if (userId) params.actor_id = userId
      if (eventType) params.action = eventType
      const result = await admin.listAuditEvents(params)
      return {
        logs: result?.events ?? [],
        next_batch: result?.next_batch
      }
    } catch (err) {
      error(`[Admin] 获取审计日志失败: ${err}`)
      return { logs: [] }
    }
  }

  async getSamlConfig(): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSamlConfig(): Promise<Record<string, unknown>>
      }
      return (await admin.getSamlConfig()) ?? {}
    } catch (err) {
      error(`[MatrixAdmin] 获取 SAML 配置失败: ${err}`)
      return {}
    }
  }

  async getSamlMetadata(): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSamlMetadata(): Promise<Record<string, unknown>>
      }
      return (await admin.getSamlMetadata()) ?? {}
    } catch (err) {
      error(`[MatrixAdmin] 获取 SAML 元数据失败: ${err}`)
      return {}
    }
  }

  async getSpMetadata(): Promise<Blob | string | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSpMetadata(): Promise<Blob | string>
      }
      return (await admin.getSpMetadata()) ?? null
    } catch (err) {
      error(`[MatrixAdmin] 获取 SP 元数据失败: ${err}`)
      return null
    }
  }

  async updateSamlConfig(config: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateSamlConfig(config: Record<string, unknown>): Promise<void>
      }
      await admin.updateSamlConfig(config)
      info('[MatrixAdmin] 更新 SAML 配置成功')
    } catch (err) {
      error(`[MatrixAdmin] 更新 SAML 配置失败: ${err}`)
      throw err
    }
  }

  async refreshIdpMetadata(): Promise<Record<string, unknown>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        refreshIdpMetadata(): Promise<Record<string, unknown>>
      }
      const metadata = await admin.refreshIdpMetadata()
      info('[MatrixAdmin] 刷新 SAML IdP 元数据成功')
      return metadata ?? {}
    } catch (err) {
      error(`[MatrixAdmin] 刷新 SAML IdP 元数据失败: ${err}`)
      throw err
    }
  }

  async listFeatureFlagsDetailed(): Promise<AdminFeatureFlag[]> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listFeatureFlags(params?: Record<string, string | number | undefined>): Promise<{
          flags?: Array<Record<string, unknown>>
          total?: number
        }>
      }

      const result = await admin.listFeatureFlags()
      return (result?.flags ?? []).map((flag) => this.normalizeFeatureFlag(flag))
    } catch (err) {
      error(`[Admin] 获取特性开关列表失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        getFeatureFlag(flagKey: string): Promise<Record<string, unknown>>
      }
      const result = await admin.getFeatureFlag(flagKey)
      return result ? this.normalizeFeatureFlag(result) : null
    } catch (err) {
      error(`[Admin] 获取特性开关详情失败: ${err}`)
      return null
    }
  }

  async saveFeatureFlag(input: AdminFeatureFlagInput): Promise<AdminFeatureFlag> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        setFeatureFlag(
          flagKey: string,
          targetScope: string,
          rolloutPercent: number,
          expiresAt: number | null,
          reason: string,
          targets: Array<{ subject_type: string; subject_id: string }>
        ): Promise<Record<string, unknown>>
      }
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
      error(`[Admin] 保存特性开关失败: ${err}`)
      throw err
    }
  }

  async setExperimentalFeature(feature: string, enabled: boolean): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateFeatureFlag(flagKey: string, patch: { status?: string }): Promise<unknown>
      }
      await admin.updateFeatureFlag(feature, { status: enabled ? 'enabled' : 'disabled' })
      info(`[Admin] 实验特性已${enabled ? '启用' : '禁用'}: ${feature}`)
    } catch (err) {
      error(`[Admin] 设置实验特性失败: ${err}`)
      throw err
    }
  }

  async deleteFeatureFlag(flagKey: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteFeatureFlag(flagKey: string): Promise<void>
      }
      await admin.deleteFeatureFlag(flagKey)
      info(`[Admin] 已删除特性开关: ${flagKey}`)
    } catch (err) {
      error(`[Admin] 删除特性开关失败: ${err}`)
      throw err
    }
  }

  async getBackups(): Promise<Array<Record<string, unknown>>> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listBackups(params?: { limit?: number; offset?: number }): Promise<{
          backups?: Array<Record<string, unknown>>
        }>
      }
      const result = await admin.listBackups()
      return result?.backups ?? []
    } catch (err) {
      error(`[Admin] 获取备份信息失败: ${err}`)
      return []
    }
  }

  async getFederationServerStatus(serverName: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getFederationDestination(destination: string, throwOnError?: boolean): Promise<Record<string, unknown> | null>
      }
      return (await admin.getFederationDestination(serverName, false)) ?? null
    } catch (err) {
      error(`[Admin] 获取联邦服务器状态失败: ${err}`)
      return null
    }
  }

  async reconnectFederation(serverName: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        resetFederationConnection(destination: string): Promise<void>
      }
      await admin.resetFederationConnection(serverName)
      info(`[Admin] 联邦连接已重连: ${serverName}`)
    } catch (err) {
      error(`[Admin] 重连联邦连接失败: ${err}`)
      throw err
    }
  }

  async getAuditEvent(eventId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getAuditEvent(eventId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getAuditEvent(eventId)) ?? null
    } catch (err) {
      error(`[Admin] 获取审计事件详情失败: ${err}`)
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
      const admin = (await this.sdkAdmin()) as unknown as {
        listSamlMappings(params: { limit?: number; from?: string }): Promise<{
          mappings: Array<Record<string, unknown>>
          next_token?: string
        }>
      }
      const result = await admin.listSamlMappings({ limit, from })
      return {
        mappings: result?.mappings ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取SAML映射失败: ${err}`)
      return { mappings: [] }
    }
  }

  async getSamlMapping(nameId: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getSamlMapping(nameId: string): Promise<Record<string, unknown>>
      }
      return (await admin.getSamlMapping(nameId)) ?? null
    } catch (err) {
      error(`[Admin] 获取SAML映射详情失败: ${err}`)
      return null
    }
  }

  async updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        updateSamlMapping(nameId: string, updates: Record<string, unknown>): Promise<void>
      }
      await admin.updateSamlMapping(nameId, updates)
      info(`[Admin] 更新SAML映射: ${nameId}`)
    } catch (err) {
      error(`[Admin] 更新SAML映射失败: ${err}`)
      throw err
    }
  }

  async deleteSamlMapping(nameId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        deleteSamlMapping(nameId: string): Promise<void>
      }
      await admin.deleteSamlMapping(nameId)
      info(`[Admin] 删除SAML映射: ${nameId}`)
    } catch (err) {
      error(`[Admin] 删除SAML映射失败: ${err}`)
      throw err
    }
  }

  async samlLogout(userId: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        samlLogout(userId: string): Promise<void>
      }
      await admin.samlLogout(userId)
      info(`[Admin] SAML登出: ${userId}`)
    } catch (err) {
      error(`[Admin] SAML登出失败: ${err}`)
      throw err
    }
  }

  async getSecurityEvents(
    limit = 100,
    from?: string,
    filters?: Record<string, unknown>
  ): Promise<{ events: Array<Record<string, unknown>>; nextToken?: string } | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listSecurityEvents(
          params: { limit?: number; from?: string } & Record<string, unknown>
        ): Promise<{ events?: Array<Record<string, unknown>>; next_token?: string }>
      }
      const params: { limit?: number; from?: string } & Record<string, unknown> = { limit }
      if (from) params.from = from
      if (filters) Object.assign(params, filters)
      const result = await admin.listSecurityEvents(params)
      return {
        events: result?.events ?? [],
        nextToken: result?.next_token
      }
    } catch (err) {
      error(`[Admin] 获取安全事件失败: ${err}`)
      return null
    }
  }

  async getIpBlocks(): Promise<Array<Record<string, unknown>> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        listIpBlocks(): Promise<Array<Record<string, unknown>>>
      }
      return (await admin.listIpBlocks()) ?? null
    } catch (err) {
      error(`[Admin] 获取IP封禁列表失败: ${err}`)
      return null
    }
  }

  async blockIp(
    ip: string,
    options?: { cidr?: number; expireAt?: number; reason?: string }
  ): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        blockIp(
          ip: string,
          options?: { cidr?: number; expire_at?: number; reason?: string }
        ): Promise<Record<string, unknown>>
      }
      const sdkOptions: { cidr?: number; expire_at?: number; reason?: string } = {}
      if (options?.cidr !== undefined) sdkOptions.cidr = options.cidr
      if (options?.expireAt !== undefined) sdkOptions.expire_at = options.expireAt
      if (options?.reason !== undefined) sdkOptions.reason = options.reason
      return (await admin.blockIp(ip, sdkOptions)) ?? null
    } catch (err) {
      error(`[Admin] 封禁IP失败: ${err}`)
      return null
    }
  }

  async unblockIp(ip: string): Promise<void> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        unblockIp(ip: string): Promise<void>
      }
      await admin.unblockIp(ip)
    } catch (err) {
      error(`[Admin] 解除IP封禁失败: ${err}`)
      throw err
    }
  }

  async getIpReputation(ip: string): Promise<Record<string, unknown> | null> {
    try {
      const admin = (await this.sdkAdmin()) as unknown as {
        getIpReputation(ip: string): Promise<Record<string, unknown>>
      }
      return (await admin.getIpReputation(ip)) ?? null
    } catch (err) {
      error(`[Admin] 获取IP声誉失败: ${err}`)
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
