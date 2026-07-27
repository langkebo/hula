import { useI18nGlobal } from '@/services/i18n'
import { createLogger } from '@/utils/Logger'
import { matrixClientService } from '../MatrixClientService'
import { authedRequestWithPath } from '../MatrixHttpClient'
import { MATRIX_PATHS } from '../paths'

const logger = createLogger('MatrixAIConnectionService')

export interface AIConnectionInfo {
  id: string
  name: string
  type: string
  status: string
  config?: Record<string, unknown>
}

interface AIConnectionsListResponse {
  connections: AIConnectionInfo[]
}

interface CreateAIConnectionRequest {
  name: string
  type: string
  config: Record<string, unknown>
}

interface CreateAIConnectionResponse {
  id: string
}

export interface McpTool {
  name: string
  description: string
  parameters: Record<string, unknown>
}

interface McpToolsResponse {
  tools: McpTool[]
}

interface CallMcpToolRequest {
  tool: string
  parameters: Record<string, unknown>
}

interface CallMcpToolResponse {
  result: Record<string, unknown>
}

class MatrixAIConnectionService {
  private ensureClient() {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error(useI18nGlobal().t('matrix_error.common.client_not_initialized'))
    }
    return client
  }

  async listConnections(): Promise<AIConnectionInfo[]> {
    const client = this.ensureClient()
    try {
      const response = await authedRequestWithPath<AIConnectionsListResponse>(
        client,
        'GET',
        MATRIX_PATHS.AI.CONNECTIONS
      )
      logger.info(`[AIConnection] 获取 AI 连接列表: ${response.connections?.length ?? 0} 个`)
      return response.connections ?? []
    } catch (err) {
      logger.error(`[AIConnection] 获取连接列表失败: ${err}`)
      throw err
    }
  }

  async createConnection(request: CreateAIConnectionRequest): Promise<string> {
    const client = this.ensureClient()
    try {
      const response = await authedRequestWithPath<CreateAIConnectionResponse>(
        client,
        'POST',
        MATRIX_PATHS.AI.CONNECTIONS,
        undefined,
        request
      )
      logger.info(`[AIConnection] 创建 AI 连接成功: ${response.id}`)
      return response.id
    } catch (err) {
      logger.error(`[AIConnection] 创建连接失败: ${err}`)
      throw err
    }
  }

  async getConnection(id: string): Promise<AIConnectionInfo> {
    const client = this.ensureClient()
    try {
      const response = await authedRequestWithPath<AIConnectionInfo>(
        client,
        'GET',
        MATRIX_PATHS.AI.CONNECTION_BY_ID(id)
      )
      logger.info(`[AIConnection] 获取 AI 连接: ${response.name ?? id}`)
      return response
    } catch (err) {
      logger.error(`[AIConnection] 获取连接详情失败: ${err}`)
      throw err
    }
  }

  async deleteConnection(id: string): Promise<void> {
    const client = this.ensureClient()
    try {
      await authedRequestWithPath<void>(client, 'DELETE', MATRIX_PATHS.AI.CONNECTION_BY_ID(id))
      logger.info(`[AIConnection] 删除 AI 连接成功: ${id}`)
    } catch (err) {
      logger.error(`[AIConnection] 删除连接失败: ${err}`)
      throw err
    }
  }

  async listMcpTools(): Promise<McpTool[]> {
    const client = this.ensureClient()
    try {
      const response = await authedRequestWithPath<McpToolsResponse>(client, 'GET', MATRIX_PATHS.AI.MCP_TOOLS)
      logger.info(`[AIConnection] 获取 MCP 工具列表: ${response.tools?.length ?? 0} 个`)
      return response.tools ?? []
    } catch (err) {
      logger.error(`[AIConnection] 获取 MCP 工具列表失败: ${err}`)
      throw err
    }
  }

  async callMcpTool(request: CallMcpToolRequest): Promise<Record<string, unknown>> {
    const client = this.ensureClient()
    try {
      const response = await authedRequestWithPath<CallMcpToolResponse>(
        client,
        'POST',
        MATRIX_PATHS.AI.MCP_TOOLS_CALL,
        undefined,
        request
      )
      logger.info(`[AIConnection] 调用 MCP 工具成功: ${request.tool}`)
      return response.result
    } catch (err) {
      logger.error(`[AIConnection] 调用 MCP 工具失败: ${err}`)
      throw err
    }
  }
}

export const matrixAIConnectionService = new MatrixAIConnectionService()
