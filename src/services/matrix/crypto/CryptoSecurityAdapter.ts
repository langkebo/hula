/**
 * CryptoSecurityAdapter — security summary, cross-signing status, and setup operations.
 *
 * Extracted from CryptoSDKAdapter to keep file sizes under the 400-line budget.
 */

import type { CryptoApi } from '@/types/matrix-extensions'
import { createLogger } from '@/utils/Logger'
import type {
  CrossSigningStatusResult,
  CryptoAdapterAccessors,
  StoreCrossSigningKeysResult
} from './cryptoAdapterTypes'

const logger = createLogger('CryptoSecurityAdapter')

export class CryptoSecurityAdapter {
  constructor(private readonly accessors: CryptoAdapterAccessors) {}

  /** 获取交叉签名状态
   */
  async getCrossSigningStatus(): Promise<CrossSigningStatusResult> {
    const crypto = this.accessors.getCrypto()
    if (!crypto) {
      return {
        privateKeysCached: false,
        crossSigningVerified: false,
        isSetup: false,
        publicKeysOnDevice: false,
        privateKeysInSecretStorage: false,
        privateKeysCachedLocally: false
      }
    }

    let privateKeysInSecretStorage = false
    let publicKeysOnDevice = false
    let privateKeysCachedLocally = false
    let crossSigningVerified = false

    try {
      const status = await crypto.getCrossSigningStatus()
      // ⚠️ 这三个事实互相独立，历史实现只取了第一个并把它冒充成「私钥已缓存」：
      //   - privateKeysInSecretStorage：私钥已入 4S（换设备/清缓存后可恢复）
      //   - publicKeysOnDevice：公钥在本机（= 交叉签名**已建立**）
      //   - privateKeysCachedLocally：私钥在本机可用（本机能签，但丢了就没了）
      // 只保留第一个时，「交叉签名已建立但 4S 未配」与「从未建立交叉签名」在 UI 上
      // 完全无法区分 —— 于是「完成第 1 步后放弃第 2 步」的用户看不到任何可操作提示。
      privateKeysInSecretStorage = status.privateKeysInSecretStorage
      publicKeysOnDevice = Boolean(status.publicKeysOnDevice)
      // SDK 逐密钥返回布尔，这里按「任一为真」聚合（见 cryptoAdapterTypes 的说明）
      const locally = status.privateKeysCachedLocally
      privateKeysCachedLocally = Boolean(
        locally && (locally.masterKey || locally.selfSigningKey || locally.userSigningKey)
      )
    } catch (err) {
      logger.warn('Get cross-signing status failed:', err)
    }

    try {
      crossSigningVerified = await crypto.isCrossSigningReady()
    } catch (err) {
      logger.warn('Check cross-signing ready failed:', err)
    }

    // 交叉签名密钥 ID 通过真实 SDK API 获取。
    // 历史缺陷：曾用 `as unknown as { crossSigningInfo }` 读取 crypto store 的内部成员
    // （`CryptoApi` 上没有该属性），三个 key 字段因此恒为 undefined，
    // 弹窗永远把密钥显示为「缺失」。真实 API 返回 null 表示尚未初始化。
    const [masterPublicKey, selfSigningPublicKey, userSigningPublicKey] = await Promise.all([
      this.getCrossSigningKeyId(crypto),
      this.getCrossSigningKeyId(crypto, 'self_signing'),
      this.getCrossSigningKeyId(crypto, 'user_signing')
    ])

    return {
      privateKeysCached: privateKeysInSecretStorage,
      crossSigningVerified,
      // 保持既有语义不变（= 私钥已入 4S）：`e2eeFullySetup` / `setupProgress` 等
      // 既有消费方依赖它。真正的「已建立」判据是 publicKeysOnDevice（见 §F-B3）。
      isSetup: privateKeysInSecretStorage,
      publicKeysOnDevice,
      privateKeysInSecretStorage,
      privateKeysCachedLocally,
      masterPublicKey,
      selfSigningPublicKey,
      userSigningPublicKey
    }
  }

  /**
   * 4S（服务端密钥存储）是否已就绪。
   *
   * 这是「能否安全补存私钥」的前置判据：`bootstrapSecretStorage` 在 4S **不存在**时
   * 会顺手新建一个 4S 密钥（SDK JSDoc: "Calls createSecretStorageKey to generate a
   * new key"），而那把密钥用户从未见过 ⇒ 不得在未就绪时调用。
   */
  async isSecretStorageReady(): Promise<boolean> {
    const crypto = this.accessors.getCrypto()
    if (!crypto || typeof crypto.isSecretStorageReady !== 'function') return false
    try {
      return await crypto.isSecretStorageReady()
    } catch (err) {
      logger.warn('Check secret storage ready failed:', err)
      return false
    }
  }

  /**
   * 把**已知的**交叉签名私钥补存进既有的 4S（幂等）。
   *
   * - 4S 未就绪 ⇒ 返回 `'needs-setup'`，**绝不**新建 4S（否则会产生用户从未见过的恢复密钥）；
   *   调用方应改为引导用户走应用内的密钥存储设置流程。
   * - 已存过 ⇒ `'already-stored'`（SDK 只在「已知且尚未存入」时写入）。
   * - 失败/ crypto 不可用 ⇒ `'failed'`，不伪装成功。
   */
  async storeCrossSigningKeysInSecretStorage(): Promise<StoreCrossSigningKeysResult> {
    const crypto = this.accessors.getCrypto()
    if (!crypto || typeof crypto.bootstrapSecretStorage !== 'function') return 'failed'
    if (!(await this.isSecretStorageReady())) return 'needs-setup'

    let wasStored = false
    try {
      const status = await crypto.getCrossSigningStatus()
      wasStored = Boolean(status.privateKeysInSecretStorage)
    } catch (err) {
      logger.warn('Read cross-signing status before store failed:', err)
    }

    try {
      await crypto.bootstrapSecretStorage({})
      return wasStored ? 'already-stored' : 'stored'
    } catch (err) {
      logger.error('Store cross-signing keys in secret storage failed:', err)
      return 'failed'
    }
  }

  /**
   * 读取指定交叉签名密钥的 ID。
   *
   * @param crypto CryptoApi 实例
   * @param type 密钥类型；缺省为主密钥
   * @returns 密钥 ID，或 null（未初始化 / SDK 未提供该能力）
   */
  private async getCrossSigningKeyId(
    crypto: CryptoApi,
    type?: 'master' | 'self_signing' | 'user_signing'
  ): Promise<string | null> {
    if (typeof crypto.getCrossSigningKeyId !== 'function') {
      return null
    }
    try {
      return await crypto.getCrossSigningKeyId(type as never)
    } catch (err) {
      logger.warn(`Get cross-signing key id failed (type=${type ?? 'master'}):`, err)
      return null
    }
  }

  /** 判断交叉签名是否就绪
   */
  async isCrossSigningReady(): Promise<boolean> {
    const client = this.accessors.getExtendedClient()
    try {
      return client.isCrossSigningReady?.() ?? false
    } catch (err) {
      logger.error('Check cross-signing ready failed:', err)
      return false
    }
  }

  /** 设置交叉签名
   */
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

    try {
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
    } catch (err) {
      // 将服务端原始 UIA 错误转为用户可读信息
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Invalid password') || msg.includes('M_FORBIDDEN')) {
        throw new Error('密码错误，请重新输入')
      }
      throw err
    }
  }
}
