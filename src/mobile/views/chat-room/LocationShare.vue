<template>
  <van-popup
    :show="props.show"
    position="bottom"
    round
    closeable
    :close-on-popstate="true"
    @update:show="handleShowUpdate">
    <div class="location-share">
      <!-- 标题 -->
      <div class="header">
        <span class="title">{{ t('location_share.title') }}</span>
        <span class="description">{{ t('location_share.description') }}</span>
      </div>

      <!-- 当前坐标 -->
      <van-cell-group inset>
        <van-cell :title="t('location_share.my_location')">
          <template #value>
            <span v-if="currentLocation" class="coords">
              {{
                t('location_share.lat_lng', {
                  lat: currentLocation.latitude,
                  lng: currentLocation.longitude
                })
              }}
            </span>
            <span v-else class="placeholder">{{ t('location_share.no_sharing') }}</span>
          </template>
        </van-cell>

        <van-cell v-if="sharing" :title="t('location_share.beacon_info')">
          <template #value>
            <span class="sharing-badge">{{ t('location_share.sharing') }}</span>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 地图预览（腾讯静态图，需 GCJ-02 坐标） -->
      <div v-if="mapLocation" class="map-preview">
        <StaticProxyMap :location="mapLocation" :zoom="16" :height="160" :draggable="false" :controls="false" />
      </div>

      <!-- 共享时长选择(未共享时显示) -->
      <div v-if="!sharing" class="duration-row">
        <div class="duration-label">{{ t('location_share.live_duration') }}</div>
        <div class="duration-options">
          <van-button
            v-for="opt in durationOptions"
            :key="opt.value"
            size="small"
            :type="selectedDuration === opt.value ? 'primary' : 'default'"
            plain
            round
            @click="selectedDuration = opt.value">
            {{ opt.label }}
          </van-button>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="actions">
        <van-button block :loading="locating" @click="handleGetCurrentPosition">
          {{ t('location_share.my_location') }}
        </van-button>

        <van-button block type="primary" :disabled="!currentLocation" :loading="sending" @click="handleSendOnce">
          {{ t('location_share.share_once') }}
        </van-button>

        <van-button v-if="!sharing" block type="success" :loading="starting" @click="handleStartBeacon">
          {{ t('location_share.start_share') }}
        </van-button>
        <van-button v-else block type="danger" :loading="stopping" @click="handleStopBeacon()">
          {{ t('location_share.stop_share') }}
        </van-button>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" class="error-text">
        {{ error }}
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StaticProxyMap from '@/components/rightBox/location/StaticProxyMap.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useGeolocation } from '@/composables/common/useGeolocation'
import { type LocationData, matrixLocationService } from '@/services/matrix/media/MatrixLocationService'
import { useLocationStore } from '@/stores/domains/chat/location'
import { wgs84ToGcj02 } from '@/utils/CoordinateTransform'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LocationShare')

/** 实时共享期间，即使设备静止也定期发布最新位置，保持 beacon 活跃 */
const LIVE_PUBLISH_INTERVAL_MS = 15000

const props = defineProps<{
  show: boolean
  roomId: string | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'sent'): void
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { getLocationWithTransform, watchPosition, isLoading: locating } = useGeolocation()

// 接入 store（C2）：统一管理 beacon 开/停与位置发布状态
const locationStore = useLocationStore()
const { sharing } = storeToRefs(locationStore)

// 本地 UI 状态
const currentLocation = ref<LocationData | null>(null)
/** 地图预览用的 GCJ-02 坐标（发送仍用 WGS-84 的 currentLocation） */
const mapLocation = ref<{ latitude: number; longitude: number } | null>(null)
const error = ref<string | null>(null)
const activeBeaconId = ref<string | null>(null)

// watchPosition（C5）清理句柄 + 周期发布定时器
let stopWatch: (() => void) | null = null
let publishTimer: number | undefined

// 共享时长选项(毫秒)
const durationOptions = [
  { label: t('location_share.duration_15min'), value: 15 * 60 * 1000 },
  { label: t('location_share.duration_1hour'), value: 60 * 60 * 1000 },
  { label: t('location_share.duration_8hour'), value: 8 * 60 * 60 * 1000 }
]
const selectedDuration = ref(durationOptions[1].value)

const sending = ref(false)
const starting = ref(false)
const stopping = ref(false)

const toLocationData = (pos: GeolocationPosition): LocationData => ({
  latitude: pos.coords.latitude,
  longitude: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  timestamp: pos.timestamp
})

// popup 显隐同步
const handleShowUpdate = (val: boolean) => {
  emit('update:show', val)
}

// 单次获取当前位置（发送面板预览）
const refreshPosition = async (): Promise<LocationData | null> => {
  try {
    const transformed = await getLocationWithTransform()
    currentLocation.value = toLocationData(transformed.position)
    mapLocation.value = { latitude: transformed.transformed.lat, longitude: transformed.transformed.lng }
    error.value = null
    return currentLocation.value
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    error.value = msg
    showFeedback(msg, 'error')
    return null
  }
}

// 打开面板时若尚无位置则自动获取一次
watch(
  () => props.show,
  (val) => {
    if (val && !currentLocation.value) {
      void refreshPosition()
    }
  }
)

// 切换房间时停止当前 beacon 并清理监听
watch(
  () => props.roomId,
  () => {
    if (activeBeaconId.value) {
      void handleStopBeacon({ silent: true })
    }
  }
)

const handleGetCurrentPosition = async () => {
  await refreshPosition()
}

const handleSendOnce = async () => {
  const roomId = props.roomId
  const current = currentLocation.value
  if (!roomId || !current) return
  sending.value = true
  try {
    await matrixLocationService.sendLocation(roomId, current)
    showFeedback(t('location_share.send_success'), 'success')
    emit('sent')
    emit('update:show', false)
  } catch (err) {
    logger.error('发送位置失败', err)
    showFeedback(t('location_share.send_failed'), 'error')
  } finally {
    sending.value = false
  }
}

const stopLiveWatch = () => {
  stopWatch?.()
  stopWatch = null
  if (publishTimer !== undefined) {
    window.clearInterval(publishTimer)
    publishTimer = undefined
  }
}

// 到期/手动停止后 sharing 变为 false 时，清理 watchPosition 与周期发布定时器，
// 避免停止后仍后台定位并上报（Blocker 1：隐私级）。
watch(sharing, (val) => {
  if (!val) {
    stopLiveWatch()
    activeBeaconId.value = null
  }
})

const startLiveWatch = () => {
  stopLiveWatch()

  // 实时监听位置变化（C5），位置更新即发布 m.beacon
  stopWatch = watchPosition(
    (pos) => {
      const loc = toLocationData(pos)
      currentLocation.value = loc
      const gcj = wgs84ToGcj02(loc.latitude, loc.longitude)
      mapLocation.value = { latitude: gcj.lat, longitude: gcj.lng }
      if (activeBeaconId.value) {
        void locationStore.publishLocation(activeBeaconId.value, loc)
      }
    },
    (err) => {
      error.value = err.message
    }
  )

  // 周期发布：设备静止时也定期发布最新位置，保持 beacon 时效
  publishTimer = window.setInterval(() => {
    if (activeBeaconId.value && currentLocation.value) {
      void locationStore.publishLocation(activeBeaconId.value, currentLocation.value)
    }
  }, LIVE_PUBLISH_INTERVAL_MS)
}

const handleStartBeacon = async () => {
  const roomId = props.roomId
  if (!roomId) return
  starting.value = true
  try {
    const beaconId = await locationStore.startLiveShare(roomId, undefined, selectedDuration.value)
    activeBeaconId.value = beaconId
    startLiveWatch()
    showFeedback(t('location_share.start_success'), 'success')
  } catch (err) {
    logger.error('开启位置共享失败', err)
    showFeedback(t('location_share.start_failed'), 'error')
  } finally {
    starting.value = false
  }
}

const handleStopBeacon = async (opts?: { silent?: boolean }) => {
  const silent = opts?.silent ?? false
  if (!activeBeaconId.value) return
  stopping.value = true
  try {
    stopLiveWatch()
    await locationStore.stopLiveShare(activeBeaconId.value)
    activeBeaconId.value = null
    if (!silent) {
      showFeedback(t('location_share.stop_success'), 'success')
    }
  } catch (err) {
    logger.error('停止位置共享失败', err)
    if (!silent) {
      showFeedback(t('location_share.stop_failed'), 'error')
    }
  } finally {
    stopping.value = false
  }
}

// 组件卸载时清理监听并停止 beacon，避免泄漏
onUnmounted(() => {
  stopLiveWatch()
  if (activeBeaconId.value) {
    void locationStore.stopLiveShare(activeBeaconId.value).catch(() => {})
    activeBeaconId.value = null
  }
})
</script>

<style lang="scss" scoped>
.location-share {
  padding: 16px 12px 20px;
  background-color: var(--tjg-surface-panel);
}

.header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 4px 4px 12px;

  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--tjg-text-primary);
  }

  .description {
    margin-top: 4px;
    font-size: 12px;
    color: var(--tjg-text-tertiary);
  }
}

.coords {
  color: var(--tjg-text-primary);
  font-size: 13px;
}

.placeholder {
  color: var(--tjg-text-tertiary);
  font-size: 13px;
}

.sharing-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: var(--tjg-color-success-bg);
  color: var(--tjg-color-success-500);
  font-size: 12px;
}

.map-preview {
  margin: 12px 16px;
  overflow: hidden;
  border-radius: var(--tjg-radius-sm);
  border: 1px solid var(--tjg-border-default);
}

.duration-row {
  margin: 12px 16px;

  .duration-label {
    font-size: 13px;
    color: var(--tjg-text-secondary);
    margin-bottom: 8px;
  }

  .duration-options {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 12px 4px;
}

.error-text {
  margin-top: 8px;
  padding: 0 4px;
  font-size: 12px;
  color: var(--tjg-color-danger-500);
}
</style>
