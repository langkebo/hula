import { nextTick, ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

export interface UseReplyJumpOptions {
  /** 在本地消息列表中查找目标消息下标；找不到返回 -1。 */
  findIndexByEventId: (eventId: string) => number
  /** 目标消息的 DOM 节点，用于滚动定位；返回 null 表示当前没有可滚动节点。 */
  resolveElement?: (eventId: string) => HTMLElement | null
}

/**
 * 历史/多选窗口里的"跳到被回复的原消息"。
 *
 * 与 `useMessageJump` 相比只是简化版：命中已加载的本地消息时给出高亮 + 滚动，
 * 未命中时给 warning 反馈。区别有两点——
 * 1. 只在调用方提供的当前列表里查找，不会像 `useMessageJump` 那样反复 `loadMore()`
 *    去时间线里翻历史；
 * 2. 不提供清除高亮的入口（没有 `clearActiveReply` 对应实现），命中后 `activeReply`
 *    会一直保留到组件卸载。
 * 这些窗口的消息列表不属于 chatStore 当前时间线，因此由调用方提供下标查找与定位。
 */
export function useReplyJump(options: UseReplyJumpOptions) {
  const { showFeedback } = useActionFeedback()
  const activeReply = ref('')

  const jumpToReply = async (eventId: string): Promise<void> => {
    const key = String(eventId)
    if (options.findIndexByEventId(key) === -1) {
      showFeedback('无法找到原始消息，可能已被删除或太久远', 'warning')
      return
    }

    activeReply.value = key
    await nextTick()
    options.resolveElement?.(key)?.scrollIntoView?.({ block: 'center' })
  }

  return { activeReply, jumpToReply }
}
