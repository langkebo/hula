import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import { matrixBeaconService } from '@/services/matrix/media/MatrixBeaconService'
import { type LocationData, matrixLocationService } from '@/services/matrix/media/MatrixLocationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LocationStore')

/** 活跃信标状态（以 beacon_info 事件 ID 为键） */
export interface ActiveBeacon {
  roomId: string
  owner: string
  description?: string
  timeout?: number
  isLive: boolean
  latestUri?: string
}

/**
 * 位置 / beacon 实时共享 Store。
 *
 * 统一管理 live share 的状态，替代组件里零散的局部 ref。
 * 当前只覆盖「单次定位 + 单信标」的开/停闭环；持续定位循环（watchPosition）
 * 与超时/会话恢复留待后续任务（C5/C9）。
 */
export const useLocationStore = defineStore(StoresEnum.LOCATION, () => {
  const activeBeacons = ref<Map<string, ActiveBeacon>>(new Map())
  const sharing = ref(false)
  const currentLocation = ref<LocationData | null>(null)

  /**
   * 开启实时位置共享：创建 beacon_info，取一次当前位置并发布首个 m.beacon。
   * 返回 beacon_info 事件 ID（供后续 publishLocation / stopLiveShare 使用）。
   */
  async function startLiveShare(roomId: string, description?: string, timeout?: number): Promise<string> {
    const beacon = await matrixBeaconService.createBeacon({ roomId, description, timeout })

    activeBeacons.value.set(beacon.event_id, {
      roomId,
      owner: beacon.user_id,
      description: beacon.description,
      timeout: beacon.timeout,
      isLive: beacon.is_live,
      latestUri: undefined
    })
    sharing.value = true

    try {
      const location = await matrixLocationService.getCurrentPosition()
      await publishLocation(beacon.event_id, location)
    } catch (error) {
      // 信标已创建成功，定位失败不阻塞共享开启（后续任务会周期重试发布位置）
      logger.warn('获取初始位置失败，信标已创建但未发布位置:', error)
    }

    return beacon.event_id
  }

  /** 发布一次信标位置（m.beacon 事件），并更新 latestUri / currentLocation。 */
  async function publishLocation(beaconInfoEventId: string, loc: LocationData): Promise<void> {
    const beacon = activeBeacons.value.get(beaconInfoEventId)
    if (!beacon) {
      logger.warn('publishLocation: 未找到 beaconInfoEventId', beaconInfoEventId)
      return
    }

    await matrixBeaconService.updateBeaconLocation({
      roomId: beacon.roomId,
      beaconInfoEventId,
      latitude: loc.latitude,
      longitude: loc.longitude,
      uncertainty: loc.accuracy
    })

    const latestUri = `geo:${loc.latitude},${loc.longitude}`
    activeBeacons.value.set(beaconInfoEventId, { ...beacon, latestUri })
    currentLocation.value = { ...loc }
  }

  /** 停止实时共享：发送 live:false 的 beacon_info state event，并关闭共享标志。 */
  async function stopLiveShare(beaconInfoEventId: string): Promise<void> {
    const beacon = activeBeacons.value.get(beaconInfoEventId)
    if (!beacon) return

    const stopped = await matrixBeaconService.stopBeacon(beacon.roomId, beaconInfoEventId)
    if (!stopped) {
      throw new Error('停止信标失败')
    }

    activeBeacons.value.set(beaconInfoEventId, { ...beacon, isLive: false })

    // 仅当不再存在任何 live 信标时才关闭共享态（为多信标场景预留）。
    sharing.value = Array.from(activeBeacons.value.values()).some((item) => item.isLive)
    currentLocation.value = null
  }

  /** 重置所有位置 / 信标状态。 */
  function reset(): void {
    activeBeacons.value = new Map()
    sharing.value = false
    currentLocation.value = null
  }

  return {
    activeBeacons,
    sharing,
    currentLocation,
    startLiveShare,
    publishLocation,
    stopLiveShare,
    reset
  }
})
