import { computed, ref } from 'vue'
import { hasTauriRuntime } from '@/utils/AppHarness'

export type Platform = 'desktop' | 'mobile'

export interface PlatformInfo {
  isDesktop: boolean
  isMobile: boolean
  platform: Platform
  isTauri: boolean
  isWeb: boolean
}

const platformCache = ref<PlatformInfo | null>(null)

const PLATFORM_QUERY_KEY = 'platform'
const PLATFORM_STORAGE_KEY = 'hula:e2e:platform'

function readRequestedPlatform(): Platform | null {
  if (typeof window === 'undefined') return null

  const queryValue = new URLSearchParams(window.location.search).get(PLATFORM_QUERY_KEY)
  if (queryValue === 'desktop' || queryValue === 'mobile') {
    return queryValue
  }

  const storageValue = window.localStorage.getItem(PLATFORM_STORAGE_KEY)
  if (storageValue === 'desktop' || storageValue === 'mobile') {
    return storageValue
  }

  return null
}

function detectPlatform(): PlatformInfo {
  if (platformCache.value) {
    return platformCache.value
  }

  const requestedPlatform = readRequestedPlatform()
  const isTauri = hasTauriRuntime()
  const isMobileUserAgent = typeof window !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const platform: Platform = requestedPlatform ?? (isTauri ? 'desktop' : isMobileUserAgent ? 'mobile' : 'desktop')
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
