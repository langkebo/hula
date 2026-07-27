import type { MatrixEvent } from 'matrix-js-sdk'
import type { MaybeRef } from 'vue'
import { computed, ref, unref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMessageForward } from '@/composables/messaging/useMessageForward'
import { matrixMessageService } from '@/services/matrix/messaging/MatrixMessageService'
import { useChatStore } from '@/stores/domains/chat/chat'
import type { MessageType } from '@/types/message'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useMessageMultiSelect')

interface UseMessageMultiSelectOptions {
  /** 当前房间 ID,支持 ref 或字符串 */
  roomId: MaybeRef<string>
}

interface BatchForwardTarget {
  /** 第一条已选消息的 eventId */
  eventId: string
  /** 所在房间 ID */
  roomId: string
  /** 加载到的源事件,可能为 null(消息已被删除等) */
  event: MatrixEvent | null
}

/**
 * 跨端消息多选 composable
 *
 * 负责多选模式开关、选中状态维护以及批量复制 / 转发 / 删除操作。
 * 多选模式开关与 chat store 的 `isMsgMultiChoose` 双向同步。
 *
 * - `batchCopy` 调用 `navigator.clipboard.writeText` 拼接所有已选文本
 * - `batchForward` 集成 `useMessageForward`,加载首条已选消息事件后返回目标信息,
 *   由父组件打开对话框完成目标房间选择
 * - `batchDelete` 调用 `MatrixMessageService.recallMessage`(底层 `redactEvent`)逐条删除
 */
export function useMessageMultiSelect(options: UseMessageMultiSelectOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const chatStore = useChatStore()

  // 集成 useMessageForward,供 batchForward 注入首条已选消息事件
  const forwardFlow = useMessageForward({ sourceEvent: null })

  const roomId = computed(() => unref(options.roomId) ?? '')

  // 已选消息 ID 列表
  const selectedIds = ref<string[]>([])
  // 批处理进行中标志
  const processing = ref(false)

  // 多选模式开关,与 chat store 双向同步
  const multiSelectMode = computed<boolean>({
    get: () => chatStore.isMsgMultiChoose,
    set: (val) => chatStore.setMsgMultiChoose(val, 'normal')
  })

  // 当前房间所有消息
  const messages = computed<MessageType[]>(() => {
    const id = roomId.value
    if (!id) return []
    return chatStore.chatMessageListByRoomId(id) ?? []
  })

  // 已选消息对象列表(保持选中顺序)
  const selectedMessages = computed<MessageType[]>(() => {
    const byId = new Map(messages.value.map((m) => [m.message.id, m]))
    return selectedIds.value.map((id) => byId.get(id)).filter(Boolean) as MessageType[]
  })

  // 是否已全选
  const isAllSelected = computed(() => {
    return messages.value.length > 0 && selectedIds.value.length === messages.value.length
  })

  /** 进入多选模式 */
  const enterMultiSelect = (): void => {
    multiSelectMode.value = true
  }

  /** 退出多选模式并清空选择 */
  const exitMultiSelect = (): void => {
    selectedIds.value = []
    multiSelectMode.value = false
  }

  /** 切换某条消息的选中状态 */
  const toggleSelect = (msgId: string): void => {
    if (!msgId) return
    const index = selectedIds.value.indexOf(msgId)
    if (index === -1) {
      selectedIds.value = [...selectedIds.value, msgId]
    } else {
      selectedIds.value = selectedIds.value.filter((id) => id !== msgId)
    }
  }

  /** 判断消息是否已选中 */
  const isSelected = (msgId: string): boolean => {
    return selectedIds.value.includes(msgId)
  }

  /** 全选当前房间消息 */
  const selectAll = (): void => {
    selectedIds.value = messages.value.map((m) => m.message.id)
  }

  /** 清空选择(不退出多选模式) */
  const clearSelection = (): void => {
    selectedIds.value = []
  }

  /** 提取消息文本内容 */
  const extractText = (msg: MessageType): string => {
    const body = msg.message?.body
    if (!body) return ''
    return String(body.content ?? body.body ?? body.text ?? '').trim()
  }

  /** 批量复制已选消息文本到剪贴板 */
  const batchCopy = async (): Promise<boolean> => {
    if (selectedMessages.value.length === 0) {
      showFeedback(t('mobile_chat.multi_select.empty_selection'), 'warning')
      return false
    }
    processing.value = true
    try {
      const text = selectedMessages.value.map(extractText).filter(Boolean).join('\n')
      if (!text) {
        showFeedback(t('mobile_chat.multi_select.copy_failed'), 'error')
        return false
      }
      await navigator.clipboard.writeText(text)
      showFeedback(t('mobile_chat.multi_select.copy_success'), 'success')
      logger.info(`[batchCopy] 复制 ${selectedMessages.value.length} 条消息`)
      return true
    } catch (err) {
      logger.error('[batchCopy] 复制失败:', err)
      showFeedback(t('mobile_chat.multi_select.copy_failed'), 'error')
      return false
    } finally {
      processing.value = false
    }
  }

  /**
   * 批量转发 - 集成 useMessageForward
   *
   * 加载第一条已选消息的 MatrixEvent 并注入 forwardFlow,
   * 返回目标信息供父组件打开 MobileForwardDialog 完成目标房间选择。
   */
  const batchForward = async (): Promise<BatchForwardTarget | null> => {
    const first = selectedMessages.value[0]
    if (!first) {
      showFeedback(t('mobile_chat.multi_select.empty_selection'), 'warning')
      return null
    }
    const eventId = first.message.id
    const targetRoomId = roomId.value
    if (!eventId || !targetRoomId) return null

    processing.value = true
    try {
      const event = await matrixMessageService.getRoomMessage(targetRoomId, eventId)
      forwardFlow.setSourceEvent(event)
      logger.info(`[batchForward] 准备转发 ${selectedMessages.value.length} 条消息,首条 ${eventId}`)
      return { eventId, roomId: targetRoomId, event }
    } catch (err) {
      logger.error('[batchForward] 加载源消息失败:', err)
      showFeedback(t('mobile_chat.multi_select.copy_failed'), 'error')
      return null
    } finally {
      processing.value = false
    }
  }

  /**
   * 批量删除已选消息
   *
   * 调用 `MatrixMessageService.recallMessage`(底层 `client.redactEvent`)逐条删除,
   * 返回成功删除的数量。
   */
  const batchDelete = async (): Promise<number> => {
    if (processing.value) return 0
    if (selectedMessages.value.length === 0) {
      showFeedback(t('mobile_chat.multi_select.empty_selection'), 'warning')
      return 0
    }
    processing.value = true
    const rid = roomId.value
    const targets = [...selectedMessages.value]
    const total = targets.length
    let successCount = 0
    try {
      for (const msg of targets) {
        try {
          await matrixMessageService.recallMessage(rid, msg.message.id)
          successCount++
        } catch (err) {
          logger.error(`[batchDelete] 删除消息失败: ${msg.message.id}`, err)
        }
      }
      if (successCount > 0) {
        showFeedback(t('mobile_chat.multi_select.delete_success'), 'success')
      } else {
        showFeedback(t('mobile_chat.multi_select.copy_failed'), 'error')
      }
      // 清空已删除消息的选择
      selectedIds.value = []
      logger.info(`[batchDelete] 成功删除 ${successCount}/${total} 条消息`)
      return successCount
    } finally {
      processing.value = false
    }
  }

  return {
    // 状态
    selectedIds,
    processing,
    multiSelectMode,
    forwardFlow,
    // 计算属性
    selectedMessages,
    messages,
    isAllSelected,
    // 方法
    enterMultiSelect,
    exitMultiSelect,
    toggleSelect,
    isSelected,
    selectAll,
    clearSelection,
    batchCopy,
    batchForward,
    batchDelete
  }
}
