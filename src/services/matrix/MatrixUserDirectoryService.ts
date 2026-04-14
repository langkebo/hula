/**
 * Matrix 用户目录服务
 *
 * 提供用户搜索和目录功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import type { ExtendedMatrixClientForUserDirectory } from '@/types/matrix-api'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

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

/**
 * 用户目录服务
 */
class UserDirectoryService extends BaseManager {
  private client: MatrixClient | null = null

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    info('[UserDirectory] 服务已初始化')
  }

  /**
   * 搜索用户
   */
  async searchUsers(query: string, limit = 10, throwOnError = true): Promise<UserDirectorySearchResult[]> {
    try {
      if (!this.client) {
        throw new Error('Client 未初始化')
      }
      const extendedClient = this.client as unknown as ExtendedMatrixClientForUserDirectory
      const result = await extendedClient.searchUserDirectory({
        term: query,
        limit
      })

      return (result.results || []).map((user) => ({
        userId: user.user_id,
        displayName: user.display_name,
        avatarUrl: user.avatar_url
      }))
    } catch (error) {
      return this.handleError(error, 'searchUsers', [] as UserDirectorySearchResult[], throwOnError)
    }
  }

  async getUserDirectory(throwOnError = true): Promise<UserDirectorySearchResult[]> {
    try {
      if (!this.client) {
        throw new Error('Client 未初始化')
      }

      return []
    } catch (error) {
      return this.handleError(error, 'getUserDirectory', [] as UserDirectorySearchResult[], throwOnError)
    }
  }

  async isSearchable(userId: string, throwOnError = true): Promise<boolean> {
    try {
      if (!this.client) {
        return false
      }

      const extendedClient = this.client as unknown as ExtendedMatrixClientForUserDirectory
      const profile = await extendedClient.getProfile(userId)
      return !!profile
    } catch (error) {
      return this.handleError(error, 'isSearchable', false, throwOnError)
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
