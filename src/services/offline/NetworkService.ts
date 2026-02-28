import { ref, computed } from 'vue'
import { info, error } from '@tauri-apps/plugin-log'

export type ConnectionStatus = 'online' | 'offline' | 'reconnecting'

export interface NetworkState {
  status: ConnectionStatus
  lastOnline: number | null
  lastOffline: number | null
  retryCount: number
  latency: number
}

class NetworkService {
  private state = ref<NetworkState>({
    status: 'online',
    lastOnline: null,
    lastOffline: null,
    retryCount: 0,
    latency: 0
  })

  private listeners: Set<(state: NetworkState) => void> = new Set()
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null

  get status() {
    return computed(() => this.state.value.status)
  }

  get isOnline() {
    return computed(() => this.state.value.status === 'online')
  }

  get isOffline() {
    return computed(() => this.state.value.status === 'offline')
  }

  get latency() {
    return computed(() => this.state.value.latency)
  }

  initialize(): void {
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)

    this.startHeartbeat()
    info('[NetworkService] 初始化完成')
  }

  private handleOnline = (): void => {
    this.state.value.status = 'online'
    this.state.value.lastOnline = Date.now()
    this.state.value.retryCount = 0
    this.notifyListeners()
    info('[NetworkService] 网络已连接')
  }

  private handleOffline = (): void => {
    this.state.value.status = 'offline'
    this.state.value.lastOffline = Date.now()
    this.notifyListeners()
    error('[NetworkService] 网络已断开')
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(async () => {
      if (this.state.value.status === 'offline') return

      try {
        const start = Date.now()
        const response = await fetch('/_matrix/client/versions', {
          method: 'GET',
          cache: 'no-cache'
        })

        if (response.ok) {
          this.state.value.latency = Date.now() - start

          if (this.state.value.status === 'reconnecting') {
            this.handleOnline()
          }
        } else {
          throw new Error('Heartbeat failed')
        }
      } catch (_err) {
        if (this.state.value.status === 'online') {
          this.startReconnect()
        }
      }
    }, 30000)
  }

  private startReconnect(): void {
    this.state.value.status = 'reconnecting'
    this.state.value.retryCount++
    this.notifyListeners()

    const delay = Math.min(1000 * 2 ** this.state.value.retryCount, 30000)

    this.reconnectTimeout = setTimeout(async () => {
      try {
        const response = await fetch('/_matrix/client/versions')
        if (response.ok) {
          this.handleOnline()
        } else {
          throw new Error('Reconnect failed')
        }
      } catch (_err) {
        this.startReconnect()
      }
    }, delay)
  }

  subscribe(callback: (state: NetworkState) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners(): void {
    this.listeners.forEach((callback) => callback(this.state.value))
  }

  cleanup(): void {
    window.removeEventListener('online', this.handleOnline)
    window.removeEventListener('offline', this.handleOffline)

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    this.listeners.clear()
    info('[NetworkService] 已清理')
  }
}

export const networkService = new NetworkService()
export default networkService
