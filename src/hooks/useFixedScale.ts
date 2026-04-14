/**
 * 固定缩放组合式函数
 *
 * 保持页面在不同系统显示缩放(DPI)下视觉尺寸一致
 *
 * 功能:
 * - 当系统显示缩放为 125%、150%、200% 等导致 devicePixelRatio 改变时，自动反向缩放页面
 * - 支持多显示器环境，窗口跨屏幕移动时自动适配
 * - 使用 Tauri 原生 API 监听 DPI 变化
 * - 提供 zoom 和 transform 两种缩放模式
 *
 * @deprecated 建议使用 useDpiManager 获得更好的多屏幕支持
 */

import { invoke } from '@tauri-apps/api/core'
import { useDebounceFn } from '@vueuse/core'
import { createLogger } from '@/utils/Logger'
import { useDpiManager } from './useDpiManager'

const logger = createLogger('FixedScale')

export type FixedScaleMode = 'zoom' | 'transform'

export type UseFixedScaleOptions = {
  target?: string | HTMLElement
  mode?: FixedScaleMode
  getScale?: () => number
  minScale?: number
  maxScale?: number
  enableWindowsTextScaleDetection?: boolean
  useNativeApi?: boolean
}

type FixedScaleController = {
  enable: () => void | Promise<void>
  disable: () => void
  getCurrentScale: () => number
  forceUpdate: () => void
  readonly isEnabled: ComputedRef<boolean>
  readonly currentScale: ComputedRef<number>
  readonly devicePixelRatio: ComputedRef<number>
}

const clamp = (n: number, min?: number, max?: number) => {
  let x = n
  if (typeof min === 'number') x = Math.max(min, x)
  if (typeof max === 'number') x = Math.min(max, x)
  return x
}

const resolveElement = (target?: string | HTMLElement): HTMLElement => {
  if (!target) return (document.getElementById('app') || document.body || document.documentElement) as HTMLElement
  if (typeof target === 'string') {
    const el = document.querySelector(target)
    return (el as HTMLElement) || (document.getElementById('app') as HTMLElement) || document.body
  }
  return target
}

const supportsZoom = (() => {
  const testEl = document.createElement('div')
  testEl.style.zoom = '1'
  return testEl.style.zoom === '1'
})()

export const useFixedScale = (options: UseFixedScaleOptions = {}): FixedScaleController => {
  const {
    target = '#app',
    mode = 'zoom',
    getScale,
    minScale = 0.1,
    maxScale = 3.0,
    enableWindowsTextScaleDetection = false,
    useNativeApi = true
  } = options

  const isEnabled = ref(false)
  const currentDPR = ref(window.devicePixelRatio || 1)
  const targetElement = ref<HTMLElement | null>(null)

  const windowsScaleInfo = ref<{
    system_dpi: number
    system_scale: number
    text_scale: number
    has_text_scaling: boolean
  } | null>(null)

  const originalStyles: Partial<CSSStyleDeclaration> = {}
  const eventListeners = new Map<string, () => void>()
  const mediaQueryListeners = new Set<MediaQueryList>()

  let dpiManager: ReturnType<typeof useDpiManager> | null = null

  const checkWindowsScale = async () => {
    if (!enableWindowsTextScaleDetection) return

    try {
      const scaleInfo = (await invoke('get_windows_scale_info')) as {
        system_dpi: number
        system_scale: number
        text_scale: number
        has_text_scaling: boolean
      }

      const oldTextScale = windowsScaleInfo.value?.text_scale
      const newTextScale = scaleInfo.text_scale

      windowsScaleInfo.value = scaleInfo

      if (oldTextScale && Math.abs(newTextScale - oldTextScale) > 0.001) {
        window.dispatchEvent(
          new CustomEvent('resize-needed', {
            detail: {
              type: 'text-scale-change',
              oldScale: oldTextScale,
              newScale: newTextScale,
              scaleInfo
            }
          })
        )
      }
    } catch (error) {
      logger.warn('Failed to get Windows scale info:', error)
    }
  }

  const calculateOptimalScale = (): number => {
    const dpr = currentDPR.value

    if (getScale) {
      return getScale()
    }

    if (enableWindowsTextScaleDetection && windowsScaleInfo.value && windowsScaleInfo.value.has_text_scaling) {
      return 1 / windowsScaleInfo.value.text_scale
    }

    if (Math.abs(dpr - 2.0) < 0.01) {
      return 0.5
    } else if (Math.abs(dpr - 1.5) < 0.01) {
      return 2 / 3
    } else if (Math.abs(dpr - 1.25) < 0.01) {
      return 0.8
    }

    return 1 / dpr
  }

  const currentScale = computed(() => clamp(calculateOptimalScale(), minScale, maxScale))
  const devicePixelRatio = computed(() => currentDPR.value)

  const applyZoom = (scale: number) => {
    if (!targetElement.value) return
    const el = targetElement.value
    const elStyle = el.style as CSSStyleDeclaration & { zoom?: string }
    elStyle.zoom = String(scale)
    el.style.transformOrigin = ''
    el.style.transform = ''
    el.style.width = ''
    el.style.height = ''
  }

  const applyTransform = (scale: number) => {
    if (!targetElement.value) return
    const el = targetElement.value
    el.style.transformOrigin = '0 0'
    el.style.transform = `scale(${scale})`
    el.style.width = `${100 / scale}%`
    el.style.height = `${100 / scale}%`
    const elStyle = el.style as CSSStyleDeclaration & { zoom?: string }
    elStyle.zoom = ''
  }

  const apply = () => {
    if (!targetElement.value) return

    const scale = currentScale.value
    document.documentElement.style.setProperty('--page-scale', String(scale))
    document.documentElement.style.setProperty('--device-pixel-ratio', String(currentDPR.value))

    const effectiveMode = mode === 'zoom' && !supportsZoom ? 'transform' : mode

    if (effectiveMode === 'zoom') {
      applyZoom(scale)
    } else {
      applyTransform(scale)
    }

    window.dispatchEvent(
      new CustomEvent('resize-needed', {
        detail: { scale, devicePixelRatio: currentDPR.value }
      })
    )
  }

  const updateDPR = () => {
    const newDPR = window.devicePixelRatio || 1
    if (Math.abs(newDPR - currentDPR.value) > 0.001) {
      currentDPR.value = newDPR
      if (isEnabled.value) {
        nextTick(() => {
          apply()
        })
      }
    }
  }

  const setupListeners = () => {
    const debounceApply = useDebounceFn(() => {
      updateDPR()
    }, 100)

    const debounceCheckWindowsScale = useDebounceFn(() => {
      checkWindowsScale()
    }, 200)

    const customResizeHandler = (e: CustomEvent) => {
      if (e.detail?.type === 'text-scale-change') {
        nextTick(() => {
          apply()
        })
      }
    }
    eventListeners.set('resize-needed', () => {
      window.removeEventListener('resize-needed', customResizeHandler as EventListener)
    })
    window.addEventListener('resize-needed', customResizeHandler as EventListener)

    const resizeHandler = () => {
      debounceApply()
      if (enableWindowsTextScaleDetection) {
        debounceCheckWindowsScale()
      }
    }
    eventListeners.set('resize', resizeHandler)
    window.addEventListener('resize', resizeHandler, { passive: true })

    if (window.visualViewport) {
      const viewportHandler = () => {
        debounceApply()
        if (enableWindowsTextScaleDetection) {
          debounceCheckWindowsScale()
        }
      }

      window.visualViewport.addEventListener('resize', viewportHandler, { passive: true })
      window.visualViewport.addEventListener('scroll', viewportHandler, { passive: true })

      eventListeners.set('visualViewport', () => {
        window.visualViewport?.removeEventListener('resize', viewportHandler)
        window.visualViewport?.removeEventListener('scroll', viewportHandler)
      })
    }

    const dprValues = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]

    dprValues.forEach((dpr) => {
      try {
        const mql = matchMedia(`(resolution: ${dpr}dppx)`)
        if (mql) {
          const handler = (e: MediaQueryListEvent) => {
            if (e.matches) {
              debounceApply()
              if (enableWindowsTextScaleDetection) {
                debounceCheckWindowsScale()
              }
            }
          }

          mql.addEventListener('change', handler)
          mediaQueryListeners.add(mql)

          eventListeners.set(`mql-${dpr}`, () => {
            mql.removeEventListener('change', handler)
          })
        }
      } catch (error) {
        logger.debug(`Failed to create media query for ${dpr}dppx:`, error)
      }
    })
  }

  const removeListeners = () => {
    eventListeners.forEach((cleanup, key) => {
      try {
        if (key === 'resize') {
          window.removeEventListener('resize', cleanup as EventListener)
        } else if (key === 'resize-needed') {
          window.removeEventListener('resize-needed', cleanup as EventListener)
        } else {
          cleanup()
        }
      } catch (error) {
        logger.debug(`Error removing listener ${key}:`, error)
      }
    })

    eventListeners.clear()
    mediaQueryListeners.clear()
  }

  const saveOriginal = () => {
    if (!targetElement.value) return
    const el = targetElement.value
    const elStyle = el.style as CSSStyleDeclaration & { zoom?: string }
    originalStyles.zoom = elStyle.zoom
    originalStyles.transform = el.style.transform
    originalStyles.transformOrigin = el.style.transformOrigin
    originalStyles.width = el.style.width
    originalStyles.height = el.style.height
  }

  const restoreOriginal = () => {
    if (!targetElement.value) return
    const el = targetElement.value

    document.documentElement.style.removeProperty('--page-scale')
    document.documentElement.style.removeProperty('--device-pixel-ratio')

    const elStyle = el.style as CSSStyleDeclaration & { zoom?: string }
    if (originalStyles.zoom !== undefined) elStyle.zoom = originalStyles.zoom
    if (originalStyles.transform !== undefined) el.style.transform = originalStyles.transform
    if (originalStyles.transformOrigin !== undefined) el.style.transformOrigin = originalStyles.transformOrigin
    if (originalStyles.width !== undefined) el.style.width = originalStyles.width
    if (originalStyles.height !== undefined) el.style.height = originalStyles.height
  }

  const enableNativeApi = async () => {
    dpiManager = useDpiManager({
      autoApply: true,
      targetElement: target,
      minScale,
      maxScale,
      onScaleChange: (newScale) => {
        currentDPR.value = newScale
        if (enableWindowsTextScaleDetection) {
          checkWindowsScale()
        }
      }
    })

    await dpiManager.startMonitoring()
    isEnabled.value = dpiManager.isMonitoring.value
  }

  const enableFallback = async () => {
    const el = resolveElement(target)
    if (!el) {
      return
    }

    targetElement.value = el
    currentDPR.value = window.devicePixelRatio || 1

    if (enableWindowsTextScaleDetection) {
      await checkWindowsScale()
    }

    saveOriginal()
    setupListeners()

    if (!enableWindowsTextScaleDetection || windowsScaleInfo.value?.has_text_scaling) {
      apply()
    }

    isEnabled.value = true
  }

  const enable = async () => {
    if (isEnabled.value) {
      return
    }

    if (useNativeApi) {
      try {
        await enableNativeApi()
        logger.info('Using native Tauri API for DPI management')
      } catch (error) {
        logger.warn('Native API failed, falling back to legacy implementation:', error)
        await enableFallback()
      }
    } else {
      await enableFallback()
    }
  }

  const disable = () => {
    if (dpiManager) {
      dpiManager.stopMonitoring()
      dpiManager = null
    }

    removeListeners()
    restoreOriginal()
    isEnabled.value = false
    targetElement.value = null
  }

  onBeforeUnmount(() => {
    disable()
  })

  return {
    enable,
    disable,
    getCurrentScale: () => currentScale.value,
    forceUpdate: () => {
      if (dpiManager) {
        dpiManager.forceUpdate()
      } else {
        updateDPR()
        apply()
      }
    },
    isEnabled: computed(() => isEnabled.value),
    currentScale,
    devicePixelRatio
  }
}
