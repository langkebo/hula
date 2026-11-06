import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useI18nGlobal } from '@/services/i18n'
import { useLocationStore } from '@/stores/domains/chat/location'
import type { LocationData } from '@/types/common'
import { createLogger } from '@/utils/Logger'

interface Options {
  currentSessionRoomId: Ref<string>
  sendLocationDirect: (locationData: LocationData) => Promise<void>
}

/**
 * 输入区的位置能力：位置选择弹窗、实时位置共享（Beacon）开始/停止。
 */
export const useMsgInputLocationShare = ({ currentSessionRoomId, sendLocationDirect }: Options) => {
  const logger = createLogger('MsgInput')
  const { t } = useI18nGlobal()
  const { showFeedback } = useActionFeedback()
  const locationStore = useLocationStore()
  const { sharing } = storeToRefs(locationStore)
  const showLocationModal = ref(false)

  const stopSharing = async () => {
    const liveBeaconId = Array.from(locationStore.activeBeacons.entries()).find(([, beacon]) => beacon.isLive)?.[0]
    if (!liveBeaconId) return

    try {
      await locationStore.stopLiveShare(liveBeaconId)
      showFeedback(t('message.beacon.stop_success'), 'success')
    } catch (error) {
      logger.error('Failed to stop Beacon:', error)
      showFeedback(t('message.beacon.stop_failed'), 'error')
    }
  }

  const handleBeaconClick = async () => {
    if (!currentSessionRoomId.value) return

    // 已在共享中：再次点击工具栏按钮即「停止共享」
    if (sharing.value) {
      await stopSharing()
      return
    }

    try {
      await locationStore.startLiveShare(currentSessionRoomId.value, t('chat.beacon.live_location'))
      showFeedback(t('message.beacon.started'), 'success')
    } catch (error) {
      logger.error('Failed to start Beacon:', error)
      showFeedback(t('message.beacon.failed'), 'error')
    }
  }

  const handleLocationSelected = async (locationData: LocationData) => {
    try {
      await sendLocationDirect(locationData)
    } catch (error) {
      logger.error('Failed to send location:', error)
      showFeedback(t('message.location.send_failed'), 'error')
    }
  }

  return { sharing, showLocationModal, handleBeaconClick, handleLocationSelected }
}
