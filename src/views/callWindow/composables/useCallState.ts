import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import type { Ref } from 'vue'
import { computed, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import type ActionBar from '@/components/windows/ActionBar.vue'
import { CallTypeEnum, RTCCallStatus } from '@/enums'
import { useGroupStore } from '@/stores/domains/chat/group'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { isMobile } from '@/utils/PlatformConstants'

export const resolveCallType = (value?: string | null): CallTypeEnum => {
  const numeric = Number(value)
  return numeric === CallTypeEnum.VIDEO ? CallTypeEnum.VIDEO : CallTypeEnum.AUDIO
}

/** 从路由 query 解析通话参数 */
export const parseCallRoute = () => {
  const route = useRoute()
  const isReceiver = route.query.isIncoming === 'true'
  return {
    remoteUserId: (route.query.remoteUserId as string) || '',
    roomId: (route.query.roomId as string) || '',
    callType: resolveCallType(route.query.callType as string | null),
    isReceiver,
    shouldAutoAccept: isReceiver && route.query.autoAccept === '1',
    isMobileDevice: isMobile()
  }
}

interface UseCallStateParams {
  remoteUserId: string
  roomId: string
  callType: CallTypeEnum
  isReceiver: boolean
  shouldAutoAccept: boolean
  isMobileDevice: boolean
  localStream: Ref<MediaStream | null>
  remoteStream: Ref<MediaStream | null>
  isVideoEnabled: Ref<boolean>
  callDuration: Ref<number>
  connectionStatus: Ref<RTCCallStatus | undefined>
}

export const useCallState = (params: UseCallStateParams) => {
  const { t } = useI18n()
  const groupStore = useGroupStore()
  const { remoteUserId, roomId, callType, isReceiver, shouldAutoAccept, isMobileDevice } = params

  const remoteUserInfo = groupStore.getUserInfo(remoteUserId)!
  const avatarSrc = computed(() => AvatarUtils.getAvatarUrl(remoteUserInfo.avatar as string))

  const isCallAccepted = ref(!isReceiver)
  const isMuted = ref(false)
  const isSpeakerOn = ref(true)
  const isVideoOn = ref(callType === CallTypeEnum.VIDEO)

  const currentWindowLabel = computed(() => (hasTauriRuntime() ? WebviewWindow.getCurrent().label : ''))
  const actionBarRef = useTemplateRef<typeof ActionBar>('actionBarRef')
  const isWindowMaximized = computed(() => actionBarRef.value?.windowMaximized)

  const callStatusText = computed(() => {
    switch (params.connectionStatus.value) {
      case RTCCallStatus.CALLING:
        return t('message.call_window.status.calling')
      case RTCCallStatus.ACCEPT:
        return t('message.call_window.status.ongoing')
      case RTCCallStatus.END:
        return t('message.call_window.status.ended')
      default:
        return t('message.call_window.status.preparing')
    }
  })

  const formattedCallDuration = computed(() => {
    const duration = params.callDuration.value
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    const seconds = duration % 60
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  const hasRemoteVideo = computed(() => {
    if (!params.remoteStream.value) return false
    const videoTracks = params.remoteStream.value.getVideoTracks()
    return videoTracks.length > 0 && videoTracks.some((track) => track.enabled)
  })

  const hasLocalVideo = computed(() => params.isVideoEnabled.value && !!params.localStream.value)

  const pipVideoSizeClass = computed(() => {
    if (!isMobileDevice) {
      return isWindowMaximized.value ? 'w-320px h-190px' : 'w-120px h-90px'
    }
    return 'w-140px h-160px'
  })

  const shouldCenterPreparingAvatar = computed(() => {
    if (!isMobileDevice) return false
    if (!params.connectionStatus.value) return true
    return params.connectionStatus.value !== RTCCallStatus.END && params.connectionStatus.value !== RTCCallStatus.ERROR
  })

  return {
    t,
    remoteUserId,
    roomId,
    callType,
    isReceiver,
    shouldAutoAccept,
    isMobileDevice,
    remoteUserInfo,
    avatarSrc,
    isCallAccepted,
    isMuted,
    isSpeakerOn,
    isVideoOn,
    currentWindowLabel,
    actionBarRef,
    isWindowMaximized,
    callStatusText,
    formattedCallDuration,
    hasRemoteVideo,
    hasLocalVideo,
    pipVideoSizeClass,
    shouldCenterPreparingAvatar
  }
}
