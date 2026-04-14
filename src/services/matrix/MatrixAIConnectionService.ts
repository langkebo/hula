/* eslint-disable @typescript-eslint/no-explicit-any */
import { matrixClientService } from './MatrixClientService'
import { BaseManager } from './BaseManager'
export interface AIConnection {
  id: string
  user_id: string
  provider: string
  config: Record<string, unknown> | null
  is_active: boolean
  created_ts: number
  updated_ts: number | null
}

export interface CreateConnectionOptions {
  provider: string
  config?: Record<string, unknown>
}

export interface UpdateConnectionOptions {
  is_active?: boolean
  config?: Record<string, unknown>
}

export interface McpToolCallOptions {
  provider: string
  toolName: string
  arguments?: Record<string, unknown>
}

class MatrixAIConnectionService extends BaseManager {
  private aiConnectionManager: any = null
  private initialized = false

  initialize(): void {
    if (this.initialized) return

    const client = matrixClientService.getClient()
    if (!client) {
      return
    }

    try {
      this.aiConnectionManager = (client as any).getAIConnectionManager?.() ?? null
      if (this.aiConnectionManager) {
        this.initialized = true
      } else {
        this.initialized = true
      }
    } catch (_err) {}
  }

  async getConnections(): Promise<AIConnection[]> {
    if (this.aiConnectionManager) {
      try {
        return await this.aiConnectionManager.getConnections()
      } catch (_err) {
        return []
      }
    }
    return []
  }

  async createConnection(options: CreateConnectionOptions): Promise<AIConnection | null> {
    if (this.aiConnectionManager) {
      try {
        const connection = await this.aiConnectionManager.createConnection(options)
        return connection
      } catch (_err) {
        return null
      }
    }
    return null
  }

  async getConnection(connectionId: string): Promise<AIConnection | null> {
    if (this.aiConnectionManager) {
      try {
        return await this.aiConnectionManager.getConnection(connectionId)
      } catch (_err) {
        return null
      }
    }
    return null
  }

  async deleteConnection(connectionId: string): Promise<boolean> {
    if (this.aiConnectionManager) {
      try {
        await this.aiConnectionManager.deleteConnection(connectionId)
        return true
      } catch (_err) {
        return false
      }
    }
    return false
  }

  async listMcpTools(provider: string): Promise<unknown> {
    if (this.aiConnectionManager) {
      try {
        return await this.aiConnectionManager.listMcpTools(provider)
      } catch (_err) {
        return null
      }
    }
    return null
  }

  async callMcpTool(options: McpToolCallOptions): Promise<unknown> {
    if (this.aiConnectionManager) {
      try {
        const result = await this.aiConnectionManager.callMcpTool(options)
        return result
      } catch (_err) {
        return null
      }
    }
    return null
  }

  getCachedConnections(): AIConnection[] {
    if (this.aiConnectionManager) {
      return this.aiConnectionManager.getCachedConnections() ?? []
    }
    return []
  }

  getCachedConnection(connectionId: string): AIConnection | undefined {
    if (this.aiConnectionManager) {
      return this.aiConnectionManager.getCachedConnection(connectionId)
    }
    return undefined
  }

  clearCache(): void {
    if (this.aiConnectionManager) {
      this.aiConnectionManager.clearCache()
    }
  }
}

export const matrixAIConnectionService = new MatrixAIConnectionService()
export default matrixAIConnectionService
