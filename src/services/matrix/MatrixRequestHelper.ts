import { info, error as logError } from '@tauri-apps/plugin-log'
import { matrixClientService } from './MatrixClientService'

export interface RequestOptions {
  throwOnError?: boolean
  logPrefix?: string
  defaultValue?: unknown
}

export class MatrixRequestHelper {
  static async safeGet<T>(
    path: string,
    queryParams?: Record<string, string>,
    options: RequestOptions = {}
  ): Promise<T | null> {
    const { logPrefix = 'MatrixRequest', defaultValue = null } = options
    const client = matrixClientService.getClient()
    if (!client) {
      logError(`[${logPrefix}] 客户端未初始化`)
      return defaultValue as T | null
    }

    try {
      const result = await client.http.authedRequest('GET', path, queryParams)
      return result as T
    } catch (err) {
      logError(`[${logPrefix}] GET ${path} 失败: ${err}`)
      if (options.throwOnError) throw err
      return defaultValue as T | null
    }
  }

  static async safePost<T>(
    path: string,
    body?: Record<string, unknown>,
    options: RequestOptions = {}
  ): Promise<T | null> {
    const { logPrefix = 'MatrixRequest', defaultValue = null } = options
    const client = matrixClientService.getClient()
    if (!client) {
      logError(`[${logPrefix}] 客户端未初始化`)
      return defaultValue as T | null
    }

    try {
      const result = await client.http.authedRequest('POST', path, undefined, body)
      info(`[${logPrefix}] POST ${path} 成功`)
      return result as T
    } catch (err) {
      logError(`[${logPrefix}] POST ${path} 失败: ${err}`)
      if (options.throwOnError) throw err
      return defaultValue as T | null
    }
  }

  static async safePut<T>(
    path: string,
    body?: Record<string, unknown>,
    options: RequestOptions = {}
  ): Promise<T | null> {
    const { logPrefix = 'MatrixRequest', defaultValue = null } = options
    const client = matrixClientService.getClient()
    if (!client) {
      logError(`[${logPrefix}] 客户端未初始化`)
      return defaultValue as T | null
    }

    try {
      const result = await client.http.authedRequest('PUT', path, undefined, body)
      info(`[${logPrefix}] PUT ${path} 成功`)
      return result as T
    } catch (err) {
      logError(`[${logPrefix}] PUT ${path} 失败: ${err}`)
      if (options.throwOnError) throw err
      return defaultValue as T | null
    }
  }

  static async safeDelete<_T = void>(path: string, options: RequestOptions = {}): Promise<boolean> {
    const { logPrefix = 'MatrixRequest' } = options
    const client = matrixClientService.getClient()
    if (!client) {
      logError(`[${logPrefix}] 客户端未初始化`)
      return false
    }

    try {
      await client.http.authedRequest('DELETE', path)
      info(`[${logPrefix}] DELETE ${path} 成功`)
      return true
    } catch (err) {
      logError(`[${logPrefix}] DELETE ${path} 失败: ${err}`)
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
