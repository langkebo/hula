import type {
  AdminFederationCache,
  AdminManager,
  PendingFederationList,
  SdkFederationDestination
} from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type {
  FederationBlacklistEntry,
  FederationCachePage,
  FederationDestination,
  PendingFederationPage
} from './AdminTypes'

const logger = createLogger('FederationService')

type SdkAdminGetter = () => Promise<AdminManager>

export class AdminFederationService {
  constructor(private readonly sdkAdmin: SdkAdminGetter) {}

  async getFederationDestinations(): Promise<FederationDestination[]> {
    try {
      const admin = await this.sdkAdmin()
      const destinations = await admin.getFederationDestinations()
      return (destinations ?? []).map((d) => this.mapFederationDestination(d))
    } catch (err) {
      logger.error(`[AdminFederation] 获取联邦目的地失败: ${err}`)
      return []
    }
  }

  async getFederationDestination(destination: string): Promise<FederationDestination | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.getFederationDestination(destination)
      return result ? this.mapFederationDestination(result, destination) : null
    } catch (err) {
      logger.error(`[AdminFederation] 获取联邦目的地详情失败: ${err}`)
      return null
    }
  }

  async resetFederationConnection(destination: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.resetFederationConnection(destination)
      logger.info(`[AdminFederation] 联邦连接已重置: ${destination}`)
    } catch (err) {
      logger.error(`[AdminFederation] 重置联邦连接失败: ${err}`)
      throw err
    }
  }

  async getFederationBlacklist(): Promise<FederationBlacklistEntry[]> {
    try {
      const admin = await this.sdkAdmin()
      const page = await admin.getFederationBlacklist()
      return (page?.blacklist ?? []).map((item) => ({
        domain: item.server_name,
        reason: item.reason ?? undefined,
        addedBy: undefined,
        addedAt: item.added_at
      }))
    } catch (err) {
      logger.error(`[AdminFederation] 获取联邦黑名单失败: ${err}`)
      return []
    }
  }

  async addToFederationBlacklist(domain: string, reason?: string): Promise<boolean> {
    try {
      const admin = await this.sdkAdmin()
      await admin.addToFederationBlacklist(domain, reason)
      logger.info(`[AdminFederation] 添加联邦黑名单成功: ${domain}`)
      return true
    } catch (err) {
      logger.error(`[AdminFederation] 添加联邦黑名单失败: ${err}`)
      return false
    }
  }

  async removeFromFederationBlacklist(domain: string): Promise<boolean> {
    try {
      const admin = await this.sdkAdmin()
      await admin.removeFromFederationBlacklist(domain)
      logger.info(`[AdminFederation] 删除联邦黑名单成功: ${domain}`)
      return true
    } catch (err) {
      logger.error(`[AdminFederation] 删除联邦黑名单失败: ${err}`)
      return false
    }
  }

  /** 获取联邦出站缓存条目（失败降级为空页，不阻断页面渲染）。 */
  async getFederationCache(): Promise<FederationCachePage> {
    try {
      const admin = await this.sdkAdmin()
      const page = await admin.getFederationCache()
      return this.mapFederationCache(page)
    } catch (err) {
      logger.error(`[AdminFederation] 获取联邦缓存失败: ${err}`)
      return { entries: [], total: 0 }
    }
  }

  /** 清空全部联邦出站缓存（写操作，失败向上抛出供 UI 提示）。 */
  async clearFederationCache(): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.clearFederationCache()
      logger.info('[AdminFederation] 联邦缓存已清空')
    } catch (err) {
      logger.error(`[AdminFederation] 清空联邦缓存失败: ${err}`)
      throw err
    }
  }

  /** 删除单条联邦缓存条目（写操作，失败向上抛出）。 */
  async deleteFederationCacheEntry(key: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteFederationCacheEntry(key)
      logger.info(`[AdminFederation] 联邦缓存条目已删除: ${key}`)
    } catch (err) {
      logger.error(`[AdminFederation] 删除联邦缓存条目失败: ${err}`)
      throw err
    }
  }

  /** 分页获取待确认的联邦服务器（失败降级为空页）。 */
  async getPendingFederationServers(from?: string, limit?: number): Promise<PendingFederationPage> {
    try {
      const admin = await this.sdkAdmin()
      const page = await admin.getPendingFederationServers(from, limit)
      return this.mapPendingFederationPage(page)
    } catch (err) {
      logger.error(`[AdminFederation] 获取待确认联邦服务器失败: ${err}`)
      return { servers: [], total: 0, limit: limit ?? 0 }
    }
  }

  /** 确认或拒绝待确认的联邦服务器（写操作，失败向上抛出）。 */
  async confirmFederation(serverName: string, accept: boolean): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.confirmFederation(serverName, accept)
      logger.info(`[AdminFederation] 待确认服务器已处理: ${serverName} accept=${accept}`)
    } catch (err) {
      logger.error(`[AdminFederation] 处理待确认联邦服务器失败: ${err}`)
      throw err
    }
  }

  private mapFederationCache(page: AdminFederationCache | null | undefined): FederationCachePage {
    return {
      entries: (page?.cache ?? []).map((entry) => ({
        key: entry.key,
        value: entry.value,
        expiryTs: entry.expiry_ts ?? null
      })),
      total: page?.total ?? 0
    }
  }

  private mapPendingFederationPage(page: PendingFederationList | null | undefined): PendingFederationPage {
    return {
      servers: (page?.servers ?? []).map((server) => ({
        serverName: server.server_name,
        failureCount: server.failure_count,
        lastFailedConnectAt: server.last_failed_connect_at ?? null,
        lastSuccessfulConnectAt: server.last_successful_connect_at ?? null,
        status: server.status,
        updatedTs: server.updated_ts ?? null
      })),
      total: page?.total ?? 0,
      limit: page?.limit ?? 0,
      nextBatch: page?.next_batch ?? undefined
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
      lastSuccessfulTs: destination.last_successful_ts ?? undefined,
      failureCount: destination.failure_count ?? undefined,
      status: destination.status ?? undefined,
      updatedTs: destination.updated_ts ?? undefined
    }
  }
}
