/**
 * OpenClaw AI 服务 - OpenAI 兼容 API
 *
 * Gateway API: POST /v1/chat/completions
 * 认证: Bearer Token
 *
 * 集成功能:
 * - Viking Router: 智能路由优化，节省 67%-93% tokens
 * - Function Calling: 工具调用支持
 * - TrendRadar: 新闻趋势工具
 */

import { ref, readonly, computed } from 'vue'
import { vikingRouter, type TaskAnalysis } from './VikingRouter'
import { functionCallingManager, type ToolCall, type ToolDefinition } from './FunctionCallingManager'

// ============ 类型定义 ============

export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface OpenClawConfig {
  gatewayUrl: string
  token: string
  autoConnect?: boolean
  reconnect?: boolean
  reconnectInterval?: number
  maxReconnectAttempts?: number
  heartbeatInterval?: number
}

/**
 * 连接状态枚举
 */
export enum ConnectionState {
  Disconnected = 'disconnected',
  Connecting = 'connecting',
  Connected = 'connected',
  Reconnecting = 'reconnecting',
  Error = 'error'
}

/**
 * 连接状态信息
 */
export interface ConnectionStateInfo {
  state: ConnectionState
  lastConnectedAt: number | null
  reconnectAttempts: number
  lastError: string | null
}

export interface ChatCompletionRequest {
  model: string
  messages: OpenClawMessage[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
  tools?: ToolDefinition[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
}

export interface StreamChunk {
  choices?: {
    delta: {
      content?: string
      tool_calls?: ToolCall[]
    }
    finish_reason?: string
  }[]
  done?: boolean
  content: string
  toolCalls?: ToolCall[]
}

export interface OpenClawExtendedConfig extends OpenClawConfig {
  enableVikingRouter?: boolean
  enableFunctionCalling?: boolean
}

// ============ 常量 ============

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:18789'
const DEFAULT_RECONNECT_INTERVAL = 3000 // 3秒
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5
const DEFAULT_HEARTBEAT_INTERVAL = 30000 // 30秒

// ============ 核心类 ============

class OpenClawClient {
  private config: OpenClawExtendedConfig = {
    gatewayUrl: DEFAULT_GATEWAY_URL,
    token: '',
    autoConnect: false,
    reconnect: true,
    reconnectInterval: DEFAULT_RECONNECT_INTERVAL,
    maxReconnectAttempts: DEFAULT_MAX_RECONNECT_ATTEMPTS,
    heartbeatInterval: DEFAULT_HEARTBEAT_INTERVAL,
    enableVikingRouter: true,
    enableFunctionCalling: true
  }

  private currentSessionKey: string | null = null

  private connectionState: ConnectionStateInfo = {
    state: ConnectionState.Disconnected,
    lastConnectedAt: null,
    reconnectAttempts: 0,
    lastError: null
  }

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  private onStateChangeCallback: ((state: ConnectionStateInfo) => void) | null = null

  private lastTaskAnalysis: TaskAnalysis | null = null

  configure(config: Partial<OpenClawExtendedConfig>) {
    this.config = { ...this.config, ...config }
    if (config.enableVikingRouter !== undefined) {
      vikingRouter.configure({ enabled: config.enableVikingRouter })
    }
  }

  getConfig(): OpenClawExtendedConfig {
    return { ...this.config }
  }

  getLastTaskAnalysis(): TaskAnalysis | null {
    return this.lastTaskAnalysis
  }

  /**
   * 检查 Gateway 连接状态
   */
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.gatewayUrl}/`, {
        method: 'GET'
      })
      return response.ok
    } catch {
      return false
    }
  }

  async listModels(): Promise<string[]> {
    return ['main', 'minimax/MiniMax-M2.5', 'minimax/MiniMax-M2.5-highspeed']
  }

  async *sendChatCompletion(
    messages: OpenClawMessage[],
    options?: {
      model?: string
      temperature?: number
      maxTokens?: number
      enableTools?: boolean
      onToolCall?: (toolCall: ToolCall) => void
    }
  ): AsyncGenerator<StreamChunk> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    let selectedModel = options?.model || 'main'

    if (this.config.enableVikingRouter && lastUserMessage) {
      this.lastTaskAnalysis = vikingRouter.analyzeTask(lastUserMessage.content)
      selectedModel = this.lastTaskAnalysis.recommendedModel
    }

    const requestBody: ChatCompletionRequest = {
      model: selectedModel,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stream: true
    }

    if (this.config.enableFunctionCalling && options?.enableTools !== false) {
      requestBody.tools = functionCallingManager.getToolDefinitions()
      requestBody.tool_choice = 'auto'
    }

    const response = await fetch(`${this.config.gatewayUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.token}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`请求失败: ${response.status} - ${error}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应流')
    }

    const decoder = new TextDecoder()
    let buffer = ''
    const pendingToolCalls: ToolCall[] = []

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
            if (pendingToolCalls.length > 0) {
              for (const toolCall of pendingToolCalls) {
                options?.onToolCall?.(toolCall)
                const result = await functionCallingManager.executeToolCall(toolCall)
                const toolMessage: OpenClawMessage = {
                  role: 'tool',
                  content: result.content,
                  tool_call_id: toolCall.id
                }
                yield* this.sendChatCompletion([...messages, toolMessage], {
                  ...options,
                  enableTools: false
                })
                return
              }
            }
            yield { done: true, content: '' }
            return
          }

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta
            const content = delta?.content || ''
            const toolCalls = delta?.tool_calls

            if (toolCalls) {
              for (const tc of toolCalls) {
                const existingCall = pendingToolCalls.find((c) => c.id === tc.id)
                if (existingCall) {
                  existingCall.function.arguments += tc.function?.arguments || ''
                } else {
                  pendingToolCalls.push({
                    id: tc.id,
                    type: 'function',
                    function: {
                      name: tc.function?.name || '',
                      arguments: tc.function?.arguments || ''
                    },
                    status: 'pending'
                  })
                }
              }
              yield { toolCalls: pendingToolCalls, content: '' }
            } else if (content) {
              yield { choices: [{ delta: { content } }], content }
            }
          } catch {
            // ignore
          }
        }
      }
    }
  }

  /**
   * 获取当前会话 Key
   */
  getCurrentSessionKey(): string | null {
    return this.currentSessionKey
  }

  /**
   * 设置当前会话 Key
   */
  setCurrentSessionKey(key: string | null) {
    this.currentSessionKey = key
  }

  /**
   * 获取连接状态
   */
  getConnectionState(): ConnectionStateInfo {
    return { ...this.connectionState }
  }

  /**
   * 设置连接状态变化回调
   */
  onStateChange(callback: (state: ConnectionStateInfo) => void) {
    this.onStateChangeCallback = callback
  }

  /**
   * 内部方法：更新连接状态
   */
  private setConnectionState(state: ConnectionState, error: string | null = null) {
    this.connectionState.state = state
    if (error) {
      this.connectionState.lastError = error
    }
    if (state === ConnectionState.Connected) {
      this.connectionState.lastConnectedAt = Date.now()
      this.connectionState.reconnectAttempts = 0
    }
    this.onStateChangeCallback?.(this.connectionState)
  }

  /**
   * 启动心跳检测
   */
  startHeartbeat() {
    this.stopHeartbeat()
    const interval = this.config.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL
    this.heartbeatTimer = setInterval(async () => {
      const isAlive = await this.ping()
      if (!isAlive && this.config.reconnect) {
        this.handleDisconnection()
      }
    }, interval)
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  /**
   * 处理断连并尝试重连
   */
  private handleDisconnection() {
    this.stopHeartbeat()
    this.setConnectionState(ConnectionState.Disconnected)

    if (!this.config.reconnect) {
      return
    }

    const maxAttempts = this.config.maxReconnectAttempts || DEFAULT_MAX_RECONNECT_ATTEMPTS
    const interval = this.config.reconnectInterval || DEFAULT_RECONNECT_INTERVAL

    if (this.connectionState.reconnectAttempts >= maxAttempts) {
      this.setConnectionState(ConnectionState.Error, `最大重连次数已达成 (${maxAttempts}次)`)
      return
    }

    this.setConnectionState(ConnectionState.Reconnecting)
    this.connectionState.reconnectAttempts++

    this.reconnectTimer = setTimeout(async () => {
      const success = await this.ping()
      if (success) {
        this.setConnectionState(ConnectionState.Connected)
        this.startHeartbeat()
      } else {
        this.handleDisconnection()
      }
    }, interval)
  }

  /**
   * 主动断开连接
   */
  disconnect() {
    this.stopHeartbeat()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.setConnectionState(ConnectionState.Disconnected)
  }

  /**
   * 强制重连
   */
  async reconnect(): Promise<boolean> {
    this.connectionState.reconnectAttempts = 0
    const success = await this.ping()
    if (success) {
      this.setConnectionState(ConnectionState.Connected)
      this.startHeartbeat()
    } else {
      this.handleDisconnection()
    }
    return success
  }
}

// ============ 导出单例 ============

export const openClawClient = new OpenClawClient()

// ============ Vue Composable ============

export function useOpenClaw() {
  const isConnected = ref(false)
  const isLoading = ref(false)
  const availableModels = ref<string[]>([])
  const currentModel = ref<string>('main')
  const error = ref<string | null>(null)
  const connectionState = ref<ConnectionStateInfo>({
    state: ConnectionState.Disconnected,
    lastConnectedAt: null,
    reconnectAttempts: 0,
    lastError: null
  })

  const messageHistory = ref<OpenClawMessage[]>([])
  const lastTaskAnalysis = ref<TaskAnalysis | null>(null)
  const pendingToolCalls = ref<ToolCall[]>([])

  openClawClient.onStateChange((state) => {
    connectionState.value = { ...state }
    isConnected.value = state.state === ConnectionState.Connected
    if (state.lastError) {
      error.value = state.lastError
    }
  })

  async function connect(config?: Partial<OpenClawExtendedConfig>) {
    if (config) {
      openClawClient.configure(config)
    }

    isLoading.value = true
    error.value = null
    connectionState.value.state = ConnectionState.Connecting

    try {
      const success = await openClawClient.ping()
      isConnected.value = success
      connectionState.value.state = success ? ConnectionState.Connected : ConnectionState.Disconnected

      if (success) {
        availableModels.value = await openClawClient.listModels()
        if (availableModels.value.length > 0) {
          currentModel.value = availableModels.value[0]
        }
        openClawClient.startHeartbeat()
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '连接失败'
      isConnected.value = false
      connectionState.value.state = ConnectionState.Error
      connectionState.value.lastError = error.value
    } finally {
      isLoading.value = false
    }
  }

  function disconnect() {
    openClawClient.disconnect()
  }

  async function reconnect(): Promise<boolean> {
    return await openClawClient.reconnect()
  }

  async function* sendMessage(
    content: string,
    onChunk?: (content: string) => void,
    onToolCall?: (toolCall: ToolCall) => void
  ): AsyncGenerator<string> {
    if (!isConnected.value) {
      throw new Error('未连接到 OpenClaw Gateway')
    }

    messageHistory.value.push({ role: 'user', content })

    isLoading.value = true
    error.value = null
    pendingToolCalls.value = []

    let fullContent = ''

    try {
      for await (const chunk of openClawClient.sendChatCompletion(messageHistory.value, {
        model: currentModel.value,
        temperature: 0.7,
        maxTokens: 4096,
        onToolCall: (tc) => {
          pendingToolCalls.value.push(tc)
          onToolCall?.(tc)
        }
      })) {
        if (chunk.toolCalls && chunk.toolCalls.length > 0) {
          pendingToolCalls.value = [...chunk.toolCalls]
        }
        if (chunk.content) {
          fullContent = chunk.content
          onChunk?.(fullContent)
          yield fullContent
        }
      }

      lastTaskAnalysis.value = openClawClient.getLastTaskAnalysis()
      messageHistory.value.push({ role: 'assistant', content: fullContent })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '发送失败'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function sendMessageSimple(content: string): Promise<string> {
    let fullContent = ''

    for await (const chunk of sendMessage(content)) {
      fullContent = chunk
    }

    return fullContent
  }

  function setModel(model: string) {
    if (availableModels.value.includes(model)) {
      currentModel.value = model
    }
  }

  function clearHistory() {
    messageHistory.value = []
    lastTaskAnalysis.value = null
    pendingToolCalls.value = []
  }

  const vikingStats = computed(() => vikingRouter.getStats())
  const vikingSavings = computed(() => vikingRouter.estimateSavings())

  return {
    isConnected: readonly(isConnected),
    isLoading: readonly(isLoading),
    availableModels: readonly(availableModels),
    currentModel: readonly(currentModel),
    error: readonly(error),
    messageHistory: readonly(messageHistory),
    connectionState: readonly(connectionState),
    lastTaskAnalysis: readonly(lastTaskAnalysis),
    pendingToolCalls: readonly(pendingToolCalls),
    vikingStats,
    vikingSavings,

    connect,
    disconnect,
    reconnect,
    sendMessage,
    sendMessageSimple,
    setModel,
    clearHistory
  }
}
