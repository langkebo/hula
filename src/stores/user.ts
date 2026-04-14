import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { StoresEnum, SexEnum } from '@/enums'
import type { UserInfoType } from '@/services/types'
import { useMatrixStore } from './matrix'
import { matrixClientService } from '@/services/matrix'
import * as PathUtil from '@/utils/PathUtil'
import { useGlobalStore } from './global'
import { info, error } from '@tauri-apps/plugin-log'

export interface MatrixUserProfile {
  userId: string
  displayName: string | null
  name?: string
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
      return matrixProfile.value?.displayName || matrixStore.userId?.split(':')[0] || 'User'
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
        const profile = await client.getProfileInfo(targetUserId)
        const userProfile: MatrixUserProfile = {
          userId: targetUserId,
          displayName: profile.displayname || null,
          avatarUrl: profile.avatar_url || null
        }

        if (!userId || userId === matrixStore.userId) {
          matrixProfile.value = userProfile
        }

        info(`[UserStore] 获取用户资料成功: ${targetUserId}`)
        return userProfile
      } catch (err) {
        error(`[UserStore] 获取用户资料失败: ${err}`)
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
        error(`[UserStore] 更新显示名称失败: ${err}`)
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
        error(`[UserStore] 更新头像失败: ${err}`)
        return false
      }
    }

    async function getUserPresence(userId: string): Promise<string | null> {
      const client = matrixClientService.getClient()
      if (!client) {
        return null
      }

      try {
        const presence = await client.getPresence(userId)
        return presence.presence || null
      } catch (err) {
        error(`[UserStore] 获取用户状态失败: ${err}`)
        return null
      }
    }

    function initUserInfo(matrixUserId: string, displayName?: string) {
      userInfo.value = {
        uid: matrixUserId,
        name: displayName || matrixUserId.split(':')[0],
        account: matrixUserId,
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

    function getUserById(userId: string): MatrixUserProfile | null {
      if (matrixProfile.value?.userId === userId) {
        return matrixProfile.value
      }
      return null
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
      clearUser,
      getUserById
    }
  },
  {
    share: {
      enable: true,
      initialize: true
    }
  }
)
