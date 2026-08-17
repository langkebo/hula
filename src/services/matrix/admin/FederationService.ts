import type { MatrixClient } from 'matrix-js-sdk'
import type { AdminManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { MATRIX_PATHS } from '../paths'
import type { FederationBlacklistEntry, FederationDestination } from './AdminTypes'

const logger = createLogger('FederationService')

type SdkAdminGetter = () => Promise<AdminManager>
type GetClientGetter = () => MatrixClient

export class AdminFederationService {
  constructor(
    private readonly sdkAdmin: SdkAdminGetter,
    private readonly getClient: GetClientGetter
  ) {}

  private async adminRequest<TResponse>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: Record<string, unknown>
  ): Promise<TResponse> {
    const client = this.getClient()
    return client.http.authedRequest(
      method,
      path,
      undefined,
      method === 'GET' || method === 'DELETE' ? undefined : body,
      { prefix: MATRIX_PATHS.ADMIN.SYNAPSE_ADMIN_BASE }
    ) as Promise<TResponse>
  }

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
      const items = await admin.getFederationBlacklist()
      return (items ?? []).map((item) => ({
        domain: item.server_name,
        reason: item.reason,
        addedBy: undefined,
        addedAt: item.added_ts
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

  async getFederationStatus(): Promise<Record<string, unknown>> {
    try {
      const response = await this.adminRequest<Record<string, unknown>>('GET', '/federation/status')
      logger.info('[AdminFederation] 获取联邦状态成功')
      return response
    } catch (err) {
      logger.error(`[AdminFederation] 获取联邦状态失败: ${err}`)
      return {}
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
