import { E2E_STORAGE_KEYS } from '@/utils/storageKeys'

type RuntimePlatform = 'desktop' | 'mobile'

export const PLATFORM_QUERY_KEY = 'platform'
export const PLATFORM_STORAGE_KEY = E2E_STORAGE_KEYS.platform

export function normalizeRequestedPlatform(value: string | null | undefined): RuntimePlatform | null {
  return value === 'mobile' || value === 'desktop' ? value : null
}

export function readRequestedPlatform(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage
): RuntimePlatform | null {
  const fromQuery = normalizeRequestedPlatform(new URLSearchParams(search).get(PLATFORM_QUERY_KEY))
  if (fromQuery) return fromQuery
  try {
    return normalizeRequestedPlatform(storage?.getItem(PLATFORM_STORAGE_KEY) ?? null)
  } catch {
    // 隐私模式等场景下访问 localStorage 会抛 SecurityError，平台覆盖视为未设置
    return null
  }
}

export function resolvePlatformType(osType: string): RuntimePlatform {
  return osType === 'android' || osType === 'ios' ? 'mobile' : 'desktop'
}

export function resolveTauriPlatform(envPlatform: string | undefined): RuntimePlatform | null {
  if (!envPlatform) return null
  return resolvePlatformType(envPlatform)
}
