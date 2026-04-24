import { resolveMatrixEndpointConfig } from '@/services/backend'
import { info, error } from '@tauri-apps/plugin-log'

export interface Badge {
  id: string
  name: string
  description?: string
  icon?: string
  obtain: number
  wearing: number
}

/**
 * 徽章服务
 * 处理用户徽章的获取和佩戴
 */
class BadgeService {
  private baseUrl: string = ''

  constructor() {
    const { homeserverUrl } = resolveMatrixEndpointConfig()
    this.baseUrl = homeserverUrl
  }

  /**
   * 设置用户徽章（佩戴徽章）
   * @param badgeId 徽章 ID
   */
  async setUserBadge(badgeId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/_matrix/client/v3/user/badge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ badgeId })
      })

      if (!response.ok) {
        throw new Error(`设置徽章失败: ${response.statusText}`)
      }

      info(`[Badge] 设置徽章成功: ${badgeId}`)
    } catch (err) {
      error(`[Badge] 设置徽章失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取徽章列表
   * @returns 徽章列表
   */
  async getBadgeList(): Promise<Badge[]> {
    try {
      const response = await fetch(`${this.baseUrl}/_matrix/client/v3/user/badges`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`获取徽章列表失败: ${response.statusText}`)
      }

      const data = await response.json()
      info('[Badge] 获取徽章列表成功')
      return data.badges || []
    } catch (err) {
      error(`[Badge] 获取徽章列表失败: ${err}`)
      return []
    }
  }

  /**
   * 批量获取徽章
   * @param badgeIds 徽章 ID 列表
   * @returns 徽章列表
   */
  async getBadgesBatch(badgeIds: string[]): Promise<Badge[]> {
    try {
      const response = await fetch(`${this.baseUrl}/_matrix/client/v3/user/badges/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ badgeIds })
      })

      if (!response.ok) {
        throw new Error(`批量获取徽章失败: ${response.statusText}`)
      }

      const data = await response.json()
      info('[Badge] 批量获取徽章成功')
      return data.badges || []
    } catch (err) {
      error(`[Badge] 批量获取徽章失败: ${err}`)
      return []
    }
  }
}

export const badgeService = new BadgeService()
export default badgeService
