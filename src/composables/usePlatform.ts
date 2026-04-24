import { computed, ref } from 'vue'

export type Platform = 'desktop' | 'mobile'

export interface PlatformInfo {
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

  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window
  const isDesktop = isTauri
  const isMobile =
    !isDesktop && typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

  const info: PlatformInfo = {
    isDesktop,
    isMobile,
    platform: isDesktop ? 'desktop' : 'mobile',
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

export function usePlatformAsync(): {
  platform: PlatformInfo
  isReady: boolean
} {
  const isReady = ref(false)
  const platform = detectPlatform()

  if (typeof window !== 'undefined') {
    isReady.value = true
  }

  return {
    platform,
    isReady: isReady.value
  }
}

export function getPlatform(): Platform {
  return detectPlatform().platform
}

export function isDesktop(): boolean {
  return detectPlatform().isDesktop
}

export function isMobile(): boolean {
  return detectPlatform().isMobile
}
