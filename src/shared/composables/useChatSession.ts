/**
 * 会话操作共享 composable（桌面端 + 移动端共享）。
 *
 * 从 useMessage 中提取的纯业务逻辑，不包含任何 UI 状态。
 * 桌面端 useMessage 在此基础上添加 msgBoxShow / menuList 等 UI 状态，
 * 移动端可直接使用本 composable 获得会话切换/删除能力。
 */

import { RoomTypeEnum } from '@/enums'
import { type SessionItem, useChatStore } from '@/stores/domains/chat/chat'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { invokeWithErrorHandler } from '@/utils/TauriInvokeHandler'

const logger = createLogger('useChatSession')

export const useChatSession = () => {
  const chatStore = useChatStore()
  const groupStore = useGroupStore()
  const userStore = useUserStore()
  const globalStore = useGlobalStore()

  /** 当前会话 roomId */
  const currentSessionRoomId = computed(() => globalStore.currentSessionRoomId)

  /**
   * 确保群成员已同步。
   * 如果本地缓存中找不到自己，说明尚未同步服务端数据，此时强制刷新群成员信息。
   */
  const ensureGroupMembersSynced = async (roomId: string, sessionType: RoomTypeEnum) => {
    if (sessionType !== RoomTypeEnum.GROUP) return

    const currentUid = userStore.userInfo?.uid
    if (!currentUid) return

    const memberList = groupStore.getUserListByRoomId(roomId)
    const alreadyHasCurrentUser = memberList.some((member) => member.uid === currentUid)

    if (!alreadyHasCurrentUser) {
      await groupStore.getGroupUserList(roomId, true)
    }
  }

  /**
   * 切换到指定会话。
   * 更新当前会话 ID、加载会话数据、标记已读、同步群成员。
   */
  const switchSession = async (item: SessionItem) => {
    const roomId = item.roomId
    logger.debug('切换会话:', roomId, 'UI未读数:', item.unreadCount)

    globalStore.updateCurrentSessionRoomId(roomId)
    chatStore.getSession(roomId)
    chatStore.markSessionRead(roomId)

    // 兜底刷新群成员，防止批量切换账号后看到旧数据
    try {
      await ensureGroupMembersSynced(roomId, item.type)
    } catch (error) {
      logger.error('同步群成员失败:', error)
    }
  }

  /**
   * 删除会话并自动选中相邻会话。
   * 如果删除的是当前选中会话，自动切换到下一个或上一个会话。
   */
  const removeSession = async (roomId: string) => {
    const currentSessions = chatStore.sessionList
    const currentIndex = currentSessions.findIndex((session) => session.roomId === roomId)
    const isCurrentSession = roomId === globalStore.currentSessionRoomId

    chatStore.removeSession(roomId)
    await invokeWithErrorHandler('hide_contact_command', { data: { roomId, hide: true } })

    // 不是当前选中会话，无需切换
    if (!isCurrentSession) return

    const updatedSessions = chatStore.sessionList
    const nextIndex = Math.min(currentIndex, updatedSessions.length - 1)
    const nextSession = updatedSessions[nextIndex]
    if (nextSession) {
      await switchSession(nextSession)
    }
  }

  /** 预加载聊天室（仅更新当前会话 ID，不加载数据） */
  const preloadChatRoom = (roomId: string = '1') => {
    globalStore.updateCurrentSessionRoomId(roomId)
  }

  return {
    currentSessionRoomId,
    switchSession,
    removeSession,
    preloadChatRoom,
    ensureGroupMembersSynced
  }
}
