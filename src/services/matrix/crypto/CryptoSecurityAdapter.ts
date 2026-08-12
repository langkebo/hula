/**
 * CryptoSecurityAdapter — security summary, cross-signing status, and setup operations.
 *
 * Extracted from CryptoSDKAdapter to keep file sizes under the 400-line budget.
 */

import type { ISecuritySummary } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import type { CrossSigningStatusResult, CryptoAdapterAccessors } from './cryptoAdapterTypes'

const logger = createLogger('CryptoSecurityAdapter')

export class CryptoSecurityAdapter {
  constructor(private readonly accessors: CryptoAdapterAccessors) {}

  async getSecuritySummary(): Promise<ISecuritySummary | null> {
    const trustManager = this.accessors.getDeviceTrustManager()
    if (trustManager) {
      return await trustManager.getSecuritySummary()
    }
    return null
  }

  async getCrossSigningStatus(): Promise<CrossSigningStatusResult> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) {
      return { privateKeysCached: false, crossSigningVerified: false, isSetup: false }
    }

    let privateKeysCached = false
    let crossSigningVerified = false

    try {
      const status = await crypto.getCrossSigningStatus()
      privateKeysCached = status.privateKeysInSecretStorage
    } catch (err) {
      logger.warn('Get cross-signing status failed:', err)
    }

    try {
      crossSigningVerified = await crypto.isCrossSigningReady()
    } catch (err) {
      logger.warn('Check cross-signing ready failed:', err)
    }

    const crossSigningInfo = (crypto as unknown as { crossSigningInfo?: { getId?(type?: string): string | undefined } })
      .crossSigningInfo

    return {
      privateKeysCached,
      crossSigningVerified,
      isSetup: privateKeysCached,
      masterPublicKey: crossSigningInfo?.getId?.(),
      selfSigningPublicKey: crossSigningInfo?.getId?.('self_signing'),
      userSigningPublicKey: crossSigningInfo?.getId?.('user_signing')
    }
  }

  async isCrossSigningReady(): Promise<boolean> {
    const client = this.accessors.getExtendedClient()
    try {
      return client.isCrossSigningReady?.() ?? false
    } catch (err) {
      logger.error('Check cross-signing ready failed:', err)
      return false
    }
  }

  async setupCrossSigning(authParams?: { password?: string; authData?: unknown }): Promise<void> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) {
      throw new Error('CryptoApi 不可用')
    }

    const buildPasswordAuthData = (password?: string, session?: string) => {
      const trimmedPassword = password?.trim()
      const userId = this.accessors.getClient().getUserId()
      if (!trimmedPassword || !userId) return undefined
      return {
        type: 'm.login.password',
        user: userId,
        password: trimmedPassword,
        ...(session ? { session } : {})
      }
    }

    const extractUiaErrorData = (err: unknown) => {
      const candidates: unknown[] = [err]
      if (err && typeof err === 'object' && 'cause' in err) {
        candidates.push((err as { cause?: unknown }).cause)
      }
      for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'object') continue
        const record = candidate as Record<string, unknown>
        if (record.data && typeof record.data === 'object') {
          const data = record.data as Record<string, unknown>
          if ('session' in data || 'flows' in data || 'params' in data) return data
        }
        if ('session' in record || 'flows' in record || 'params' in record) return record
      }
      return null
    }

    await crypto.bootstrapCrossSigning?.({
      authUploadDeviceSigningKeys: async (makeRequest: (authData: unknown) => Promise<unknown>) => {
        const baseAuthData =
          (authParams?.authData as Record<string, unknown> | undefined) ?? buildPasswordAuthData(authParams?.password)
        if (baseAuthData) {
          try {
            return await makeRequest(baseAuthData)
          } catch (err) {
            const uiaData = extractUiaErrorData(err)
            if (uiaData?.session && !baseAuthData.session) {
              return makeRequest({ ...baseAuthData, session: uiaData.session })
            }
            throw err
          }
        }
        throw new Error('需要认证参数')
      }
    })
  }
}
