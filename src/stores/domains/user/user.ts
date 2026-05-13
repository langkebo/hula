import { error, info } from '@tauri-apps/plugin-log'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { formatMatrixError } from '@/common/matrixErrorTranslator'
import { SexEnum, StoresEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import type { UserInfoType } from '@/services/types'
import * as PathUtil from '@/utils/PathUtil'
import { toLocalpart } from '@/utils/userIdentity'
import { useMatrixStore } from '../chat/matrix'
import { useGlobalStore } from '../widget/global'

export interface MatrixUserProfile {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  presence?: string
  statusMessage?: string
}

export const useUserStore = defineStore(
  StoresEnum.USER,
  () => {
    const userInfo = ref<UserInfoType | undefined>()
    const matrixProfile = ref<MatrixUserProfile | null>(null)
    const globalStore = useGlobalStore()
    const matrixStore = useMatrixStore()

    const isMe = computed(() => (id: string) => {
      return userInfo.value?.uid === id || matrixStore.userId === id
    })

    const isLoggedIn = computed(() => {
      return matrixStore.isLoggedIn
    })

    const currentUserDisplayName = computed(() => {
      return (
        matrixProfile.value?.displayName ||
        userInfo.value?.name ||
        toLocalpart(matrixStore.userId ?? userInfo.value?.uid) ||
        'User'
      )
    })

    const currentUserAvatarUrl = computed(() => {
      return matrixProfile.value?.avatarUrl
    })

    async function fetchUserProfile(userId?: string): Promise<MatrixUserProfile | null> {
      const client = matrixClientService.getClient()
      if (!client) {
        error('[UserStore] 客户端未初始化')
        return null
      }

      const targetUserId = userId || matrixStore.userId
      if (!targetUserId) {
        error('[UserStore] 用户ID不存在')
        return null
      }

      try {
        let displayName: string | null = null
        let avatarUrl: string | null = null

        const clientAny = client as unknown as Record<string, unknown>

        // 优先使用 ProfileManager
        const profileManager = clientAny.getProfileManager as
          | (() => { getProfileInfo: (userId: string) => Promise<{ displayname?: string; avatar_url?: string }> })
          | undefined
        const pm = profileManager?.()
        if (pm) {
          const profile = await pm.getProfileInfo(targetUserId)
          displayName = profile?.displayname ?? null
          avatarUrl = profile?.avatar_url ?? null
        } else {
          // 回退到标准 Matrix Client API
          const profileUrl = `/_matrix/client/v3/profile/${encodeURIComponent(targetUserId)}`
          const httpFn = clientAny.http as
            | { authedRequest: <T>(method: string, path: string, ...args: unknown[]) => Promise<T> }
            | undefined
          if (httpFn?.authedRequest) {
            const profile = await httpFn.authedRequest<{ displayname?: string; avatar_url?: string }>('GET', profileUrl)
            displayName = profile?.displayname ?? null
            avatarUrl = profile?.avatar_url ?? null
          } else {
            // 最终回退：使用 getProfileInfo（标准 SDK 方法）
            const getProfileInfo = clientAny.getProfileInfo as
              | ((userId: string) => Promise<{ displayname?: string; avatar_url?: string }>)
              | undefined
            if (getProfileInfo) {
              const profile = await getProfileInfo.call(client, targetUserId)
              displayName = profile?.displayname ?? null
              avatarUrl = profile?.avatar_url ?? null
            } else {
              throw new Error('MatrixClient 未提供可用的 profile 查询方法')
            }
          }
        }
        const userProfile: MatrixUserProfile = {
          userId: targetUserId,
          displayName,
          avatarUrl
        }

        if (!userId || userId === matrixStore.userId) {
          matrixProfile.value = userProfile
        }

        info(`[UserStore] 获取用户资料成功: ${targetUserId}`)
        return userProfile
      } catch (err) {
        error(`[UserStore] 获取用户资料失败: ${formatMatrixError(err)}`)
        return null
      }
    }

    async function updateDisplayName(displayName: string): Promise<boolean> {
      const client = matrixClientService.getClient()
      if (!client) {
        error('[UserStore] 客户端未初始化')
        return false
      }

      try {
        await client.setDisplayName(displayName)
        if (matrixProfile.value) {
          matrixProfile.value.displayName = displayName
        }
        info(`[UserStore] 更新显示名称成功: ${displayName}`)
        return true
      } catch (err) {
        error(`[UserStore] 更新显示名称失败: ${formatMatrixError(err)}`)
        return false
      }
    }

    async function updateAvatar(avatarUrl: string): Promise<boolean> {
      const client = matrixClientService.getClient()
      if (!client) {
        error('[UserStore] 客户端未初始化')
        return false
      }

      try {
        await client.setAvatarUrl(avatarUrl)
        if (matrixProfile.value) {
          matrixProfile.value.avatarUrl = avatarUrl
        }
        info(`[UserStore] 更新头像成功`)
        return true
      } catch (err) {
        error(`[UserStore] 更新头像失败: ${formatMatrixError(err)}`)
        return false
      }
    }

    async function getUserPresence(userId: string): Promise<string | null> {
      try {
        const presence = await matrixPresenceService.getPresence(userId)
        return presence.presence || null
      } catch (err) {
        error(`[UserStore] 获取用户状态失败: ${formatMatrixError(err)}`)
        return null
      }
    }

    function initUserInfo(matrixUserId: string, displayName?: string) {
      userInfo.value = {
        uid: matrixUserId,
        name: displayName || toLocalpart(matrixUserId),
        account: toLocalpart(matrixUserId),
        email: '',
        avatar: '',
        modifyNameChance: 0,
        sex: SexEnum.MAN,
        userStateId: '',
        avatarUpdateTime: 0,
        client: 'PC',
        resume: ''
      }
    }

    const getUserRoomDir = async () => {
      const uid = userInfo.value?.uid || matrixStore.userId
      if (!uid) {
        throw new Error('用户ID不存在')
      }
      return await PathUtil.getUserVideosDir(uid, globalStore.currentSessionRoomId)
    }

    const getUserRoomAbsoluteDir = async () => {
      const uid = userInfo.value?.uid || matrixStore.userId
      if (!uid) {
        throw new Error('用户ID不存在')
      }
      return await PathUtil.getUserAbsoluteVideosDir(uid, globalStore.currentSessionRoomId)
    }

    function clearUser() {
      userInfo.value = undefined
      matrixProfile.value = null
    }

    return {
      userInfo,
      matrixProfile,
      isMe,
      isLoggedIn,
      currentUserDisplayName,
      currentUserAvatarUrl,
      fetchUserProfile,
      updateDisplayName,
      updateAvatar,
      getUserPresence,
      initUserInfo,
      getUserRoomDir,
      getUserRoomAbsoluteDir,
      clearUser
    }
  },
  {
    persist: {
      pick: ['userInfo'],
      serializer: {
        serialize: (state: Record<string, unknown>) => {
          const info = state.userInfo as Record<string, unknown> | undefined
          if (!info) return JSON.stringify(state)
          const { password: _, phone: __, ...safe } = info
          return JSON.stringify({ ...state, userInfo: safe })
        },
        deserialize: JSON.parse
      }
    }
  }
)
