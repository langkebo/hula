import { info, error } from '@tauri-apps/plugin-log'
import type { RegistrationToken } from './AdminTypes'

type SdkAdminManager = {
  getRegistrationTokens(): Promise<
    Array<{
      token: string
      uses_allowed?: number
      pending?: number
      completed?: number
      expiry_ts?: number
    }>
  >
  createRegistrationToken(body: { token?: string; uses_allowed?: number; expiry_ts?: number }): Promise<{
    token: string
    uses_allowed?: number
    pending?: number
    completed?: number
    expiry_ts?: number
  }>
  updateRegistrationToken(token: string, body: { uses_allowed?: number; expiry_ts?: number }): Promise<void>
  deleteRegistrationToken(token: string): Promise<void>
}

export type SdkAdminGetter = () => Promise<SdkAdminManager>

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
      const tokens = await admin.getRegistrationTokens()
      return (tokens ?? []).map((t) => ({
        token: t.token,
        usesAllowed: t.uses_allowed,
        pending: t.pending ?? 0,
        completed: t.completed ?? 0,
        expiryTime: t.expiry_ts
      }))
    } catch (err) {
      error(`[Admin] 获取注册令牌失败: ${err}`)
      return []
    }
  }

  async get(token: string): Promise<RegistrationToken | null> {
    try {
      const tokens = await this.list()
      return tokens.find((t) => t.token === token) ?? null
    } catch (err) {
      error(`[Admin] 获取注册令牌详情失败: ${err}`)
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
      const body: { token?: string; uses_allowed?: number; expiry_ts?: number } = {}
      if (options?.token) body.token = options.token
      if (options?.usesAllowed !== undefined) body.uses_allowed = options.usesAllowed
      if (options?.expiryTime !== undefined) body.expiry_ts = options.expiryTime
      const result = await admin.createRegistrationToken(body)
      info('[Admin] 注册令牌已创建')
      return {
        token: result.token,
        usesAllowed: result.uses_allowed,
        pending: result.pending ?? 0,
        completed: result.completed ?? 0,
        expiryTime: result.expiry_ts
      }
    } catch (err) {
      error(`[Admin] 创建注册令牌失败: ${err}`)
      return null
    }
  }

  async update(
    token: string,
    updates: { usesAllowed?: number; expiryTime?: number }
  ): Promise<RegistrationToken | null> {
    try {
      const admin = await this.sdkAdmin()
      const body: { uses_allowed?: number; expiry_ts?: number } = {}
      if (updates.usesAllowed !== undefined) body.uses_allowed = updates.usesAllowed
      if (updates.expiryTime !== undefined) body.expiry_ts = updates.expiryTime
      await admin.updateRegistrationToken(token, body)
      info(`[Admin] 注册令牌已更新: ${token}`)
      return this.get(token)
    } catch (err) {
      error(`[Admin] 更新注册令牌失败: ${err}`)
      return null
    }
  }

  async delete(token: string): Promise<void> {
    try {
      const admin = await this.sdkAdmin()
      await admin.deleteRegistrationToken(token)
      info(`[Admin] 注册令牌已删除: ${token}`)
    } catch (err) {
      error(`[Admin] 删除注册令牌失败: ${err}`)
      throw err
    }
  }
}
