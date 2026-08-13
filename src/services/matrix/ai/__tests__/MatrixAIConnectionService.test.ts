import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetClient, mockAuthedRequestWithPath, mockInfo, mockError } = vi.hoisted(() => ({
  mockGetClient: vi.fn(),
  mockAuthedRequestWithPath: vi.fn(),
  mockInfo: vi.fn(),
  mockError: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: mockInfo, error: mockError })
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: { getClient: mockGetClient }
}))

vi.mock('../../MatrixHttpClient', () => ({
  authedRequestWithPath: mockAuthedRequestWithPath
}))

vi.mock('../../paths', () => ({
  MATRIX_PATHS: {
    AI: {
      CONNECTIONS: '/_matrix/client/v1/ai/connections',
      CONNECTION_BY_ID: (id: string) => `/_matrix/client/v1/ai/connections/${encodeURIComponent(id)}`,
      MCP_TOOLS: '/_matrix/client/v1/ai/mcp/tools',
      MCP_TOOLS_CALL: '/_matrix/client/v1/ai/mcp/tools/call'
    }
  }
}))

import { matrixAIConnectionService } from '../MatrixAIConnectionService'

const fakeClient = { id: 'client-1' }

describe('MatrixAIConnectionService', () => {
  beforeEach(() => {
    mockGetClient.mockReset()
    mockAuthedRequestWithPath.mockReset()
    mockInfo.mockReset()
    mockError.mockReset()
    mockGetClient.mockReturnValue(fakeClient)
  })

  describe('client 未初始化 (ensureClient 空值路径)', () => {
    it('listConnections 在 client 为 null 时抛出 i18n 错误', async () => {
      mockGetClient.mockReturnValue(null)
      await expect(matrixAIConnectionService.listConnections()).rejects.toThrow(
        'matrix_error.common.client_not_initialized'
      )
      expect(mockAuthedRequestWithPath).not.toHaveBeenCalled()
    })

    it('createConnection 在 client 为 null 时抛出 i18n 错误', async () => {
      mockGetClient.mockReturnValue(undefined)
      await expect(matrixAIConnectionService.createConnection({ name: 'n', type: 't', config: {} })).rejects.toThrow(
        'matrix_error.common.client_not_initialized'
      )
    })

    it('getConnection 在 client 为 null 时抛出 i18n 错误', async () => {
      mockGetClient.mockReturnValue(null)
      await expect(matrixAIConnectionService.getConnection('c1')).rejects.toThrow(
        'matrix_error.common.client_not_initialized'
      )
    })

    it('listMcpTools 在 client 为 null 时抛出 i18n 错误', async () => {
      mockGetClient.mockReturnValue(null)
      await expect(matrixAIConnectionService.listMcpTools()).rejects.toThrow(
        'matrix_error.common.client_not_initialized'
      )
    })
  })

  describe('listConnections', () => {
    it('正常返回 connections 数组', async () => {
      mockAuthedRequestWithPath.mockResolvedValueOnce({
        connections: [{ id: 'c1', name: 'A', type: 'openai', status: 'active' }]
      })
      const result = await matrixAIConnectionService.listConnections()
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('c1')
      expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(fakeClient, 'GET', '/_matrix/client/v1/ai/connections')
      expect(mockInfo).toHaveBeenCalled()
    })

    it('connections 缺失时回退为空数组', async () => {
      mockAuthedRequestWithPath.mockResolvedValueOnce({})
      const result = await matrixAIConnectionService.listConnections()
      expect(result).toEqual([])
    })

    it('请求失败时记录 error 并抛出原错误', async () => {
      const err = new Error('boom')
      mockAuthedRequestWithPath.mockRejectedValueOnce(err)
      await expect(matrixAIConnectionService.listConnections()).rejects.toThrow('boom')
      expect(mockError).toHaveBeenCalled()
    })
  })

  describe('createConnection', () => {
    it('POST 请求体并返回 id', async () => {
      mockAuthedRequestWithPath.mockResolvedValueOnce({ id: 'conn-9' })
      const request = { name: 'OpenAI', type: 'openai', config: { key: 'k' } }
      const id = await matrixAIConnectionService.createConnection(request)
      expect(id).toBe('conn-9')
      expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(
        fakeClient,
        'POST',
        '/_matrix/client/v1/ai/connections',
        undefined,
        request
      )
    })

    it('请求失败时抛出原错误', async () => {
      mockAuthedRequestWithPath.mockRejectedValueOnce(new Error('bad request'))
      await expect(matrixAIConnectionService.createConnection({ name: 'n', type: 't', config: {} })).rejects.toThrow(
        'bad request'
      )
    })
  })

  describe('getConnection', () => {
    it('GET 连接详情并返回结果', async () => {
      mockAuthedRequestWithPath.mockResolvedValueOnce({ id: 'c1', name: 'A', type: 't', status: 'active' })
      const result = await matrixAIConnectionService.getConnection('c1')
      expect(result.id).toBe('c1')
      expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(fakeClient, 'GET', '/_matrix/client/v1/ai/connections/c1')
    })

    it('name 缺失时日志回退到 id', async () => {
      mockAuthedRequestWithPath.mockResolvedValueOnce({ id: 'c1', type: 't', status: 'active' })
      const result = await matrixAIConnectionService.getConnection('c1')
      expect(result.name).toBeUndefined()
      expect(mockInfo).toHaveBeenCalled()
    })

    it('请求失败时抛出原错误', async () => {
      mockAuthedRequestWithPath.mockRejectedValueOnce(new Error('not found'))
      await expect(matrixAIConnectionService.getConnection('c-unknown')).rejects.toThrow('not found')
    })
  })

  describe('deleteConnection', () => {
    it('DELETE 连接并正常返回', async () => {
      mockAuthedRequestWithPath.mockResolvedValueOnce(undefined)
      await expect(matrixAIConnectionService.deleteConnection('c1')).resolves.toBeUndefined()
      expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(
        fakeClient,
        'DELETE',
        '/_matrix/client/v1/ai/connections/c1'
      )
    })

    it('请求失败时抛出原错误', async () => {
      mockAuthedRequestWithPath.mockRejectedValueOnce(new Error('delete failed'))
      await expect(matrixAIConnectionService.deleteConnection('c1')).rejects.toThrow('delete failed')
    })
  })

  describe('listMcpTools', () => {
    it('正常返回工具列表', async () => {
      mockAuthedRequestWithPath.mockResolvedValueOnce({ tools: [{ name: 't1', description: 'd', parameters: {} }] })
      const result = await matrixAIConnectionService.listMcpTools()
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('t1')
      expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(fakeClient, 'GET', '/_matrix/client/v1/ai/mcp/tools')
    })

    it('tools 缺失时回退为空数组', async () => {
      mockAuthedRequestWithPath.mockResolvedValueOnce({})
      const result = await matrixAIConnectionService.listMcpTools()
      expect(result).toEqual([])
    })

    it('请求失败时抛出原错误', async () => {
      mockAuthedRequestWithPath.mockRejectedValueOnce(new Error('mcp error'))
      await expect(matrixAIConnectionService.listMcpTools()).rejects.toThrow('mcp error')
      expect(mockError).toHaveBeenCalled()
    })
  })

  describe('callMcpTool', () => {
    it('POST 请求体并返回 result', async () => {
      mockAuthedRequestWithPath.mockResolvedValueOnce({ result: { ok: true } })
      const request = { tool: 'fetch', parameters: { url: 'x' } }
      const result = await matrixAIConnectionService.callMcpTool(request)
      expect(result).toEqual({ ok: true })
      expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(
        fakeClient,
        'POST',
        '/_matrix/client/v1/ai/mcp/tools/call',
        undefined,
        request
      )
    })

    it('请求失败时抛出原错误', async () => {
      mockAuthedRequestWithPath.mockRejectedValueOnce(new Error('call failed'))
      await expect(matrixAIConnectionService.callMcpTool({ tool: 't', parameters: {} })).rejects.toThrow('call failed')
      expect(mockError).toHaveBeenCalled()
    })
  })
})
