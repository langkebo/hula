import { computed, onMounted, onUnmounted, type Ref } from 'vue'
import { createMacContextSelectionGuard } from '@/utils/MacSelectionGuard'
import { isMobile } from '@/utils/PlatformConstants'

type UseMessageContextMenuOptions = {
  activeBubble: Ref<string>
}

export const useMessageContextMenu = (options: UseMessageContextMenuOptions) => {
  const { activeBubble } = options

  const { recordSelectionBeforeContext, handleContextMenuSelection } = createMacContextSelectionGuard({
    lockSelector: '.chat-message-max-width'
  })

  const closeMenu = (event: MouseEvent) => {
    if (event.target instanceof HTMLElement && !event.target.matches('.bubble, .bubble-oneself')) {
      activeBubble.value = ''
    }
  }

  const longPressOption = computed(() => ({
    delay: 700,
    modifiers: {
      prevent: isMobile(),
      stop: isMobile()
    },
    reset: true,
    windowResize: true,
    windowScroll: true,
    immediate: true,
    updateTiming: 'sync'
  }))

  const handleLongPress = (e: PointerEvent, _menu: unknown) => {
    if (!isMobile()) return

    e.preventDefault()
    e.stopPropagation()

    const target = e.target as HTMLElement

    const preventClick = (event: Event) => {
      event.stopPropagation()
      event.preventDefault()
      document.removeEventListener('click', preventClick, true)
      document.removeEventListener('pointerup', preventClick, true)
    }

    document.addEventListener('click', preventClick, true)
    document.addEventListener('pointerup', preventClick, true)

    const contextMenuEvent = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: e.clientX,
      clientY: e.clientY,
      button: 2
    })

    target.dispatchEvent(contextMenuEvent)

    setTimeout(() => {
      document.removeEventListener('click', preventClick, true)
      document.removeEventListener('pointerup', preventClick, true)
    }, 300)
  }

  onMounted(() => {
    window.addEventListener('click', closeMenu, true)
  })

  onUnmounted(() => {
    window.removeEventListener('click', closeMenu, true)
  })

  return {
    recordSelectionBeforeContext,
    handleContextMenuSelection,
    longPressOption,
    handleLongPress
  }
}
