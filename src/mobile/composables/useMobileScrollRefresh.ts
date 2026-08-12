import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import { ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileScrollRefresh')

/**
 * 移动端会话列表滚动与下拉刷新控制 composable
 * 负责:监听滚动决定是否启用下拉刷新、搜索框聚焦时锁定列表滚动
 */
export function useMobileScrollRefresh() {
  const isEnablePullRefresh = ref(true)
  let scrollTop = 0

  const enablePullRefresh = useDebounceFn((top: number) => {
    isEnablePullRefresh.value = top === 0
  }, 100)

  const disablePullRefresh = useThrottleFn(() => {
    isEnablePullRefresh.value = false
  }, 80)

  const onScroll = (e: Event) => {
    scrollTop = (e.target as HTMLElement).scrollTop
    if (scrollTop < 200) {
      enablePullRefresh(scrollTop)
    } else {
      disablePullRefresh()
    }
  }

  const getScrollTop = () => scrollTop

  const lockScroll = () => {
    logger.debug('锁定触发')
    const scrollEl = document.querySelector('.mobile-session-list') as HTMLElement | null
    if (scrollEl) {
      scrollEl.style.overflow = 'hidden'
    }
  }

  const unlockScroll = () => {
    logger.debug('锁定解除')
    const scrollEl = document.querySelector('.mobile-session-list') as HTMLElement | null
    if (scrollEl) {
      scrollEl.style.overflow = 'auto'
    }
  }

  return {
    isEnablePullRefresh,
    enablePullRefresh,
    disablePullRefresh,
    onScroll,
    getScrollTop,
    lockScroll,
    unlockScroll
  }
}

export type MobileScrollRefreshReturn = ReturnType<typeof useMobileScrollRefresh>
