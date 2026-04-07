/**
 * 联邦黑名单服务
 * 管理 federation 级别的服务器黑名单
 */
import { matrixClientService } from './MatrixClientService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('FederationBlacklist')

export interface FederationBlacklistEntry {
  domain: string
  reason?: string
  addedBy: string
  addedAt: number
  expiresAt?: number
}

export interface AddToBlacklistParams {
  domain: string
  reason?: string
  expiresAt?: number
}

class MatrixFederationBlacklistService {
  private get client() {
    const c = matrixClientService.getClient()
    if (!c) throw new Error('Matrix client not initialized')
    return c
  }

  /**
   * 添加到黑名单
   */
  async add(params: AddToBlacklistParams): Promise<boolean> {
    try {
      await this.client.http.authedRequest({}, 'POST', '/_matrix/client/v1/admin/federation/blacklist', undefined, {
        body: JSON.stringify(params)
      })
      return true
    } catch (error) {
      logger.error('添加失败:', error)
      return false
    }
  }

  /**
   * 从黑名单移除
   */
  async remove(domain: string): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        {},
        'DELETE',
        `/_matrix/client/v1/admin/federation/blacklist/${encodeURIComponent(domain)}`,
        undefined
      )
      return true
    } catch (error) {
      logger.error('移除失败:', error)
      return false
    }
  }

  /**
   * 获取黑名单列表
   */
  async list(): Promise<FederationBlacklistEntry[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        '/_matrix/client/v1/admin/federation/blacklist',
        undefined
      )) as any
      return (response.entries || []).map(this.mapEntry)
    } catch (error) {
      logger.error('列表失败:', error)
      return []
    }
  }

  /**
   * 检查域名是否在黑名单中
   */
  async check(domain: string): Promise<boolean> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        `/_matrix/client/v1/admin/federation/blacklist/${encodeURIComponent(domain)}/check`,
        undefined
      )) as any
      return response.blacklisted || false
    } catch {
      return false
    }
  }

  /**
   * 批量导入黑名单
   */
  async importBatch(entries: AddToBlacklistParams[]): Promise<number> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'POST',
        '/_matrix/client/v1/admin/federation/blacklist/import',
        undefined,
        { body: JSON.stringify({ entries }) }
      )) as any
      return response.imported || 0
    } catch (error) {
      logger.error('批量导入失败:', error)
      return 0
    }
  }

  /**
   * 导出黑名单
   */
  async export(): Promise<AddToBlacklistParams[]> {
    try {
      const response = (await this.client.http.authedRequest(
        {},
        'GET',
        '/_matrix/client/v1/admin/federation/blacklist/export',
        undefined
      )) as any
      return response.entries || []
    } catch (error) {
      logger.error('导出失败:', error)
      return []
    }
  }

  private mapEntry(data: any): FederationBlacklistEntry {
    return {
      domain: data.domain,
      reason: data.reason,
      addedBy: data.added_by,
      addedAt: data.added_ts,
      expiresAt: data.expires_ts
    }
  }
}

export const matrixFederationBlacklistService = new MatrixFederationBlacklistService()
