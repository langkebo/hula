/**
 * Matrix 用户目录服务
 *
 * 提供用户搜索和目录功能
 */

import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixUserDirectory')

import type { MatrixClient } from 'matrix-js-sdk'
import { BaseMatrixService } from '../BaseMatrixService'

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
class UserDirectoryService extends BaseMatrixService {
  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.setFallbackClient(client)
    logger.info('[UserDirectory] 服务已初始化')
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
      const errMsg = err instanceof Error ? err.message : String(err)
      if (
        errMsg.includes('M_UNAUTHORIZED') ||
        errMsg.includes('401') ||
        errMsg.includes('M_FORBIDDEN') ||
        errMsg.includes('403')
      ) {
        logger.info(`[UserDirectory] 用户搜索需要认证 (${errMsg.includes('403') ? '403' : '401'})`)
        return []
      }
      logger.error(`[UserDirectory] 搜索用户失败: ${err}`)
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
      logger.error(`[UserDirectory] 获取目录失败: ${err}`)
      return []
    }
  }

  /**
   * 检查用户是否可搜索
   */
  async isSearchable(userId: string): Promise<boolean> {
    try {
      const client = this.getClient()
      const profile = await client.getProfileInfo(userId)
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
      const result = await client.http.authedRequest<{
        results?: Array<{
          user_id: string
          display_name?: string
          avatar_url?: string
        }>
        next_batch?: string
      }>('POST', '/_matrix/client/v3/user_directory/list', undefined, {
        limit,
        from: from || undefined
      })
      const users = (result.results ?? []).map((u) => ({
        userId: u.user_id,
        displayName: u.display_name,
        avatarUrl: u.avatar_url
      }))
      return { users, next_batch: result.next_batch }
    } catch (err) {
      logger.error(`[UserDirectory] 获取用户目录列表失败: ${err}`)
      return { users: [] }
    }
  }

  async getUserDirectoryProfile(userId: string): Promise<UserDirectorySearchResult | null> {
    const client = this.getClient()
    try {
      const result = await client.http.authedRequest<{
        display_name?: string
        avatar_url?: string
      }>('GET', `/_matrix/client/v3/user_directory/profiles/${encodeURIComponent(userId)}`)
      return {
        userId,
        displayName: result.display_name,
        avatarUrl: result.avatar_url
      }
    } catch (err) {
      logger.error(`[UserDirectory] 获取目录资料失败: ${err}`)
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
