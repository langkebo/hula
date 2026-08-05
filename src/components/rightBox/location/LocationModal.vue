<template>
  <n-modal
    v-model:show="modalVisible"
    :mask-closable="false"
    class="rounded-8px"
    transform-origin="center"
    role="dialog"
    aria-modal="true">
    <div class="location-modal h-full w-480px box-border flex flex-col items-center justify-between">
      <!-- 标题栏 -->
      <n-flex :size="6" vertical class="w-full">
        <MacCloseButton
          v-if="isMac()"
          class="location-modal__mac-close mt-6px absolute left-6px z-10"
          @click="modalVisible = false" />

        <n-flex class="text-(14px [--tjg-text-primary]) select-none pt-6px" justify="center">{{ modalTitle }}</n-flex>

        <svg
          v-if="isWindows()"
          class="size-14px cursor-pointer pt-6px select-none absolute right-6px z-10"
          @click="modalVisible = false">
          <use href="#close"></use>
        </svg>
        <span class="h-1px w-full bg-[--tjg-border-default]"></span>
      </n-flex>

      <!-- 地图加载错误 -->
      <div v-if="mapError" class="h-340px flex-center">
        <n-result status="error" :title="t('message.location.modal.result.map_error_title')" :description="mapError">
          <template #footer>
            <n-flex justify="center" :size="12">
              <n-button secondary @click="modalVisible = false">
                {{ t('message.location.modal.buttons.cancel') }}
              </n-button>
              <n-button type="primary" secondary @click="retryMapLoad">
                {{ t('message.location.modal.buttons.retry') }}
              </n-button>
            </n-flex>
          </template>
        </n-result>
      </div>

      <!-- 位置获取失败 -->
      <div v-else-if="locationState.error && !selectedLocation" class="h-340px flex-center">
        <n-result
          status="warning"
          :title="t('message.location.modal.result.location_error_title')"
          :description="locationState.error">
          <template #footer>
            <n-flex justify="center" :size="12">
              <n-button secondary @click="modalVisible = false">
                {{ t('message.location.modal.buttons.cancel') }}
              </n-button>
              <n-button type="primary" secondary @click="relocate">
                {{ t('message.location.modal.buttons.retry') }}
              </n-button>
            </n-flex>
          </template>
        </n-result>
      </div>

      <!-- 地图容器 -->
      <div v-else class="flex flex-col gap-16px p-8px">
        <!-- 地图区域 -->
        <div class="relative rounded-8px overflow-hidden flex-center h-340px">
          <!-- 地图加载中 -->
          <div v-if="locationState.loading || mapLoading" class="flex-col-center gap-42px">
            <n-spin :size="42" />
            <p class="text-(14px [--tjg-text-secondary])">
              {{
                locationState.loading
                  ? t('message.location.modal.loading.locating')
                  : t('message.location.modal.loading.map')
              }}
            </p>
          </div>

          <!-- 地图组件 -->
          <StaticProxyMap
            v-else-if="selectedLocation"
            :location="selectedLocation"
            :zoom="18"
            :height="340"
            :draggable="true"
            :controls="true"
            @location-change="handleLocationChange"
            @map-ready="() => (mapLoading = false)"
            @map-error="handleMapError" />
        </div>

        <!-- 位置信息显示 -->
        <div v-if="selectedLocation" class="location-modal__info rounded-6px p-12px">
          <n-flex vertical :size="8">
            <span class="text-14px font-medium">{{ t('message.location.modal.info.current') }}</span>
            <div class="text-(12px [--tjg-text-secondary])">
              {{ selectedLocation.address || t('message.location.modal.info.fetching_address') }}
            </div>
            <div class="text-(11px [--tjg-text-tertiary])">
              {{
                t('message.location.modal.info.coordinate', {
                  lat: selectedLocation.latitude.toFixed(6),
                  lng: selectedLocation.longitude.toFixed(6)
                })
              }}
            </div>
          </n-flex>
        </div>
      </div>

      <!-- 操作按钮 -->
      <n-flex v-if="showActionButtons" align="center" :size="24" class="py-8px">
        <n-button type="primary" secondary :loading="sendingLocation" @click="handleConfirm">
          {{ t('message.location.modal.buttons.send') }}
        </n-button>
      </n-flex>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import MacCloseButton from '@/components/common/MacCloseButton.vue'
import { useGeolocation } from '@/composables/common/useGeolocation'
import { reverseGeocode } from '@/services/mapApi'
import type { LocationData } from '@/types/common'
import { createLogger } from '@/utils/Logger'
import { isMac, isWindows } from '@/utils/PlatformConstants'
import StaticProxyMap from './StaticProxyMap.vue'

const logger = createLogger('LocationModal')

type LocationModalProps = {
  visible: boolean
}

type LocationModalEmits = {
  'update:visible': [visible: boolean]
  'location-selected': [location: LocationData]
  cancel: []
}

const props = withDefaults(defineProps<LocationModalProps>(), {
  visible: false
})

const emit = defineEmits<LocationModalEmits>()

// 地理位置Hook
const { state: locationState, getLocationWithTransform, clearError } = useGeolocation()

// 响应式状态
const modalVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => {
    if (!value) {
      handleClose()
    }
    emit('update:visible', value)
  }
})

const selectedLocation = ref<LocationData | null>(null)
const mapLoading = ref(false)
const mapError = ref<string | null>(null)
const sendingLocation = ref(false)

const { t } = useI18n()

// 计算属性
const modalTitle = computed(() => {
  if (mapError.value) return t('message.location.modal.title.map_error')
  if (locationState.value.error) return t('message.location.modal.title.location_error')
  return t('message.location.modal.title.default')
})

const showActionButtons = computed(() => {
  return !mapLoading.value && !locationState.value.loading && selectedLocation.value !== null && !mapError.value
})

// 处理关闭
const handleClose = () => {
  clearError()
  selectedLocation.value = null
  mapError.value = null
  mapLoading.value = false
  emit('cancel')
}

// 获取位置
const getLocation = async () => {
  try {
    mapError.value = null
    clearError()

    // 获取位置信息
    const result = await getLocationWithTransform({
      enableHighAccuracy: true
    })

    // 获取地址信息
    const geocodeResult = await reverseGeocode(result.transformed.lat, result.transformed.lng).catch((error) => {
      logger.warn('逆地理编码失败:', error)
      return null
    })
    const address =
      geocodeResult?.formatted_addresses?.recommend ||
      geocodeResult?.address ||
      t('message.location.modal.info.unknown_address')

    selectedLocation.value = {
      latitude: result.transformed.lat,
      longitude: result.transformed.lng,
      address,
      timestamp: result.timestamp
    }
  } catch (error) {
    logger.error('获取位置失败:', error)
  }
}

// 监听弹窗显示
watch(modalVisible, (visible) => {
  if (visible) {
    // 重置状态
    selectedLocation.value = null
    mapError.value = null
    mapLoading.value = false

    // 获取位置
    getLocation()
  }
})

// 重新定位
const relocate = async () => {
  selectedLocation.value = null
  mapError.value = null
  await getLocation()
}

// 重试地图加载
const retryMapLoad = async () => {
  mapError.value = null
  await getLocation()
}

// 地图事件处理
const handleLocationChange = async (newLocation: { lat: number; lng: number }) => {
  if (!selectedLocation.value) return

  // 获取新位置的地址
  const geocodeResult = await reverseGeocode(newLocation.lat, newLocation.lng).catch((error) => {
    logger.warn('逆地理编码失败:', error)
    return null
  })
  const address =
    geocodeResult?.formatted_addresses?.recommend || geocodeResult?.address || selectedLocation.value.address

  selectedLocation.value = {
    ...selectedLocation.value,
    latitude: newLocation.lat,
    longitude: newLocation.lng,
    address,
    timestamp: Date.now()
  }
}

const handleMapError = (error: string) => {
  mapError.value = error
  mapLoading.value = false
}

// 确认发送位置
const handleConfirm = async () => {
  if (!selectedLocation.value) return

  sendingLocation.value = true
  emit('location-selected', selectedLocation.value)
  modalVisible.value = false
  sendingLocation.value = false
}
</script>

<style scoped lang="scss">
.location-modal {
  background-color: var(--tjg-surface-panel-muted);
}

.location-modal__mac-close {
  background-color: color-mix(in srgb, var(--tjg-color-danger-500) 72%, transparent);
}

.location-modal__info {
  background-color: var(--tjg-surface-elevated);
}
</style>
