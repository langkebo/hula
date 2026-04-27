import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { hasTauriRuntime } from '@/utils/AppHarness'

function withOmittedCredentials(init?: RequestInit): RequestInit {
  return {
    ...init,
    credentials: init?.credentials ?? 'omit'
  }
}

export function getRuntimeAwareFetch(): typeof globalThis.fetch {
  if (hasTauriRuntime()) {
    return ((input: URL | RequestInfo, init?: RequestInit) =>
      nativeFetch(input as URL | Request | string, withOmittedCredentials(init))) as typeof globalThis.fetch
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
