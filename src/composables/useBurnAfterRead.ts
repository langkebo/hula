import { computed, ref } from 'vue'
import {
  type BurnPendingEvent,
  type BurnStats,
  matrixBurnAfterReadService
} from '@/services/matrix/messaging/MatrixBurnAfterReadService'
import { useGlobalStore } from '@/stores/domains/widget/global'

// Fix 1: 模块级单例缓存，确保所有 useBurnAfterRead() 调用者共享同一份状态。
// 原实现将缓存放在函数体内，每次调用创建新实例，导致开关状态无法跨组件传递。
const burnSettingsCache = ref<Record<string, boolean>>({})
const burnDurationCache = ref<Record<string, number>>({})

/** 仅供测试使用：重置模块级缓存 */
export function _resetBurnCacheForTesting() {
  burnSettingsCache.value = {}
  burnDurationCache.value = {}
}

export function useBurnAfterRead() {
  const globalStore = useGlobalStore()

  const currentRoomId = computed(() => globalStore.currentSessionRoomId)

  const isRoomBurnEnabled = (roomId?: string) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return false
    return burnSettingsCache.value[targetRoomId] ?? false
  }

  // Fix 2: 缓存单位为「秒」，与服务层 burnAfterMs（毫秒）区分。
  // 发送链路 getRoomBurnDuration() * 1000 转回毫秒，保持一致。
  const getRoomBurnDuration = (roomId?: string) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return 0
    return burnDurationCache.value[targetRoomId] ?? 0
  }

  const refreshBurnSettings = async (roomId?: string) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return

    try {
      const settings = await matrixBurnAfterReadService.getBurnSettings(targetRoomId)
      if (settings) {
        burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: settings.enabled }
        // Fix 2: burnAfterMs 是毫秒，转为秒存储
        burnDurationCache.value = {
          ...burnDurationCache.value,
          [targetRoomId]: Math.round(settings.burnAfterMs / 1000)
        }
      }
    } catch {
      // Ignore errors - defaults will be used
    }
  }

  const toggleRoomBurn = async (roomId?: string) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return

    const isEnabled = isRoomBurnEnabled(targetRoomId)
    try {
      if (isEnabled) {
        const result = await matrixBurnAfterReadService.disableBurn(targetRoomId)
        // 仅在服务端确认成功时更新缓存，避免乐观更新导致状态不一致
        if (result !== null && result !== undefined) {
          burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: false }
        }
      } else {
        const result = await matrixBurnAfterReadService.enableBurn(targetRoomId)
        if (result !== null && result !== undefined) {
          burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: true }
          // Fix 3: 同步更新时长缓存（服务返回 burnAfterMs 毫秒，转秒存储）
          burnDurationCache.value = {
            ...burnDurationCache.value,
            [targetRoomId]: Math.round(result.burnAfterMs / 1000)
          }
        }
      }
    } catch {
      // 服务端返回错误时不更新缓存，保持原有状态
    }
  }

  // Fix 5: 返回 boolean 让调用方据以决定是否启动倒计时
  const markMessageRead = async (msgId: string, roomId?: string): Promise<boolean> => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return false
    try {
      return await matrixBurnAfterReadService.markBurnRead(targetRoomId, msgId)
    } catch {
      return false
    }
  }

  const getBurnStats = async (): Promise<BurnStats> => {
    try {
      return await matrixBurnAfterReadService.getBurnStats()
    } catch {
      return { totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 }
    }
  }

  const cancelBurn = async (roomId: string, eventId: string): Promise<boolean> => {
    try {
      return await matrixBurnAfterReadService.cancelBurn(roomId, eventId)
    } catch {
      return false
    }
  }

  const getPendingBurns = async (roomId: string): Promise<BurnPendingEvent[]> => {
    try {
      return await matrixBurnAfterReadService.getPendingBurns(roomId)
    } catch {
      return []
    }
  }

  const setBurnConfig = async (defaultBurnMs: number): Promise<number | null> => {
    try {
      return await matrixBurnAfterReadService.setBurnConfig(defaultBurnMs)
    } catch {
      return null
    }
  }

  const enableBurn = async (roomId?: string, burnAfterMs?: number) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return
    try {
      const result = await matrixBurnAfterReadService.enableBurn(targetRoomId, burnAfterMs)
      if (result !== null && result !== undefined) {
        burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: true }
        // Fix 3: 同步更新时长缓存，优先使用传入的 burnAfterMs，否则用服务返回值
        const durationMs = burnAfterMs ?? result.burnAfterMs
        burnDurationCache.value = {
          ...burnDurationCache.value,
          [targetRoomId]: Math.round(durationMs / 1000)
        }
      }
    } catch {
      // 服务端返回错误时不更新缓存
    }
  }

  const disableBurn = async (roomId?: string) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return
    try {
      const result = await matrixBurnAfterReadService.disableBurn(targetRoomId)
      if (result !== null && result !== undefined) {
        burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: false }
      }
    } catch {
      // 服务端返回错误时不更新缓存
    }
  }

  return {
    isRoomBurnEnabled,
    getRoomBurnDuration,
    refreshBurnSettings,
    toggleRoomBurn,
    markMessageRead,
    getBurnStats,
    enableBurn,
    disableBurn,
    cancelBurn,
    getPendingBurns,
    setBurnConfig
  }
}
