import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { withTimeout } from '@/services/matrix/media/mediaMetadata'
import type { BurnStats } from '@/services/matrix/messaging/MatrixBurnAfterReadService'
import { useRoomStore } from '@/stores/domains/chat/room'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'
import { useBurnAfterRead } from './useBurnAfterRead'

const logger = createLogger('BurnAfterReadSettings')

/** 统计请求超时（ms）：服务端无响应时不能让卡片永久转圈。 */
const BURN_STATS_TIMEOUT_MS = 3_000

/** 阅后即焚可选时长（秒），桌面与移动端共用 */
/**
 * 可选存续时长（秒）。产品口径固定三档：1 / 5 / 30 分钟。
 * 与后端 `MAX_BURN_AFTER_MS`（30 分钟）保持一致，超出的值会被拒。
 */
const BURN_DURATION_VALUES = [60, 300, 1800] as const

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
    if (loadingStats.value) return
    loadingStats.value = true
    try {
      const stats = await withTimeout(getBurnStats(), BURN_STATS_TIMEOUT_MS, 'burn stats request timeout')
      burnStats.totalBurned = stats.totalBurned
      burnStats.totalPending = stats.totalPending
      burnStats.roomsWithBurnEnabled = stats.roomsWithBurnEnabled
    } catch (error) {
      // 超时/失败时展示 0 而不是保留转圈；loading 由 finally 复位
      logger.warn('Failed to load burn stats', error)
      burnStats.totalBurned = 0
      burnStats.totalPending = 0
      burnStats.roomsWithBurnEnabled = 0
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
