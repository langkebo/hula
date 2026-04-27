import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixRequest')

export interface RequestLog {
  url: string
  method: string
  timestamp: number
  status?: number
  duration?: number
  error?: string
}

const requestLogs: RequestLog[] = []
const MAX_LOGS = 100

export function createInterceptedFetch(originalFetch: typeof fetch): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = init?.method || 'GET'
    const startTime = Date.now()

    const log: RequestLog = {
      url,
      method,
      timestamp: startTime
    }

    logger.info(`[Request] ${method} ${url}`)

    try {
      const response = await originalFetch(input, init)
      const duration = Date.now() - startTime

      log.status = response.status
      log.duration = duration

      if (!response.ok) {
        logger.error(`[Response] ${response.status} ${url}`, {
          status: response.status,
          statusText: response.statusText,
          duration: `${duration}ms`,
          headers: Object.fromEntries(response.headers.entries())
        })
      } else {
        logger.info(`[Response] ${response.status} ${url} (${duration}ms)`)
      }

      // 保存日志
      requestLogs.push(log)
      if (requestLogs.length > MAX_LOGS) {
        requestLogs.shift()
      }

      return response
    } catch (error) {
      const duration = Date.now() - startTime
      log.duration = duration
      log.error = error instanceof Error ? error.message : String(error)

      logger.error(`[Network Error] ${url}`, {
        method,
        duration: `${duration}ms`,
        error
      })

      requestLogs.push(log)
      if (requestLogs.length > MAX_LOGS) {
        requestLogs.shift()
      }

      throw error
    }
  }
}

export function getRequestLogs(): RequestLog[] {
  return [...requestLogs]
}

export function clearRequestLogs(): void {
  requestLogs.length = 0
}

export function getFailedRequests(): RequestLog[] {
  return requestLogs.filter((log) => log.status && log.status >= 400)
}

export function getRequestStats() {
  const total = requestLogs.length
  const failed = requestLogs.filter((log) => log.status && log.status >= 400).length
  const avgDuration = requestLogs.reduce((sum, log) => sum + (log.duration || 0), 0) / (total || 1)

  return {
    total,
    failed,
    success: total - failed,
    avgDuration: Math.round(avgDuration),
    failureRate: total > 0 ? ((failed / total) * 100).toFixed(2) + '%' : '0%'
  }
}

// 导出到全局作用域供浏览器控制台使用
if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).getMatrixRequestLogs = getRequestLogs
  ;(window as unknown as Record<string, unknown>).getMatrixRequestStats = getRequestStats
  ;(window as unknown as Record<string, unknown>).getMatrixFailedRequests = getFailedRequests
  ;(window as unknown as Record<string, unknown>).clearMatrixRequestLogs = clearRequestLogs
}
