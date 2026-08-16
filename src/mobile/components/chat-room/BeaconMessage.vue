<template>
  <main
    class="beacon-message"
    role="button"
    :aria-label="t('chat.beacon.live_location')"
    @click.stop="handleOpenLocation">
    <!-- 位置图标和标题 -->
    <div class="beacon-message__header">
      <div class="beacon-message__title">
        <svg
          class="beacon-message__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <path d="M12 21s-7-5.1-7-11a7 7 0 0 1 14 0c0 5.9-7 11-7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
        <span class="beacon-message__title-text">{{ t('chat.beacon.live_location') }}</span>
      </div>

      <div class="beacon-message__status">
        <span :class="['beacon-message__status-dot', isActive ? 'is-active' : 'is-inactive']"></span>
        <van-tag plain round :color="isActive ? 'var(--tjg-color-primary-500)' : 'var(--tjg-text-quaternary)'">
          {{ isActive ? t('location_share.sharing') : t('chat.beacon.ended') }}
        </van-tag>
      </div>
    </div>

    <!-- 描述信息 -->
    <div class="beacon-message__description">
      {{ body?.description || t('chat.beacon.live_location') }}
    </div>

    <!-- 状态面板 -->
    <div class="beacon-message__panel">
      <template v-if="isActive">
        <van-cell-group inset class="beacon-message__cell-group">
          <van-cell :title="t('chat.beacon.remaining_time')" :value="remainingTimeText" />
        </van-cell-group>
        <van-button size="small" round type="primary" plain @click.stop="handleOpenLocation">
          {{ t('chat.beacon.view_location') }}
        </van-button>
      </template>
      <template v-else>
        <svg
          class="beacon-message__ended-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        <span class="beacon-message__ended-text">{{ t('chat.beacon.ended') }}</span>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { matrixLocationService } from '@/services/matrix/media/MatrixLocationService'
import type { BeaconBody } from '@/services/types'
import { formatBeaconRemainingTime, isBeaconActive } from '@/utils/beacon'
import { parseGeoUri } from '@/utils/location'

defineOptions({
  inheritAttrs: false
})

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    body?: BeaconBody
  }>(),
  {
    body: undefined
  }
)

const now = ref(Date.now())
let timer: number | undefined

const isActive = computed(() => isBeaconActive(props.body, now.value))

const remainingTimeText = computed(() => formatBeaconRemainingTime(props.body, now.value))

const handleOpenLocation = () => {
  if (!isActive.value) return
  const location = props.body?.uri ? parseGeoUri(props.body.uri) : null
  if (!location) return
  // OSM 使用 WGS-84，不做 GCJ-02 转换
  void openExternalUrl(
    matrixLocationService.getOpenStreetMapUrl({
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: Date.now()
    })
  )
}

onMounted(() => {
  timer = window.setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (timer !== undefined) {
    window.clearInterval(timer)
    timer = undefined
  }
})
</script>

<style scoped lang="scss">
.beacon-message {
  display: flex;
  flex-direction: column;
  width: 260px;
  max-width: 100%;
  padding: 8px;
  border-radius: var(--tjg-radius-md);
  border: 1px solid var(--tjg-border-default);
  background-color: var(--tjg-surface-muted);
  cursor: pointer;
  user-select: none;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 8px;
  }

  &__title {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  &__icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--tjg-color-warning-400);
  }

  &__title-text {
    font-size: var(--tjg-font-size-base);
    font-weight: var(--tjg-font-weight-medium);
    color: var(--tjg-text-primary);
  }

  &__status {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  &__status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;

    &.is-active {
      background-color: var(--tjg-color-primary-500);
      box-shadow: 0 0 4px var(--tjg-color-primary-500);
      animation: beacon-pulse 2s infinite;
    }

    &.is-inactive {
      background-color: var(--tjg-text-quaternary);
    }
  }

  &__description {
    padding-bottom: 8px;
    font-size: var(--tjg-font-size-sm);
    line-height: 1.5;
    color: var(--tjg-text-tertiary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 80px;
    padding: 8px 0;
    border-radius: var(--tjg-radius-sm);
    background-color: var(--tjg-surface-app);
  }

  &__cell-group {
    width: 100%;
    margin: 0;

    :deep(.van-cell) {
      padding: 6px 12px;
      background: transparent;

      &::after {
        border-bottom: none;
      }
    }
  }

  &__ended-icon {
    width: 24px;
    height: 24px;
    color: var(--tjg-text-quaternary);
  }

  &__ended-text {
    font-size: var(--tjg-font-size-sm);
    color: var(--tjg-text-quaternary);
  }
}

@keyframes beacon-pulse {
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

@media (prefers-reduced-motion: reduce) {
  .beacon-message__status-dot.is-active {
    animation: none;
  }
}
</style>
