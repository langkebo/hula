/**
 * §9.3.3 认证错误统一处理
 *
 * 集中处理 auth 类 AppError：
 * - Token 过期类（M_UNKNOWN_TOKEN/M_MISSING_TOKEN/UNAUTHORIZED）：尝试 refreshToken，
 *   成功则继续；失败则 logout 并跳转登录页。
 * - 权限不足类（M_FORBIDDEN/FORBIDDEN）：Toast 提示「无权限」，不刷新 token。
 * - 访客受限（M_GUEST_ACCESS_FORBIDDEN）：Toast 提示访客受限。
 *
 * 依赖通过注入传入，便于测试与解耦。供 SessionOrchestrator 注册为全局 auth 错误监听器。
 */
import type { AppError, AppErrorAuth } from '@/common/errors'
import { resolveErrorMessage } from '@/locales/errors'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AuthErrorHandler')

/** Token 过期类 errcode（可恢复，尝试刷新） */
const TOKEN_EXPIRED_CODES = new Set([
  'M_UNKNOWN_TOKEN',
  'M_MISSING_TOKEN',
  'UNAUTHORIZED',
  'TOKEN_EXPIRED',
  'TokenExpired',
  'TokenInvalid'
])

/** 权限不足类 errcode（不可恢复，仅提示） */
const FORBIDDEN_CODES = new Set(['M_FORBIDDEN', 'FORBIDDEN', 'Permission'])

/** 访客受限 errcode */
const GUEST_FORBIDDEN_CODES = new Set(['M_GUEST_ACCESS_FORBIDDEN'])

export interface AuthErrorHandlerDeps {
  /** 刷新 token，返回是否成功；未提供时直接登出 */
  refreshToken?: () => Promise<boolean>
  /** 登出当前会话 */
  logout: () => Promise<void> | void
  /** 跳转到登录页 */
  redirectToLogin: () => void
  /** 展示用户反馈 */
  showFeedback: (message: string, type: 'error' | 'warning' | 'info') => void
}

/**
 * 认证错误处理器
 *
 * @returns handleAuthError 处理 auth 错误，返回 true 表示已处理，false 表示非 auth 错误未处理
 */
export function useAuthErrorHandler(deps: AuthErrorHandlerDeps) {
  const handleAuthError = async (err: AppError | AppErrorAuth): Promise<boolean> => {
    if (err.kind !== 'auth') {
      return false
    }

    const code = err.code

    // 访客受限
    if (GUEST_FORBIDDEN_CODES.has(code)) {
      const message = resolveErrorMessage(code)
      deps.showFeedback(message, 'warning')
      logger.warn(`访客受限: ${code}`)
      return true
    }

    // 权限不足（不可恢复）
    if (FORBIDDEN_CODES.has(code) || err.recoverable === false) {
      const message = resolveErrorMessage(code)
      deps.showFeedback(message, 'error')
      logger.warn(`权限不足: ${code}`)
      return true
    }

    // Token 过期类（可恢复）
    if (TOKEN_EXPIRED_CODES.has(code)) {
      if (deps.refreshToken) {
        try {
          const ok = await deps.refreshToken()
          if (ok) {
            logger.info('Token 刷新成功，无需跳转登录页')
            return true
          }
        } catch (e) {
          logger.error('Token 刷新异常', e)
        }
      }
      // 刷新失败或无刷新能力 → 登出并跳转
      try {
        await deps.logout()
      } catch (e) {
        logger.error('登出失败', e)
      }
      deps.redirectToLogin()
      logger.info('Token 过期已跳转登录页')
      return true
    }

    // 其他 auth 错误：兜底提示
    const message = resolveErrorMessage(code, 'zh', err.message)
    deps.showFeedback(message, 'error')
    return true
  }

  return { handleAuthError }
}
