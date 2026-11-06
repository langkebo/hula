import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BurnStats } from '@/services/matrix/messaging/MatrixBurnAfterReadService'
import { useRoomStore } from '@/stores/domains/chat/room'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useBurnAfterRead } from './useBurnAfterRead'

/** 阅后即焚可选时长（秒），桌面与移动端共用 */
const BURN_DURATION_VALUES = [30, 60, 300, 3600, 86400] as const

/**
 * 阅后即焚设置页共享逻辑（桌面 Naive UI / 移动 Vant 各自只保留模板）。
 *
 * - 全局开关、默认时长、倒计时展示统一读写 settingStore；
 * - 房间级开关经 useBurnAfterRead 走服务层，成功后由该 composable 回写 store；
 * - 房间列表读 settingStore.burnRooms，不再由各端自行维护 localStorage 副本。
 */
export function useBurnAfterReadSettings() {
  const { t } = useI18n()
  const settingStore = useSettingStore()
  const roomStore = useRoomStore()
  const { enableBurn, disableBurn, getBurnStats } = useBurnAfterRead()

  const globalEnabled = ref(settingStore.burnDefaultEnabled)
  const defaultDuration = ref<number>(settingStore.burnDefaultDuration)
  const showCountdown = ref(settingStore.burnShowCountdownEnabled)

  const loadingStats = ref(false)
  const burnStats = reactive<BurnStats>({ totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 })

  /** 已开启阅后即焚的房间（store 持久化，名称按当前房间列表实时解析） */
  const burnRooms = computed(() =>
    settingStore.burnRooms.map((room: { roomId: string; duration: number }) => ({
      roomId: room.roomId,
      duration: room.duration,
      name: roomStore.roomList.find((item) => item.roomId === room.roomId)?.name || room.roomId
    }))
  )

  /** 时长格式化：秒 -> 可读文案 */
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return t('setting.burn_after_read.formats.seconds', { count: String(seconds) })
    if (seconds < 3600) {
      return t('setting.burn_after_read.formats.minutes', { count: String(Math.floor(seconds / 60)) })
    }
    if (seconds < 86400) {
      return t('setting.burn_after_read.formats.hours', { count: String(Math.floor(seconds / 3600)) })
    }
    return t('setting.burn_after_read.formats.days', { count: String(Math.floor(seconds / 86400)) })
  }

  const durationOptions = computed(() => BURN_DURATION_VALUES.map((value) => ({ label: formatDuration(value), value })))

  const setGlobalEnabled = (enabled: boolean) => {
    globalEnabled.value = enabled
    settingStore.setBurnDefaultEnabled(enabled)
  }

  const setDefaultDuration = (duration: number) => {
    defaultDuration.value = duration
    settingStore.setBurnDefaultDuration(duration)
  }

  const setShowCountdown = (enabled: boolean) => {
    showCountdown.value = enabled
    settingStore.setBurnShowCountdownEnabled(enabled)
  }

  const loadBurnStats = async () => {
    loadingStats.value = true
    try {
      const stats = await getBurnStats()
      burnStats.totalBurned = stats.totalBurned
      burnStats.totalPending = stats.totalPending
      burnStats.roomsWithBurnEnabled = stats.roomsWithBurnEnabled
    } finally {
      loadingStats.value = false
    }
  }

  /** 切换房间级开关，返回服务端是否确认成功 */
  const toggleRoomBurn = async (roomId: string, enabled: boolean, durationSeconds: number): Promise<boolean> => {
    const ok = enabled ? await enableBurn(roomId, durationSeconds * 1000) : await disableBurn(roomId)
    if (ok) await loadBurnStats()
    return ok
  }

  return {
    globalEnabled,
    defaultDuration,
    showCountdown,
    loadingStats,
    burnStats,
    burnRooms,
    formatDuration,
    durationOptions,
    setGlobalEnabled,
    setDefaultDuration,
    setShowCountdown,
    loadBurnStats,
    toggleRoomBurn
  }
}
