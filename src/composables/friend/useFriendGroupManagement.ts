import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { FriendGroup } from '@/services/matrix/friends/MatrixFriendService'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useFriendGroupManagement')

export interface UseFriendGroupManagementOptions {
  /** 是否启用(默认启用) */
  enabled?: boolean
}

/**
 * 跨端好友分组管理 composable
 * PC 端 FriendGroupDialog.vue 与移动端 MobileFriendGroupManager.vue 共用此逻辑
 *
 * 能力:
 * - 加载分组列表
 * - 创建/重命名/删除分组
 * - 将好友加入/移出分组
 */
export function useFriendGroupManagement(options: UseFriendGroupManagementOptions = {}) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const groups = ref<FriendGroup[]>([])
  const loading = ref(false)
  const creating = ref(false)
  const renaming = ref<Record<string, boolean>>({})
  const deleting = ref<Record<string, boolean>>({})
  const errorMessage = ref<string | null>(null)

  const enabled = computed(() => options.enabled !== false)
  const groupCount = computed(() => groups.value.length)

  const load = async (): Promise<void> => {
    if (!enabled.value) return
    loading.value = true
    errorMessage.value = null
    try {
      const list = await matrixFriendService.getFriendGroups()
      groups.value = list ?? []
    } catch (err) {
      logger.error('加载好友分组失败', err)
      errorMessage.value = t('friend.group.load_failed')
    } finally {
      loading.value = false
    }
  }

  const createGroup = async (name: string): Promise<FriendGroup | null> => {
    if (!name.trim()) {
      showFeedback(t('friend.group.create_failed'), 'error')
      return null
    }
    creating.value = true
    try {
      const group = await matrixFriendService.createFriendGroup(name.trim())
      showFeedback(t('friend.group.create_success'), 'success')
      groups.value.push(group)
      return group
    } catch (err) {
      logger.error('创建好友分组失败', err)
      showFeedback(t('friend.group.create_failed'), 'error')
      return null
    } finally {
      creating.value = false
    }
  }

  const renameGroup = async (groupId: string, name: string): Promise<boolean> => {
    if (!name.trim()) {
      showFeedback(t('friend.group.rename_failed'), 'error')
      return false
    }
    renaming.value[groupId] = true
    try {
      await matrixFriendService.renameFriendGroup(groupId, name.trim())
      showFeedback(t('friend.group.rename_success'), 'success')
      const target = groups.value.find((g) => g.group_id === groupId)
      if (target) target.name = name.trim()
      return true
    } catch (err) {
      logger.error('重命名好友分组失败', err)
      showFeedback(t('friend.group.rename_failed'), 'error')
      return false
    } finally {
      renaming.value[groupId] = false
    }
  }

  const deleteGroup = async (groupId: string): Promise<boolean> => {
    deleting.value[groupId] = true
    try {
      await matrixFriendService.deleteFriendGroup(groupId)
      showFeedback(t('friend.group.delete_success'), 'success')
      groups.value = groups.value.filter((g) => g.group_id !== groupId)
      return true
    } catch (err) {
      logger.error('删除好友分组失败', err)
      showFeedback(t('friend.group.delete_failed'), 'error')
      return false
    } finally {
      deleting.value[groupId] = false
    }
  }

  const addFriendToGroup = async (groupId: string, userId: string): Promise<boolean> => {
    try {
      await matrixFriendService.addFriendToGroup(groupId, userId)
      showFeedback(t('friend.group.create_success'), 'success')
      return true
    } catch (err) {
      logger.error('将好友加入分组失败', err)
      showFeedback(t('friend.group.create_failed'), 'error')
      return false
    }
  }

  const removeFriendFromGroup = async (groupId: string, userId: string): Promise<boolean> => {
    try {
      await matrixFriendService.removeFriendFromGroup(groupId, userId)
      showFeedback(t('friend.group.delete_success'), 'success')
      return true
    } catch (err) {
      logger.error('将好友移出分组失败', err)
      showFeedback(t('friend.group.delete_failed'), 'error')
      return false
    }
  }

  return {
    groups,
    loading,
    creating,
    renaming,
    deleting,
    errorMessage,
    enabled,
    groupCount,
    load,
    createGroup,
    renameGroup,
    deleteGroup,
    addFriendToGroup,
    removeFriendFromGroup
  }
}
