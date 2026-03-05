/**
 * Matrix 用户资料服务
 *
 * 提供用户资料获取和设置功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { info, error } from '@tauri-apps/plugin-log'

/**
 * 用户资料
 */
export interface UserProfile {
  /** 用户 ID */
  userId: string
  /** 显示名 */
  displayname?: string
  /** 头像 URL */
  avatarUrl?: string
  /** 签名 */
  signature?: string
}

/**
 * 用户资料服务
 */
class ProfileService {
  private client: MatrixClient | null = null

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    info('[Profile] 服务已初始化')
  }

  /**
   * 获取用户资料
   */
  async getProfile(userId: string): Promise<UserProfile> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      const profile = await (this.client as any).getProfile(userId)
      return {
        userId,
        displayname: profile.displayname,
        avatarUrl: profile.avatar_url
      }
    } catch (err) {
      error(`[Profile] 获取用户资料失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取显示名
   */
  async getDisplayName(userId: string): Promise<string | undefined> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      const profile = await (this.client as any).getProfile(userId)
      return profile.displayname
    } catch (err) {
      error(`[Profile] 获取显示名失败: ${err}`)
      return undefined
    }
  }

  /**
   * 获取头像
   */
  async getAvatarUrl(userId: string): Promise<string | undefined> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      const profile = await (this.client as any).getProfile(userId)
      return profile.avatar_url
    } catch (err) {
      error(`[Profile] 获取头像失败: ${err}`)
      return undefined
    }
  }

  /**
   * 设置显示名
   */
  async setDisplayName(displayname: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await (this.client as any).setDisplayName(displayname)
      info(`[Profile] 设置显示名成功: ${displayname}`)
    } catch (err) {
      error(`[Profile] 设置显示名失败: ${err}`)
      throw err
    }
  }

  /**
   * 设置头像
   */
  async setAvatarUrl(avatarUrl: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      await (this.client as any).setAvatarUrl(avatarUrl)
      info(`[Profile] 设置头像成功: ${avatarUrl}`)
    } catch (err) {
      error(`[Profile] 设置头像失败: ${err}`)
      throw err
    }
  }

  /**
   * 上传并设置头像
   */
  async uploadAndSetAvatar(file: File | Blob): Promise<string> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      // 上传图片
      const { content_uri } = await (this.client as any).uploadContent(file, {
        type: file.type,
        rawResponse: false
      })

      // 设置头像
      await this.setAvatarUrl(content_uri)

      return content_uri
    } catch (err) {
      error(`[Profile] 上传头像失败: ${err}`)
      throw err
    }
  }
}

/**
 * 单例实例
 */
export const profileService = new ProfileService()

/**
 * Vue Composable
 */
import { ref } from 'vue'

export function useProfile() {
  const profile = ref<UserProfile | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function getProfile(userId: string) {
    isLoading.value = true
    error.value = null
    try {
      profile.value = await profileService.getProfile(userId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取资料失败'
    } finally {
      isLoading.value = false
    }
  }

  async function setDisplayName(displayname: string) {
    isLoading.value = true
    error.value = null
    try {
      await profileService.setDisplayName(displayname)
      if (profile.value) {
        profile.value.displayname = displayname
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function setAvatarUrl(avatarUrl: string) {
    isLoading.value = true
    error.value = null
    try {
      await profileService.setAvatarUrl(avatarUrl)
      if (profile.value) {
        profile.value.avatarUrl = avatarUrl
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function uploadAvatar(file: File | Blob) {
    isLoading.value = true
    error.value = null
    try {
      const url = await profileService.uploadAndSetAvatar(file)
      if (profile.value) {
        profile.value.avatarUrl = url
      }
      return url
    } catch (err) {
      error.value = err instanceof Error ? err.message : '上传失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  return {
    profile,
    isLoading,
    error,
    getProfile,
    setDisplayName,
    setAvatarUrl,
    uploadAvatar
  }
}

export default profileService
