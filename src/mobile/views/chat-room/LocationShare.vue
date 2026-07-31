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
            <span v-if="location.currentLocation.value" class="coords">
              {{
                t('location_share.lat_lng', {
                  lat: location.currentLocation.value.latitude,
                  lng: location.currentLocation.value.longitude
                })
              }}
            </span>
            <span v-else class="placeholder">{{ t('location_share.no_sharing') }}</span>
          </template>
        </van-cell>

        <van-cell v-if="location.sharing.value" :title="t('location_share.beacon_info')">
          <template #value>
            <span class="sharing-badge">{{ t('location_share.sharing') }}</span>
          </template>
        </van-cell>
      </van-cell-group>

      <!-- 共享时长选择(未共享时显示) -->
      <div v-if="!location.sharing.value" class="duration-row">
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
        <van-button block :loading="location.loading.value" @click="handleGetCurrentPosition">
          {{ t('location_share.my_location') }}
        </van-button>

        <van-button
          block
          type="primary"
          :disabled="!location.currentLocation.value"
          :loading="sending"
          @click="handleSendOnce">
          {{ t('location_share.share_once') }}
        </van-button>

        <van-button v-if="!location.sharing.value" block type="success" :loading="starting" @click="handleStartBeacon">
          {{ t('location_share.start_share') }}
        </van-button>
        <van-button v-else block type="danger" :loading="stopping" @click="handleStopBeacon">
          {{ t('location_share.stop_share') }}
        </van-button>
      </div>

      <!-- 错误提示 -->
      <div v-if="location.error.value" class="error-text">
        {{ location.error.value }}
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocationShare } from '@/composables/location/useLocationShare'

const props = defineProps<{
  show: boolean
  roomId: string | null
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'sent'): void
}>()

const { t } = useI18n()

const location = useLocationShare({ roomId: props.roomId })

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

// popup 显隐同步
const handleShowUpdate = (val: boolean) => {
  emit('update:show', val)
}

// 打开时自动获取一次位置
watch(
  () => props.show,
  (val) => {
    if (val) {
      location.getCurrentPosition()
    }
  }
)

// 房间变化时重置状态
watch(
  () => props.roomId,
  () => {
    location.reset()
  }
)

const handleGetCurrentPosition = async () => {
  await location.getCurrentPosition()
}

const handleSendOnce = async () => {
  const roomId = props.roomId
  const current = location.currentLocation.value
  if (!roomId || !current) return
  sending.value = true
  try {
    const ok = await location.sendLocation(roomId, current)
    if (ok) {
      emit('sent')
      emit('update:show', false)
    }
  } finally {
    sending.value = false
  }
}

const handleStartBeacon = async () => {
  const roomId = props.roomId
  if (!roomId) return
  starting.value = true
  try {
    await location.startBeacon(roomId, selectedDuration.value)
  } finally {
    starting.value = false
  }
}

const handleStopBeacon = async () => {
  const roomId = props.roomId
  if (!roomId) return
  stopping.value = true
  try {
    await location.stopBeacon(roomId)
  } finally {
    stopping.value = false
  }
}
</script>

<style lang="scss" scoped>
.location-share {
  padding: 16px 12px 20px;
  background-color: var(--hula-surface-panel);
}

.header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 4px 4px 12px;

  .title {
    font-size: 16px;
    font-weight: 600;
    color: var(--hula-text-primary);
  }

  .description {
    margin-top: 4px;
    font-size: 12px;
    color: var(--hula-text-tertiary);
  }
}

.coords {
  color: var(--hula-text-primary);
  font-size: 13px;
}

.placeholder {
  color: var(--hula-text-tertiary);
  font-size: 13px;
}

.sharing-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  background-color: var(--hula-color-success-bg, rgba(7, 193, 96, 0.12));
  color: var(--hula-color-success-500);
  font-size: 12px;
}

.duration-row {
  margin: 12px 16px;

  .duration-label {
    font-size: 13px;
    color: var(--hula-text-secondary);
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
  color: var(--hula-color-danger-500);
}
</style>
