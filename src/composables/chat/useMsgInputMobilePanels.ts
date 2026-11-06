import { onKeyStroke } from '@vueuse/core'
import type { ComputedRef, Ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { useIsMobile } from '@/composables/usePlatform'
import { MittEnum, MobilePanelStateEnum } from '@/enums'

interface Options {
  msgInput: Ref<string>
  privateModeActive: Ref<boolean>
  emitCustomFocus: (state: MobilePanelStateEnum) => void
  emitClickMore: (state: MobilePanelStateEnum) => void
  emitClickEmoji: (state: MobilePanelStateEnum) => void
  emitClickVoice: (state: MobilePanelStateEnum) => void
}

/**
 * 移动端输入区面板状态与语音模式：面板互斥切换、聚焦状态、私有模式样式、面板关闭事件。
 */
export const useMsgInputMobilePanels = ({
  msgInput,
  privateModeActive,
  emitCustomFocus,
  emitClickMore,
  emitClickEmoji,
  emitClickVoice
}: Options) => {
  const isMobileRef: ComputedRef<boolean> = useIsMobile()
  const isVoiceMode = ref(false)
  const mobilePanelState = ref<MobilePanelStateEnum>(MobilePanelStateEnum.NONE)

  const formClass = computed(() => (isMobileRef.value ? 'gap-10px ' : ''))
  const containerClass = computed(() =>
    isMobileRef.value ? 'flex flex-1 p-5px gap-2 pt-5px items-center min-h-2.25rem' : ' flex-col'
  )
  const inputMinHeight = computed(() => (isMobileRef.value ? '2rem' : '36px'))
  const inputLineHeight = computed(() => (isMobileRef.value && !msgInput.value ? '2rem' : '20px'))
  const inputClass = computed(() => {
    const base = isMobileRef.value
      ? 'empty:before:content-[attr(data-placeholder)] before:text-(12px [--tjg-text-tertiary]) p-2 min-h-2rem ps-10px! text-[length:var(--tjg-font-size-base)]! rounded-10px! max-h-8rem! flex items-center'
      : 'empty:before:content-[attr(data-placeholder)] before:text-(12px [--tjg-text-tertiary]) p-2'
    return privateModeActive.value ? `${base} private-mode-input` : base
  })

  const listenMobilePanelHandler = () => {
    mobilePanelState.value = MobilePanelStateEnum.NONE
  }

  const toggleVoiceMode = () => {
    isVoiceMode.value = !isVoiceMode.value
  }

  const setIsFocus = (value: boolean) => {
    if (
      isMobileRef.value &&
      !value &&
      (mobilePanelState.value === MobilePanelStateEnum.EMOJI ||
        mobilePanelState.value === MobilePanelStateEnum.VOICE ||
        mobilePanelState.value === MobilePanelStateEnum.MORE)
    ) {
      return
    }

    mobilePanelState.value = value ? MobilePanelStateEnum.FOCUS : MobilePanelStateEnum.NONE
    emitCustomFocus(mobilePanelState.value)
  }

  const handleMoreClick = () => {
    mobilePanelState.value =
      mobilePanelState.value === MobilePanelStateEnum.MORE ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.MORE
    emitClickMore(mobilePanelState.value)
  }

  const handleEmojiClick = () => {
    mobilePanelState.value =
      mobilePanelState.value === MobilePanelStateEnum.EMOJI ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.EMOJI
    emitClickEmoji(mobilePanelState.value)
  }

  const handleVoiceClick = () => {
    mobilePanelState.value =
      mobilePanelState.value === MobilePanelStateEnum.VOICE ? MobilePanelStateEnum.NONE : MobilePanelStateEnum.VOICE
    emitClickVoice(mobilePanelState.value)
  }

  const handleVoiceCancel = () => {
    isVoiceMode.value = false
  }

  const stops: Array<() => void> = []

  onMounted(() => {
    if (isMobileRef.value) {
      useMitt.on(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
    }
    useMitt.on(MittEnum.VOICE_RECORD_TOGGLE, toggleVoiceMode)
    stops.push(
      onKeyStroke('Escape', () => {
        if (isVoiceMode.value) isVoiceMode.value = false
      })
    )
  })

  onUnmounted(() => {
    useMitt.off(MittEnum.VOICE_RECORD_TOGGLE, toggleVoiceMode)
    if (isMobileRef.value) {
      useMitt.off(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
    }
    stops.forEach((stop) => stop())
    stops.length = 0
  })

  return {
    isMobileRef,
    isVoiceMode,
    mobilePanelState,
    formClass,
    containerClass,
    inputMinHeight,
    inputLineHeight,
    inputClass,
    setIsFocus,
    handleMoreClick,
    handleEmojiClick,
    handleVoiceClick,
    handleVoiceCancel
  }
}
