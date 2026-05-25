import { getCurrentSessionRoomId, setCurrentSessionRoomId } from '@/common/currentSessionRoomState'
import {
  clearCurrentUserState,
  getCurrentUserInfo,
  patchCurrentUserInfoFields,
  setCurrentUserInfo
} from '@/common/currentUserState'
import { setTrayMenuShow } from '@/common/globalUiState'
import { getMatrixClient } from '@/services/matrix/matrixClientAccessor'
import { getMatrixSessionSnapshot } from '@/services/matrix/matrixSessionState'
import type { UserInfoType } from '@/services/types'
import { pinia } from '@/stores'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useRoomStore } from '@/stores/domains/chat/room'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { MatrixRuntimeSessionService, type SessionStorePort } from './MatrixRuntimeSessionService'

export function createSessionStorePort(): SessionStorePort {
  const matrixStore = () => useMatrixStore(pinia)
  const userStore = () => useUserStore(pinia)
  const roomStore = () => useRoomStore(pinia)
  const chatStore = () => useChatStore(pinia)
  const groupStore = () => useGroupStore(pinia)
  const contactStore = () => useContactStore(pinia)
  const loginHistoryStore = () => useLoginHistoriesStore(pinia)
  const emojiStore = () => useEmojiStore(pinia)
  const settingStore = () => useSettingStore(pinia)
  const getRuntimeMatrixSession = () => {
    const sessionSnapshot = getMatrixSessionSnapshot()
    const store = matrixStore() as unknown as {
      userId?: string | null
      accessToken?: string | null
      homeserverUrl?: string | null
    }

    return {
      userId: sessionSnapshot.userId ?? store.userId ?? null,
      accessToken: sessionSnapshot.accessToken ?? store.accessToken ?? null,
      homeserverUrl: sessionSnapshot.homeserverUrl ?? store.homeserverUrl ?? null
    }
  }

  return {
    matrix: {
      getClient() {
        return getMatrixClient() ?? matrixStore().getClient?.() ?? null
      },
      getUserId() {
        return getRuntimeMatrixSession().userId
      },
      isLoggedIn() {
        const runtimeSession = getRuntimeMatrixSession()
        return Boolean(runtimeSession.userId && runtimeSession.accessToken)
      },
      isInitialized() {
        return matrixStore().isInitialized
      },
      getLastError() {
        return matrixStore().lastError ?? undefined
      },
      getAccessToken() {
        return getRuntimeMatrixSession().accessToken ?? undefined
      },
      getRefreshToken() {
        return (matrixStore() as unknown as { refreshToken?: string }).refreshToken ?? undefined
      },
      getHomeserverUrl() {
        return getRuntimeMatrixSession().homeserverUrl ?? undefined
      },
      initialize(config) {
        return matrixStore().initialize(config)
      },
      login(username, password, deviceName) {
        return matrixStore().login(username, password, deviceName)
      },
      completeSSOLogin(loginToken) {
        return matrixStore().completeSSOLogin(loginToken)
      },
      loginWithToken(accessToken, userId) {
        return matrixStore().loginWithToken(accessToken, userId)
      },
      logout() {
        return matrixStore().logout()
      }
    },
    user: {
      getUserInfo() {
        return getCurrentUserInfo()
      },
      initUserInfo(uid, displayName) {
        userStore().initUserInfo(uid, displayName)
      },
      setUserInfo(info) {
        setCurrentUserInfo(info)
      },
      clearUser() {
        clearCurrentUserState()
      },
      async fetchUserProfile(uid) {
        const profile = await userStore().fetchUserProfile(uid)
        if (!profile) return null
        return {
          displayName: profile.displayName ?? undefined,
          avatarUrl: profile.avatarUrl ?? undefined
        }
      },
      updateProfileFields(fields) {
        patchCurrentUserInfoFields(fields)
      }
    },
    room: {
      getRoomList() {
        return roomStore().roomList
      },
      getMessages(roomId) {
        return chatStore().chatMessageListByRoomId(roomId)
      },
      resetState() {
        roomStore().resetState()
      },
      setupEventListeners() {
        return roomStore().setupEventListeners()
      },
      loadRooms() {
        return roomStore().loadRooms()
      }
    },
    chat: {
      getSessionList(refresh) {
        return chatStore().getSessionList(refresh)
      },
      getSessionListValue() {
        return chatStore().sessionList
      }
    },
    group: {
      clearGroupDetails() {
        groupStore().groupDetails.length = 0
      },
      clearMembersMap() {
        const store = groupStore()
        for (const key of Object.keys(store.membersMap)) {
          delete store.membersMap[key]
        }
      },
      updateUserPresence(userId, presence) {
        if (typeof groupStore().updateUserPresence === 'function') {
          groupStore().updateUserPresence(userId, presence)
        }
      }
    },
    contact: {
      updateContactPresence(userId, patch) {
        if (typeof contactStore().updateContactPresence === 'function') {
          contactStore().updateContactPresence(userId, patch)
        }
      }
    },
    global: {
      getCurrentSessionRoomId() {
        return getCurrentSessionRoomId()
      },
      updateCurrentSessionRoomId(roomId) {
        setCurrentSessionRoomId(roomId)
      },
      setTrayMenuShow(show) {
        setTrayMenuShow(show)
      }
    },
    loginHistory: {
      addLoginHistory(account) {
        loginHistoryStore().addLoginHistory(account as UserInfoType)
      }
    },
    emoji: {
      initEmojis() {
        return emojiStore().initEmojis()
      },
      prefetchEmojiToLocal() {
        return emojiStore().prefetchEmojiToLocal()
      }
    },
    setting: {
      closeAutoLogin() {
        settingStore().closeAutoLogin()
      }
    }
  }
}

export const sessionOrchestrator = new MatrixRuntimeSessionService(createSessionStorePort())
