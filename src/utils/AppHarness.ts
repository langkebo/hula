import { type as getOsType } from '@tauri-apps/plugin-os'
import { performanceReporter } from '@/utils/PerformanceReporter'

type AppPlatform = 'desktop' | 'mobile'
type RenderSampleStatus = 'pass' | 'warn'

interface RenderSampleRecord {
  name: string
  route: string
  startedAt: number
  completedAt: number
  duration: number
  thresholdMs: number
  status: RenderSampleStatus
  meta?: Record<string, string>
}

interface RenderSampleStartOptions {
  route?: string
  thresholdMs?: number
  meta?: Record<string, string>
}

interface RenderSampleCompleteOptions extends RenderSampleStartOptions {}

interface ActiveRenderSample {
  startedAt: number
  route: string
  thresholdMs: number
  meta?: Record<string, string>
}

const PLATFORM_QUERY_KEY = 'platform'
const E2E_QUERY_KEY = 'e2e'
const MOCK_AUTH_QUERY_KEY = 'mockAuth'
const PLATFORM_STORAGE_KEY = 'tjg:e2e:platform'
const E2E_STORAGE_KEY = 'tjg:e2e:enabled'
const MOCK_AUTH_STORAGE_KEY = 'tjg:e2e:mock-auth'
const DEFAULT_RENDER_THRESHOLD_MS = 800
const activeSamples = new Map<string, ActiveRenderSample>()

const isBrowser = () => typeof window !== 'undefined'

export const hasTauriRuntime = (): boolean => {
  if (!isBrowser()) return false
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

const readQueryFlag = (key: string): string | null => {
  if (!isBrowser()) return null
  return new URLSearchParams(window.location.search).get(key)
}

const readStorageFlag = (key: string): string | null => {
  if (!isBrowser()) return null
  return window.localStorage.getItem(key)
}

const isEnabledFlag = (value: string | null): boolean => {
  return value === '1' || value === 'true'
}

const getRequestedPlatform = (): AppPlatform | null => {
  const candidate = readQueryFlag(PLATFORM_QUERY_KEY) ?? readStorageFlag(PLATFORM_STORAGE_KEY)
  if (candidate === 'mobile' || candidate === 'desktop') {
    return candidate
  }
  return null
}

const resolveFallbackRoute = (explicitRoute?: string): string => {
  if (explicitRoute) return explicitRoute
  if (!isBrowser()) return 'unknown'
  return `${window.location.pathname}${window.location.search}`
}

const ensureRenderSampleStore = (): RenderSampleRecord[] | null => {
  if (!isBrowser()) return null
  window.__TJG_RENDER_SAMPLES__ ??= []
  return window.__TJG_RENDER_SAMPLES__
}

const toSampleStatus = (duration: number, thresholdMs: number): RenderSampleStatus => {
  return duration <= thresholdMs ? 'pass' : 'warn'
}

export const isE2EMode = (): boolean => {
  return isEnabledFlag(readQueryFlag(E2E_QUERY_KEY)) || isEnabledFlag(readStorageFlag(E2E_STORAGE_KEY))
}

export const shouldBypassAuthForE2E = (): boolean => {
  return (
    import.meta.env.DEV &&
    isE2EMode() &&
    (isEnabledFlag(readQueryFlag(MOCK_AUTH_QUERY_KEY)) || isEnabledFlag(readStorageFlag(MOCK_AUTH_STORAGE_KEY)))
  )
}

export const detectAppPlatform = (): AppPlatform => {
  const requestedPlatform = getRequestedPlatform()
  if (requestedPlatform) {
    return requestedPlatform
  }

  try {
    const osType = getOsType()
    if (osType === 'ios' || osType === 'android') {
      return 'mobile'
    }
  } catch {
    // Browser-only E2E runs can safely fall back to desktop.
  }

  return 'desktop'
}

export const startRenderSample = (name: string, options: RenderSampleStartOptions = {}): void => {
  if (typeof performance === 'undefined') return

  activeSamples.set(name, {
    startedAt: performance.now(),
    route: resolveFallbackRoute(options.route),
    thresholdMs: options.thresholdMs ?? DEFAULT_RENDER_THRESHOLD_MS,
    meta: options.meta
  })
}

const completeRenderSample = (name: string, options: RenderSampleCompleteOptions = {}): RenderSampleRecord | null => {
  if (typeof performance === 'undefined') return null

  const activeSample = activeSamples.get(name)
  if (!activeSample) return null

  activeSamples.delete(name)

  const completedAt = performance.now()
  const route = options.route ?? activeSample.route
  const thresholdMs = options.thresholdMs ?? activeSample.thresholdMs
  const meta = options.meta ?? activeSample.meta
  const duration = completedAt - activeSample.startedAt
  const sample: RenderSampleRecord = {
    name,
    route,
    startedAt: activeSample.startedAt,
    completedAt,
    duration,
    thresholdMs,
    status: toSampleStatus(duration, thresholdMs),
    meta
  }

  ensureRenderSampleStore()?.push(sample)
  performanceReporter.reportPageRender(name, duration, thresholdMs, route, meta)
  return sample
}

export const completeRenderSampleOnNextFrame = (name: string, options: RenderSampleCompleteOptions = {}): void => {
  if (!isBrowser()) {
    completeRenderSample(name, options)
    return
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      completeRenderSample(name, options)
    })
  })
}

const _resetRenderSamples = (): void => {
  activeSamples.clear()
  const samples = ensureRenderSampleStore()
  if (samples) {
    samples.length = 0
  }
}
