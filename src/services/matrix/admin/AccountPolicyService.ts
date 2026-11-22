/**
 * 账户有效期 / 密码认证提供方 / 策略服务器 / 限流状态服务（Admin）
 *
 * 对应 synapse-rust 的四组管理端点，全部复用 SDK `AdminManager`（R1：不另建 HTTP 调用）。
 *
 * 路由清单：
 *   POST /account_validity                          设置账户有效期
 *   GET  /account_validity/{user_id}                查询账户有效期
 *   POST /account_validity/{user_id}/renew          续期
 *   GET  /password_auth_providers                   认证提供方列表（裸数组）
 *   POST /password_auth_providers                   创建认证提供方
 *   GET  /policy/status                             策略服务器状态
 *   POST /policy/check                              触发策略检查
 *   GET  /rate-limit-status                         限流状态与指标
 */
import type {
  AdminConfigManager,
  AdminServerManager,
  PolicyCheckRequest,
  PolicyCheckResponse,
  PolicyServerStatus
} from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { BaseMatrixService } from '../BaseMatrixService'

const logger = createLogger('AdminAccountPolicy')

/** `POST /account_validity` 的请求体（由 SDK 签名推导，避免重复定义）。 */
export type AccountValidityRequest = Parameters<AdminConfigManager['createAccountValidity']>[0]

/** `POST /account_validity/{user_id}/renew` 的请求体。 */
export type AccountValidityRenewRequest = Parameters<AdminConfigManager['renewAccountValidity']>[1]

/** 账户有效期信息。 */
export type AdminAccountValidityInfo = Awaited<ReturnType<AdminConfigManager['getAccountValidity']>>

/** 密码认证提供方条目。 */
export type AdminPasswordAuthProvider = Awaited<ReturnType<AdminConfigManager['listPasswordAuthProviders']>>[number]

/** `POST /password_auth_providers` 的请求体。 */
export type CreatePasswordAuthProviderRequest = Parameters<AdminConfigManager['createPasswordAuthProvider']>[0]

/** 限流状态响应。 */
export type RateLimitStatusResponse = Awaited<ReturnType<AdminServerManager['getRateLimitStatus']>>

/** 策略检查动作枚举。 */
export type PolicyCheckAction = PolicyCheckRequest['action']

export type { PolicyCheckRequest, PolicyCheckResponse, PolicyServerStatus }

/** 账户有效期管理。 */
export class AccountValidityService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getAdminManager()
  }

  /** 为用户设置账户有效期。 */
  async createValidity(payload: AccountValidityRequest): Promise<AdminAccountValidityInfo> {
    try {
      return await this.getManager().config.createAccountValidity(payload)
    } catch (err) {
      logger.error(`[AdminAccountPolicy] createValidity 失败: ${err}`)
      throw err
    }
  }

  /** 查询指定用户的账户有效期。 */
  async getValidity(userId: string): Promise<AdminAccountValidityInfo> {
    try {
      return await this.getManager().config.getAccountValidity(userId)
    } catch (err) {
      logger.error(`[AdminAccountPolicy] getValidity 失败: ${err}`)
      throw err
    }
  }

  /** 使用续期令牌延长账户有效期。 */
  async renewValidity(userId: string, payload: AccountValidityRenewRequest): Promise<AdminAccountValidityInfo> {
    try {
      return await this.getManager().config.renewAccountValidity(userId, payload)
    } catch (err) {
      logger.error(`[AdminAccountPolicy] renewValidity 失败: ${err}`)
      throw err
    }
  }
}

/** 密码认证提供方管理。 */
export class PasswordAuthProviderService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getAdminManager()
  }

  /** 列出全部密码认证提供方。 */
  async listProviders(): Promise<AdminPasswordAuthProvider[]> {
    try {
      return await this.getManager().config.listPasswordAuthProviders()
    } catch (err) {
      logger.error(`[AdminAccountPolicy] listProviders 失败: ${err}`)
      throw err
    }
  }

  /** 创建密码认证提供方。 */
  async createProvider(payload: CreatePasswordAuthProviderRequest): Promise<AdminPasswordAuthProvider> {
    try {
      return await this.getManager().config.createPasswordAuthProvider(payload)
    } catch (err) {
      logger.error(`[AdminAccountPolicy] createProvider 失败: ${err}`)
      throw err
    }
  }
}

/** 策略服务器状态与检查。 */
export class PolicyServerService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getAdminManager()
  }

  /** 读取策略服务器状态。 */
  async getStatus(): Promise<PolicyServerStatus> {
    try {
      return await this.getManager().policy.getStatus()
    } catch (err) {
      logger.error(`[AdminAccountPolicy] getPolicyStatus 失败: ${err}`)
      throw err
    }
  }

  /** 触发一次策略检查。 */
  async check(request: PolicyCheckRequest): Promise<PolicyCheckResponse> {
    try {
      return await this.getManager().policy.check(request)
    } catch (err) {
      logger.error(`[AdminAccountPolicy] checkPolicy 失败: ${err}`)
      throw err
    }
  }
}

/** 限流状态查询。 */
export class RateLimitStatusService extends BaseMatrixService {
  private getManager() {
    return this.getClient().getAdminManager()
  }

  /** 读取限流状态与指标。 */
  async getStatus(): Promise<RateLimitStatusResponse> {
    try {
      return await this.getManager().server.getRateLimitStatus()
    } catch (err) {
      logger.error(`[AdminAccountPolicy] getRateLimitStatus 失败: ${err}`)
      throw err
    }
  }
}

export const adminAccountValidityService = new AccountValidityService()
export const adminPasswordAuthProviderService = new PasswordAuthProviderService()
export const adminPolicyServerService = new PolicyServerService()
export const adminRateLimitService = new RateLimitStatusService()
