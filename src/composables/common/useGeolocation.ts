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

  /** 组装 navigator.geolocation 的 PositionOptions（带默认值） */
  const buildPositionOptions = (options?: GeolocationOptions): PositionOptions => ({
    enableHighAccuracy: state.value.precision === 'high',
    timeout: 10000,
    maximumAge: 300000,
    ...options
  })

  /** 将 GeolocationPositionError 映射为用户可读的本地化错误信息 */
  const mapPositionError = (error: GeolocationPositionError): string => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return t('message.location.hook.permission_denied')
      case error.POSITION_UNAVAILABLE:
        return t('message.location.hook.position_unavailable')
      case error.TIMEOUT:
        return t('message.location.hook.timeout')
      default:
        return t('message.location.hook.error_generic')
    }
  }

  const getCurrentPosition = async (options?: GeolocationOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const unsupportedError = t('message.location.hook.unsupported')
        reject(new Error(unsupportedError))
        return
      }

      const defaultOptions = buildPositionOptions(options)

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
          const errorMessage = mapPositionError(error)
          state.value.error = errorMessage
          reject(new Error(errorMessage))
        },
        defaultOptions
      )
    })
  }

  /**
   * 实时监听位置变化（实时位置共享必需）。
   *
   * 抽象点说明：当前统一走 WebView 的 `navigator.geolocation.watchPosition`，
   * Tauri 在 Android/iOS 上会将其桥接到系统定位（前提是已声明移动端定位权限，
   * 见 `src-tauri/gen/android/.../AndroidManifest.xml` 与 iOS Info.plist）。
   * 若后续需要更强的原生能力（后台定位、自定义权限引导），可在此处替换为
   * `@tauri-apps/plugin-geolocation` 的 watchPosition，公开接口保持
   * `watchPosition(onUpdate, onError, options) => clear` 不变。
   *
   * @returns 清理函数：调用 `navigator.geolocation.clearWatch` 停止监听。
   */
  const watchPosition = (
    onUpdate: (position: GeolocationPosition) => void,
    onError: (error: Error) => void,
    options?: GeolocationOptions
  ): (() => void) => {
    if (!navigator.geolocation) {
      onError(new Error(t('message.location.hook.unsupported')))
      return () => {}
    }

    const watchOptions = buildPositionOptions(options)
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        state.value.position = position
        onUpdate(position)
      },
      (error) => {
        const errorMessage = mapPositionError(error)
        state.value.error = errorMessage
        onError(new Error(errorMessage))
      },
      watchOptions
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
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
    watchPosition,
    getLocationWithTransform,
    clearError
  }
}
