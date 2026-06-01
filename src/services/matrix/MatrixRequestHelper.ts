import { createLogger } from '@/utils/Logger'
import { matrixClientService } from './MatrixClientService'

const logger = createLogger('MatrixRequestHelper')

/**
 * @deprecated **DO NOT USE** — This class is deprecated and will be removed in a future release.
 *
 * All consumers have been migrated to `MatrixHttpClient` (import `matrixHttpClient` from
 * `@/services/matrix/MatrixHttpClient` or the barrel `@/services/matrix`).
 *
 * Migration guide:
 *   MatrixRequestHelper.safeGet(path, qp?, opts?)  → matrixHttpClient.get(path, { queryParams: qp, ...opts })
 *   MatrixRequestHelper.safePost(path, body?, opts?) → matrixHttpClient.post(path, body, opts)
 *   MatrixRequestHelper.safePut(path, body?, opts?)  → matrixHttpClient.put(path, body, opts)
 *   MatrixRequestHelper.safeDelete(path, opts?)      → matrixHttpClient.delete(path, opts)
 *   MatrixRequestHelper.buildRoomPath / buildUserPath / encodeMatrixId → same methods on matrixHttpClient
 *   RequestOptions → MatrixHttpRequestOptions
 */

export interface RequestOptions {
  throwOnError?: boolean
  logPrefix?: string
  defaultValue?: unknown
  quiet?: boolean
}

export class MatrixRequestHelper {
  static async safeGet<T>(
    path: string,
    queryParams?: Record<string, string>,
    options: RequestOptions = {}
  ): Promise<T | null> {
    const { logPrefix = 'MatrixRequest', defaultValue = null, quiet = false } = options
    const client = matrixClientService.getClient()
    if (!client) {
      if (!quiet) logger.error(`[${logPrefix}] 客户端未初始化`)
      return defaultValue as T | null
    }

    try {
      const result = await client.http.authedRequest('GET', path, queryParams)
      return result as T
    } catch (err) {
      if (!quiet) logger.error(`[${logPrefix}] GET ${path} 失败: ${err}`)
      if (options.throwOnError) throw err
      return defaultValue as T | null
    }
  }

  static async safePost<T>(
    path: string,
    body?: Record<string, unknown>,
    options: RequestOptions = {}
  ): Promise<T | null> {
    const { logPrefix = 'MatrixRequest', defaultValue = null, quiet = false } = options
    const client = matrixClientService.getClient()
    if (!client) {
      if (!quiet) logger.error(`[${logPrefix}] 客户端未初始化`)
      return defaultValue as T | null
    }

    try {
      const result = await client.http.authedRequest('POST', path, undefined, body)
      if (!quiet) logger.info(`[${logPrefix}] POST ${path} 成功`)
      return result as T
    } catch (err) {
      if (!quiet) logger.error(`[${logPrefix}] POST ${path} 失败: ${err}`)
      if (options.throwOnError) throw err
      return defaultValue as T | null
    }
  }

  static async safePut<T>(
    path: string,
    body?: Record<string, unknown>,
    options: RequestOptions = {}
  ): Promise<T | null> {
    const { logPrefix = 'MatrixRequest', defaultValue = null, quiet = false } = options
    const client = matrixClientService.getClient()
    if (!client) {
      if (!quiet) logger.error(`[${logPrefix}] 客户端未初始化`)
      return defaultValue as T | null
    }

    try {
      const result = await client.http.authedRequest('PUT', path, undefined, body)
      if (!quiet) logger.info(`[${logPrefix}] PUT ${path} 成功`)
      return result as T
    } catch (err) {
      if (!quiet) logger.error(`[${logPrefix}] PUT ${path} 失败: ${err}`)
      if (options.throwOnError) throw err
      return defaultValue as T | null
    }
  }

  static async safeDelete<_T = void>(path: string, options: RequestOptions = {}): Promise<boolean> {
    const { logPrefix = 'MatrixRequest', quiet = false } = options
    const client = matrixClientService.getClient()
    if (!client) {
      if (!quiet) logger.error(`[${logPrefix}] 客户端未初始化`)
      return false
    }

    try {
      await client.http.authedRequest('DELETE', path)
      if (!quiet) logger.info(`[${logPrefix}] DELETE ${path} 成功`)
      return true
    } catch (err) {
      if (!quiet) logger.error(`[${logPrefix}] DELETE ${path} 失败: ${err}`)
      if (options.throwOnError) throw err
      return false
    }
  }

  static encodeMatrixId(id: string): string {
    return encodeURIComponent(id)
  }

  static buildRoomPath(roomId: string, suffix: string): string {
    return `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/${suffix}`
  }

  static buildUserPath(userId: string, suffix: string): string {
    return `/_matrix/client/v3/user/${encodeURIComponent(userId)}/${suffix}`
  }
}
