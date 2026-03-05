/**
 * Matrix 用户目录服务
 *
 * 提供用户搜索和目录功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { info, error } from '@tauri-apps/plugin-log'

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
class UserDirectoryService {
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
  async searchUsers(query: string, limit = 10): Promise<UserDirectorySearchResult[]> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      const result = await (this.client as any).searchUserDirectory({
        term: query,
        limit
      })

      return (result.results || []).map((user: any) => ({
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
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

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
    if (!this.client) {
      return false
    }

    try {
      const profile = await (this.client as any).getProfile(userId)
      // 如果能获取到资料，说明可搜索
      return !!profile
    } catch {
      return false
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
