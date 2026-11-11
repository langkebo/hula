import { getCurrentSessionRoomId, setCurrentSessionRoomId } from '@/common/currentSessionRoomState'
import {
  clearCurrentUserState,
  getCurrentUserInfo,
  patchCurrentUserInfoFields,
  setCurrentUserInfo
} from '@/common/currentUserState'
import { setTrayMenuShow } from '@/common/globalUiState'
import { getMatrixAccessToken, getMatrixClient } from '@/services/matrix/matrixClientAccessor'
import { getMatrixSessionSnapshot } from '@/services/matrix/matrixSessionState'
import type { UserInfoType } from '@/services/types'
import { pinia } from '@/stores'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useEmojiStore } from '@/stores/domains/chat/emoji'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useLocationStore } from '@/stores/domains/chat/location'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { useRoomStore } from '@/stores/domains/chat/room'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useLoginHistoriesStore } from '@/stores/domains/user/loginHistory'
import { useUserStore } from '@/stores/domains/user/user'
import { MatrixRuntimeSessionService, type SessionStorePort } from './MatrixRuntimeSessionService'

/**
 * Create a SessionStorePort that bridges Pinia stores, MatrixClientService,
 * and the current user/room runtime state into a single interface for
 * MatrixRuntimeSessionService.
 *
 * **这是应用启动期的组合根（composition root），不是「服务层反向依赖 store」。**
 * 本文件是全仓唯一把「store 层聚合为 service 所需端口」的适配器：`SessionStorePort`
 * 由服务层定义，实现放在这里、只在启动时实例化一次。把它挪到 store 层并不能消除
 * `service → store` 的边 —— 只会把同一份适配逻辑连同 `sessionOrchestrator` 单例
 * 一起搬走，并让 4 处导入路径跟着改（router / useLoginFlow / GuestUpgradeModal / 测试桩）。
 * 故 2026-11-05 复审判定为**已知折中、不再迁移**（ARCH-A01 结项）。
 *
 * @throws Never throws (factory function, all store access is synchronous).
 */
export function createSessionStorePort(): SessionStorePort {
  const matrixStore = () => useMatrixStore(pinia)
  const userStore = () => useUserStore(pinia)
  const roomStore = () => useRoomStore(pinia)
  const chatStore = () => useChatStore(pinia)
  const groupStore = () => useGroupStore(pinia)
  const locationStore = () => useLocationStore(pinia)
  const loginHistoryStore = () => useLoginHistoriesStore(pinia)
  const emojiStore = () => useEmojiStore(pinia)
  const settingStore = () => useSettingStore(pinia)
  const getRuntimeMatrixSession = () => {
    const sessionSnapshot = getMatrixSessionSnapshot()
    const store = matrixStore() as {
      userId?: string | null
      accessToken?: string | null
      homeserverUrl?: string | null
    }

    return {
      userId: sessionSnapshot.userId ?? store.userId ?? null,
      // AR-07b / B1：token 不再从快照或 pinia 镜像取（两者刷新后都陈旧），
      // 唯一读入口是 accessor —— 它直接读 SDK client，client 内即真相。
      accessToken: getMatrixAccessToken(),
      homeserverUrl: sessionSnapshot.homeserverUrl ?? store.homeserverUrl ?? null
    }
  }

  return {
    matrix: {
      getClient() {
        return getMatrixClient() ?? null
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
      getHomeserverUrl() {
        return getRuntimeMatrixSession().homeserverUrl ?? undefined
      },
      initialize(config) {
        return matrixStore().initialize(config)
      },
      login(username, password, deviceName) {
        return matrixStore().login(username, password, deviceName)
      },
      registerGuest(deviceName) {
        return matrixStore().registerGuest(deviceName)
      },
      applyGuestUpgrade(userId, accessToken) {
        matrixStore().applyGuestUpgrade(userId, accessToken)
      },
      completeSSOLogin(loginToken) {
        return matrixStore().completeSSOLogin(loginToken)
      },
      loginWithToken(accessToken, userId, refreshToken) {
        return matrixStore().loginWithToken(accessToken, userId, refreshToken)
      },
      stopClient() {
        return matrixStore().stopClient()
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
        // 页面内登录不经过 SessionRestoreService 的 initUserInfo，只写 currentUserState
        // 会让 userStore.userInfo 一直为空：自己发的消息被判定成他人（isMe=false），
        // 头像、消息对齐与失败重试入口全部失效，直到手动刷新页面。
        userStore().userInfo = info
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
    location: {
      reset() {
        locationStore().reset()
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
