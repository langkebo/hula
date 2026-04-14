import type { MatrixClient } from 'matrix-js-sdk'
import type { ExtendedMatrixClientForProfile } from '@/types/matrix-api'
import { BaseManager } from './BaseManager'
import { getGlobalCache } from '@/composables/useCache'
import { info } from '@tauri-apps/plugin-log'

export interface UserProfile {
  userId: string
  displayname?: string
  avatarUrl?: string
  signature?: string
}

export class ProfileService extends BaseManager {
  private client: MatrixClient | null = null
  private profileCache = getGlobalCache<UserProfile>('profile', { maxSize: 200, ttl: 60000 })

  initialize(client: MatrixClient): void {
    this.client = client
    this.profileCache.clear()
    info('[Profile] 服务已初始化')
  }

  getProfileFromCache(userId: string): UserProfile | null {
    return this.profileCache.get(userId) ?? null
  }

  async getProfile(userId: string, throwOnError = true): Promise<UserProfile> {
    const cached = this.profileCache.get(userId)
    if (cached) return cached

    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      const extendedClient = this.client as unknown as ExtendedMatrixClientForProfile
      const profile = await extendedClient.getProfile?.(userId)
      const result: UserProfile = {
        userId,
        displayname: profile?.displayname,
        avatarUrl: profile?.avatar_url
      }
      this.profileCache.set(userId, result)
      return result
    } catch (err) {
      return this.handleError(err, 'getProfile', { userId } as UserProfile, throwOnError)
    }
  }

  async getDisplayName(userId: string, throwOnError = true): Promise<string | undefined> {
    const cached = this.profileCache.get(userId)
    if (cached) return cached.displayname

    try {
      const profile = await this.getProfile(userId, throwOnError)
      return profile.displayname
    } catch (err) {
      return this.handleError(err, 'getDisplayName', undefined, throwOnError)
    }
  }

  async getAvatarUrl(userId: string, throwOnError = true): Promise<string | undefined> {
    const cached = this.profileCache.get(userId)
    if (cached) return cached.avatarUrl

    try {
      const profile = await this.getProfile(userId, throwOnError)
      return profile.avatarUrl
    } catch (err) {
      return this.handleError(err, 'getAvatarUrl', undefined, throwOnError)
    }
  }

  async setDisplayName(displayname: string, throwOnError = false): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      const extendedClient = this.client as unknown as ExtendedMatrixClientForProfile
      await extendedClient.setDisplayName?.(displayname)
      info(`[Profile] 设置显示名成功: ${displayname}`)
    } catch (err) {
      this.handleError(err, 'setDisplayName', undefined as void, throwOnError)
    }
  }

  async setAvatarUrl(avatarUrl: string, throwOnError = false): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      const extendedClient = this.client as unknown as ExtendedMatrixClientForProfile
      await extendedClient.setAvatarUrl?.(avatarUrl)
      info(`[Profile] 设置头像成功: ${avatarUrl}`)
    } catch (err) {
      this.handleError(err, 'setAvatarUrl', undefined as void, throwOnError)
    }
  }

  async uploadAndSetAvatar(file: File | Blob, throwOnError = false): Promise<string> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    try {
      const extendedClient = this.client as unknown as ExtendedMatrixClientForProfile
      const response = await extendedClient.uploadContent?.(file, {
        type: file.type,
        rawResponse: false
      })

      if (!response?.content_uri) {
        throw new Error('上传失败：未返回 content_uri')
      }

      await this.setAvatarUrl(response.content_uri, throwOnError)

      return response.content_uri
    } catch (err) {
      return this.handleError(err, 'uploadAndSetAvatar', '' as string, throwOnError)
    }
  }
}

export const profileService = new ProfileService()

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
