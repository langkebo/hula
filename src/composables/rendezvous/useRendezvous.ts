import { type Ref, ref } from 'vue'
import {
  type CreateSessionResponse,
  type GetMessagesResponse,
  matrixRendezvousService,
  type RendezvousMessage,
  type RendezvousSession,
  type RendezvousSessionIntent,
  type RendezvousSessionStatus,
  type RendezvousSessionTransport,
  type SendMessageResponse,
  type UpdateSessionResponse
} from '@/services/matrix/rendezvous/MatrixRendezvousService'

export type {
  CreateSessionResponse,
  GetMessagesResponse,
  RendezvousMessage,
  RendezvousSession,
  RendezvousSessionIntent,
  RendezvousSessionStatus,
  RendezvousSessionTransport,
  SendMessageResponse,
  UpdateSessionResponse
} from '@/services/matrix/rendezvous/MatrixRendezvousService'

export type SessionPhase = 'idle' | 'creating' | 'active' | 'completed' | 'failed'

export interface UseRendezvousResult {
  loading: Ref<boolean>
  error: Ref<string | null>
  currentSession: Ref<RendezvousSession | null>
  messages: Ref<RendezvousMessage[]>
  sessionStatus: Ref<SessionPhase>
  createSessionResponse: Ref<CreateSessionResponse | null>

  createSession: (options?: {
    intent?: RendezvousSessionIntent
    transport?: RendezvousSessionTransport
    transport_data?: Record<string, unknown>
    expires_in_ms?: number
  }) => Promise<CreateSessionResponse>
  getSession: (sessionId: string, sessionKey?: string) => Promise<RendezvousSession | null>
  updateSession: (
    sessionId: string,
    status: RendezvousSessionStatus,
    sessionKey?: string
  ) => Promise<UpdateSessionResponse>
  deleteSession: (sessionId: string, sessionKey?: string) => Promise<void>
  sendMessage: (sessionId: string, message: RendezvousMessage, sessionKey?: string) => Promise<SendMessageResponse>
  getMessages: (sessionId: string, sessionKey?: string) => Promise<GetMessagesResponse>
  completeSession: (
    sessionId: string,
    sessionKey?: string
  ) => Promise<{ access_token: string; device_id: string; user_id: string } | null>
  pollForMessages: (
    sessionId: string,
    options?: {
      interval?: number
      maxAttempts?: number
      onMessage?: (messages: RendezvousMessage[]) => void
      sessionKey?: string
    }
  ) => Promise<RendezvousMessage[]>
}

export function useRendezvous(): UseRendezvousResult {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentSession = ref<RendezvousSession | null>(null)
  const messages = ref<RendezvousMessage[]>([])
  const sessionStatus = ref<SessionPhase>('idle')
  const createSessionResponse = ref<CreateSessionResponse | null>(null)

  function clearError() {
    error.value = null
  }

  async function createSession(options?: {
    intent?: RendezvousSessionIntent
    transport?: RendezvousSessionTransport
    transport_data?: Record<string, unknown>
    expires_in_ms?: number
  }): Promise<CreateSessionResponse> {
    loading.value = true
    sessionStatus.value = 'creating'
    clearError()
    try {
      const response = await matrixRendezvousService.createSession({
        intent: options?.intent ?? 'login.start',
        transport: options?.transport ?? 'http.v1',
        transport_data: options?.transport_data,
        expires_in_ms: options?.expires_in_ms
      })
      createSessionResponse.value = response
      sessionStatus.value = 'active'
      return response
    } catch (err) {
      sessionStatus.value = 'failed'
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getSession(sessionId: string, sessionKey?: string): Promise<RendezvousSession | null> {
    loading.value = true
    clearError()
    try {
      const session = await matrixRendezvousService.getSession(sessionId, sessionKey)
      currentSession.value = session
      return session
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function updateSession(
    sessionId: string,
    status: RendezvousSessionStatus,
    sessionKey?: string
  ): Promise<UpdateSessionResponse> {
    loading.value = true
    clearError()
    try {
      const response = await matrixRendezvousService.updateSession(sessionId, status, sessionKey)
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function deleteSession(sessionId: string, sessionKey?: string): Promise<void> {
    loading.value = true
    clearError()
    try {
      await matrixRendezvousService.deleteSession(sessionId, sessionKey)
      currentSession.value = null
      createSessionResponse.value = null
      messages.value = []
      sessionStatus.value = 'idle'
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function sendMessage(
    sessionId: string,
    message: RendezvousMessage,
    sessionKey?: string
  ): Promise<SendMessageResponse> {
    loading.value = true
    clearError()
    try {
      const response = await matrixRendezvousService.sendMessage(sessionId, message, sessionKey)
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function getMessages(sessionId: string, sessionKey?: string): Promise<GetMessagesResponse> {
    loading.value = true
    clearError()
    try {
      const response = await matrixRendezvousService.getMessages(sessionId, sessionKey)
      if (response.messages) {
        messages.value = response.messages
      }
      return response
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function completeSession(
    sessionId: string,
    sessionKey?: string
  ): Promise<{ access_token: string; device_id: string; user_id: string } | null> {
    loading.value = true
    clearError()
    try {
      const result = await matrixRendezvousService.completeSession(sessionId, sessionKey)
      sessionStatus.value = 'completed'
      return result
    } catch (err) {
      sessionStatus.value = 'failed'
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  async function pollForMessages(
    sessionId: string,
    options?: {
      interval?: number
      maxAttempts?: number
      onMessage?: (messages: RendezvousMessage[]) => void
      sessionKey?: string
    }
  ): Promise<RendezvousMessage[]> {
    loading.value = true
    clearError()
    try {
      const result = await matrixRendezvousService.pollForMessages(sessionId, {
        ...options,
        onMessage: (msgs) => {
          if (msgs.length > 0) {
            messages.value = [...messages.value, ...msgs]
          }
          options?.onMessage?.(msgs)
        }
      })
      return result
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    currentSession,
    messages,
    sessionStatus,
    createSessionResponse,
    createSession,
    getSession,
    updateSession,
    deleteSession,
    sendMessage,
    getMessages,
    completeSession,
    pollForMessages
  }
}
