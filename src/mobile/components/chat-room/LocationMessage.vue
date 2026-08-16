<template>
  <main class="location-message" role="button" :aria-label="t('chat.location.title')" @click.stop="handleOpenMap">
    <!-- 位置图标和标题 -->
    <div class="location-message__header">
      <div class="location-message__title">
        <svg
          class="location-message__icon"
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
        <span class="location-message__title-text">{{ t('chat.location.title') }}</span>
      </div>
      <span v-if="body?.precision" class="location-message__precision">{{ body.precision }}</span>
    </div>

    <!-- 地址信息 -->
    <div class="location-message__address">
      {{ body?.address || t('chat.location.cannot_display') }}
    </div>

    <!-- 地图预览区域 -->
    <div class="location-message__map">
      <StaticProxyMap
        v-if="locationData"
        :location="locationData"
        :zoom="16"
        :height="120"
        :draggable="false"
        :controls="false" />
      <div v-else class="location-message__empty">
        <svg
          class="location-message__empty-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 15s1.5 2 4 2 4-2 4-2" />
          <path d="M9 9h.01M15 9h.01" />
        </svg>
        <span>{{ t('chat.location.cannot_display') }}</span>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StaticProxyMap from '@/components/rightBox/location/StaticProxyMap.vue'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { matrixLocationService } from '@/services/matrix/media/MatrixLocationService'
import type { LocationBody } from '@/services/types'
import { wgs84ToGcj02 } from '@/utils/CoordinateTransform'

defineOptions({
  inheritAttrs: false
})

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    body?: LocationBody
  }>(),
  {
    body: undefined
  }
)

// 收到的 geo URI 存 WGS-84，腾讯地图显示前转 GCJ-02（仅中国境内坐标会被转换）
const locationData = computed(() => {
  const latitude = Number(props.body?.latitude)
  const longitude = Number(props.body?.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const gcj = wgs84ToGcj02(latitude, longitude)
  return {
    latitude: gcj.lat,
    longitude: gcj.lng,
    address: props.body?.address,
    timestamp: Number(props.body?.timestamp) || Date.now()
  }
})

const handleOpenMap = () => {
  if (!locationData.value) return
  // OSM 使用 WGS-84，不做 GCJ-02 转换
  void openExternalUrl(
    matrixLocationService.getOpenStreetMapUrl({
      latitude: Number(props.body?.latitude),
      longitude: Number(props.body?.longitude),
      timestamp: Number(props.body?.timestamp) || Date.now()
    })
  )
}
</script>

<style scoped lang="scss">
.location-message {
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
    color: var(--tjg-color-primary-500);
  }

  &__title-text {
    font-size: var(--tjg-font-size-base);
    font-weight: var(--tjg-font-weight-medium);
    color: var(--tjg-text-primary);
  }

  &__precision {
    flex-shrink: 0;
    padding: 2px 6px;
    border-radius: var(--tjg-radius-xs);
    border: 1px solid var(--tjg-color-primary-500);
    color: var(--tjg-color-primary-500);
    font-size: var(--tjg-font-size-xs);
  }

  &__address {
    padding-bottom: 8px;
    font-size: var(--tjg-font-size-sm);
    line-height: 1.5;
    color: var(--tjg-text-tertiary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  &__map {
    position: relative;
    overflow: hidden;
    border-radius: var(--tjg-radius-sm);
    background-color: var(--tjg-surface-app);
  }

  &__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 120px;
    color: var(--tjg-text-quaternary);
    font-size: var(--tjg-font-size-sm);
  }

  &__empty-icon {
    width: 24px;
    height: 24px;
  }
}
</style>
