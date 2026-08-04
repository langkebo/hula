import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { type FriendRequestItem, useContactStore } from '@/stores/domains/chat/contacts'

/**
 * 好友请求预览与快捷操作 Composable
 *
 * 负责：
 * - 待处理好友请求预览列表（最多 3 条 incoming）
 * - 快速接受 / 快速拒绝（handleQuickAccept / handleQuickReject）
 * - 处理状态标记（processingRequest）
 * - 新请求到达时的 ARIA 公告
 */
export function useFriendRequests() {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const { announce } = useAriaLive()
  const contactStore = useContactStore()

  const processingRequest = ref<string | null>(null)

  // 预览区域最多显示3条好友请求
  const previewIncomingRequests = computed(() =>
    contactStore.requestFriendsList.filter((r) => r.direction === 'incoming').slice(0, 3)
  )

  // 快速接受好友请求
  const handleQuickAccept = async (request: FriendRequestItem) => {
    if (!request.userId) return
    processingRequest.value = request.userId
    try {
      await contactStore.acceptFriendRequest(request.userId)
      showFeedback(t('friend.request.success.accept'), 'success')
    } catch {
      showFeedback(t('friend.request.error.accept'), 'error')
    } finally {
      processingRequest.value = null
    }
  }

  // 快速拒绝好友请求
  const handleQuickReject = async (request: FriendRequestItem) => {
    if (!request.userId) return
    processingRequest.value = request.userId
    try {
      await contactStore.rejectFriendRequest(request.userId)
      showFeedback(t('friend.request.success.reject'), 'success')
    } catch {
      showFeedback(t('friend.request.error.reject'), 'error')
    } finally {
      processingRequest.value = null
    }
  }

  watch(
    () => contactStore.incomingRequestsCount,
    (count, prevCount) => {
      if (count > (prevCount || 0)) {
        announce(t('friend.list.new_request_announcement', { count: count }), 'assertive')
      }
    }
  )

  return {
    processingRequest,
    previewIncomingRequests,
    handleQuickAccept,
    handleQuickReject
  }
}
