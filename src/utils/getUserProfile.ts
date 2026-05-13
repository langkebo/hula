import { computed } from 'vue'
import { OnlineEnum } from '@/enums'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'

/**
 * 统一的用户资料接口
 */
export interface UnifiedUserProfile {
  userId: string
  uid: string
  name: string
  account: string
  avatar: string
  avatarUrl: string
  activeStatus: OnlineEnum
  displayName: string | null
  /** 数据源优先级标记：group > contact > user > fallback */
  source: 'group' | 'contact' | 'user' | 'fallback'
}

/**
 * 从 groupStore 获取用户信息
 */
function getFromGroupStore(userId: string, roomId?: string) {
  const groupStore = useGroupStore()

  // 优先从指定房间获取
  if (roomId) {
    const member = groupStore.getUserInfo(userId, roomId)
    if (member) {
      return {
        userId: member.userId,
        uid: member.uid,
        name: member.name || member.userId.split(':')[0],
        account: member.account || member.userId.split(':')[0],
        avatar: member.avatar || '',
        avatarUrl: member.avatarUrl || '',
        activeStatus: member.activeStatus ?? OnlineEnum.OFFLINE,
        displayName: member.displayName,
        source: 'group' as const
      }
    }
  }

  // 从所有房间成员中查找
  const allMembers = groupStore.allUserInfo
  const member = allMembers.find((m) => m.userId === userId || m.uid === userId)

  if (member) {
    return {
      userId: member.userId,
      uid: member.uid,
      name: member.name || member.userId.split(':')[0],
      account: member.account || member.userId.split(':')[0],
      avatar: member.avatar || '',
      avatarUrl: member.avatarUrl || '',
      activeStatus: member.activeStatus ?? OnlineEnum.OFFLINE,
      displayName: member.displayName,
      source: 'group' as const
    }
  }

  return null
}

/**
 * 从 contactsStore 获取用户信息
 */
function getFromContactsStore(userId: string) {
  const contactStore = useContactStore()
  const contact = contactStore.getContactByUserId(userId)

  if (contact) {
    return {
      userId: contact.userId,
      uid: contact.uid,
      name: contact.name || contact.userId.split(':')[0],
      account: contact.account || contact.userId.split(':')[0],
      avatar: contact.avatar || '',
      avatarUrl: contact.avatarUrl || '',
      activeStatus: contact.activeStatus ?? OnlineEnum.OFFLINE,
      displayName: contact.displayName,
      source: 'contact' as const
    }
  }

  return null
}

/**
 * 从 userStore 获取用户信息
 */
function getFromUserStore(userId: string) {
  const userStore = useUserStore()

  // 检查是否是当前用户
  if (userStore.userInfo?.uid === userId) {
    return {
      userId: userId,
      uid: userStore.userInfo.uid,
      name: userStore.userInfo.name || userId.split(':')[0],
      account: userStore.userInfo.account || userId.split(':')[0],
      avatar: userStore.userInfo.avatar || '',
      avatarUrl: userStore.userInfo.avatar || '',
      activeStatus: userStore.userInfo.activeStatus ?? OnlineEnum.OFFLINE,
      displayName: userStore.userInfo.name || null,
      source: 'user' as const
    }
  }

  return null
}

/**
 * 获取统一的用户资料
 *
 * 数据源优先级：groupStore > contactsStore > userStore > fallback
 *
 * @param userId - 用户 ID
 * @param roomId - 房间 ID（可选，用于优先从指定房间获取群成员信息）
 * @returns 统一的用户资料
 */
export function getUserProfile(userId: string, roomId?: string): UnifiedUserProfile {
  const userStore = useUserStore()

  // 当前登录用户优先使用 userStore，避免被群成员缓存中的旧昵称/旧头像覆盖。
  if (userStore.userInfo?.uid === userId) {
    const fromUser = getFromUserStore(userId)
    if (fromUser) return fromUser
  }

  // 按优先级依次尝试获取
  const fromGroup = getFromGroupStore(userId, roomId)
  if (fromGroup) return fromGroup

  const fromContact = getFromContactsStore(userId)
  if (fromContact) return fromContact

  const fromUser = getFromUserStore(userId)
  if (fromUser) return fromUser

  // Fallback：仅使用 userId
  return {
    userId,
    uid: userId,
    name: userId.split(':')[0],
    account: userId.split(':')[0],
    avatar: '',
    avatarUrl: '',
    activeStatus: OnlineEnum.OFFLINE,
    displayName: null,
    source: 'fallback'
  }
}

/**
 * 创建一个响应式的用户资料 computed
 *
 * @param userId - 用户 ID（可以是响应式的）
 * @param roomId - 房间 ID（可选，可以是响应式的）
 * @returns 响应式的用户资料
 */
export function useUserProfile(userId: string | (() => string), roomId?: string | (() => string | undefined)) {
  return computed(() => {
    const uid = typeof userId === 'function' ? userId() : userId
    const rid = typeof roomId === 'function' ? roomId() : roomId
    return getUserProfile(uid, rid)
  })
}

/**
 * 获取用户的显示名称
 *
 * 优先级：displayName > name > account > userId
 *
 * @param userId - 用户 ID
 * @param roomId - 房间 ID（可选）
 * @returns 显示名称
 */
export function getUserDisplayName(userId: string, roomId?: string): string {
  const profile = getUserProfile(userId, roomId)

  // 优先级：displayName > name > account > userId
  if (profile.displayName) return profile.displayName
  if (profile.name && profile.name !== profile.userId.split(':')[0]) return profile.name
  if (profile.account) return profile.account
  return profile.userId.split(':')[0]
}

/**
 * 获取用户的头像 URL
 *
 * @param userId - 用户 ID
 * @param roomId - 房间 ID（可选）
 * @returns 头像 URL
 */
export function getUserAvatarUrl(userId: string, roomId?: string): string {
  const profile = getUserProfile(userId, roomId)
  return profile.avatarUrl || profile.avatar || ''
}

/**
 * 获取用户的在线状态
 *
 * @param userId - 用户 ID
 * @param roomId - 房间 ID（可选）
 * @returns 在线状态
 */
export function getUserActiveStatus(userId: string, roomId?: string): OnlineEnum {
  const profile = getUserProfile(userId, roomId)
  return profile.activeStatus
}
