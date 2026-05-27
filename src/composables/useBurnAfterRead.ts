import { computed, ref } from 'vue'
import { matrixBurnAfterReadService } from '@/services/matrix/messaging/MatrixBurnAfterReadService'
import { useGlobalStore } from '@/stores/domains/widget/global'

export function useBurnAfterRead() {
  const globalStore = useGlobalStore()
  const burnSettingsCache = ref<Record<string, boolean>>({})
  const burnDurationCache = ref<Record<string, number>>({})

  const currentRoomId = computed(() => globalStore.currentSessionRoomId)

  const isRoomBurnEnabled = (roomId?: string) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return false
    return burnSettingsCache.value[targetRoomId] ?? false
  }

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
        burnDurationCache.value = { ...burnDurationCache.value, [targetRoomId]: settings.burnAfterMs }
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
        }
      }
    } catch {
      // 服务端返回错误时不更新缓存，保持原有状态
    }
  }

  const markMessageRead = async (msgId: string, roomId?: string) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return
    try {
      await matrixBurnAfterReadService.markBurnRead(targetRoomId, msgId)
    } catch {
      // Ignore errors
    }
  }

  const getBurnStats = () => {
    const enabledCount = Object.values(burnSettingsCache.value).filter(Boolean).length
    const totalCount = Object.keys(burnSettingsCache.value).length
    return {
      totalBurned: 0,
      totalPending: 0,
      roomsWithBurnEnabled: enabledCount,
      enabledCount,
      totalCount
    }
  }

  const enableBurn = async (roomId?: string, burnAfterMs?: number) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return
    try {
      const result = await matrixBurnAfterReadService.enableBurn(targetRoomId, burnAfterMs)
      if (result !== null && result !== undefined) {
        burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: true }
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
    disableBurn
  }
}
