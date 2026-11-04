import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { matrixThreadService } from '@/services/matrix/messaging/MatrixThreadService'

/**
 * 线程指示器共享逻辑（桌面 / 移动共用）。
 *
 * 两端只保留各自的 UI 差异（Naive UI / Vant），回复数读取与空态派生收敛在这里，
 * 避免同名组件的业务逻辑各自漂移。
 */
export function useThreadIndicator(roomId: MaybeRefOrGetter<string>, eventId: MaybeRefOrGetter<string>) {
  const replyCount = ref(0)

  const hasReplies = computed(() => replyCount.value > 0)

  const loadThreadInfo = () => {
    const thread = matrixThreadService.getThread(toValue(roomId), toValue(eventId))
    if (thread) {
      replyCount.value = thread.replyCount
    }
  }

  return { replyCount, hasReplies, loadThreadInfo }
}
