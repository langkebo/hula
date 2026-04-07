import { ref, computed, shallowReadonly } from 'vue'
import type { AIProviderType, AIProvider, AIChatRequest, AIChatResponse, AIChatChunk } from './ai-provider'
import { openClawClient } from './openclaw/OpenClawService'
import { trendRadarClient } from './trendradar/TrendRadarService'

export type { AIProviderType }

class AIProviderManager {
  private _connectionState = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  private _currentProviderType = ref<AIProviderType>('openclaw')
  private _lastError = ref<string | null>(null)
  private _initialized = ref(false)

  private providers: Partial<Record<AIProviderType, AIProvider>> = {}

  get state() {
    return shallowReadonly(this._connectionState)
  }

  get currentProvider() {
    return shallowReadonly(this._currentProviderType)
  }

  get lastErrorMessage() {
    return shallowReadonly(this._lastError)
  }

  get initialized() {
    return shallowReadonly(this._initialized)
  }

  get currentProviderName() {
    return computed(() => {
      switch (this._currentProviderType.value) {
        case 'openclaw':
          return 'OpenClaw'
        case 'trendradar':
          return 'TrendRadar'
        case 'hula':
          return 'HuLa 后端'
      }
    })
  }

  private getActiveProvider(): AIProvider | undefined {
    return this.providers[this._currentProviderType.value]
  }

  async initialize(): Promise<void> {
    if (this._initialized.value) {
      return
    }

    // Initialize available providers
    this.providers['openclaw'] = openClawClient as unknown as AIProvider
    this.providers['trendradar'] = trendRadarClient as unknown as AIProvider

    // Default to OpenClaw
    this._currentProviderType.value = 'openclaw'

    this._initialized.value = true
  }

  async setProvider(type: AIProviderType): Promise<void> {
    if (this._currentProviderType.value === type) return

    // Disconnect current provider if connected
    const current = this.getActiveProvider()
    if (current && current.state === 'connected') {
      current.disconnect()
    }

    this._currentProviderType.value = type
    this._connectionState.value = 'disconnected'

    // Automatically connect to the new provider
    await this.connect()
  }

  getProviderType(): AIProviderType {
    return this._currentProviderType.value
  }

  async connect(): Promise<void> {
    this._connectionState.value = 'connecting'
    this._lastError.value = null

    try {
      const provider = this.getActiveProvider()
      if (!provider) {
        throw new Error(`Provider ${this._currentProviderType.value} is not implemented yet`)
      }

      await provider.connect()
      this._connectionState.value = 'connected'
    } catch (err) {
      this._connectionState.value = 'error'
      this._lastError.value = err instanceof Error ? err.message : String(err)
      throw err
    }
  }

  disconnect(): void {
    const provider = this.getActiveProvider()
    if (provider) {
      provider.disconnect()
    }
    this._connectionState.value = 'disconnected'
  }

  async testConnection(type?: AIProviderType): Promise<boolean> {
    const targetType = type || this._currentProviderType.value
    const provider = this.providers[targetType]
    if (!provider) return false

    return provider.testConnection()
  }

  async chat(request: AIChatRequest): Promise<AIChatResponse> {
    const provider = this.getActiveProvider()
    if (!provider) {
      throw new Error(`Provider ${this._currentProviderType.value} is not available`)
    }
    return provider.chat(request)
  }

  async *streamChat(request: AIChatRequest): AsyncGenerator<AIChatChunk> {
    const provider = this.getActiveProvider()
    if (!provider) {
      throw new Error(`Provider ${this._currentProviderType.value} is not available`)
    }
    yield* provider.streamChat(request)
  }

  getAvailableProviders(): AIProviderType[] {
    return ['openclaw', 'trendradar', 'hula']
  }

  isProviderAvailable(type: AIProviderType): boolean {
    return !!this.providers[type]
  }
}

export const aiProviderManager = new AIProviderManager()

export function useAIProvider() {
  return {
    manager: aiProviderManager,
    state: aiProviderManager.state,
    currentProvider: aiProviderManager.currentProvider,
    currentProviderName: aiProviderManager.currentProviderName,
    lastError: aiProviderManager.lastErrorMessage,
    initialized: aiProviderManager.initialized,
    connect: () => aiProviderManager.connect(),
    disconnect: () => aiProviderManager.disconnect(),
    setProvider: (type: AIProviderType) => aiProviderManager.setProvider(type),
    testConnection: (type?: AIProviderType) => aiProviderManager.testConnection(type),
    getAvailableProviders: () => aiProviderManager.getAvailableProviders(),
    isProviderAvailable: (type: AIProviderType) => aiProviderManager.isProviderAvailable(type),
    chat: (request: AIChatRequest) => aiProviderManager.chat(request),
    streamChat: (request: AIChatRequest) => aiProviderManager.streamChat(request)
  }
}
