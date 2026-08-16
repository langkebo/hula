import { useI18n } from 'vue-i18n'
import { wgs84ToGcj02 } from '@/utils/CoordinateTransform'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Geolocation')

type GeolocationState = {
  loading: boolean
  error: string | null
  position: GeolocationPosition | null
  permission: PermissionState | null
  precision: 'high' | 'low'
}

type GeolocationOptions = {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

/** getLocationWithTransform 返回结果：原始 WGS-84 与转换后 GCJ-02 坐标分离 */
export type LocationWithTransform = {
  /** WGS-84 坐标，用于发送/存储（geo URI 必须用 WGS-84 与其它客户端互通） */
  original: { lat: number; lng: number }
  /** GCJ-02 坐标，用于腾讯地图显示与逆地理编码 */
  transformed: { lat: number; lng: number }
  position: GeolocationPosition
  address: string
  precision: 'high' | 'low'
  timestamp: number
}

export const useGeolocation = () => {
  const { t } = useI18n()
  const state = ref<GeolocationState>({
    loading: false,
    error: null,
    position: null,
    permission: null,
    precision: 'high'
  })

  const isSupported = computed(() => 'geolocation' in navigator)
  const hasPermission = computed(() => state.value.permission === 'granted')
  const isLoading = computed(() => state.value.loading)
  const error = computed(() => state.value.error)
  const currentPosition = computed(() => state.value.position)

  const checkPermission = async (): Promise<PermissionState> => {
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'geolocation' })
        state.value.permission = permission.state
        return permission.state
      } catch (error) {
        logger.warn('权限检查失败:', error)
      }
    }
    return 'prompt'
  }

  const getCurrentPosition = async (options?: GeolocationOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const unsupportedError = t('message.location.hook.unsupported')
        reject(new Error(unsupportedError))
        return
      }

      const defaultOptions: PositionOptions = {
        enableHighAccuracy: state.value.precision === 'high',
        timeout: 10000,
        maximumAge: 300000,
        ...options
      }

      state.value.loading = true
      state.value.error = null

      navigator.geolocation.getCurrentPosition(
        (position) => {
          state.value.loading = false
          state.value.position = position
          resolve(position)
        },
        (error) => {
          state.value.loading = false
          let errorMessage = t('message.location.hook.error_generic')

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = t('message.location.hook.permission_denied')
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = t('message.location.hook.position_unavailable')
              break
            case error.TIMEOUT:
              errorMessage = t('message.location.hook.timeout')
              break
          }

          state.value.error = errorMessage
          reject(new Error(errorMessage))
        },
        defaultOptions
      )
    })
  }

  const getLocationWithTransform = async (options?: GeolocationOptions): Promise<LocationWithTransform> => {
    const position = await getCurrentPosition(options)
    const { latitude, longitude } = position.coords

    const transformed = wgs84ToGcj02(latitude, longitude)

    return {
      original: { lat: latitude, lng: longitude },
      transformed,
      position,
      address: '',
      precision: state.value.precision,
      timestamp: Date.now()
    }
  }

  const clearError = () => {
    state.value.error = null
  }

  return {
    state,
    isSupported,
    hasPermission,
    isLoading,
    error,
    currentPosition,
    checkPermission,
    getCurrentPosition,
    getLocationWithTransform,
    clearError
  }
}
