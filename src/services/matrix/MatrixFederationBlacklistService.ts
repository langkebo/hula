import type {
  FederationBlacklistEntryResponse,
  FederationBlacklistListResponse,
  FederationBlacklistCheckResponse,
  FederationBlacklistImportResponse
} from '@/types/matrix-api'
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'

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

class MatrixFederationBlacklistService extends BaseManager {
  private get client() {
    const c = matrixClientService.getClient()
    if (!c) throw new Error('Matrix client not initialized')
    return c
  }

  async add(params: AddToBlacklistParams, throwOnError = false): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/admin/federation/blacklist',
        undefined,
        JSON.stringify(params),
        { prefix: '' }
      )
      return true
    } catch (error) {
      return this.handleError(error, 'add', false, throwOnError)
    }
  }

  async remove(domain: string, throwOnError = false): Promise<boolean> {
    try {
      await this.client.http.authedRequest(
        'DELETE',
        `/_matrix/client/v1/admin/federation/blacklist/${encodeURIComponent(domain)}`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return true
    } catch (error) {
      return this.handleError(error, 'remove', false, throwOnError)
    }
  }

  async list(throwOnError = true): Promise<FederationBlacklistEntry[]> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        '/_matrix/client/v1/admin/federation/blacklist',
        undefined,
        undefined,
        { prefix: '' }
      )) as FederationBlacklistListResponse
      return (response.entries || []).map(this.mapEntry)
    } catch (error) {
      return this.handleError(error, 'list', [] as FederationBlacklistEntry[], throwOnError)
    }
  }

  async check(domain: string, throwOnError = true): Promise<boolean> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        `/_matrix/client/v1/admin/federation/blacklist/${encodeURIComponent(domain)}/check`,
        undefined,
        undefined,
        { prefix: '' }
      )) as FederationBlacklistCheckResponse
      return response.blacklisted || false
    } catch (error) {
      return this.handleError(error, 'check', false, throwOnError)
    }
  }

  async importBatch(entries: AddToBlacklistParams[], throwOnError = false): Promise<number> {
    try {
      const response = (await this.client.http.authedRequest(
        'POST',
        '/_matrix/client/v1/admin/federation/blacklist/import',
        undefined,
        JSON.stringify({ entries }),
        { prefix: '' }
      )) as FederationBlacklistImportResponse
      return response.imported || 0
    } catch (error) {
      return this.handleError(error, 'importBatch', 0, throwOnError)
    }
  }

  async export(throwOnError = true): Promise<AddToBlacklistParams[]> {
    try {
      const response = (await this.client.http.authedRequest(
        'GET',
        '/_matrix/client/v1/admin/federation/blacklist/export',
        undefined,
        undefined,
        { prefix: '' }
      )) as FederationBlacklistListResponse
      return response.entries || []
    } catch (error) {
      return this.handleError(error, 'export', [] as AddToBlacklistParams[], throwOnError)
    }
  }

  private mapEntry(data: FederationBlacklistEntryResponse): FederationBlacklistEntry {
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
