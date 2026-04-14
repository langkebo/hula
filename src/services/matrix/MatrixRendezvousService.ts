import { BaseManager } from './BaseManager'
export interface RendezvousSession {
  sessionId: string
  intent: string
  transport: string
  status: string
  createdTs: number
  expiresAt?: number
  userId?: string
  deviceId?: string
}

class MatrixRendezvousService extends BaseManager {
  private client: any = null
  private rendezvousManager: any = null

  initialize(client: any): void {
    this.client = client
    this.rendezvousManager = client?.getRendezvousManager?.() ?? null
  }

  private getManager() {
    if (!this.client) throw new Error('客户端未初始化')
    if (!this.rendezvousManager) throw new Error('RendezvousManager 不可用')
    return this.rendezvousManager
  }

  async createSession(
    intent: string = 'login.start',
    transport: string = 'http.v1'
  ): Promise<RendezvousSession | null> {
    const manager = this.getManager()
    const result = await manager.createSession({ intent, transport })
    return {
      sessionId: result?.session_id ?? result?.sessionId ?? '',
      intent: result?.intent ?? intent,
      transport: result?.transport ?? transport,
      status: result?.status ?? 'created',
      createdTs: result?.created_ts ?? Date.now(),
      expiresAt: result?.expires_at,
      userId: result?.user_id,
      deviceId: result?.device_id
    }
  }

  async getSession(sessionId: string): Promise<RendezvousSession | null> {
    try {
      const manager = this.getManager()
      const result = await manager.getSession(sessionId)
      if (!result) return null
      return {
        sessionId: result?.session_id ?? result?.sessionId ?? sessionId,
        intent: result?.intent ?? '',
        transport: result?.transport ?? '',
        status: result?.status ?? 'unknown',
        createdTs: result?.created_ts ?? 0,
        expiresAt: result?.expires_at,
        userId: result?.user_id,
        deviceId: result?.device_id
      }
    } catch (_err) {
      return null
    }
  }

  async updateSession(sessionId: string, data: Record<string, unknown>): Promise<void> {
    const manager = this.getManager()
    await manager.updateSession(sessionId, data)
  }

  async deleteSession(sessionId: string): Promise<void> {
    const manager = this.getManager()
    await manager.deleteSession(sessionId)
  }

  async sendMessage(sessionId: string, message: Record<string, unknown>): Promise<string | null> {
    const manager = this.getManager()
    const result = await manager.sendMessage(sessionId, message)
    return result?.message_id ?? result?.messageId ?? null
  }

  async getMessages(sessionId: string): Promise<unknown[]> {
    try {
      const manager = this.getManager()
      const result = await manager.getMessages(sessionId)
      return result?.messages ?? []
    } catch (_err) {
      return []
    }
  }
}

export const matrixRendezvousService = new MatrixRendezvousService()
export default matrixRendezvousService
