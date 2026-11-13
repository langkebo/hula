import { ref } from 'vue'
import { useTimerManager } from '@/utils/TimerManager'

/**
 * 全屏遮罩：打开时锁定 body 滚动并记录位置，关闭时还原。
 */
export function useFriendMask() {
  const timerManager = useTimerManager()

  const showMask = ref(false)
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
      timerManager.setTimeout(() => {
        showMask.value = false
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.width = ''
        window.scrollTo(0, scrollY)
      }, 200)
    }
  }

  return { showMask, maskHandler }
}
