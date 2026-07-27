/**
 * 房间级消息保留策略 Composable (§8.7)
 *
 * 支持三种保留模式：
 * - unlimited: 不限制（默认）
 * - by_days: 保留最近 N 天（1-3650）
 * - by_count: 保留最近 N 条消息（1-100000）
 *
 * 通过 m.room.retention 状态事件持久化，仅管理员可配置。
 */

import { computed, ref } from 'vue'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRoomRetention')

type RetentionMode = 'unlimited' | 'by_days' | 'by_count'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_MESSAGE_ESTIMATE = 5 * 60 * 1000 // 5 分钟/条 估算
const MIN_DAYS = 1
const MAX_DAYS = 3650
const MIN_COUNT = 1
const MAX_COUNT = 100000

export interface RoomRetentionConfig {
  sendStateEvent: (roomId: string, eventType: string, content: Record<string, unknown>) => Promise<unknown>
  getStateEvent: (roomId: string, eventType: string) => Promise<{ content: Record<string, unknown> } | null>
}

export function useRoomRetention(config: RoomRetentionConfig) {
  const mode = ref<RetentionMode>('unlimited')
  const days = ref<number>(30)
  const count = ref<number>(1000)
  const isLoading = ref(false)
  const isSaving = ref(false)

  /** 配置是否有效 */
  const isConfigValid = computed(() => {
    if (mode.value === 'unlimited') return true
    if (mode.value === 'by_days') {
      return days.value >= MIN_DAYS && days.value <= MAX_DAYS
    }
    if (mode.value === 'by_count') {
      return count.value >= MIN_COUNT && count.value <= MAX_COUNT
    }
    return false
  })

  function setMode(newMode: RetentionMode): void {
    mode.value = newMode
  }

  function setDays(value: number): void {
    days.value = value
  }

  function setCount(value: number): void {
    count.value = value
  }

  /**
   * 加载房间当前保留策略
   */
  async function loadPolicy(roomId: string): Promise<void> {
    isLoading.value = true
    try {
      const event = await config.getStateEvent(roomId, 'm.room.retention')
      if (event?.content?.max_lifetime) {
        const maxLifetime = event.content.max_lifetime as number
        if (maxLifetime === 0) {
          mode.value = 'unlimited'
        } else {
          mode.value = 'by_days'
          days.value = Math.round(maxLifetime / MS_PER_DAY)
        }
      } else {
        mode.value = 'unlimited'
      }
      logger.info(`[RoomRetention] 加载保留策略: mode=${mode.value}`)
    } catch (err) {
      logger.error('[RoomRetention] 加载保留策略失败:', err)
      mode.value = 'unlimited'
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 保存保留策略到房间状态事件
   */
  async function savePolicy(roomId: string): Promise<void> {
    if (!isConfigValid.value) {
      throw new Error('保留策略配置无效')
    }

    isSaving.value = true
    try {
      let maxLifetime: number
      if (mode.value === 'unlimited') {
        maxLifetime = 0
      } else if (mode.value === 'by_days') {
        maxLifetime = days.value * MS_PER_DAY
      } else {
        maxLifetime = count.value * MS_PER_MESSAGE_ESTIMATE
      }

      const content = {
        max_lifetime: maxLifetime,
        expire_on_clients: true
      }

      await config.sendStateEvent(roomId, 'm.room.retention', content)
      logger.info(`[RoomRetention] 保存保留策略: mode=${mode.value}, max_lifetime=${maxLifetime}ms`)
    } catch (err) {
      logger.error('[RoomRetention] 保存保留策略失败:', err)
      throw err
    } finally {
      isSaving.value = false
    }
  }

  return {
    mode,
    days,
    count,
    isLoading,
    isSaving,
    isConfigValid,
    setMode,
    setDays,
    setCount,
    loadPolicy,
    savePolicy
  }
}
