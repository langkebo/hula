import { createLogger } from '@/utils/Logger'

const logger = createLogger('MatrixProfile')

import type { MatrixClient } from 'matrix-js-sdk'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { BaseMatrixService } from '../BaseMatrixService'

interface MatrixProfile {
  userId: string
  displayname?: string
  avatarUrl?: string
}

interface MatrixExtendedProfile {
  sex?: number
  resume?: string
  region?: string
  birthday?: string
  displayBirthdayTag?: boolean
  displayAge?: boolean
  displayConstellation?: boolean
  [key: string]: string | number | boolean | null | undefined | Record<string, unknown> | Array<unknown>
}

export class ExtendedProfileUnsupportedError extends Error {
  code = 'EXTENDED_PROFILE_UNSUPPORTED'

  constructor(message = 'Extended profile is not supported by the server') {
    super(message)
    this.name = 'ExtendedProfileUnsupportedError'
  }
}

interface UploadContentResponse {
  content_uri: string
}

class MatrixProfileService extends BaseMatrixService {
  private isUnsupportedExtendedProfileError(err: unknown): boolean {
    const httpStatus = (err as { httpStatus?: number })?.httpStatus
    const errcode = (err as { errcode?: string })?.errcode
    const message = String(err)
    return (
      errcode === 'M_UNRECOGNIZED' ||
      message.includes('M_UNRECOGNIZED') ||
      message.includes('Unrecognized request') ||
      message.includes('Server does not support extended profiles') ||
      httpStatus === 501
    )
  }

  private isMissingExtendedProfileError(err: unknown): boolean {
    const httpStatus = (err as { httpStatus?: number })?.httpStatus
    const errcode = (err as { errcode?: string })?.errcode
    return httpStatus === 404 || errcode === 'M_NOT_FOUND' || String(err).includes('404')
  }

  initialize(client: MatrixClient): void {
    this.setFallbackClient(client)
    logger.info('服务已初始化')
  }

  async getProfile(userId: string): Promise<MatrixProfile> {
    try {
      const client = this.getClient()
      const profile = await client.getProfileInfo(userId)
      return {
        userId,
        displayname: profile.displayname,
        avatarUrl: profile.avatar_url
      }
    } catch (err: unknown) {
      // 13.4.3: 降级处理 404 (M_NOT_FOUND)，这在 Matrix 中是常见现象（例如用户未设置资料或用户不存在）
      if ((err as { httpStatus?: number })?.httpStatus === 404 || String(err).includes('404')) {
        logger.warn(`用户资料不存在: ${userId}`)
      } else {
        logger.error(`获取资料失败: ${userId}, ${err}`)
      }
      throw err
    }
  }

  async getDisplayName(userId: string): Promise<string | undefined> {
    try {
      const profile = await this.getProfile(userId)
      return profile.displayname
    } catch (err) {
      logger.warn(`获取昵称失败: ${userId}, ${err}`)
      return undefined
    }
  }

  async getAvatarUrl(userId: string): Promise<string | undefined> {
    try {
      const profile = await this.getProfile(userId)
      return profile.avatarUrl
    } catch (err) {
      logger.warn(`获取头像失败: ${userId}, ${err}`)
      return undefined
    }
  }

  async setDisplayName(displayName: string): Promise<void> {
    try {
      const client = this.getClient()
      await client.setDisplayName(displayName)
      logger.info(`设置显示名称成功: ${displayName}`)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn('设置显示名称被中止')
      } else {
        logger.error(`设置显示名称失败: ${err}`)
      }
      throw err
    }
  }

  async setAvatarUrl(avatarUrl: string): Promise<void> {
    try {
      const client = this.getClient()
      await client.setAvatarUrl(avatarUrl)
      logger.info(`设置头像成功: ${avatarUrl}`)
    } catch (err) {
      logger.error(`设置头像失败: ${err}`)
      throw err
    }
  }

  async getExtendedProfile(userId: string): Promise<MatrixExtendedProfile> {
    try {
      const client = this.getClient()
      const response = await client.getProfileManager().getExtendedProfile(userId)
      if (!response || typeof response !== 'object' || Array.isArray(response)) {
        return {}
      }
      return response as MatrixExtendedProfile
    } catch (err) {
      if (this.isUnsupportedExtendedProfileError(err)) {
        logger.info(`服务器不支持扩展资料接口，返回空对象: ${userId}`)
        return {}
      }
      if (this.isMissingExtendedProfileError(err)) {
        logger.info(`扩展资料不存在，返回空对象: ${userId}`)
        return {}
      }
      logger.error(`获取扩展资料失败: ${userId}, ${err}`)
      throw err
    }
  }

  async setExtendedProfileField(userId: string, keyName: string, value: unknown): Promise<void> {
    try {
      const client = this.getClient()
      await client.getProfileManager().setExtendedProfilePropertyForUser(userId, keyName, value)
      logger.info(`设置扩展资料字段成功: ${userId}/${keyName}`)
    } catch (err) {
      if (this.isUnsupportedExtendedProfileError(err)) {
        throw new ExtendedProfileUnsupportedError()
      }
      logger.error(`设置扩展资料字段失败: ${userId}/${keyName}, ${err}`)
      throw err
    }
  }

  async deleteExtendedProfileField(userId: string, keyName: string): Promise<void> {
    try {
      const client = this.getClient()
      await client.getProfileManager().deleteExtendedProfilePropertyForUser(userId, keyName)
      logger.info(`删除扩展资料字段成功: ${userId}/${keyName}`)
    } catch (err) {
      if (this.isUnsupportedExtendedProfileError(err)) {
        throw new ExtendedProfileUnsupportedError()
      }
      if (this.isMissingExtendedProfileError(err)) {
        logger.info(`扩展资料字段不存在，跳过删除: ${userId}/${keyName}`)
        return
      }
      logger.error(`删除扩展资料字段失败: ${userId}/${keyName}, ${err}`)
      throw err
    }
  }

  async updateOwnExtendedProfile(fields: Partial<MatrixExtendedProfile>): Promise<MatrixExtendedProfile> {
    const client = this.getClient()
    const userId = client.getUserId()
    if (!userId) {
      throw new Error(this.t('matrix_error.account.cannot_get_user_id'))
    }

    const entries = Object.entries(fields)
    await Promise.all(
      entries.map(async ([key, value]) => {
        if (value === undefined || value === null || value === '') {
          await this.deleteExtendedProfileField(userId, key)
          return
        }
        await this.setExtendedProfileField(userId, key, value)
      })
    )

    return await this.getExtendedProfile(userId)
  }

  async uploadAndSetAvatar(file: Blob | File): Promise<string> {
    try {
      const client = this.getClient()
      const response = (await client.uploadContent(file, {
        type: file.type || 'application/octet-stream',
        rawResponse: false
      })) as UploadContentResponse

      await client.setAvatarUrl(response.content_uri)
      logger.info('上传头像成功')
      return response.content_uri
    } catch (err) {
      logger.error(`上传头像失败: ${err}`)
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
