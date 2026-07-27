import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { roomOperations } from '@/services/matrix/room/RoomOperations'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRoomTags')

/** 标签名最大长度 */
const MAX_TAG_LENGTH = 32

/** 推荐标签快捷选项,在 UI 中显示作为快捷添加入口 */
export const SUGGESTED_TAGS: string[] = ['favorite', 'work', 'personal', 'todo', 'important']

interface RoomTag {
  name: string
  order?: number
}

interface UseRoomTagsOptions {
  /** 房间 ID,支持 ref / getter / 字符串 */
  roomId: MaybeRefOrGetter<string | null>
}

/**
 * 跨端房间标签管理 composable
 *
 * PC 端 RoomTagsDialog.vue 与移动端 MobileRoomTagsManager.vue 共用此逻辑。
 * 标签可作为会话列表分组依据(如"重要"、"待办"、"工作"等)。
 */
export function useRoomTags(options: UseRoomTagsOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const tags = ref<RoomTag[]>([])
  const loading = ref(false)
  const updating = ref(false)
  const errorMessage = ref<string | null>(null)

  const tagNames = computed(() => tags.value.map((tag) => tag.name))
  const tagCount = computed(() => tags.value.length)
  const hasTags = computed(() => tags.value.length > 0)

  /** 检查标签是否已存在(精确匹配) */
  const hasTag = (name: string): boolean => {
    return tags.value.some((tag) => tag.name === name)
  }

  /** 拉取房间所有标签 */
  const load = async (): Promise<void> => {
    const roomId = toValue(options.roomId)
    if (!roomId) {
      tags.value = []
      return
    }

    loading.value = true
    errorMessage.value = null
    try {
      const result = await roomOperations.getTags(roomId)
      tags.value = Object.entries(result).map(([name, value]) => ({
        name,
        order: value?.order
      }))
    } catch (err) {
      logger.error('加载房间标签失败', err)
      errorMessage.value = t('room_tags.load_failed')
    } finally {
      loading.value = false
    }
  }

  /**
   * 添加标签
   * 校验: 非空、不重复、长度 <= 32
   * 添加成功后自动 load() 刷新本地状态
   */
  const addTag = async (name: string, order?: number): Promise<boolean> => {
    const roomId = toValue(options.roomId)
    const trimmed = name.trim()

    if (!roomId) {
      showFeedback(t('room_tags.add_failed'), 'error')
      return false
    }

    if (!trimmed) {
      showFeedback(t('room_tags.name_empty'), 'warning')
      return false
    }

    if (trimmed.length > MAX_TAG_LENGTH) {
      showFeedback(t('room_tags.name_too_long'), 'warning')
      return false
    }

    if (hasTag(trimmed)) {
      showFeedback(t('room_tags.name_exists'), 'warning')
      return false
    }

    updating.value = true
    try {
      await roomOperations.setTag(roomId, trimmed, order)
      showFeedback(t('room_tags.add_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('添加房间标签失败', err)
      showFeedback(t('room_tags.add_failed'), 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /** 删除标签,成功后自动 load() 刷新本地状态 */
  const removeTag = async (name: string): Promise<boolean> => {
    const roomId = toValue(options.roomId)
    if (!roomId) {
      showFeedback(t('room_tags.remove_failed'), 'error')
      return false
    }

    updating.value = true
    try {
      await roomOperations.removeTag(roomId, name)
      showFeedback(t('room_tags.remove_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('移除房间标签失败', err)
      showFeedback(t('room_tags.remove_failed'), 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /**
   * 重命名标签(先 remove 再 add)
   * 校验新标签名: 非空、长度 <= 32、不与已有标签(除旧名外)重复
   */
  const renameTag = async (oldName: string, newName: string): Promise<boolean> => {
    const roomId = toValue(options.roomId)
    const trimmed = newName.trim()

    if (!roomId) {
      showFeedback(t('room_tags.add_failed'), 'error')
      return false
    }

    if (!trimmed) {
      showFeedback(t('room_tags.name_empty'), 'warning')
      return false
    }

    if (trimmed.length > MAX_TAG_LENGTH) {
      showFeedback(t('room_tags.name_too_long'), 'warning')
      return false
    }

    if (trimmed !== oldName && hasTag(trimmed)) {
      showFeedback(t('room_tags.name_exists'), 'warning')
      return false
    }

    updating.value = true
    try {
      // 先删除旧标签再添加新标签
      await roomOperations.removeTag(roomId, oldName)
      await roomOperations.setTag(roomId, trimmed)
      showFeedback(t('room_tags.add_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('重命名房间标签失败', err)
      showFeedback(t('room_tags.add_failed'), 'error')
      await load()
      return false
    } finally {
      updating.value = false
    }
  }

  /** 删除所有标签(循环 removeTag) */
  const clearAll = async (): Promise<boolean> => {
    const roomId = toValue(options.roomId)
    if (!roomId) {
      return false
    }

    if (tags.value.length === 0) {
      return true
    }

    updating.value = true
    try {
      // 循环删除所有标签
      for (const tag of [...tags.value]) {
        await roomOperations.removeTag(roomId, tag.name)
      }
      showFeedback(t('room_tags.remove_success'), 'success')
      await load()
      return true
    } catch (err) {
      logger.error('清除所有房间标签失败', err)
      showFeedback(t('room_tags.remove_failed'), 'error')
      await load()
      return false
    } finally {
      updating.value = false
    }
  }

  return {
    tags,
    loading,
    updating,
    errorMessage,
    tagNames,
    tagCount,
    hasTags,
    SUGGESTED_TAGS,
    load,
    addTag,
    removeTag,
    renameTag,
    hasTag,
    clearAll
  }
}
