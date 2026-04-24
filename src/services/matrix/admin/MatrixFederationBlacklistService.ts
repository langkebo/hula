import type { MatrixClient } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface FederationBlacklistEntry {
  domain: string
  reason?: string
  addedBy?: string
  addedAt?: number
}

export interface AddFederationBlacklistPayload {
  domain: string
  reason?: string
}

interface FederationBlacklistListResponse {
  blacklist?: unknown[]
  servers?: unknown[]
}

class MatrixFederationBlacklistService {
  private getClient(): MatrixClient {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('客户端未初始化')
    }
    return client
  }

  private toEntry(value: unknown): FederationBlacklistEntry | null {
    if (typeof value !== 'object' || value === null) {
      return null
    }

    const record = value as Record<string, unknown>
    const domain =
      typeof record.domain === 'string'
        ? record.domain
        : typeof record.server_name === 'string'
          ? record.server_name
          : null

    if (!domain) {
      return null
    }

    return {
      domain,
      reason: typeof record.reason === 'string' ? record.reason : undefined,
      addedBy: typeof record.added_by === 'string' ? record.added_by : undefined,
      addedAt: typeof record.added_at === 'number' ? record.added_at : undefined
    }
  }

  private async request<TResponse>(method: string, path: string, body?: Record<string, unknown>): Promise<TResponse> {
    const client = this.getClient()
    return client.http.authedRequest({}, method, `/_synapse/admin/v1${path}`, undefined, body) as Promise<TResponse>
  }

  async list(): Promise<FederationBlacklistEntry[]> {
    try {
      const response = await this.request<FederationBlacklistListResponse>('GET', '/federation/blacklist')
      const items = Array.isArray(response.blacklist)
        ? response.blacklist
        : Array.isArray(response.servers)
          ? response.servers
          : []

      return items.map((item) => this.toEntry(item)).filter((item): item is FederationBlacklistEntry => item !== null)
    } catch (err) {
      error(`[FederationBlacklist] 获取黑名单失败: ${err}`)
      return []
    }
  }

  async add(payload: AddFederationBlacklistPayload): Promise<boolean> {
    try {
      await this.request('POST', `/federation/blacklist/${encodeURIComponent(payload.domain)}`, {
        reason: payload.reason
      })
      info(`[FederationBlacklist] 添加黑名单成功: ${payload.domain}`)
      return true
    } catch (err) {
      error(`[FederationBlacklist] 添加黑名单失败: ${err}`)
      return false
    }
  }

  async remove(domain: string): Promise<boolean> {
    try {
      await this.request('DELETE', `/federation/blacklist/${encodeURIComponent(domain)}`)
      info(`[FederationBlacklist] 删除黑名单成功: ${domain}`)
      return true
    } catch (err) {
      error(`[FederationBlacklist] 删除黑名单失败: ${err}`)
      return false
    }
  }

  async getFederationStatus(): Promise<Record<string, unknown>> {
    try {
      const response = await this.request<Record<string, unknown>>('GET', '/federation/status')
      info('[FederationBlacklist] 获取联邦状态成功')
      return response
    } catch (err) {
      error(`[FederationBlacklist] 获取联邦状态失败: ${err}`)
      return {}
    }
  }

  async getFederationDestinations(): Promise<Array<Record<string, unknown>>> {
    try {
      const response = (await this.request<{ destinations?: Array<Record<string, unknown>> }>(
        'GET',
        '/federation/destinations'
      )) as { destinations?: Array<Record<string, unknown>> }
      info('[FederationBlacklist] 获取联邦目标列表成功')
      return response.destinations ?? []
    } catch (err) {
      error(`[FederationBlacklist] 获取联邦目标列表失败: ${err}`)
      return []
    }
  }
}

export const matrixFederationBlacklistService = new MatrixFederationBlacklistService()
export default matrixFederationBlacklistService
