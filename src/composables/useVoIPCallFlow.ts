import { computed, onUnmounted, ref, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { CallInfo, CallOptions } from '@/services/matrix/media/MatrixVoIPService'
import { matrixVoIPService } from '@/services/matrix/media/MatrixVoIPService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useVoIPCallFlow')

interface UseVoIPCallFlowOptions {
  initialCallId?: string
  initialRoomId?: string
}

/**
 * 跨端 VoIP 通话流程 composable
 * PC 端 CallView.vue 与移动端 rtcCall/index.vue 共用此逻辑
 */
export function useVoIPCallFlow(options: UseVoIPCallFlowOptions = {}) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const callId = ref<string | null>(options.initialCallId ?? null)
  const roomId = ref<string>(options.initialRoomId ?? '')
  const callInfo = shallowRef<CallInfo | null>(null)
  const isAudioMuted = ref(false)
  const isVideoEnabled = ref(false)
  const isSpeakerOn = ref(false)
  const isScreensharing = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  // CallInfo 不包含来电/去电标识,用内部 ref 跟踪
  const isIncomingCall = ref(false)

  let unsubscribeCallUpdate: (() => void) | null = null
  // 页面卸载后异步操作才完成时，必须回收已在服务层创建的通话，避免幽灵通话
  let disposed = false

  const state = computed(() => callInfo.value?.state ?? null)
  const isConnected = computed(() => state.value === 'connected')
  const isIncoming = computed(() => isIncomingCall.value && state.value === 'ringing')
  const isOutgoing = computed(() => !isIncomingCall.value && state.value === 'ringing')
  const isActive = computed(
    () => state.value === 'connected' || state.value === 'connecting' || state.value === 'ringing'
  )

  const subscribeCallUpdate = (): void => {
    if (!callId.value) return
    if (unsubscribeCallUpdate) {
      unsubscribeCallUpdate()
    }
    unsubscribeCallUpdate = matrixVoIPService.onCallUpdate(callId.value, (info: CallInfo) => {
      // 服务层原地修改同一个对象后再次通知（answerCall 改 state、feeds_changed 改 stream），
      // shallowRef 收到同一引用不会失效，必须换新对象才能让 computed 重新计算。
      callInfo.value = { ...info }
    })
  }

  // 外部已建好通话（如来电透传 callId）时必须先种子 callInfo：
  // 来电已经处于 ringing，不会再有 notifyCallUpdate 触发，否则页面会误判为去电响铃。
  if (callId.value) {
    isIncomingCall.value = true
    const existing = matrixVoIPService.getActiveCalls().find((call) => call.callId === callId.value)
    callInfo.value = existing ?? null
    isVideoEnabled.value = !!existing?.isVideo
    subscribeCallUpdate()
  }

  const startCall = async (targetRoomId: string, callOptions: CallOptions): Promise<boolean> => {
    if (!targetRoomId || loading.value) {
      return false
    }
    loading.value = true
    error.value = null
    try {
      const id = await matrixVoIPService.startCall(targetRoomId, callOptions)
      if (disposed) {
        void matrixVoIPService.hangupCall(id).catch((err) => logger.warn('startCall hangup after unmount failed', err))
        return false
      }
      callId.value = id
      roomId.value = targetRoomId
      isVideoEnabled.value = !!callOptions.video
      isIncomingCall.value = false
      subscribeCallUpdate()
      return true
    } catch (err) {
      logger.error('startCall failed', err)
      error.value = t('voip.errors.start_failed')
      showFeedback(error.value, 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const answerCall = async (targetCallId?: string, callOptions?: CallOptions): Promise<boolean> => {
    const id = targetCallId ?? callId.value
    if (!id || loading.value) return false
    loading.value = true
    try {
      await matrixVoIPService.answerCall(id, callOptions)
      if (disposed) {
        void matrixVoIPService.hangupCall(id).catch((err) => logger.warn('answerCall hangup after unmount failed', err))
        return false
      }
      callId.value = id
      isVideoEnabled.value = !!callOptions?.video
      isIncomingCall.value = true
      subscribeCallUpdate()
      return true
    } catch (err) {
      logger.error('answerCall failed', err)
      error.value = t('voip.errors.answer_failed')
      showFeedback(error.value, 'error')
      return false
    } finally {
      loading.value = false
    }
  }

  const rejectCall = async (targetCallId?: string): Promise<boolean> => {
    const id = targetCallId ?? callId.value
    if (!id) return false
    try {
      await matrixVoIPService.rejectCall(id)
      return true
    } catch (err) {
      logger.error('rejectCall failed', err)
      error.value = t('voip.errors.hangup_failed')
      showFeedback(error.value, 'error')
      return false
    }
  }

  const hangup = async (): Promise<void> => {
    const id = callId.value
    if (!id) return
    loading.value = true
    try {
      await matrixVoIPService.hangupCall(id)
    } catch (err) {
      logger.error('hangup failed', err)
      showFeedback(t('voip.errors.hangup_failed'), 'error')
    } finally {
      if (callId.value === id) {
        callId.value = null
        callInfo.value = null
        isAudioMuted.value = false
        isVideoEnabled.value = false
        isSpeakerOn.value = false
        isScreensharing.value = false
        if (unsubscribeCallUpdate) {
          unsubscribeCallUpdate()
          unsubscribeCallUpdate = null
        }
      }
      loading.value = false
    }
  }

  const toggleMute = async (): Promise<boolean> => {
    if (!callId.value) return false
    try {
      const muted = await matrixVoIPService.toggleMute(callId.value)
      isAudioMuted.value = muted
      return true
    } catch (err) {
      logger.error('toggleMute failed', err)
      showFeedback(t('voip.errors.mute_failed'), 'error')
      return false
    }
  }

  const toggleVideo = async (): Promise<boolean> => {
    if (!callId.value) return false
    try {
      const enabled = await matrixVoIPService.toggleVideo(callId.value)
      isVideoEnabled.value = enabled
      return true
    } catch (err) {
      logger.error('toggleVideo failed', err)
      showFeedback(t('voip.errors.video_failed'), 'error')
      return false
    }
  }

  const toggleSpeaker = async (): Promise<void> => {
    // 扬声器切换是本地操作,通过 audio 元素或 Web Audio API
    isSpeakerOn.value = !isSpeakerOn.value
  }

  const toggleScreenshare = async (): Promise<boolean> => {
    if (!callId.value) return false
    try {
      if (isScreensharing.value) {
        await matrixVoIPService.stopScreenshare(callId.value)
        isScreensharing.value = false
      } else {
        await matrixVoIPService.startScreenshare(callId.value)
        isScreensharing.value = true
      }
      return true
    } catch (err) {
      logger.error('toggleScreenshare failed', err)
      showFeedback(t('voip.errors.screenshare_failed'), 'error')
      return false
    }
  }

  const checkPermissions = async (): Promise<{ audio: boolean; video: boolean }> => {
    try {
      return await matrixVoIPService.checkMediaPermissions()
    } catch (err) {
      logger.error('checkPermissions failed', err)
      return { audio: false, video: false }
    }
  }

  const checkAvailability = async (): Promise<boolean> => {
    try {
      const result = await matrixVoIPService.checkVoipAvailability()
      if (!result.voipAvailable) {
        showFeedback(t('voip.errors.voip_unavailable'), 'warning')
        return false
      }
      if (!result.turnAvailable) {
        showFeedback(t('voip.errors.turn_unavailable'), 'warning')
      }
      return result.voipAvailable
    } catch (err) {
      logger.error('checkAvailability failed', err)
      return false
    }
  }

  onUnmounted(() => {
    disposed = true
    if (unsubscribeCallUpdate) {
      unsubscribeCallUpdate()
      unsubscribeCallUpdate = null
    }
    // 离开通话页必须结束通话；不走 hangup() 以免刷新 loading 或弹出错误提示
    const id = callId.value
    if (!id) return
    void matrixVoIPService.hangupCall(id).catch((err) => logger.warn('hangup on unmount failed', err))
    callId.value = null
    callInfo.value = null
  })

  return {
    // state
    callId,
    roomId,
    callInfo,
    isAudioMuted,
    isVideoEnabled,
    isSpeakerOn,
    isScreensharing,
    loading,
    error,
    // getters
    state,
    isConnected,
    isIncoming,
    isOutgoing,
    isActive,
    // actions
    startCall,
    answerCall,
    rejectCall,
    hangup,
    toggleMute,
    toggleVideo,
    toggleSpeaker,
    toggleScreenshare,
    checkPermissions,
    checkAvailability
  }
}
