import type { MatrixClient } from 'matrix-js-sdk'
import { BaseManager } from './BaseManager'

class MatrixAccountDataService extends BaseManager {
  private client: MatrixClient | null = null
  private accountDataManager: any = null

  initialize(client: MatrixClient): void {
    this.client = client
    this.accountDataManager = (client as any).getAccountDataManager?.() ?? null
  }

  private getManager() {
    if (!this.client) throw new Error('客户端未初始化')
    if (!this.accountDataManager) throw new Error('AccountDataManager 不可用')
    return this.accountDataManager
  }

  async setAccountData(type: string, content: Record<string, unknown>, throwOnError = false): Promise<void> {
    if (!this.client) {
      return this.handleError(new Error('客户端未初始化'), 'setAccountData', undefined as void, throwOnError)
    }
    try {
      if (this.accountDataManager) {
        await this.accountDataManager.setAccountData(type, content)
      } else {
        await this.client.setAccountData(type, content)
      }
    } catch (err) {
      return this.handleError(err, 'setAccountData', undefined as void, throwOnError)
    }
  }

  async getAccountData(type: string, throwOnError = true): Promise<Record<string, unknown> | null> {
    if (!this.client) {
      return this.handleError(new Error('客户端未初始化'), 'getAccountData', null, throwOnError)
    }
    try {
      if (this.accountDataManager) {
        return await this.accountDataManager.getAccountData(type)
      }
      const data = this.client.getAccountData(type)
      return data?.getContent?.() ?? null
    } catch (err) {
      return this.handleError(err, 'getAccountData', null, throwOnError)
    }
  }

  async getAccountDataFromServer(type: string, throwOnError = true): Promise<Record<string, unknown> | null> {
    if (!this.client) {
      return this.handleError(new Error('客户端未初始化'), 'getAccountDataFromServer', null, throwOnError)
    }
    try {
      if (this.accountDataManager) {
        return await this.accountDataManager.getAccountDataFromServer(type)
      }
      return await (this.client as any).getAccountDataFromServer?.(type)
    } catch (err) {
      return this.handleError(err, 'getAccountDataFromServer', null, throwOnError)
    }
  }

  async listAccountData(throwOnError = true): Promise<string[]> {
    if (!this.client) {
      return this.handleError(new Error('客户端未初始化'), 'listAccountData', [] as string[], throwOnError)
    }
    try {
      if (this.accountDataManager) {
        return await this.accountDataManager.listAccountData()
      }
      const events = this.client.store.getAccountData()
      return events ? Object.keys(events) : []
    } catch (err) {
      return this.handleError(err, 'listAccountData', [] as string[], throwOnError)
    }
  }

  async deleteAccountData(type: string, throwOnError = false): Promise<void> {
    try {
      const manager = this.getManager()
      await manager.deleteAccountData(type)
    } catch (err) {
      return this.handleError(err, 'deleteAccountData', undefined as void, throwOnError)
    }
  }
}

export const matrixAccountDataService = new MatrixAccountDataService()
export default matrixAccountDataService
