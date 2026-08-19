import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { formatMatrixError } from '@/common/matrixErrorTranslator'
import { SexEnum, StoresEnum } from '@/enums'
import { matrixPresenceService } from '@/services/matrix/user/MatrixPresenceService'
import { profileService } from '@/services/matrix/user/MatrixProfileService'
import type { UserInfoType } from '@/services/types'
import { createLogger } from '@/utils/Logger'
import * as PathUtil from '@/utils/PathUtil'
import { toLocalpart } from '@/utils/userIdentity'
import { useMatrixStore } from '../chat/matrix'
import { useGlobalStore } from '../widget/global'

const logger = createLogger('user')

interface MatrixUserProfile {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  sex?: number
  resume?: string
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
      const targetUserId = userId || matrixStore.userId
      if (!targetUserId) {
        logger.error('[UserStore] 用户ID不存在')
        return null
      }

      try {
        const profile = await profileService.getProfile(targetUserId)
        const extendedProfile = await profileService.getExtendedProfile(targetUserId)

        const userProfile: MatrixUserProfile = {
          userId: targetUserId,
          displayName: profile.displayname ?? null,
          avatarUrl: profile.avatarUrl ?? null,
          sex: typeof extendedProfile.sex === 'number' ? extendedProfile.sex : undefined,
          resume: typeof extendedProfile.resume === 'string' ? extendedProfile.resume : undefined
        }

        if (!userId || userId === matrixStore.userId) {
          matrixProfile.value = userProfile
          if (userInfo.value) {
            if (userProfile.displayName) {
              userInfo.value.name = userProfile.displayName
            }
            if (userProfile.avatarUrl) {
              userInfo.value.avatar = userProfile.avatarUrl
            }
            if (typeof userProfile.sex === 'number') {
              userInfo.value.sex = userProfile.sex as UserInfoType['sex']
            }
            if (typeof userProfile.resume === 'string') {
              userInfo.value.resume = userProfile.resume
            }
          }
        }

        logger.info(`[UserStore] 获取用户资料成功: ${targetUserId}`)
        return userProfile
      } catch (err) {
        logger.error(`[UserStore] 获取用户资料失败: ${formatMatrixError(err)}`)
        return null
      }
    }

    async function updateDisplayName(displayName: string): Promise<boolean> {
      try {
        await profileService.setDisplayName(displayName)
        if (matrixProfile.value) {
          matrixProfile.value.displayName = displayName
        }
        logger.info(`[UserStore] 更新显示名称成功: ${displayName}`)
        return true
      } catch (err) {
        logger.error(`[UserStore] 更新显示名称失败: ${formatMatrixError(err)}`)
        return false
      }
    }

    async function updateAvatar(avatarUrl: string): Promise<boolean> {
      try {
        await profileService.setAvatarUrl(avatarUrl)
        if (matrixProfile.value) {
          matrixProfile.value.avatarUrl = avatarUrl
        }
        // 关键同步：LeftAvatar / UserMenu 等大量入口读的是 userInfo.avatar（原始 mxc），
        // 若不在这里同步，设置页改头像后侧边栏头像不会刷新（与 InfoEdit.vue 的更新路径保持一致）。
        if (userInfo.value) {
          userInfo.value.avatar = avatarUrl
        }
        logger.info('[UserStore] 更新头像成功')
        return true
      } catch (err) {
        logger.error(`[UserStore] 更新头像失败: ${formatMatrixError(err)}`)
        return false
      }
    }

    async function getUserPresence(userId: string): Promise<string | null> {
      try {
        const presence = await matrixPresenceService.getPresence(userId)
        return presence.presence || null
      } catch (err) {
        logger.error(`[UserStore] 获取用户状态失败: ${formatMatrixError(err)}`)
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
        modifyNameChance: -1,
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
