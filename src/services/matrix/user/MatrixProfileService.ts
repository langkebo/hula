import { error, info, warn } from '@tauri-apps/plugin-log'
import type { MatrixClient } from 'matrix-js-sdk'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { matrixClientService } from '../MatrixClientService'

export interface MatrixProfile {
  userId: string
  displayname?: string
  avatarUrl?: string
}

interface UploadContentResponse {
  content_uri: string
}

class MatrixProfileService {
  private client: MatrixClient | null = null

  initialize(client: MatrixClient): void {
    this.client = client
    info('[ProfileService] 服务已初始化')
  }

  private ensureClient(): MatrixClient {
    const activeClient = matrixClientService.getClient() ?? this.client
    if (!activeClient) {
      throw new Error('Client 未初始化')
    }
    if (this.client !== activeClient) {
      this.client = activeClient
    }
    return activeClient
  }

  async getProfile(userId: string): Promise<MatrixProfile> {
    try {
      const client = this.ensureClient()
      const profile = await client.getProfileInfo(userId)
      return {
        userId,
        displayname: profile.displayname,
        avatarUrl: profile.avatar_url
      }
    } catch (err: unknown) {
      // 13.4.3: 降级处理 404 (M_NOT_FOUND)，这在 Matrix 中是常见现象（例如用户未设置资料或用户不存在）
      if ((err as { httpStatus?: number })?.httpStatus === 404 || String(err).includes('404')) {
        warn(`[ProfileService] 用户资料不存在: ${userId}`)
      } else {
        error(`[ProfileService] 获取资料失败: ${userId}, ${err}`)
      }
      throw err
    }
  }

  async getDisplayName(userId: string): Promise<string | undefined> {
    try {
      const profile = await this.getProfile(userId)
      return profile.displayname
    } catch (err) {
      warn(`[ProfileService] 获取昵称失败: ${userId}, ${err}`)
      return undefined
    }
  }

  async getAvatarUrl(userId: string): Promise<string | undefined> {
    try {
      const profile = await this.getProfile(userId)
      return profile.avatarUrl
    } catch (err) {
      warn(`[ProfileService] 获取头像失败: ${userId}, ${err}`)
      return undefined
    }
  }

  async setDisplayName(displayName: string): Promise<void> {
    try {
      const client = this.ensureClient()
      await client.setDisplayName(displayName)
      info('[ProfileService] 更新昵称成功')
    } catch (err) {
      error(`[ProfileService] 更新昵称失败: ${err}`)
      throw err
    }
  }

  async setAvatarUrl(avatarUrl: string): Promise<void> {
    try {
      const client = this.ensureClient()
      await client.setAvatarUrl(avatarUrl)
      info('[ProfileService] 更新头像成功')
    } catch (err) {
      error(`[ProfileService] 更新头像失败: ${err}`)
      throw err
    }
  }

  async uploadAndSetAvatar(file: Blob | File): Promise<string> {
    try {
      const client = this.ensureClient()
      const response = (await client.uploadContent(file, {
        type: file.type || 'application/octet-stream',
        rawResponse: false
      })) as UploadContentResponse

      await client.setAvatarUrl(response.content_uri)
      info('[ProfileService] 上传头像成功')
      return response.content_uri
    } catch (err) {
      error(`[ProfileService] 上传头像失败: ${err}`)
      throw err
    }
  }
}

export const profileService = new MatrixProfileService()

interface UseProfileResult {
  profile: Ref<MatrixProfile | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  getProfile: (userId: string) => Promise<MatrixProfile>
  setDisplayName: (displayName: string) => Promise<void>
  setAvatarUrl: (avatarUrl: string) => Promise<void>
  uploadAvatar: (file: Blob | File) => Promise<string>
}

export function useProfile(): UseProfileResult {
  const profile = ref<MatrixProfile | null>(null)
  const isLoading = ref(false)
  const errorMessage = ref<string | null>(null)

  const runWithLoading = async <T>(operation: () => Promise<T>): Promise<T> => {
    isLoading.value = true
    errorMessage.value = null
    try {
      return await operation()
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : '操作失败'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const getProfile = async (userId: string): Promise<MatrixProfile> => {
    return await runWithLoading(async () => {
      const result = await profileService.getProfile(userId)
      profile.value = result
      return result
    })
  }

  const setDisplayName = async (displayName: string): Promise<void> => {
    await runWithLoading(async () => {
      await profileService.setDisplayName(displayName)
      if (profile.value) {
        profile.value = {
          ...profile.value,
          displayname: displayName
        }
      }
    })
  }

  const setAvatarUrl = async (avatarUrl: string): Promise<void> => {
    await runWithLoading(async () => {
      await profileService.setAvatarUrl(avatarUrl)
      if (profile.value) {
        profile.value = {
          ...profile.value,
          avatarUrl
        }
      }
    })
  }

  const uploadAvatar = async (file: Blob | File): Promise<string> => {
    return await runWithLoading(async () => {
      const avatarUrl = await profileService.uploadAndSetAvatar(file)
      if (profile.value) {
        profile.value = {
          ...profile.value,
          avatarUrl
        }
      }
      return avatarUrl
    })
  }

  return {
    profile,
    isLoading,
    error: errorMessage,
    getProfile,
    setDisplayName,
    setAvatarUrl,
    uploadAvatar
  }
}

export default profileService
