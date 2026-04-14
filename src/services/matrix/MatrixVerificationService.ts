import type { MatrixClient } from 'matrix-js-sdk'
import { BaseManager } from './BaseManager'
export interface VerificationRequest {
  transactionId: string
  userId: string
  deviceId: string
  methods: string[]
  timestamp: number
}

class MatrixVerificationService extends BaseManager {
  private client: MatrixClient | null = null
  private keyVerificationManager: any = null

  initialize(client: MatrixClient): void {
    this.client = client
    this.keyVerificationManager = (client as any).getKeyVerificationManager?.() ?? null
  }

  private getManager() {
    if (!this.client) throw new Error('客户端未初始化')
    if (!this.keyVerificationManager) throw new Error('KeyVerificationManager 不可用')
    return this.keyVerificationManager
  }

  async requestVerification(userId: string, methods?: string[]): Promise<VerificationRequest | null> {
    if (!this.client) throw new Error('客户端未初始化')
    if (this.keyVerificationManager) {
      const result = await this.keyVerificationManager.requestVerification(userId, methods)
      return {
        transactionId: result?.transaction_id ?? result?.transactionId ?? '',
        userId,
        deviceId: result?.device_id ?? result?.deviceId ?? '',
        methods: result?.methods ?? methods ?? [],
        timestamp: Date.now()
      }
    }
    const request = await (this.client as any).requestVerificationDM?.(userId)
    return request
      ? {
          transactionId: request.transactionId ?? '',
          userId,
          deviceId: '',
          methods: [],
          timestamp: Date.now()
        }
      : null
  }

  async acceptVerification(transactionId: string): Promise<void> {
    const manager = this.getManager()
    await manager.acceptKeyVerification(transactionId)
  }

  async cancelVerification(transactionId: string, reason?: string): Promise<void> {
    const manager = this.getManager()
    await manager.cancelKeyVerification(transactionId, reason)
  }

  async getVerificationRequests(userId?: string): Promise<VerificationRequest[]> {
    try {
      const manager = this.getManager()
      const requests = await manager.getVerificationRequests(userId)
      return (requests || []).map((r: any) => ({
        transactionId: r.transaction_id ?? r.transactionId ?? '',
        userId: r.user_id ?? r.userId ?? '',
        deviceId: r.device_id ?? r.deviceId ?? '',
        methods: r.methods ?? [],
        timestamp: r.timestamp ?? r.created_ts ?? 0
      }))
    } catch (_err) {
      return []
    }
  }

  onVerificationRequest(callback: (request: VerificationRequest) => void): () => void {
    if (!this.keyVerificationManager) return () => {}
    const handler = (data: any) => {
      callback({
        transactionId: data?.transaction_id ?? data?.transactionId ?? '',
        userId: data?.user_id ?? data?.userId ?? '',
        deviceId: data?.device_id ?? data?.deviceId ?? '',
        methods: data?.methods ?? [],
        timestamp: data?.timestamp ?? data?.created_ts ?? Date.now()
      })
    }
    this.keyVerificationManager.on('VerificationRequested', handler)
    return () => this.keyVerificationManager?.off('VerificationRequested', handler)
  }

  async verifyKeyAgreement(transactionId: string, key: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      await manager.verifyKeyAgreement(transactionId, key)
      return true
    } catch (error) {
      return this.handleError(error, 'verifyKeyAgreement', false, throwOnError)
    }
  }

  async verifyMac(
    transactionId: string,
    mac: Record<string, string>,
    keys: string,
    throwOnError = false
  ): Promise<boolean> {
    try {
      const manager = this.getManager()
      await manager.verifyMac(transactionId, mac, keys)
      return true
    } catch (error) {
      return this.handleError(error, 'verifyMac', false, throwOnError)
    }
  }

  async verifyDone(transactionId: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      await manager.verifyDone(transactionId)
      return true
    } catch (error) {
      return this.handleError(error, 'verifyDone', false, throwOnError)
    }
  }

  async showQrCode(transactionId: string, throwOnError = true): Promise<string | null> {
    try {
      const manager = this.getManager()
      const result = await manager.showQrCode(transactionId)
      return result?.qr_code ?? result?.qrCode ?? result ?? null
    } catch (error) {
      return this.handleError(error, 'showQrCode', null, throwOnError)
    }
  }

  async scanQrCode(transactionId: string, qrCodeData: string, throwOnError = false): Promise<boolean> {
    try {
      const manager = this.getManager()
      await manager.scanQrCode(transactionId, qrCodeData)
      return true
    } catch (error) {
      return this.handleError(error, 'scanQrCode', false, throwOnError)
    }
  }
}

export const matrixVerificationService = new MatrixVerificationService()
export default matrixVerificationService
