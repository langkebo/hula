import type { Ref } from 'vue'
import type { RTCCallStatus } from '@/enums'

interface UseCallControlsParams {
  isMuted: Ref<boolean>
  isCallAccepted: Ref<boolean>
  connectionStatus: Ref<RTCCallStatus | undefined>
}

export const useCallControls = (params: UseCallControlsParams) => {
  const toggleMute = () => {
    params.isMuted.value = !params.isMuted.value
  }

  return { toggleMute }
}
