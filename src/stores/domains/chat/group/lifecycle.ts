import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import type { MatrixGroupInfo, MatrixRoomMember } from './types'

const logger = createLogger('GroupStore.Lifecycle')

export type GroupLifecycleContext = {
  membersMap: Record<string, MatrixRoomMember[]>
  groupInfoMap: Record<string, MatrixGroupInfo>
  loadRoomMembers: (roomId: string, forceRefresh?: boolean) => Promise<MatrixRoomMember[]>
  loadGroupInfo: (roomId: string) => Promise<MatrixGroupInfo | null>
}

/**
 * 群生命周期模块：邀请/踢出/封禁、退群/忘记、会话切换预加载、全量清理。
 */
export function createGroupLifecycle(ctx: GroupLifecycleContext) {
  const { membersMap, groupInfoMap, loadRoomMembers, loadGroupInfo } = ctx
  const globalStore = useGlobalStore()

  async function inviteUser(roomId: string, userId: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.inviteUser(roomId, userId)
      logger.info(`[GroupStore] 邀请用户成功: ${userId} -> ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 邀请用户失败: ${err}`)
      return false
    }
  }

  async function kickUser(roomId: string, userId: string, reason?: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.kickUser(roomId, userId, reason)
      membersMap[roomId] = membersMap[roomId]?.filter((m) => m.userId !== userId) || []
      logger.info(`[GroupStore] 踢出用户成功: ${userId} <- ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 踢出用户失败: ${err}`)
      return false
    }
  }

  async function banUser(roomId: string, userId: string, reason?: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.banUser(roomId, userId, reason)
      await loadRoomMembers(roomId, true)
      logger.info(`[GroupStore] 封禁用户成功: ${userId} <- ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 封禁用户失败: ${err}`)
      return false
    }
  }

  async function unbanUser(roomId: string, userId: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.unbanUser(roomId, userId)
      await loadRoomMembers(roomId, true)
      logger.info(`[GroupStore] 解封用户成功: ${userId} <- ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 解封用户失败: ${err}`)
      return false
    }
  }

  async function leaveRoom(roomId: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.leaveRoom(roomId)
      delete membersMap[roomId]
      delete groupInfoMap[roomId]
      logger.info(`[GroupStore] 离开房间成功: ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 离开房间失败: ${err}`)
      return false
    }
  }

  async function forgetRoom(roomId: string): Promise<boolean> {
    try {
      await matrixRoomActionFacade.forgetRoom(roomId)
      delete membersMap[roomId]
      delete groupInfoMap[roomId]
      logger.info(`[GroupStore] 忘记房间成功: ${roomId}`)
      return true
    } catch (err) {
      logger.error(`[GroupStore] 忘记房间失败: ${err}`)
      return false
    }
  }

  async function exitGroup(roomId: string): Promise<void> {
    await leaveRoom(roomId)
  }

  async function removeGroupMembers(uidList: string[], roomId?: string): Promise<void> {
    const targetRoomId = roomId || globalStore.currentSessionRoomId
    if (!targetRoomId) return
    for (const uid of uidList) {
      await kickUser(targetRoomId, uid)
    }
  }

  function clearAllData(): void {
    Object.keys(membersMap).forEach((key) => delete membersMap[key])
    Object.keys(groupInfoMap).forEach((key) => delete groupInfoMap[key])
  }

  async function switchSession(session: { roomId: string }): Promise<{ success: boolean }> {
    if (!session?.roomId) return { success: false }
    try {
      await loadRoomMembers(session.roomId, true)
      await loadGroupInfo(session.roomId)
      return { success: true }
    } catch (error) {
      logger.error('switchSession error:', error)
      return { success: false }
    }
  }

  return {
    inviteUser,
    kickUser,
    banUser,
    unbanUser,
    leaveRoom,
    forgetRoom,
    exitGroup,
    removeGroupMembers,
    clearAllData,
    switchSession
  }
}
