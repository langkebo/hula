/**
 * SiliconFlow AI 服务 - OpenAI 兼容 API
 *
 * API 文档: https://cloud.siliconflow.cn/
 * API 端点: https://api.siliconflow.cn/v1/chat/completions
 * 认证: Bearer Token (API Key)
 */

import { ref } from 'vue'
import { HttpClient, HttpClientError } from '@/utils/HttpClient'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SiliconFlow')

// ============ 类型定义 ============

interface SiliconFlowMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface SiliconFlowConfig {
  apiKey: string
  baseUrl: string
  model: string
  temperature?: number
  maxTokens?: number
}

interface StreamChunk {
  choices?: { delta: { content: string } }[]
  done?: boolean
  content: string
}

interface ConnectionState {
  connected: boolean
  connecting: boolean
  error: string | null
  lastConnectedAt: number | null
}

interface ModelInfo {
  id: string
  name: string
  provider?: string
}

// ============ 常量 ============

const DEFAULT_BASE_URL = 'https://api.siliconflow.cn'
const DEFAULT_MODEL = 'deepseek-ai/DeepSeek-V3'

// SiliconFlow 支持的模型列表
const AVAILABLE_MODELS: ModelInfo[] = [
  { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3', provider: 'DeepSeek' },
  { id: 'deepseek-ai/DeepSeek-R1', name: 'DeepSeek R1', provider: 'DeepSeek' },
  { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', provider: 'Qwen' },
  { id: 'Qwen/Qwen2.5-14B-Instruct', name: 'Qwen 2.5 14B', provider: 'Qwen' },
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', provider: 'Qwen' },
  { id: 'Anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'Anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'OpenAI/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'OpenAI/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'Google/gemini-pro', name: 'Gemini Pro', provider: 'Google' },
  { id: 'Google/gemini-flash', name: 'Gemini Flash', provider: 'Google' },
  { id: 'mistral/mistral-7B-instruct', name: 'Mistral 7B', provider: 'Mistral' },
  { id: 'mistral/mixtral-8x7B-instruct', name: 'Mixtral 8x7B', provider: 'Mistral' },
  { id: 'meta-llama/Llama-3.1-8B-Instruct', name: 'Llama 3.1 8B', provider: 'Meta' },
  { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B', provider: 'Meta' }
]

// ============ 核心类 ============

class SiliconFlowClient {
  private config: SiliconFlowConfig = {
    apiKey: '',
    baseUrl: DEFAULT_BASE_URL,
    model: DEFAULT_MODEL,
    temperature: 0.7,
    maxTokens: 4096
  }

  private _connectionState = ref<ConnectionState>({
    connected: false,
    connecting: false,
    error: null,
    lastConnectedAt: null
  })

  private onStateChange: ((state: ConnectionState) => void) | null = null

  setOnStateChange(callback: (state: ConnectionState) => void) {
    this.onStateChange = callback
  }

  getConnectionState(): ConnectionState {
    return { ...this._connectionState.value }
  }

  private updateConnectionState(partial: Partial<ConnectionState>) {
    this._connectionState.value = {
      ...this._connectionState.value,
      ...partial
    }
    this.onStateChange?.(this._connectionState.value)
  }

  configure(config: Partial<SiliconFlowConfig>) {
    this.config = {
      ...this.config,
      ...config
    }
  }

  getConfig(): SiliconFlowConfig {
    return { ...this.config }
  }

  async ping(): Promise<boolean> {
    try {
      await HttpClient.get(`${this.config.baseUrl}/v1/models`, {
        timeoutMs: 5000,
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`
        }
      })

      this.updateConnectionState({
        connected: true,
        connecting: false,
        error: null,
        lastConnectedAt: Date.now()
      })
      return true
    } catch (error) {
      if (error instanceof HttpClientError && error.status === 401) {
        this.updateConnectionState({
          connected: false,
          error: 'API Key 无效'
        })
        return false
      }

      const errorMessage = error instanceof Error ? error.message : '连接失败'
      this.updateConnectionState({
        connected: false,
        error: errorMessage
      })
      logger.error('ping 失败:', errorMessage)
      return false
    }
  }

  getAvailableModels(): ModelInfo[] {
    return AVAILABLE_MODELS
  }

  async *sendChatCompletion(
    messages: { role: string; content: string }[],
    options?: {
      model?: string
      temperature?: number
      maxTokens?: number
    }
  ): AsyncGenerator<StreamChunk> {
    const requestBody = {
      model: options?.model || this.config.model,
      messages,
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 4096,
      stream: true
    }

    const response = await HttpClient.streamResponse(`${this.config.baseUrl}/v1/chat/completions`, requestBody, {
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`
      }
    })

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)

          if (data === '[DONE]') {
            yield { done: true, content: '' }
            return
          }

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content || ''

            if (content) {
              yield { choices: [{ delta: { content } }], content }
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }
  }

  /** 测试 SiliconFlow 服务连接
   */
  async testConnection(baseUrl: string, apiKey: string): Promise<boolean> {
    try {
      await HttpClient.get(`${baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      return true
    } catch (err) {
      logger.error('Connection test failed', err)
      return false
    }
  }

  async chatStream(
    model: string,
    messages: SiliconFlowMessage[],
    config: { baseUrl: string; apiKey: string; temperature?: number; maxTokens?: number }
  ): Promise<Response> {
    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true
    }
    if (config.temperature !== undefined) {
      body.temperature = config.temperature
    }
    if (config.maxTokens !== undefined) {
      body.max_tokens = config.maxTokens
    }
    return HttpClient.streamResponse(`${config.baseUrl}/v1/chat/completions`, body, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`
      }
    })
  }

  disconnect() {
    this.updateConnectionState({
      connected: false,
      connecting: false,
      error: '已断开连接'
    })
  }

  destroy() {
    this.updateConnectionState({
      connected: false,
      connecting: false,
      error: '客户端已销毁',
      lastConnectedAt: null
    })
  }
}

// ============ 导出单例 ============

const siliconFlowClient = new SiliconFlowClient()

export const siliconFlowService = siliconFlowClient

// ============ Vue Composable ============

export function useSiliconFlow() {
  const isConnected = ref(false)
  const isConnecting = ref(false)
  const isLoading = ref(false)
  const availableModels = ref<ModelInfo[]>([])
  const currentModel = ref<string>(DEFAULT_MODEL)
  const error = ref<string | null>(null)
  const lastConnectedAt = ref<number | null>(null)
  const messageHistory = ref<{ role: string; content: string }[]>([])

  siliconFlowClient.setOnStateChange((state) => {
    isConnected.value = state.connected
    isConnecting.value = state.connecting
    error.value = state.error
    lastConnectedAt.value = state.lastConnectedAt
  })

  async function connect(config?: Partial<SiliconFlowConfig>): Promise<boolean> {
    if (config) {
      siliconFlowClient.configure(config)
    }

    if (isConnecting.value) {
      return isConnected.value
    }

    isConnecting.value = true
    error.value = null

    try {
      const success = await siliconFlowClient.ping()

      if (success) {
        availableModels.value = siliconFlowClient.getAvailableModels()
        if (!currentModel.value && availableModels.value.length > 0) {
          currentModel.value = availableModels.value[0].id
        }
        return true
      }
      return false
    } catch (e) {
      error.value = e instanceof Error ? e.message : '连接失败'
      return false
    } finally {
      isConnecting.value = false
    }
  }

  function disconnect() {
    siliconFlowClient.disconnect()
  }

  async function testConnection(config?: Partial<SiliconFlowConfig>): Promise<{ success: boolean; error?: string }> {
    const originalConfig = siliconFlowClient.getConfig()

    try {
      if (config) {
        siliconFlowClient.configure(config)
      }

      const success = await siliconFlowClient.ping()
      return { success }
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : '未知错误' }
    } finally {
      siliconFlowClient.configure(originalConfig)
    }
  }

  async function* sendMessage(content: string, onChunk?: (content: string) => void): AsyncGenerator<string> {
    if (!isConnected.value) {
      throw new Error('未连接到 SiliconFlow')
    }

    messageHistory.value.push({ role: 'user', content })
    isLoading.value = true
    error.value = null

    let fullContent = ''

    try {
      for await (const chunk of siliconFlowClient.sendChatCompletion(messageHistory.value, {
        model: currentModel.value
      })) {
        if (chunk.content) {
          fullContent += chunk.content
          onChunk?.(fullContent)
          yield fullContent
        }
      }

      messageHistory.value.push({ role: 'assistant', content: fullContent })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '发送失败'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function setModel(modelId: string) {
    currentModel.value = modelId
  }

  function clearHistory() {
    messageHistory.value = []
  }

  function destroy() {
    siliconFlowClient.destroy()
  }

  return {
    isConnected: readonly(isConnected),
    isConnecting: readonly(isConnecting),
    isLoading: readonly(isLoading),
    availableModels: readonly(availableModels),
    currentModel: readonly(currentModel),
    error: readonly(error),
    lastConnectedAt: readonly(lastConnectedAt),
    messageHistory: readonly(messageHistory),
    connect,
    disconnect,
    testConnection,
    sendMessage,
    setModel,
    clearHistory,
    destroy
  }
}
