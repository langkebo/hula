import { error, info } from '@tauri-apps/plugin-log'
import { configService } from '@/services/ConfigService'

/**
 * Built-in fallback configuration used when the server-side ICE config is
 * unavailable. Module-private so callers never see stale defaults after a
 * refresh.
 */
const DEFAULT_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:117.72.67.248:3478' },
    {
      urls: ['turn:117.72.67.248:3478?transport=udp', 'turn:117.72.67.248:3478?transport=tcp'],
      username: 'chr',
      credential: '123456'
    }
  ],
  iceTransportPolicy: 'all'
}

let currentConfiguration: RTCConfiguration = DEFAULT_CONFIGURATION

/**
 * Parse a raw iceServer entry from the backend config into a validated
 * `RTCIceServer`. Returns null when `urls` is missing or empty.
 */
export function parseIceServerEntry(raw: unknown): RTCIceServer | null {
  if (!raw || typeof raw !== 'object') return null
  const server = raw as Record<string, unknown>
  if (!Array.isArray(server.urls) || server.urls.length === 0) return null
  const urls = server.urls as string[]
  if (server.username && server.credential) {
    return {
      urls,
      username: server.username as string,
      credential: server.credential as string
    }
  }
  return { urls }
}

/**
 * Returns the ICE configuration currently in use. Never returns null —
 * falls back to the built-in default until `loadIceServers()` replaces it.
 */
export function getIceConfiguration(): RTCConfiguration {
  return currentConfiguration
}

/**
 * Replace the active ICE configuration. Exposed primarily for tests; prefer
 * `loadIceServers()` in production so the source of truth stays the backend
 * config.
 */
export function setIceConfiguration(next: RTCConfiguration): void {
  currentConfiguration = next
}

/**
 * Reset back to the built-in default. Primarily for tests.
 */
export function resetIceConfiguration(): void {
  currentConfiguration = DEFAULT_CONFIGURATION
}

/**
 * Fetch ICE configuration from the backend `initConfig` and swap it in.
 * Swallows errors so call setup never blocks on config fetch — callers
 * just fall back to whatever was current.
 */
export async function loadIceServers(): Promise<void> {
  try {
    const init = (await configService.initConfig()) as Record<string, unknown>
    const iceServer = init?.iceServer
    const entry = parseIceServerEntry(iceServer)
    if (entry) {
      currentConfiguration = { iceServers: [entry], iceTransportPolicy: 'all' }
      info(`ICE 配置已加载: ${JSON.stringify(currentConfiguration)}`)
    } else {
      info('ICE 配置为空，使用内置默认配置')
    }
  } catch (e) {
    error(`加载 ICE 配置失败: ${String(e)}`)
  }
}
