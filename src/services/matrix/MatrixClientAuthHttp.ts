/**
 * MatrixClientAuthHttp — 登录 HTTP fallback 工具
 *
 * 当 SDK 的 loginRequest / login 方法因网络问题（fetch failed / error sending request）
 * 失败时，直接通过 HTTP POST 调用 PREFIX_V3 + /login 端点作为回退。
 *
 * 包含 429 限流重试逻辑：
 * - retry_after_ms <= 60s 时按服务器指示等待后重试（最多 2 次）
 * - retry_after_ms > 60s 时不再阻塞重试，直接抛错让 UI 显示"登录过于频繁"
 */

import { useI18nGlobal } from '@/services/i18n'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import type { LoginResponse } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'
import { PREFIX_V3 } from './paths'

const logger = createLogger('MatrixClient')

/**
 * 通过 HTTP POST PREFIX_V3 + /login 进行密码登录回退。
 *
 * @param homeserverUrl Matrix homeserver URL
 * @param username 用户名
 * @param password 密码
 * @param deviceName 设备显示名（可选）
 * @returns LoginResponse 登录响应
 */
export async function loginByHttpFallback(
  homeserverUrl: string,
  username: string,
  password: string,
  deviceName?: string
): Promise<LoginResponse> {
  const url = `${homeserverUrl.replace(/\/+$/, '')}${PREFIX_V3}/login`
  const body = JSON.stringify({
    type: 'm.login.password',
    user: username,
    password,
    initial_device_display_name: deviceName || 'Tjg Client'
  })
  return loginRequestWithRetry(url, body)
}

/**
 * 通过 HTTP POST PREFIX_V3 + /login 进行 token 登录回退（SSO 场景）。
 *
 * @param homeserverUrl Matrix homeserver URL
 * @param loginToken SSO 登录 token
 * @returns LoginResponse 登录响应
 */
export async function tokenLoginByHttpFallback(homeserverUrl: string, loginToken: string): Promise<LoginResponse> {
  const url = `${homeserverUrl.replace(/\/+$/, '')}${PREFIX_V3}/login`
  const body = JSON.stringify({
    type: 'm.login.token',
    token: loginToken
  })
  return loginRequestWithRetry(url, body)
}

/**
 * 执行登录 HTTP 请求，支持 429 限流重试。
 *
 * 限流处理策略：
 * - retry_after_ms <= 60s：等待后重试（最多 maxRetries 次）
 * - retry_after_ms > 60s：立即抛错（避免阻塞 UI 15 分钟）
 *
 * @param url 完整登录 URL
 * @param body 请求体 JSON 字符串
 * @param maxRetries 最大重试次数（默认 2）
 * @returns LoginResponse 登录响应
 */
async function loginRequestWithRetry(url: string, body: string, maxRetries = 2): Promise<LoginResponse> {
  const runtimeFetch = getRuntimeAwareFetch()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await runtimeFetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body
    })

    if (response.ok) {
      return (await response.json()) as LoginResponse
    }

    if (response.status === 429 && attempt < maxRetries) {
      let retryAfterMs = 5000
      try {
        const errorBody = await response.clone().json()
        retryAfterMs = errorBody.retry_after_ms || 5000
      } catch {
        /* ignore */
      }
      // 限流时间过长（>60s）时不再阻塞重试，立即抛错让 UI 显示"登录过于频繁，请X分钟后重试"
      // 否则 setTimeout(900000) 会阻塞 15 分钟，useLoginFlow 30s 超时后状态混乱
      if (retryAfterMs > 60_000) {
        const err = new Error(
          JSON.stringify({ errcode: 'M_LIMIT_EXCEEDED', error: 'Rate limited', retry_after_ms: retryAfterMs })
        ) as Error & { errcode?: string; retry_after_ms?: number }
        err.errcode = 'M_LIMIT_EXCEEDED'
        err.retry_after_ms = retryAfterMs
        logger.warn(`登录请求被限流 (429)，retry_after_ms=${retryAfterMs} 过长，不再重试，直接抛错`)
        throw err
      }
      logger.warn(`登录请求被限流 (429)，${retryAfterMs}ms 后重试 (${attempt + 1}/${maxRetries})`)
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs))
      continue
    }

    const text = await response.text().catch(() => '')
    throw new Error(
      text || useI18nGlobal().t('matrix_error.auth.login_failed_with_status', { status: response.status })
    )
  }

  throw new Error('登录请求被限流，请稍后重试')
}
