import type { UserInfoType } from '@/services/types'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useRoomStore } from '@/stores/domains/chat/room'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { MatrixRuntimeSessionService, type SessionStorePort } from './MatrixRuntimeSessionService'

export function createSessionStorePort(): SessionStorePort {
  return {
    matrix: {
      getClient() {
        return useMatrixStore().getClient()
      },
      getUserId() {
        return useMatrixStore().userId
      },
      isLoggedIn() {
        return useMatrixStore().isLoggedIn
      },
      isInitialized() {
        return useMatrixStore().isInitialized
      },
      getLastError() {
        return useMatrixStore().lastError ?? undefined
      },
      getAccessToken() {
        return useMatrixStore().accessToken ?? undefined
      },
      getRefreshToken() {
        return (useMatrixStore() as unknown as { refreshToken?: string }).refreshToken ?? undefined
      },
      getHomeserverUrl() {
        return useMatrixStore().homeserverUrl ?? undefined
      },
      initialize(config) {
        return useMatrixStore().initialize(config)
      },
      login(username, password, deviceName) {
        return useMatrixStore().login(username, password, deviceName)
      },
      completeSSOLogin(loginToken) {
        return useMatrixStore().completeSSOLogin(loginToken)
      },
      loginWithToken(accessToken, userId) {
        return useMatrixStore().loginWithToken(accessToken, userId)
      },
      logout() {
        return useMatrixStore().logout()
      }
    },
    user: {
      getUserInfo() {
        return useUserStore().userInfo
      },
      initUserInfo(uid, displayName) {
        useUserStore().initUserInfo(uid, displayName)
      },
      setUserInfo(info) {
        useUserStore().userInfo = info
      },
      clearUser() {
        useUserStore().clearUser()
      },
      async fetchUserProfile(uid) {
        const profile = await useUserStore().fetchUserProfile(uid)
        if (!profile) return null
        return {
          displayName: profile.displayName ?? undefined,
          avatarUrl: profile.avatarUrl ?? undefined
        }
      },
      updateProfileFields(fields) {
        const userStore = useUserStore()
        if (!userStore.userInfo) return
        if (fields.name !== undefined) userStore.userInfo.name = fields.name
        if (fields.avatar !== undefined) userStore.userInfo.avatar = fields.avatar
        if (fields.activeStatus !== undefined) userStore.userInfo.activeStatus = fields.activeStatus
        if (fields.lastOptTime !== undefined) userStore.userInfo.lastOptTime = fields.lastOptTime
      }
    },
    room: {
      getRoomList() {
        return useRoomStore().roomList
      },
      getMessages(roomId) {
        return useChatStore().chatMessageListByRoomId(roomId)
      },
      resetState() {
        useRoomStore().resetState()
      },
      setupEventListeners() {
        return useRoomStore().setupEventListeners()
      },
      loadRooms() {
        return useRoomStore().loadRooms()
      }
    },
    chat: {
      getSessionList(refresh) {
        return useChatStore().getSessionList(refresh)
      },
      getSessionListValue() {
        return useChatStore().sessionList
      }
    },
    group: {
      clearGroupDetails() {
        useGroupStore().groupDetails.length = 0
      },
      clearMembersMap() {
        const groupStore = useGroupStore()
        for (const key of Object.keys(groupStore.membersMap)) {
          delete groupStore.membersMap[key]
        }
      },
      updateUserPresence(userId, presence) {
        if (typeof useGroupStore().updateUserPresence === 'function') {
          useGroupStore().updateUserPresence(userId, presence)
        }
      }
    },
    contact: {
      updateContactPresence(userId, patch) {
        if (typeof useContactStore().updateContactPresence === 'function') {
          useContactStore().updateContactPresence(userId, patch)
        }
      }
    },
    global: {
      getCurrentSessionRoomId() {
        return useGlobalStore().currentSessionRoomId
      },
      updateCurrentSessionRoomId(roomId) {
        useGlobalStore().updateCurrentSessionRoomId(roomId)
      },
      setTrayMenuShow(show) {
        useGlobalStore().isTrayMenuShow = show
      }
    },
    loginHistory: {
      addLoginHistory(account) {
        useLoginHistoriesStore().addLoginHistory(account as UserInfoType)
      }
    },
    emoji: {
      initEmojis() {
        return useEmojiStore().initEmojis()
      },
      prefetchEmojiToLocal() {
        return useEmojiStore().prefetchEmojiToLocal()
      }
    },
    setting: {
      closeAutoLogin() {
        useSettingStore().closeAutoLogin()
      }
    }
  }
}

export const sessionOrchestrator = new MatrixRuntimeSessionService(createSessionStorePort())
