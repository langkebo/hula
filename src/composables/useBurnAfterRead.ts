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
    if (isEnabled) {
      await matrixBurnAfterReadService.disableBurn(targetRoomId)
      burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: false }
    } else {
      await matrixBurnAfterReadService.enableBurn(targetRoomId)
      burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: true }
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
    await matrixBurnAfterReadService.enableBurn(targetRoomId, burnAfterMs)
    burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: true }
  }

  const disableBurn = async (roomId?: string) => {
    const targetRoomId = roomId || currentRoomId.value
    if (!targetRoomId) return
    await matrixBurnAfterReadService.disableBurn(targetRoomId)
    burnSettingsCache.value = { ...burnSettingsCache.value, [targetRoomId]: false }
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
