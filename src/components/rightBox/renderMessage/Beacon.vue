<template>
  <main class="beacon-message" @dblclick.stop="handleBeaconClick">
    <!-- 位置图标和标题 -->
    <n-flex align="center" justify="space-between" class="pb-8px">
      <div class="flex-y-center gap-8px">
        <svg class="size-14px color-[--tjg-color-warning-400]">
          <use href="#local"></use>
        </svg>
        <p class="text-[length:var(--tjg-font-size-base)] font-medium color-[--tjg-text-primary]">
          {{ t('chat.beacon.live_location') }}
        </p>
      </div>

      <div class="flex-y-center gap-4px">
        <span v-if="isActive" class="status-dot active"></span>
        <span v-else class="status-dot inactive"></span>
        <p
          class="text-[length:var(--tjg-font-size-xs)]"
          :class="isActive ? 'color-[--tjg-color-primary-500]' : 'color-[--tjg-text-quaternary]'">
          {{ isActive ? '共享中' : '已结束' }}
        </p>
      </div>
    </n-flex>

    <!-- 描述信息 -->
    <div class="text-(12px [--tjg-text-tertiary]) pb-8px leading-5 line-clamp-2">
      {{ body?.description || '发起了位置共享' }}
    </div>

    <!-- 状态面板 -->
    <div class="relative rounded-6px overflow-hidden bg-[--tjg-surface-app] h-80px flex-col-center gap-8px">
      <template v-if="isActive">
        <p class="text-[length:var(--tjg-font-size-sm)] color-[--tjg-text-secondary]">
          {{ t('chat.beacon.remaining_time') }} {{ remainingTimeText }}
        </p>
        <n-button size="small" type="primary" secondary @click.stop="handleJoinClick">
          {{ t('chat.beacon.view_location') }}
        </n-button>
      </template>
      <template v-else>
        <svg class="size-24px color-[--tjg-text-quaternary]">
          <use href="#time-out"></use>
        </svg>
        <span class="text-[length:var(--tjg-font-size-sm)] color-[--tjg-text-quaternary]">
          {{ t('chat.beacon.ended') }}
        </span>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { matrixLocationService } from '@/services/matrix/media/MatrixLocationService'
import type { BeaconBody } from '@/services/types'
import { useTimerManager } from '@/utils/TimerManager'

defineOptions({
  inheritAttrs: false
})

const { t } = useI18n()

/**
 * Beacon 消息组件 - 用于显示实时位置共享消息
 * Matrix MSC3672: https://github.com/matrix-org/matrix-spec-proposals/pull/3672
 *
 * @remarks
 * Beacon 是一种实时位置共享功能，允许用户分享他们的实时位置给房间成员。
 * 组件支持：
 * - 显示位置共享的实时状态（共享中/已结束）
 * - 倒计时显示剩余共享时间
 * - 点击查看实时位置地图
 *
 * @example
 * ```vue
 * <Beacon :body="beaconData" />
 * ```
 */
const props = withDefaults(
  defineProps<{
    /** Beacon 事件的消息体 */
    body?: BeaconBody
  }>(),
  {
    body: undefined
  }
)

/**
 * Beacon 数据结构说明：
 * - description: 位置共享的描述信息
 * - isLive: 是否正在实时共享
 * - lastUpdateTs: 最后更新时间戳
 * - timeout: 共享持续时间（毫秒）
 * - uri: 位置的 URI (geo:latitude,longitude 格式)
 * - timestamp: 共享开始时间戳
 */

/**
 * 当前时间引用，用于实时更新倒计时
 */
const now = ref(Date.now())
const timerManager = useTimerManager()
let timer: number | undefined
const { showFeedback } = useActionFeedback()

const isActive = computed(() => {
  if (!props.body?.isLive) return false
  const startTime = props.body.lastUpdateTs || Date.now()
  return now.value < startTime + (props.body.timeout || 0)
})

const remainingTimeText = computed(() => {
  if (!props.body) return '00:00'
  const startTime = props.body.lastUpdateTs || Date.now()
  const endTime = startTime + (props.body.timeout || 0)
  const diff = Math.max(0, Math.floor((endTime - now.value) / 1000))

  if (diff <= 0) return '00:00'

  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})

/**
 * 从 URI 解析位置数据
 */
const parseGeoUri = (uri: string): { latitude: number; longitude: number; timestamp: number } | null => {
  if (!uri) return null
  const match = uri.match(/geo:([-\d.]+),([-\d.]+)/)
  if (match) {
    return {
      latitude: parseFloat(match[1]),
      longitude: parseFloat(match[2]),
      timestamp: Date.now()
    }
  }
  return null
}

/**
 * 打开地图查看位置
 */
const handleBeaconClick = () => {
  if (!isActive.value) {
    showFeedback('位置共享已结束，无法查看', 'info')
    return
  }

  const uri = props.body?.uri
  if (!uri) {
    showFeedback('无法获取位置信息', 'info')
    return
  }

  const location = parseGeoUri(uri)
  if (!location) {
    showFeedback('位置信息格式无效', 'info')
    return
  }

  // 使用 OpenStreetMap 打开地图（无需 API Key）
  const mapsUrl = matrixLocationService.getOpenStreetMapUrl(location)
  void openExternalUrl(mapsUrl)
}

const handleJoinClick = () => {
  handleBeaconClick()
}

onMounted(() => {
  timer = timerManager.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timer) {
    timerManager.clearInterval(timer)
  }
})
</script>

<style scoped lang="scss">
.beacon-message {
  cursor: default;
  user-select: none;
  @apply: w-260px flex flex-col h-fit bg-[--tjg-surface-muted]
  border-(1px solid [--tjg-border-default])
  hover:bg-[--tjg-fill-hover] rounded-8px p-8px box-border
  custom-shadow transition-colors duration-200;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;

  &.active {
    background-color: var(--tjg-color-primary-500);
    box-shadow: 0 0 4px var(--tjg-color-primary-500);
    animation: pulse 2s infinite;
  }

  &.inactive {
    background-color: var(--tjg-text-quaternary);
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
