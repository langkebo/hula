/**
 * OpenClaw AI 服务 - OpenAI 兼容 API
 *
 * Gateway API: POST /v1/chat/completions
 * 认证: Bearer Token
 */

import { ref, readonly } from 'vue'

// ============ 类型定义 ============

export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface OpenClawConfig {
  gatewayUrl: string
  token: string
}

export interface ChatCompletionRequest {
  model: string
  messages: { role: string; content: string }[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface StreamChunk {
  choices?: { delta: { content: string } }[]
  done?: boolean
  content: string
}

// ============ 常量 ============

const DEFAULT_GATEWAY_URL = 'http://127.0.0.1:18789'

// ============ 核心类 ============

class OpenClawClient {
  private config: OpenClawConfig = {
    gatewayUrl: DEFAULT_GATEWAY_URL,
    token: ''
  }

  private currentSessionKey: string | null = null

  /**
   * 配置客户端
   */
  configure(config: Partial<OpenClawConfig>) {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): OpenClawConfig {
    return { ...this.config }
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

  /**
   * 获取可用模型列表
   */
  async listModels(): Promise<string[]> {
    // OpenClaw 使用 model 字段指定 agent
    // 返回可用的 agent 列表
    return ['main', 'minimax/MiniMax-M2.5', 'minimax/MiniMax-M2.5-highspeed']
  }

  /**
   * 发送聊天完成请求 (流式)
   */
  async *sendChatCompletion(
    messages: { role: string; content: string }[],
    options?: {
      model?: string
      temperature?: number
      maxTokens?: number
    }
  ): AsyncGenerator<StreamChunk> {
    const requestBody: ChatCompletionRequest = {
      model: options?.model || 'main',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stream: true
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

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // 处理 SSE 格式
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
}

// ============ 导出单例 ============

export const openClawClient = new OpenClawClient()

// ============ Vue Composable ============

/**
 * Vue Composable: 使用 OpenClaw AI
 */
export function useOpenClaw() {
  // 响应式状态
  const isConnected = ref(false)
  const isLoading = ref(false)
  const availableModels = ref<string[]>([])
  const currentModel = ref<string>('main')
  const error = ref<string | null>(null)

  // 消息历史
  const messageHistory = ref<{ role: string; content: string }[]>([])

  /**
   * 连接到 OpenClaw Gateway
   */
  async function connect(config?: Partial<OpenClawConfig>) {
    if (config) {
      openClawClient.configure(config)
    }

    isLoading.value = true
    error.value = null

    try {
      isConnected.value = await openClawClient.ping()

      if (isConnected.value) {
        availableModels.value = await openClawClient.listModels()
        if (availableModels.value.length > 0) {
          currentModel.value = availableModels.value[0]
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '连接失败'
      isConnected.value = false
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 发送消息 (流式)
   */
  async function* sendMessage(content: string, onChunk?: (content: string) => void): AsyncGenerator<string> {
    if (!isConnected.value) {
      throw new Error('未连接到 OpenClaw Gateway')
    }

    // 添加用户消息
    messageHistory.value.push({ role: 'user', content })

    isLoading.value = true
    error.value = null

    let fullContent = ''

    try {
      for await (const chunk of openClawClient.sendChatCompletion(messageHistory.value, {
        model: currentModel.value,
        temperature: 0.7,
        maxTokens: 4096
      })) {
        if (chunk.content) {
          fullContent += chunk.content
          onChunk?.(fullContent)
          yield fullContent
        }
      }

      // 添加助手消息到历史
      messageHistory.value.push({ role: 'assistant', content: fullContent })
    } catch (e) {
      error.value = e instanceof Error ? e.message : '发送失败'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 发送消息 (简单版本)
   */
  async function sendMessageSimple(content: string): Promise<string> {
    let fullContent = ''

    for await (const chunk of sendMessage(content)) {
      fullContent = chunk
    }

    return fullContent
  }

  /**
   * 切换模型
   */
  function setModel(model: string) {
    if (availableModels.value.includes(model)) {
      currentModel.value = model
    }
  }

  /**
   * 清空历史
   */
  function clearHistory() {
    messageHistory.value = []
  }

  return {
    // 状态 (只读)
    isConnected: readonly(isConnected),
    isLoading: readonly(isLoading),
    availableModels: readonly(availableModels),
    currentModel: readonly(currentModel),
    error: readonly(error),
    messageHistory: readonly(messageHistory),

    // 方法
    connect,
    sendMessage,
    sendMessageSimple,
    setModel,
    clearHistory
  }
}
