import { type AsyncComponentLoader, type Component, type ComputedRef, computed, defineAsyncComponent, ref } from 'vue'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { isMobile } from '@/utils/PlatformConstants'
import { readRequestedPlatform, resolveTauriPlatform } from '@/utils/platformDetection'

type Platform = 'desktop' | 'mobile'

interface PlatformInfo {
  isDesktop: boolean
  isMobile: boolean
  platform: Platform
  isTauri: boolean
  isWeb: boolean
}

const platformCache = ref<PlatformInfo | null>(null)

function detectPlatform(): PlatformInfo {
  if (platformCache.value) {
    return platformCache.value
  }

  const requestedPlatform = readRequestedPlatform()
  const isTauri = hasTauriRuntime()
  const isMobileUserAgent = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const tauriPlatform = resolveTauriPlatform(import.meta.env.TAURI_ENV_PLATFORM)
  const platform: Platform =
    requestedPlatform ?? tauriPlatform ?? (isTauri ? 'desktop' : isMobileUserAgent ? 'mobile' : 'desktop')
  const isDesktop = platform === 'desktop'
  const isMobile = platform === 'mobile'

  const info: PlatformInfo = {
    isDesktop,
    isMobile,
    platform,
    isTauri,
    isWeb: !isTauri
  }

  platformCache.value = info
  return info
}

export function usePlatform(): PlatformInfo {
  const info = detectPlatform()

  return {
    isDesktop: computed(() => info.isDesktop).value,
    isMobile: computed(() => info.isMobile).value,
    platform: computed(() => info.platform).value,
    isTauri: computed(() => info.isTauri).value,
    isWeb: computed(() => info.isWeb).value
  }
}

export function isDesktop(): boolean {
  return detectPlatform().isDesktop
}

/**
 * 响应式移动端判定，用于收敛各组件内重复的 computed 包装移动端判定分支。
 */
export function useIsMobile(): ComputedRef<boolean> {
  return computed(() => isMobile())
}

/**
 * 仅在移动端加载指定异步组件；桌面端返回 undefined。
 * 用于收敛各组件内重复的移动端条件异步组件加载分支。
 */
export function mobileOnlyAsyncComponent<T extends Component>(loader: AsyncComponentLoader<T>): T | undefined {
  return isMobile() ? defineAsyncComponent(loader) : undefined
}
