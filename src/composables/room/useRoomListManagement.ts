import type { RoomMember } from 'matrix-js-sdk'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixRoomMembershipService } from '@/services/matrix/room/MembershipService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRoomListManagement')

export interface ListMember {
  userId: string
  name?: string
  avatarUrl?: string
  reason?: string
  membership: string
}

export type ListType = 'allowlist' | 'denylist'

export interface UseRoomListManagementOptions {
  roomId: string | null
  /** 是否具备管理权限 */
  canManage?: boolean
}

/**
 * 跨端房间邀请白名单/禁止名单管理 composable
 * PC 端 RoomDetailPane.vue 与移动端 ChatSetting.vue 共用此逻辑
 *
 * - allowlist(邀请白名单):已发出邀请但未加入的成员(membership === 'invite')
 * - denylist(禁止名单):被 ban 的成员(membership === 'ban')
 */
export function useRoomListManagement(options: UseRoomListManagementOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const allowlist = ref<ListMember[]>([])
  const denylist = ref<ListMember[]>([])
  const loading = ref(false)
  const adding = ref(false)
  const removing = ref<Record<string, boolean>>({})
  const errorMessage = ref<string | null>(null)

  const canManage = computed(() => options.canManage !== false && !!options.roomId)
  const allowlistCount = computed(() => allowlist.value.length)
  const denylistCount = computed(() => denylist.value.length)

  const toListMember = (m: RoomMember): ListMember => {
    const banEvent = (
      m as unknown as { events?: { sender?: string; replacedByUser?: string; content?: { reason?: string } }[] }
    ).events
    const reason = banEvent?.find((e) => e?.content?.reason)?.content?.reason
    return {
      userId: m.userId,
      name: m.name || m.rawDisplayName || m.userId,
      avatarUrl: m.avatarUrl ?? undefined,
      reason,
      membership: m.membership ?? 'join'
    }
  }

  const load = async (): Promise<void> => {
    const roomId = options.roomId
    if (!roomId) {
      allowlist.value = []
      denylist.value = []
      return
    }

    loading.value = true
    errorMessage.value = null

    try {
      const [invited, banned] = await Promise.all([
        matrixRoomMembershipService.getInvitedMembers(roomId),
        matrixRoomMembershipService.getBannedMembers(roomId)
      ])
      allowlist.value = invited.map(toListMember)
      denylist.value = banned.map(toListMember)
    } catch (err) {
      logger.error('加载黑白名单失败', err)
      errorMessage.value = t('room_advanced.denylist.add_failed')
    } finally {
      loading.value = false
    }
  }

  /**
   * 添加用户到邀请白名单(邀请用户加入房间)
   */
  const addToAllowlist = async (userId: string): Promise<boolean> => {
    const roomId = options.roomId
    if (!roomId || !userId.trim()) {
      showFeedback(t('room_advanced.allowlist.add_failed'), 'error')
      return false
    }

    adding.value = true
    try {
      await matrixRoomMembershipService.inviteUser(roomId, userId.trim())
      showFeedback(t('room_advanced.allowlist.user_added'), 'success')
      // 重新加载白名单
      await load()
      return true
    } catch (err) {
      logger.error('邀请用户失败', err)
      showFeedback(t('room_advanced.allowlist.add_failed'), 'error')
      return false
    } finally {
      adding.value = false
    }
  }

  /**
   * 从邀请白名单移除(对 invited 用户执行 kick 以撤销邀请)
   */
  const removeFromAllowlist = async (userId: string): Promise<boolean> => {
    const roomId = options.roomId
    if (!roomId) return false

    removing.value[userId] = true
    try {
      await matrixRoomMembershipService.kickUser(roomId, userId)
      showFeedback(t('room_advanced.allowlist.user_removed'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('撤销邀请失败', err)
      showFeedback(t('room_advanced.allowlist.remove_failed'), 'error')
      return false
    } finally {
      removing.value[userId] = false
    }
  }

  /**
   * 添加用户到禁止名单(ban)
   */
  const addToDenylist = async (userId: string, reason?: string): Promise<boolean> => {
    const roomId = options.roomId
    if (!roomId || !userId.trim()) {
      showFeedback(t('room_advanced.denylist.add_failed'), 'error')
      return false
    }

    adding.value = true
    try {
      await matrixRoomMembershipService.banUser(roomId, userId.trim(), reason?.trim() || undefined)
      showFeedback(t('room_advanced.denylist.user_added'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('封禁用户失败', err)
      showFeedback(t('room_advanced.denylist.add_failed'), 'error')
      return false
    } finally {
      adding.value = false
    }
  }

  /**
   * 从禁止名单移除(unban)
   */
  const removeFromDenylist = async (userId: string): Promise<boolean> => {
    const roomId = options.roomId
    if (!roomId) return false

    removing.value[userId] = true
    try {
      await matrixRoomMembershipService.unbanUser(roomId, userId)
      showFeedback(t('room_advanced.denylist.user_removed'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('解封用户失败', err)
      showFeedback(t('room_advanced.denylist.remove_failed'), 'error')
      return false
    } finally {
      removing.value[userId] = false
    }
  }

  return {
    allowlist,
    denylist,
    loading,
    adding,
    removing,
    errorMessage,
    canManage,
    allowlistCount,
    denylistCount,
    load,
    addToAllowlist,
    removeFromAllowlist,
    addToDenylist,
    removeFromDenylist
  }
}
