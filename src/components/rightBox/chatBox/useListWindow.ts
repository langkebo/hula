import { computed, type Ref, ref, watch } from 'vue'

/** 每屏最多渲染多少行；滚到底部再追加同样数量 */
export const LIST_WINDOW_SIZE = 100

interface ListWindowOptions<T> {
  /** 完整数据（已在内存中，渲染端做窗口裁剪） */
  items: Ref<T[]>
  /** 该值变化时重置窗口（如切换会话/房间） */
  resetKey: () => unknown
  /** 滚到底部时的额外动作（如触发数据刷新） */
  onReachBottom?: () => void
}

/**
 * 「滚到底再追加」的渲染窗口。
 *
 * 用于那些**数据已在内存、但一次全渲染会很卡**的列表（PF-A02 成员列表）：
 * 只渲染前 `LIST_WINDOW_SIZE` 项，`handleScroll` 判定到底后追加同样数量。
 *
 * 为什么不用虚拟列表：目标列表里混排「分组标题 + 数据行」且逐项绑定 popover ref，
 * 定高虚拟列表会改变高度与交互。窗口化只裁剪 DOM 数量，不动布局与交互。
 *
 * 判定用 `<= clientHeight + 1` 而不是严格相等：`scrollTop` 可能是小数（缩放/DPR），
 * 严格相等会漏掉最后一像素。
 */
export function useListWindow<T>(options: ListWindowOptions<T>) {
  const visibleCount = ref(LIST_WINDOW_SIZE)
  const visibleItems = computed(() => options.items.value.slice(0, visibleCount.value))

  watch(options.resetKey, () => {
    visibleCount.value = LIST_WINDOW_SIZE
  })

  const handleScroll = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (!target) return

    const isBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 1
    if (!isBottom) return

    // 先扩本地窗口（立即生效），再触发数据侧动作
    if (visibleCount.value < options.items.value.length) {
      visibleCount.value += LIST_WINDOW_SIZE
    }
    options.onReachBottom?.()
  }

  return { visibleItems, handleScroll }
}
