/**
 * Matrix 用户目录服务
 *
 * 提供用户搜索和目录功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { info, error } from '@tauri-apps/plugin-log'
import { matrixClientService } from '../MatrixClientService'

/**
 * 用户目录搜索结果
 */
export interface UserDirectorySearchResult {
  /** 用户 ID */
  userId: string
  /** 显示名 */
  displayName?: string
  /** 头像 URL */
  avatarUrl?: string
}

interface MatrixDirectoryUser {
  user_id: string
  display_name?: string
  avatar_url?: string
}

/**
 * 用户目录服务
 */
class UserDirectoryService {
  private client: MatrixClient | null = null

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    info('[UserDirectory] 服务已初始化')
  }

  private getClient(): MatrixClient {
    const client = matrixClientService.getClient() ?? this.client
    if (!client) {
      throw new Error('Client 未初始化')
    }
    if (this.client !== client) {
      this.client = client
    }
    return client
  }

  /**
   * 搜索用户
   */
  async searchUsers(query: string, limit = 10): Promise<UserDirectorySearchResult[]> {
    const client = this.getClient()
    try {
      const result = await client.searchUserDirectory({
        term: query,
        limit
      })

      return (result.results || []).map((user: MatrixDirectoryUser) => ({
        userId: user.user_id,
        displayName: user.display_name,
        avatarUrl: user.avatar_url
      }))
    } catch (err) {
      error(`[UserDirectory] 搜索用户失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取用户目录
   */
  async getUserDirectory(): Promise<UserDirectorySearchResult[]> {
    this.getClient()

    try {
      // Matrix API 不提供直接获取整个目录的方法
      // 这里返回空数组，需要通过搜索获取
      return []
    } catch (err) {
      error(`[UserDirectory] 获取目录失败: ${err}`)
      return []
    }
  }

  /**
   * 检查用户是否可搜索
   */
  async isSearchable(userId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      const profile = await client.getProfile(userId)
      return !!profile
    } catch {
      return false
    }
  }

  async listUserDirectory(
    limit: number = 20,
    from?: string
  ): Promise<{
    users: UserDirectorySearchResult[]
    next_batch?: string
  }> {
    const client = this.getClient()
    try {
      const queryParams: Record<string, string> = { limit: String(limit) }
      if (from) queryParams.from = from
      const result = await client.http.authedRequest('POST', '/_matrix/client/v3/user_directory/list', undefined, {
        limit,
        from: from || undefined
      })
      const users = ((result as { results?: Array<Record<string, unknown>> }).results ?? []).map((u) => ({
        userId: u.user_id as string,
        displayName: u.display_name as string | undefined,
        avatarUrl: u.avatar_url as string | undefined
      }))
      return { users, next_batch: (result as { next_batch?: string }).next_batch }
    } catch (err) {
      error(`[UserDirectory] 获取用户目录列表失败: ${err}`)
      return { users: [] }
    }
  }

  async getUserDirectoryProfile(userId: string): Promise<UserDirectorySearchResult | null> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest(
        'GET',
        `/_matrix/client/v3/user_directory/profiles/${encodeURIComponent(userId)}`
      )
      return {
        userId,
        displayName: (result as { display_name?: string }).display_name,
        avatarUrl: (result as { avatar_url?: string }).avatar_url
      }
    } catch (err) {
      error(`[UserDirectory] 获取目录资料失败: ${err}`)
      return null
    }
  }
}

/**
 * 单例实例
 */
export const userDirectoryService = new UserDirectoryService()

/**
 * Vue Composable
 */
import { ref } from 'vue'

export function useUserDirectory() {
  const results = ref<UserDirectorySearchResult[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function search(query: string, limit?: number) {
    isLoading.value = true
    error.value = null
    try {
      results.value = await userDirectoryService.searchUsers(query, limit)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '搜索失败'
    } finally {
      isLoading.value = false
    }
  }

  function clearResults() {
    results.value = []
  }

  return {
    results,
    isLoading,
    error,
    search,
    clearResults
  }
}

export default userDirectoryService
