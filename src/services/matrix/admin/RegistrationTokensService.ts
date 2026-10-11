import type { AdminManager } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import type { RegistrationToken } from './AdminTypes'

const logger = createLogger('RegistrationTokensService')

type SdkAdminGetter = () => Promise<AdminManager>

/**
 * Admin Registration Tokens domain service.
 *
 * Extracted during the P0-5 admin domain split. The top-level admin facade
 * keeps the singleton-friendly surface area (same methods, same signatures)
 * and forwards here; new callers can target this class directly.
 */
export class AdminRegistrationTokensService {
  constructor(private readonly sdkAdmin: SdkAdminGetter) {}

  async list(): Promise<RegistrationToken[]> {
    try {
      const admin = await this.sdkAdmin()
      const page = await admin.getRegistrationTokens()
      return (page?.registration_tokens ?? []).map((t) => ({
        token: t.token,
        usesAllowed: t.uses_allowed ?? undefined,
        pending: t.pending ?? 0,
        completed: t.completed ?? 0,
        expiryTime: t.expiry_time ?? undefined
      }))
    } catch (err) {
      logger.error(`[Admin] 获取注册令牌失败: ${err}`)
      return []
    }
  }

  async get(token: string): Promise<RegistrationToken | null> {
    try {
      const tokens = await this.list()
      return tokens.find((t) => t.token === token) ?? null
    } catch (err) {
      logger.error(`[Admin] 获取注册令牌详情失败: ${err}`)
      return null
    }
  }

  async create(options?: {
    token?: string
    usesAllowed?: number
    expiryTime?: number
    length?: number
  }): Promise<RegistrationToken | null> {
    try {
      const admin = await this.sdkAdmin()
      const result = await admin.createRegistrationToken({
        token: options?.token ?? `tjg_${Date.now()}`,
        uses_allowed: options?.usesAllowed,
        expiry_time: options?.expiryTime
      })
      logger.info('[Admin] 注册令牌已创建')
      return {
        token: result.token,
        usesAllowed: result.uses_allowed ?? undefined,
        pending: result.pending ?? 0,
        completed: result.completed ?? 0,
        expiryTime: result.expiry_time ?? undefined
      }
    } catch (err) {
      logger.error(`[Admin] 创建注册令牌失败: ${err}`)
      return null
    }
  }

  async update(
    token: string,
    updates: { usesAllowed?: number; expiryTime?: number }
  ): Promise<RegistrationToken | null> {
    try {
      const admin = await this.sdkAdmin()
      const body: { uses_allowed?: number; expiry_time?: number } = {}
      if (updates.usesAllowed !== undefined) body.uses_allowed = updates.usesAllowed
      if (updates.expiryTime !== undefined) body.expiry_time = updates.expiryTime
      await admin.updateRegistrationToken(token, body)
      logger.info(`[Admin] 注册令牌已更新: ${token}`)
      return this.get(token)
    } catch (err) {
      logger.error(`[Admin] 更新注册令牌失败: ${err}`)
      return null
    }
  }

  async delete(token: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteRegistrationToken(token)
      logger.info(`[Admin] 注册令牌已删除: ${token}`)
    } catch (err) {
      logger.error(`[Admin] 删除注册令牌失败: ${err}`)
      throw err
    }
  }
}
