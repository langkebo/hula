/**
 * DPI 管理模块
 *
 * 使用 Tauri 原生 API 监听系统 DPI 变化，解决多屏幕适配问题
 *
 * 功能:
 * - 监听窗口 DPI 变化（跨屏幕移动）
 * - 自动应用缩放以保持 UI 一致性
 * - 支持多显示器环境
 */

import { ref, computed, onMounted, onUnmounted, nextTick, type ComputedRef } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('DpiManager')

export interface DpiInfo {
  scaleFactor: number
  windowId: string
  timestamp: number
}

export interface UseDpiManagerOptions {
  autoApply?: boolean
  targetElement?: string | HTMLElement
  onScaleChange?: (scale: number, oldScale: number) => void
  minScale?: number
  maxScale?: number
}

export interface DpiManagerController {
  currentScale: ComputedRef<number>
  isMonitoring: ComputedRef<boolean>
  dpiHistory: ComputedRef<DpiInfo[]>
  startMonitoring: () => Promise<void>
  stopMonitoring: () => void
  applyScale: (scale: number) => void
  forceUpdate: () => void
}

const DEFAULT_MIN_SCALE = 0.1
const DEFAULT_MAX_SCALE = 3.0

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function resolveElement(target?: string | HTMLElement): HTMLElement | null {
  if (!target) {
    return document.getElementById('app') || document.body
  }
  if (typeof target === 'string') {
    const el = document.querySelector(target)
    return el as HTMLElement | null
  }
  return target
}

export function useDpiManager(options: UseDpiManagerOptions = {}): DpiManagerController {
  const {
    autoApply = true,
    targetElement = '#app',
    onScaleChange,
    minScale = DEFAULT_MIN_SCALE,
    maxScale = DEFAULT_MAX_SCALE
  } = options

  const currentScale = ref(1)
  const isMonitoring = ref(false)
  const dpiHistory = ref<DpiInfo[]>([])
  const lastError = ref<string | null>(null)

  let unlisten: (() => void) | null = null
  let targetEl: HTMLElement | null = null
  let originalZoom: string | null = null

  const applyScale = (scale: number) => {
    if (!autoApply || !targetEl) return

    const clampedScale = clamp(scale, minScale, maxScale)

    try {
      const elStyle = targetEl.style as CSSStyleDeclaration & { zoom?: string }
      elStyle.zoom = String(clampedScale)

      document.documentElement.style.setProperty('--app-scale', String(clampedScale))
      document.documentElement.style.setProperty('--device-pixel-ratio', String(1 / clampedScale))

      logger.debug(`Applied scale: ${clampedScale}`)
    } catch (error) {
      logger.error('Failed to apply scale:', error)
    }
  }

  const saveOriginalStyles = () => {
    if (!targetEl) return
    const elStyle = targetEl.style as CSSStyleDeclaration & { zoom?: string }
    originalZoom = elStyle.zoom || null
  }

  const restoreOriginalStyles = () => {
    if (!targetEl) return

    const elStyle = targetEl.style as CSSStyleDeclaration & { zoom?: string }
    if (originalZoom !== null) {
      elStyle.zoom = originalZoom
    } else {
      elStyle.zoom = ''
    }

    document.documentElement.style.removeProperty('--app-scale')
    document.documentElement.style.removeProperty('--device-pixel-ratio')
  }

  const startMonitoring = async () => {
    if (isMonitoring.value) {
      logger.warn('DPI monitoring already started')
      return
    }

    targetEl = resolveElement(targetElement)
    if (!targetEl) {
      logger.error('Target element not found:', targetElement)
      return
    }

    saveOriginalStyles()

    try {
      const window = getCurrentWindow()

      unlisten = await window.onScaleChanged(({ payload }) => {
        const oldScale = currentScale.value
        const newScale = payload.scaleFactor

        currentScale.value = newScale

        dpiHistory.value.push({
          scaleFactor: newScale,
          windowId: window.label,
          timestamp: Date.now()
        })

        if (dpiHistory.value.length > 100) {
          dpiHistory.value = dpiHistory.value.slice(-50)
        }

        if (Math.abs(oldScale - newScale) > 0.001) {
          nextTick(() => {
            applyScale(1 / newScale)
            onScaleChange?.(newScale, oldScale)
          })
          logger.info(`DPI changed: ${oldScale.toFixed(3)} -> ${newScale.toFixed(3)}`)
        }
      })

      const initialScale = await window.scaleFactor()
      currentScale.value = initialScale
      applyScale(1 / initialScale)

      isMonitoring.value = true
      lastError.value = null
      logger.info(`DPI monitoring started with initial scale: ${initialScale}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      lastError.value = errorMsg
      logger.error('Failed to start DPI monitoring:', errorMsg)

      if (autoApply) {
        const fallbackScale = 1 / (window.devicePixelRatio || 1)
        applyScale(fallbackScale)
        logger.warn(`Using fallback scale: ${fallbackScale}`)
      }
    }
  }

  const stopMonitoring = () => {
    if (unlisten) {
      unlisten()
      unlisten = null
    }

    restoreOriginalStyles()
    isMonitoring.value = false
    logger.info('DPI monitoring stopped')
  }

  const forceUpdate = () => {
    if (!isMonitoring.value) return
    applyScale(1 / currentScale.value)
  }

  onMounted(() => {
    startMonitoring()
  })

  onUnmounted(() => {
    stopMonitoring()
  })

  return {
    currentScale: computed(() => currentScale.value),
    isMonitoring: computed(() => isMonitoring.value),
    dpiHistory: computed(() => [...dpiHistory.value]),
    startMonitoring,
    stopMonitoring,
    applyScale,
    forceUpdate
  }
}

export type { DpiManagerController as DpiManager }
