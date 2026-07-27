/**
 * Matrix Rendezvous 服务
 *
 * 封装 SDK RendezvousManager，提供二维码登录会话管理功能（MSC3886）。
 * 对应后端: synapse-rust/src/web/routes/rendezvous.rs
 */

import { createLogger } from '@/utils/Logger'
import matrixClientService from '../MatrixClientService'

const logger = createLogger('MatrixRendezvousService')

export type RendezvousSessionIntent = 'login.start' | 'login.reciprocate'

export type RendezvousSessionTransport = 'http.v1' | 'http.v2'

export type RendezvousSessionStatus = 'created' | 'connected' | 'completed' | 'expired' | 'cancelled'

export interface RendezvousSession {
  session_id: string
  intent: RendezvousSessionIntent
  transport: RendezvousSessionTransport
  transport_data?: Record<string, unknown>
  status: RendezvousSessionStatus
  created_ts: number
  expires_at?: number
  user_id?: string
  device_id?: string
  key?: string
}

export interface CreateSessionResponse {
  url: string
  session_id: string
  key: string
}

export interface UpdateSessionResponse {
  session_id: string
  status: RendezvousSessionStatus
  login_finish?: {
    access_token: string
    device_id: string
    user_id: string
  }
}

export interface RendezvousMessage {
  type: string
  content: Record<string, unknown>
}

export interface SendMessageResponse {
  session_id: string
  message_id: string
  sent_ts: number
}

export interface GetMessagesResponse {
  messages: RendezvousMessage[]
}

type RendezvousManagerLike = {
  createSession(options: {
    intent: RendezvousSessionIntent
    transport: RendezvousSessionTransport
    transport_data?: Record<string, unknown>
    expires_in_ms?: number
  }): Promise<CreateSessionResponse>
  getSession(sessionId: string, sessionKey?: string): Promise<RendezvousSession | null>
  updateSession(sessionId: string, status: RendezvousSessionStatus, sessionKey?: string): Promise<UpdateSessionResponse>
  deleteSession(sessionId: string, sessionKey?: string): Promise<void>
  sendMessage(sessionId: string, message: RendezvousMessage, sessionKey?: string): Promise<SendMessageResponse>
  getMessages(sessionId: string, sessionKey?: string): Promise<GetMessagesResponse>
  connectToSession(sessionId: string, sessionKey?: string): Promise<UpdateSessionResponse>
  completeSession(
    sessionId: string,
    sessionKey?: string
  ): Promise<{ access_token: string; device_id: string; user_id: string } | null>
  pollForMessages(
    sessionId: string,
    options?: {
      interval?: number
      maxAttempts?: number
      onMessage?: (messages: RendezvousMessage[]) => void
      sessionKey?: string
    }
  ): Promise<RendezvousMessage[]>
}

class MatrixRendezvousService {
  private getRendezvousManager(): RendezvousManagerLike {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('Matrix client not initialized')
    }

    const clientWithMethods = client as unknown as Record<string, unknown>
    if (typeof clientWithMethods.getRendezvousManager === 'function') {
      return clientWithMethods.getRendezvousManager() as RendezvousManagerLike
    }

    throw new Error('RendezvousManager not available on Matrix client')
  }

  /**
   * 创建 Rendezvous 会话
   */
  async createSession(options: {
    intent: RendezvousSessionIntent
    transport: RendezvousSessionTransport
    transport_data?: Record<string, unknown>
    expires_in_ms?: number
  }): Promise<CreateSessionResponse> {
    try {
      const manager = this.getRendezvousManager()
      const response = await manager.createSession(options)
      logger.info(`[MatrixRendezvous] 会话创建成功: ${response.session_id}`)
      return response
    } catch (err) {
      logger.error(`[MatrixRendezvous] 创建会话失败: ${err}`)
      throw err
    }
  }

  /**
   * 获取 Rendezvous 会话详情
   */
  async getSession(sessionId: string, sessionKey?: string): Promise<RendezvousSession | null> {
    try {
      const manager = this.getRendezvousManager()
      const session = await manager.getSession(sessionId, sessionKey)
      logger.info(`[MatrixRendezvous] 获取会话: ${sessionId}`)
      return session
    } catch (err) {
      logger.error(`[MatrixRendezvous] 获取会话失败: ${sessionId}, ${err}`)
      throw err
    }
  }

  /**
   * 更新 Rendezvous 会话状态
   */
  async updateSession(
    sessionId: string,
    status: RendezvousSessionStatus,
    sessionKey?: string
  ): Promise<UpdateSessionResponse> {
    try {
      const manager = this.getRendezvousManager()
      const response = await manager.updateSession(sessionId, status, sessionKey)
      logger.info(`[MatrixRendezvous] 更新会话状态: ${sessionId} -> ${status}`)
      return response
    } catch (err) {
      logger.error(`[MatrixRendezvous] 更新会话失败: ${sessionId}, ${err}`)
      throw err
    }
  }

  /**
   * 删除 Rendezvous 会话
   */
  async deleteSession(sessionId: string, sessionKey?: string): Promise<void> {
    try {
      const manager = this.getRendezvousManager()
      await manager.deleteSession(sessionId, sessionKey)
      logger.info(`[MatrixRendezvous] 会话已删除: ${sessionId}`)
    } catch (err) {
      logger.error(`[MatrixRendezvous] 删除会话失败: ${sessionId}, ${err}`)
      throw err
    }
  }

  /**
   * 发送消息到 Rendezvous 会话
   */
  async sendMessage(sessionId: string, message: RendezvousMessage, sessionKey?: string): Promise<SendMessageResponse> {
    try {
      const manager = this.getRendezvousManager()
      const response = await manager.sendMessage(sessionId, message, sessionKey)
      logger.info(`[MatrixRendezvous] 消息已发送: ${sessionId}, messageId=${response.message_id}`)
      return response
    } catch (err) {
      logger.error(`[MatrixRendezvous] 发送消息失败: ${sessionId}, ${err}`)
      throw err
    }
  }

  /**
   * 获取 Rendezvous 会话的消息
   */
  async getMessages(sessionId: string, sessionKey?: string): Promise<GetMessagesResponse> {
    try {
      const manager = this.getRendezvousManager()
      const response = await manager.getMessages(sessionId, sessionKey)
      logger.info(`[MatrixRendezvous] 获取消息: ${sessionId}, count=${response.messages?.length ?? 0}`)
      return response
    } catch (err) {
      logger.error(`[MatrixRendezvous] 获取消息失败: ${sessionId}, ${err}`)
      throw err
    }
  }

  /**
   * 连接到现有会话（辅助方法）
   */
  async connectToSession(sessionId: string, sessionKey?: string): Promise<UpdateSessionResponse> {
    try {
      const manager = this.getRendezvousManager()
      const response = await manager.connectToSession(sessionId, sessionKey)
      logger.info(`[MatrixRendezvous] 已连接会话: ${sessionId}`)
      return response
    } catch (err) {
      logger.error(`[MatrixRendezvous] 连接会话失败: ${sessionId}, ${err}`)
      throw err
    }
  }

  /**
   * 完成会话并获取登录凭证（辅助方法）
   */
  async completeSession(
    sessionId: string,
    sessionKey?: string
  ): Promise<{ access_token: string; device_id: string; user_id: string } | null> {
    try {
      const manager = this.getRendezvousManager()
      const result = await manager.completeSession(sessionId, sessionKey)
      logger.info(`[MatrixRendezvous] 会话已完成: ${sessionId}`)
      return result
    } catch (err) {
      logger.error(`[MatrixRendezvous] 完成会话失败: ${sessionId}, ${err}`)
      throw err
    }
  }

  /**
   * 轮询获取消息直到会话完成
   */
  async pollForMessages(
    sessionId: string,
    options?: {
      interval?: number
      maxAttempts?: number
      onMessage?: (messages: RendezvousMessage[]) => void
      sessionKey?: string
    }
  ): Promise<RendezvousMessage[]> {
    try {
      const manager = this.getRendezvousManager()
      const messages = await manager.pollForMessages(sessionId, options)
      logger.info(`[MatrixRendezvous] 轮询完成: ${sessionId}, 消息数=${messages.length}`)
      return messages
    } catch (err) {
      logger.error(`[MatrixRendezvous] 轮询消息失败: ${sessionId}, ${err}`)
      throw err
    }
  }
}

export const matrixRendezvousService = new MatrixRendezvousService()
