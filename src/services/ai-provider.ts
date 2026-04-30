import type { ConnectionState } from './openclaw/OpenClawService'

export type AIProviderType = 'openclaw' | 'trendradar' | 'hula'

export interface AIProviderConfig {
  provider: AIProviderType
  enabled: boolean
}

export interface AIProviderStatus {
  provider: AIProviderType
  state: ConnectionState
  lastConnectedAt: number | null
  lastError: string | null
}

export interface AIChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  name?: string
  tool_calls?: AItoolCall[]
  tool_call_id?: string
}

export interface AItoolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface AIChatRequest {
  messages: AIChatMessage[]
  model?: string
  temperature?: number
  max_tokens?: number
  stream?: boolean
}

export interface AIChatResponse {
  id: string
  model: string
  message: AIChatMessage
  finish_reason: string
}

export interface AIChatChunk {
  id: string
  delta: string
  finish_reason: string | null
}

export interface AIProvider {
  readonly type: AIProviderType
  readonly state: ConnectionState

  initialize(): Promise<void>
  connect(): Promise<void>
  disconnect(): void
  testConnection(): Promise<boolean>

  chat(request: AIChatRequest): Promise<AIChatResponse>
  streamChat(request: AIChatRequest): AsyncGenerator<AIChatChunk>
}

export function isAIProvider(obj: unknown): obj is AIProvider {
  if (!obj || typeof obj !== 'object') return false
  const provider = obj as AIProvider
  return (
    'type' in provider &&
    'state' in provider &&
    'initialize' in provider &&
    'connect' in provider &&
    'disconnect' in provider &&
    'testConnection' in provider &&
    'chat' in provider &&
    'streamChat' in provider
  )
}

export function getAIProviderName(type: AIProviderType): string {
  switch (type) {
    case 'openclaw':
      return 'OpenClaw'
    case 'trendradar':
      return 'TrendRadar'
    case 'hula':
      return 'HuLa 后端'
  }
}

export function getAIProviderDescription(type: AIProviderType): string {
  switch (type) {
    case 'openclaw':
      return '连接本地 OpenClaw AI 服务，支持自定义模型'
    case 'trendradar':
      return '连接 TrendRadar MCP 服务，获取热点新闻和分析'
    case 'hula':
      return '使用 HuLa 后端 AI 服务'
  }
}
