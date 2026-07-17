import type { MatrixEvent } from 'matrix-js-sdk'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixForwardService } from '@/services/matrix/messaging/MatrixForwardService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useMessageForward')

/** 可转发的目标会话条目 */
export interface ForwardableRoom {
  roomId: string
  name: string
  avatar: string
  activeTime: number
}

export interface UseMessageForwardOptions {
  /** 源消息事件,可能由父组件异步加载完成后注入 */
  sourceEvent: MatrixEvent | null
}

/**
 * 跨端消息转发 composable
 *
 * PC 端 ForwardDialog.vue 与移动端 MobileForwardDialog.vue 共用此逻辑。
 *
 * 使用方式:
 * 1. 创建时传入 sourceEvent(可为 null,后续通过 setSourceEvent 注入)
 * 2. 通过 recentRooms 获取可转发的会话列表
 * 3. toggleRoom 切换目标房间选择
 * 4. forward 执行转发(单房间走 forwardEvent,多房间走 forwardEventToMultipleRooms)
 * 5. reset 清空选择与错误状态
 */
export function useMessageForward(options: UseMessageForwardOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const chatStore = useChatStore()
  const globalStore = useGlobalStore()

  // 内部保存 sourceEvent 的 ref,允许通过 setSourceEvent 动态更新
  const sourceEventRef = ref<MatrixEvent | null>(options.sourceEvent)

  // 选中的目标房间 ID 列表
  const targetRoomIds = ref<string[]>([])
  // 转发进行中标志
  const forwarding = ref(false)
  // 错误信息
  const error = ref<string | null>(null)

  /**
   * 可转发的最近会话列表
   * - 排除当前所在会话(避免转发到自身)
   * - 排除源消息所在房间(若可从事件中解析)
   * - 按 activeTime 倒序排列(最近的在前)
   */
  const recentRooms = computed<ForwardableRoom[]>(() => {
    const sessions = chatStore.sessionList ?? []
    const currentRoomId = globalStore.currentSessionRoomId
    const sourceRoomId = sourceEventRef.value?.getRoomId?.()

    return sessions
      .filter((session) => {
        if (!session.roomId) return false
        if (session.roomId === currentRoomId) return false
        if (sourceRoomId && session.roomId === sourceRoomId) return false
        return true
      })
      .map((session) => ({
        roomId: session.roomId,
        name: session.remark || session.name || session.roomId,
        avatar: session.avatar ?? '',
        activeTime: session.activeTime ?? 0
      }))
      .sort((a, b) => b.activeTime - a.activeTime)
  })

  /**
   * 切换目标房间的选中状态
   */
  const toggleRoom = (roomId: string): void => {
    if (!roomId) return
    const index = targetRoomIds.value.indexOf(roomId)
    if (index === -1) {
      targetRoomIds.value = [...targetRoomIds.value, roomId]
    } else {
      targetRoomIds.value = targetRoomIds.value.filter((id) => id !== roomId)
    }
  }

  /**
   * 判断房间是否已被选中
   */
  const isRoomSelected = (roomId: string): boolean => {
    return targetRoomIds.value.includes(roomId)
  }

  /**
   * 更新源消息事件(供父组件异步加载完成后注入)
   */
  const setSourceEvent = (event: MatrixEvent | null): void => {
    sourceEventRef.value = event
    error.value = null
  }

  /**
   * 执行转发
   * - 单房间调用 forwardEvent
   * - 多房间调用 forwardEventToMultipleRooms
   * @returns 成功转发的房间数量,失败返回 0
   */
  const forward = async (): Promise<number> => {
    if (forwarding.value) return 0
    const event = sourceEventRef.value
    if (!event) {
      const message = t('message.forward.failed')
      error.value = message
      showFeedback(message, 'error')
      logger.error('[forward] sourceEvent 为空,无法转发')
      return 0
    }

    const roomIds = [...targetRoomIds.value]
    if (roomIds.length === 0) {
      return 0
    }

    forwarding.value = true
    error.value = null

    try {
      let successCount = 0

      if (roomIds.length === 1) {
        // 单房间转发,直接调用 forwardEvent
        const targetRoomId = roomIds[0]
        try {
          await matrixForwardService.forwardEvent(event, targetRoomId)
          successCount = 1
          logger.info(`[forward] 转发成功: ${event.getId()} -> ${targetRoomId}`)
        } catch (err) {
          logger.error(`[forward] 转发失败: ${event.getId()} -> ${targetRoomId}`, err)
        }
      } else {
        // 多房间转发,调用 forwardEventToMultipleRooms
        const results = await matrixForwardService.forwardEventToMultipleRooms(event, roomIds)
        successCount = results.filter((r) => r.success).length
      }

      if (successCount > 0) {
        showFeedback(t('message.forward.success', { count: successCount }), 'success')
      } else {
        const message = t('message.forward.failed')
        error.value = message
        showFeedback(message, 'error')
      }

      return successCount
    } catch (err) {
      const message = t('message.forward.failed')
      error.value = message
      logger.error('[forward] 转发流程异常:', err)
      showFeedback(message, 'error')
      return 0
    } finally {
      forwarding.value = false
    }
  }

  /**
   * 重置所有状态(选择、错误),但保留 sourceEvent
   */
  const reset = (): void => {
    targetRoomIds.value = []
    forwarding.value = false
    error.value = null
  }

  return {
    // 状态
    targetRoomIds,
    forwarding,
    error,
    // 计算属性
    recentRooms,
    // 方法
    toggleRoom,
    isRoomSelected,
    setSourceEvent,
    forward,
    reset
  }
}
