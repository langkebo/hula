import { ref } from 'vue'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useTimerManager } from '@/utils/TimerManager'

export interface LongPressOption {
  delay: number
  modifiers: { prevent: boolean; stop: boolean }
  reset: boolean
  windowResize: boolean
  windowScroll: boolean
  immediate: boolean
  updateTiming: string
}

interface LongPressScrollControls {
  disablePullRefresh: () => void
  enablePullRefresh: (top: number) => void
  getScrollTop: () => number
}

/**
 * 移动端会话长按菜单与蒙板 composable
 * 负责:长按手势识别、长按菜单浮层定位、页面蒙板(锁定背景滚动)
 *
 * 与 useMobileScrollRefresh 协同:长按激活时禁用下拉刷新,关闭时恢复
 */
export function useMobileLongPress(scrollControls: LongPressScrollControls) {
  const chatStore = useChatStore()
  const timerManager = useTimerManager()

  const showMask = ref(false)
  const currentLongPressItem = ref<SessionItem | null>(null)

  const longPressState = ref({
    showLongPressMenu: false,
    longPressMenuTop: 0,
    longPressActive: false,
    enable: () => {
      longPressState.value.longPressActive = true
      scrollControls.disablePullRefresh()
    },
    disable: () => {
      longPressState.value.showLongPressMenu = false
      longPressState.value.longPressMenuTop = 0
      longPressState.value.longPressActive = false
      scrollControls.enablePullRefresh(scrollControls.getScrollTop())
    }
  })

  const longPressOption = ref({
    delay: 200,
    modifiers: {
      prevent: true,
      stop: true
    },
    reset: true,
    windowResize: true,
    windowScroll: true,
    immediate: true,
    updateTiming: 'sync'
  })

  let scrollY = 0

  const maskHandler = {
    open: () => {
      scrollY = window.scrollY
      showMask.value = true
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
    },
    close: () => {
      const closeModal = () => {
        showMask.value = false
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        window.scrollTo(0, scrollY)
      }

      timerManager.setTimeout(closeModal, 60)
      longPressState.value.disable()
    }
  }

  const handleLongPress = (e: PointerEvent, item: SessionItem) => {
    const latestItem = chatStore.sessionList.find((session) => session.roomId === item.roomId)
    if (!latestItem) return

    currentLongPressItem.value = latestItem
    e.stopPropagation()
    maskHandler.open()
    longPressState.value.enable()

    const setLongPressMenuTop = () => {
      const target = e.target as HTMLElement | null
      if (!target) return

      const currentTarget = target.closest('.grid')
      if (!currentTarget) return

      const rect = currentTarget.getBoundingClientRect()
      longPressState.value.longPressMenuTop = rect.top - rect.height / 3
    }

    setLongPressMenuTop()
    longPressState.value.showLongPressMenu = true
  }

  return {
    showMask,
    currentLongPressItem,
    longPressState,
    longPressOption,
    maskHandler,
    handleLongPress
  }
}

export type MobileLongPressReturn = ReturnType<typeof useMobileLongPress>
