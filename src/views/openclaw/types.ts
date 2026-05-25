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
