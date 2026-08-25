import type { Ref } from 'vue'
import type { RTCCallStatus } from '@/enums'
import router from '@/router'

interface UseCallControlsParams {
  isMuted: Ref<boolean>
  isCallAccepted: Ref<boolean>
  connectionStatus: Ref<RTCCallStatus | undefined>
  isMobileDevice: boolean
}

export const useCallControls = (params: UseCallControlsParams) => {
  const toggleMute = () => {
    params.isMuted.value = !params.isMuted.value
  }

  const hangUp = () => {
    if (params.isMobileDevice) {
      if (router.currentRoute.value.path === '/mobile/rtcCall') {
        if (window.history.length > 1) {
          router.back()
        } else {
          router.replace('/mobile/message')
        }
      } else {
        router.back()
      }
    }
  }

  return { toggleMute, hangUp }
}
