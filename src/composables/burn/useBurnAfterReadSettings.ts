import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { BurnPendingEvent, BurnSettings, BurnStats } from '@/services/matrix/messaging/MatrixBurnAfterReadService'
import { matrixBurnAfterReadService } from '@/services/matrix/messaging/MatrixBurnAfterReadService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useBurnAfterReadSettings')

/** 可选的焚毁时长预设(毫秒) */
export const BURN_DURATION_PRESETS_MS = [
  30 * 1000, // 30 秒
  60 * 1000, // 1 分钟
  5 * 60 * 1000, // 5 分钟
  60 * 60 * 1000, // 1 小时
  24 * 60 * 60 * 1000 // 1 天
] as const

export interface UseBurnAfterReadSettingsOptions {
  /** 当前房间 ID,提供后则针对该房间操作;留空则仅做全局操作 */
  roomId?: string
}

/**
 * 阅后即焚设置 composable
 *
 * 封装 MatrixBurnAfterReadService 的能力:
 * - 全局默认焚毁时长(setBurnConfig)
 * - 房间级启用/禁用(enableBurn/disableBurn)
 * - 房间级设置查询(getBurnSettings)
 * - 待焚毁消息查询(getPendingBurns)
 * - 焚毁统计(getBurnStats)
 * - 取消焚毁(cancelBurn)
 *
 * 由移动端 BurnAfterReadSettings.vue 与未来 PC 端等共用
 */
export function useBurnAfterReadSettings(options: UseBurnAfterReadSettingsOptions = {}) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const roomIdRef = ref<string | undefined>(options.roomId)

  const loading = ref(false)
  const updating = ref(false)
  const errorMessage = ref<string | null>(null)

  const roomSettings = ref<BurnSettings | null>(null)
  const pendingBurns = ref<BurnPendingEvent[]>([])
  const burnStats = ref<BurnStats>({ totalBurned: 0, totalPending: 0, roomsWithBurnEnabled: 0 })

  /** 房间是否已启用阅后即焚 */
  const isRoomBurnEnabled = computed<boolean>(() => !!roomSettings.value?.enabled)

  /** 当前房间的焚毁时长(毫秒),未启用时返回 0 */
  const roomBurnAfterMs = computed<number>(() => roomSettings.value?.burnAfterMs ?? 0)

  /** 是否已绑定房间 */
  const hasRoom = computed<boolean>(() => !!roomIdRef.value)

  /**
   * 加载房间级阅后即焚设置与待焚毁列表
   */
  const loadRoomSettings = async (): Promise<void> => {
    const roomId = roomIdRef.value
    if (!roomId) {
      logger.warn('[loadRoomSettings] 未提供 roomId,跳过房间级查询')
      return
    }
    loading.value = true
    errorMessage.value = null
    try {
      const [settings, pending] = await Promise.all([
        matrixBurnAfterReadService.getBurnSettings(roomId),
        matrixBurnAfterReadService.getPendingBurns(roomId)
      ])
      roomSettings.value = settings
      pendingBurns.value = pending
    } catch (err) {
      logger.error('[loadRoomSettings] 加载房间阅后即焚设置失败', err)
      errorMessage.value = t('mobile_burn.entry.apply_failed')
      showFeedback(errorMessage.value as string, 'error')
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载全局焚毁统计
   */
  const loadStats = async (): Promise<void> => {
    try {
      burnStats.value = await matrixBurnAfterReadService.getBurnStats()
    } catch (err) {
      logger.error('[loadStats] 加载焚毁统计失败', err)
    }
  }

  /**
   * 一次性加载所有数据
   */
  const load = async (): Promise<void> => {
    await Promise.all([loadRoomSettings(), loadStats()])
  }

  /**
   * 启用房间阅后即焚
   * @param burnAfterMs 焚毁时长(毫秒),缺省使用服务端默认值
   */
  const enableRoomBurn = async (burnAfterMs?: number): Promise<boolean> => {
    const roomId = roomIdRef.value
    if (!roomId) {
      showFeedback(t('mobile_burn.entry.apply_failed'), 'error')
      return false
    }
    updating.value = true
    errorMessage.value = null
    try {
      const result = await matrixBurnAfterReadService.enableBurn(roomId, burnAfterMs)
      if (result) {
        roomSettings.value = result
        showFeedback(t('mobile_burn.room_enabled'), 'success')
        return true
      }
      errorMessage.value = t('mobile_burn.entry.apply_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } catch (err) {
      logger.error('[enableRoomBurn] 启用房间阅后即焚失败', err)
      errorMessage.value = t('mobile_burn.entry.apply_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /**
   * 禁用房间阅后即焚
   */
  const disableRoomBurn = async (): Promise<boolean> => {
    const roomId = roomIdRef.value
    if (!roomId) {
      showFeedback(t('mobile_burn.entry.apply_failed'), 'error')
      return false
    }
    updating.value = true
    errorMessage.value = null
    try {
      const result = await matrixBurnAfterReadService.disableBurn(roomId)
      if (result) {
        roomSettings.value = result
        pendingBurns.value = []
        showFeedback(t('mobile_burn.room_disabled'), 'success')
        return true
      }
      errorMessage.value = t('mobile_burn.entry.apply_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } catch (err) {
      logger.error('[disableRoomBurn] 禁用房间阅后即焚失败', err)
      errorMessage.value = t('mobile_burn.entry.apply_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /**
   * 切换房间阅后即焚状态
   */
  const toggleRoomBurn = async (enabled: boolean, burnAfterMs?: number): Promise<boolean> => {
    return enabled ? enableRoomBurn(burnAfterMs) : disableRoomBurn()
  }

  /**
   * 更新全局默认焚毁时长
   * @param burnAfterMs 焚毁时长(毫秒)
   */
  const updateDefaultDuration = async (burnAfterMs: number): Promise<boolean> => {
    updating.value = true
    errorMessage.value = null
    try {
      const result = await matrixBurnAfterReadService.setBurnConfig(burnAfterMs)
      if (result !== null) {
        showFeedback(t('mobile_burn.entry.apply_success'), 'success')
        return true
      }
      errorMessage.value = t('mobile_burn.entry.apply_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } catch (err) {
      logger.error('[updateDefaultDuration] 更新默认焚毁时长失败', err)
      errorMessage.value = t('mobile_burn.entry.apply_failed')
      showFeedback(errorMessage.value as string, 'error')
      return false
    } finally {
      updating.value = false
    }
  }

  /**
   * 取消指定事件的焚毁
   */
  const cancelBurn = async (eventId: string): Promise<boolean> => {
    const roomId = roomIdRef.value
    if (!roomId || !eventId) return false
    try {
      const ok = await matrixBurnAfterReadService.cancelBurn(roomId, eventId)
      if (ok) {
        pendingBurns.value = pendingBurns.value.filter((e) => e.eventId !== eventId)
        showFeedback(t('mobile_burn.entry.apply_success'), 'success')
      }
      return ok
    } catch (err) {
      logger.error('[cancelBurn] 取消焚毁失败', err)
      return false
    }
  }

  /**
   * 更新绑定的房间 ID(供父组件动态切换房间)
   */
  const setRoomId = (roomId: string | undefined): void => {
    roomIdRef.value = roomId
    roomSettings.value = null
    pendingBurns.value = []
    errorMessage.value = null
  }

  return {
    // 状态
    loading,
    updating,
    errorMessage,
    roomSettings,
    pendingBurns,
    burnStats,
    // 计算属性
    isRoomBurnEnabled,
    roomBurnAfterMs,
    hasRoom,
    // 方法
    load,
    loadRoomSettings,
    loadStats,
    enableRoomBurn,
    disableRoomBurn,
    toggleRoomBurn,
    updateDefaultDuration,
    cancelBurn,
    setRoomId
  }
}
