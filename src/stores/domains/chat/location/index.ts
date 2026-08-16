import { defineStore } from 'pinia'
import { ref } from 'vue'
import { StoresEnum } from '@/enums'
import { matrixBeaconService } from '@/services/matrix/media/MatrixBeaconService'
import { type LocationData, matrixLocationService } from '@/services/matrix/media/MatrixLocationService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LocationStore')

/** 到期自动停止失败后的退避重试间隔。 */
const EXPIRY_STOP_RETRY_DELAY_MS = 5000

/** 活跃信标状态（以 beacon_info 事件 ID 为键） */
export interface ActiveBeacon {
  roomId: string
  owner: string
  description?: string
  timeout?: number
  /** beacon 起始时间戳（m.ts），用于计算到期时间 */
  timestamp: number
  isLive: boolean
  latestUri?: string
}

/**
 * 位置 / beacon 实时共享 Store。
 *
 * 统一管理 live share 的状态，替代组件里零散的局部 ref。
 * 覆盖「开启 → 周期发布 → 超时/手动停止 → 过期清理 → 会话恢复」完整闭环。
 */
export const useLocationStore = defineStore(StoresEnum.LOCATION, () => {
  const activeBeacons = ref<Map<string, ActiveBeacon>>(new Map())
  const sharing = ref(false)
  const currentLocation = ref<LocationData | null>(null)

  /** 到期定时器（以 beacon_info 事件 ID 为键），到期后自动停止对应信标。 */
  const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function clearExpiryTimer(beaconInfoEventId: string): void {
    const timer = expiryTimers.get(beaconInfoEventId)
    if (timer !== undefined) {
      clearTimeout(timer)
      expiryTimers.delete(beaconInfoEventId)
    }
  }

  function clearAllExpiryTimers(): void {
    for (const timer of expiryTimers.values()) {
      clearTimeout(timer)
    }
    expiryTimers.clear()
  }

  /** 依据 timestamp + timeout 计算剩余时长并排定到期定时器；到期即调用 stopLiveShare。 */
  function scheduleExpiry(beaconInfoEventId: string, beacon: ActiveBeacon): void {
    clearExpiryTimer(beaconInfoEventId)
    if (beacon.timeout === undefined || beacon.timeout <= 0) return

    const remaining = beacon.timestamp + beacon.timeout - Date.now()
    if (remaining <= 0) {
      // 已过期：立即停止（信标已写入 activeBeacons，stopLiveShare 可定位到它）
      void stopLiveShare(beaconInfoEventId).catch((error) => handleExpiryStopFailure(beaconInfoEventId, error))
      return
    }

    expiryTimers.set(
      beaconInfoEventId,
      setTimeout(() => {
        expiryTimers.delete(beaconInfoEventId)
        void stopLiveShare(beaconInfoEventId).catch((error) => handleExpiryStopFailure(beaconInfoEventId, error))
      }, remaining)
    )
  }

  /**
   * 到期自动停止失败时的兜底：短暂退避后重新调度 stopLiveShare。
   * 否则定时器已删除、isLive/sharing 未复位，信标会永久卡在 live 态。
   */
  function handleExpiryStopFailure(beaconInfoEventId: string, error: unknown): void {
    logger.warn('到期自动停止失败，短暂退避后重试:', beaconInfoEventId, error)
    expiryTimers.set(
      beaconInfoEventId,
      setTimeout(() => {
        expiryTimers.delete(beaconInfoEventId)
        void stopLiveShare(beaconInfoEventId).catch((err) => handleExpiryStopFailure(beaconInfoEventId, err))
      }, EXPIRY_STOP_RETRY_DELAY_MS)
    )
  }

  /**
   * 开启实时位置共享：创建 beacon_info，取一次当前位置并发布首个 m.beacon。
   * 返回 beacon_info 事件 ID（供后续 publishLocation / stopLiveShare 使用）。
   */
  async function startLiveShare(roomId: string, description?: string, timeout?: number): Promise<string> {
    const beacon = await matrixBeaconService.createBeacon({ roomId, description, timeout })

    // 本地会话以开启时刻为起始时间（服务端 m.ts 即创建时刻，二者相差毫秒级），
    // 与 SDK checkLiveness 的「timestamp + timeout」口径一致。
    const active: ActiveBeacon = {
      roomId,
      owner: beacon.user_id,
      description: beacon.description,
      timeout: beacon.timeout,
      timestamp: Date.now(),
      isLive: beacon.is_live,
      latestUri: undefined
    }
    activeBeacons.value.set(beacon.event_id, active)
    sharing.value = true
    scheduleExpiry(beacon.event_id, active)

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

    // 停止（含到期自动停止）后不得继续后台定位并上报（Blocker 1：隐私级）。
    if (!beacon.isLive) {
      logger.warn('publishLocation: 信标已停止，跳过位置发布', beaconInfoEventId)
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

    clearExpiryTimer(beaconInfoEventId)

    const stopped = await matrixBeaconService.stopBeacon(beacon.roomId, beaconInfoEventId)
    if (!stopped) {
      throw new Error('停止信标失败')
    }

    activeBeacons.value.set(beaconInfoEventId, { ...beacon, isLive: false })

    // 仅当不再存在任何 live 信标时才关闭共享态（为多信标场景预留）。
    sharing.value = Array.from(activeBeacons.value.values()).some((item) => item.isLive)
    currentLocation.value = null
  }

  /**
   * 会话恢复：从服务端重建活跃信标并恢复共享态。
   * 重连 / 重启后调用（app 就绪或进入房间时），并为仍 live 的信标重建到期定时器。
   */
  async function restoreActiveBeacons(roomId: string): Promise<void> {
    const beacons = await matrixBeaconService.getActiveBeacons(roomId)

    clearAllExpiryTimers()
    const restored = new Map<string, ActiveBeacon>()
    for (const beacon of beacons) {
      restored.set(beacon.event_id, {
        roomId: beacon.room_id,
        owner: beacon.user_id,
        description: beacon.description,
        timeout: beacon.timeout,
        timestamp: beacon.last_updated,
        isLive: beacon.is_live,
        latestUri: undefined
      })
    }

    activeBeacons.value = restored
    sharing.value = restored.size > 0
    currentLocation.value = null

    for (const [beaconInfoEventId, beacon] of restored) {
      scheduleExpiry(beaconInfoEventId, beacon)
    }
  }

  /** 重置所有位置 / 信标状态。 */
  function reset(): void {
    clearAllExpiryTimers()
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
    restoreActiveBeacons,
    reset
  }
})
