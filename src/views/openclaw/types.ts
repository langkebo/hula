export interface OpenClawWorkbenchMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  reasoningContent?: string
  createdAt: number
  model?: string
  status?: 'done' | 'streaming' | 'error'
  errorMessage?: string
}

export interface OpenClawConversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: OpenClawWorkbenchMessage[]
}

export interface OpenClawConfig {
  gatewayUrl: string
  token: string
  autoConnect: boolean
  reconnect: boolean
  reconnectInterval: number
  maxReconnectAttempts: number
  heartbeatInterval: number
  temperature: number
  maxTokens: number
  topP: number
  presencePenalty: number
  frequencyPenalty: number
  systemPrompt: string
}

export interface OpenClawPresetOption {
  label: string
  value: number
}

export interface OpenClawPresetState {
  label: string
  desc: string
}
