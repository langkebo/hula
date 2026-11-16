import { matrixAccountService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AccountDeactivationFlow')

export type AccountDeactivationAuthData = Parameters<typeof matrixAccountService.deactivateAccount>[0]

export type AccountDeactivationFailureCode = 'password_invalid' | 'failed'

/** 注销失败原因：供桌面/移动两端映射到同一组 i18n 文案 */
export class AccountDeactivationError extends Error {
  readonly code: AccountDeactivationFailureCode

  constructor(code: AccountDeactivationFailureCode) {
    super(`Account deactivation failed: ${code}`)
    this.name = 'AccountDeactivationError'
    this.code = code
  }
}

/** 失败原因 → 共享文案 key；未知错误一律按注销失败处理 */
export function deactivationErrorKey(
  error: unknown
): 'setting.account.deactivate_password_invalid' | 'setting.account.deactivate_failed' {
  return error instanceof AccountDeactivationError && error.code === 'password_invalid'
    ? 'setting.account.deactivate_password_invalid'
    : 'setting.account.deactivate_failed'
}

/**
 * 账户注销的公共流程（平台无关）：密码校验 + 注销请求。
 *
 * 桌面与移动端只在确认交互（Naive Dialog / Vant Dialog）与登录态切换上不同，
 * 校验与请求必须走同一份实现，避免两端对「密码错误」的判定与文案分叉。
 */
export function useAccountDeactivationFlow() {
  async function verifyPassword(password: string): Promise<boolean> {
    try {
      return await matrixAccountService.verifyPassword(password)
    } catch (error) {
      // 请求异常（如取不到 MXID）同样视为校验未通过，不继续注销
      logger.error('注销前密码校验失败:', error)
      return false
    }
  }

  async function deactivate(authData?: AccountDeactivationAuthData, eraseData = false): Promise<void> {
    try {
      await matrixAccountService.deactivateAccount(authData, eraseData)
    } catch (error) {
      logger.error('注销账户失败:', error)
      throw new AccountDeactivationError('failed')
    }
  }

  /** 先校验密码，通过后再以该密码执行注销；校验失败不发送注销请求 */
  async function deactivateWithPassword(userId: string, password: string, eraseData = false): Promise<void> {
    const verified = await verifyPassword(password)
    if (!verified) {
      throw new AccountDeactivationError('password_invalid')
    }

    await deactivate(
      {
        type: 'm.login.password',
        identifier: {
          type: 'm.id.user',
          user: userId
        },
        password
      },
      eraseData
    )
  }

  return { verifyPassword, deactivate, deactivateWithPassword }
}
