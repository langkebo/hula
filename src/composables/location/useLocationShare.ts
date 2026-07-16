import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixBeaconService } from '@/services/matrix/media/MatrixBeaconService'
import { type LocationData, matrixLocationService } from '@/services/matrix/media/MatrixLocationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useLocationShare')

export interface UseLocationShareOptions {
  roomId: string | null
}

/** 实时共享默认时长:1 小时 */
export const DEFAULT_BEACON_TIMEOUT = 3600000

/**
 * 跨端位置共享 composable
 *
 * 封装以下能力:
 * - getCurrentPosition 通过浏览器 navigator.geolocation 获取当前位置
 * - sendLocation 调用 MatrixLocationService 发送一次性位置消息
 * - startBeacon 调用 MatrixBeaconService.createBeacon 开启实时位置共享
 * - stopBeacon  调用 MatrixBeaconService.stopBeacon 停止实时位置共享
 *
 * PC 端与移动端共用此逻辑,UI 层只需消费状态并调用方法。
 */
export function useLocationShare(options: UseLocationShareOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  // 是否正在实时共享
  const sharing = ref(false)
  // 当前位置(最近一次获取到的)
  const currentLocation = ref<LocationData | null>(null)
  // 错误信息
  const error = ref<string | null>(null)
  // 实时共享对应的 beacon_info 事件 ID(用于停止共享)
  const beaconInfoEventId = ref<string | null>(null)
  // 操作进行中标志(获取位置/发送/启停)
  const loading = ref(false)

  /**
   * 使用浏览器 navigator.geolocation API 获取当前位置
   * 成功时更新 currentLocation 并返回 LocationData,失败时返回 null
   */
  const getCurrentPosition = (): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        const msg = t('location_share.permission_failed')
        error.value = msg
        showFeedback(msg, 'error')
        resolve(null)
        return
      }

      loading.value = true
      error.value = null

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          }
          currentLocation.value = location
          loading.value = false
          resolve(location)
        },
        (err) => {
          logger.error('获取位置失败', err)
          const msg =
            err.code === err.PERMISSION_DENIED
              ? t('location_share.permission_denied')
              : t('location_share.permission_failed')
          error.value = msg
          showFeedback(msg, 'error')
          loading.value = false
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      )
    })
  }

  /**
   * 解析有效 roomId:优先使用方法入参,缺省时回退到 options.roomId
   */
  const resolveRoomId = (roomId: string): string => {
    return roomId || options.roomId || ''
  }

  /**
   * 发送一次性位置消息到指定房间
   */
  const sendLocation = async (roomId: string, location: LocationData): Promise<boolean> => {
    const resolved = resolveRoomId(roomId)
    if (!resolved) {
      showFeedback(t('location_share.send_failed'), 'error')
      return false
    }
    try {
      await matrixLocationService.sendLocation(resolved, location)
      showFeedback(t('location_share.send_success'), 'success')
      return true
    } catch (err) {
      logger.error('发送位置失败', err)
      showFeedback(t('location_share.send_failed'), 'error')
      return false
    }
  }

  /**
   * 开启实时位置共享
   * @param roomId 房间 ID
   * @param duration 共享时长(毫秒),默认 1 小时
   */
  const startBeacon = async (roomId: string, duration: number = DEFAULT_BEACON_TIMEOUT): Promise<boolean> => {
    const resolved = resolveRoomId(roomId)
    if (!resolved) {
      showFeedback(t('location_share.start_failed'), 'error')
      return false
    }
    try {
      const beacon = await matrixBeaconService.createBeacon({
        roomId: resolved,
        timeout: duration
      })
      beaconInfoEventId.value = beacon.event_id
      sharing.value = true
      showFeedback(t('location_share.start_success'), 'success')
      return true
    } catch (err) {
      logger.error('开启位置共享失败', err)
      showFeedback(t('location_share.start_failed'), 'error')
      return false
    }
  }

  /**
   * 停止实时位置共享
   */
  const stopBeacon = async (roomId: string): Promise<boolean> => {
    const resolved = resolveRoomId(roomId)
    if (!resolved || !beaconInfoEventId.value) {
      showFeedback(t('location_share.stop_failed'), 'error')
      return false
    }
    try {
      const ok = await matrixBeaconService.stopBeacon(resolved, beaconInfoEventId.value)
      if (ok) {
        sharing.value = false
        beaconInfoEventId.value = null
        showFeedback(t('location_share.stop_success'), 'success')
        return true
      }
      showFeedback(t('location_share.stop_failed'), 'error')
      return false
    } catch (err) {
      logger.error('停止位置共享失败', err)
      showFeedback(t('location_share.stop_failed'), 'error')
      return false
    }
  }

  /**
   * 重置全部状态(组件卸载或切换房间时调用)
   */
  const reset = (): void => {
    sharing.value = false
    currentLocation.value = null
    error.value = null
    beaconInfoEventId.value = null
    loading.value = false
  }

  return {
    // 状态
    sharing,
    currentLocation,
    error,
    beaconInfoEventId,
    loading,
    // 方法
    getCurrentPosition,
    sendLocation,
    startBeacon,
    stopBeacon,
    reset
  }
}
