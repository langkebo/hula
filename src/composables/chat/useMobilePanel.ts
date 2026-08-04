import { computed, type Ref, ref } from 'vue'
import type { VoiceRecordPayload } from '@/components/rightBox/VoiceRecorder.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, MobilePanelStateEnum } from '@/enums'
import { createLogger } from '@/utils/Logger'

type MsgInputLike = {
  sendVoiceDirect: (voiceData: VoiceRecordPayload) => Promise<void>
  sendFilesDirect: (files: File[]) => Promise<void>
}

/**
 * 移动端面板状态管理
 * 管理表情/语音/更多面板的显示与切换
 */
export function useMobilePanel(MsgInputRef: Ref<unknown>) {
  const logger = createLogger('useMobilePanel')
  const { showFeedback } = useActionFeedback()

  const msgInputRef = MsgInputRef as Ref<MsgInputLike | null>

  const mobilePanelState = ref<MobilePanelStateEnum>(MobilePanelStateEnum.NONE)

  const isPanelVisible = computed(() => {
    return (
      mobilePanelState.value === MobilePanelStateEnum.EMOJI ||
      mobilePanelState.value === MobilePanelStateEnum.VOICE ||
      mobilePanelState.value === MobilePanelStateEnum.MORE
    )
  })

  const handleMoreClick = (value: { panelState: MobilePanelStateEnum }) => {
    mobilePanelState.value = value.panelState
  }

  const handleEmojiClick = (value: { panelState: MobilePanelStateEnum }) => {
    mobilePanelState.value = value.panelState
  }

  const handleVoiceClick = (value: { panelState: MobilePanelStateEnum }) => {
    mobilePanelState.value = value.panelState
  }

  const handleCustomFocus = (value: { panelState: MobilePanelStateEnum }) => {
    if (value.panelState === MobilePanelStateEnum.FOCUS) {
      mobilePanelState.value = MobilePanelStateEnum.NONE
    } else {
      mobilePanelState.value = value.panelState
    }
  }

  const handleMobileVoiceCancel = () => {
    useMitt.emit(MittEnum.MOBILE_CLOSE_PANEL)
    mobilePanelState.value = MobilePanelStateEnum.NONE
  }

  const handleMobileVoiceSend = async (voiceData: VoiceRecordPayload) => {
    try {
      await msgInputRef.value?.sendVoiceDirect(voiceData)
    } catch (error) {
      logger.error('发送语音失败', error)
    }
    handleMobileVoiceCancel()
  }

  const handleMoreSendFiles = async (files: File[]) => {
    if (!files || files.length === 0) return
    try {
      await msgInputRef.value?.sendFilesDirect(files)
    } catch (error) {
      logger.error('移动端发送文件失败:', error)
      showFeedback('发送文件失败', 'error')
    }
  }

  const handleSend = () => {
    // 发送后不关闭面板，保持当前状态
  }

  const listenMobilePanelHandler = () => {
    mobilePanelState.value = MobilePanelStateEnum.NONE
  }

  const listenMobileClosePanel = () => {
    useMitt.on(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
  }

  const removeMobileClosePanel = () => {
    useMitt.off(MittEnum.MOBILE_CLOSE_PANEL, listenMobilePanelHandler)
  }

  return {
    mobilePanelState,
    isPanelVisible,
    handleMoreClick,
    handleEmojiClick,
    handleVoiceClick,
    handleCustomFocus,
    handleMobileVoiceCancel,
    handleMobileVoiceSend,
    handleMoreSendFiles,
    handleSend,
    listenMobileClosePanel,
    removeMobileClosePanel
  }
}
