import { type ClientOptions, fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RuntimeFetch')
const RELAXED_TLS_HOST_SUFFIXES = ['.test', '.localhost', '.local']

function withOmittedCredentials(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: init?.credentials ?? 'omit'
  }
}

function resolveRequestUrl(input: URL | RequestInfo): string {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
}

function shouldAllowInvalidCerts(input: URL | RequestInfo): boolean {
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'test')) {
    return false
  }

  try {
    const url = new URL(resolveRequestUrl(input))
    if (url.protocol !== 'https:') {
      return false
    }

    return RELAXED_TLS_HOST_SUFFIXES.some((suffix) => url.hostname === suffix.slice(1) || url.hostname.endsWith(suffix))
  } catch {
    return false
  }
}

function withTauriClientOptions(input: URL | RequestInfo, init?: RequestInit): RequestInit & ClientOptions {
  const requestInit: RequestInit & ClientOptions = withOmittedCredentials(init)

  if (shouldAllowInvalidCerts(input)) {
    requestInit.danger = {
      ...requestInit.danger,
      acceptInvalidCerts: true,
      acceptInvalidHostnames: true
    }
  }

  return requestInit
}

function shouldUseBrowserFallback(input: URL | RequestInfo): boolean {
  const url = resolveRequestUrl(input)
  return /^https?:\/\//i.test(url) && typeof globalThis.fetch === 'function'
}

function createTauriFetchWithBrowserFallback(): typeof globalThis.fetch {
  return (async (input: URL | RequestInfo, init?: RequestInit) => {
    const normalizedInit = withTauriClientOptions(input, init)

    try {
      return await nativeFetch(input as URL | Request | string, normalizedInit)
    } catch (error) {
      if (!shouldUseBrowserFallback(input)) {
        throw error
      }

      logger.warn('Tauri native fetch failed, falling back to browser fetch', error)
      return await globalThis.fetch(input, withOmittedCredentials(init))
    }
  }) as typeof globalThis.fetch
}

export function getRuntimeAwareFetch(): typeof globalThis.fetch {
  if (hasTauriRuntime()) {
    return createTauriFetchWithBrowserFallback()
  }

  return ((input: URL | RequestInfo, init?: RequestInit) =>
    globalThis.fetch(input, withOmittedCredentials(init))) as typeof globalThis.fetch
}

export function getRuntimeAwareFetchFn(): typeof globalThis.fetch | undefined {
  if (!hasTauriRuntime()) {
    return undefined
  }

  return getRuntimeAwareFetch()
}
