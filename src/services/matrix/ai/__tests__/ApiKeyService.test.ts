import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn()
}))

vi.mock('@/services/backend', () => ({
  matrixExtensionEndpoints: {
    API_KEY_PAGE: 'apiKeyPage',
    API_KEY_SIMPLE_LIST: 'apiKeySimpleList',
    API_KEY_CREATE: 'apiKeyCreate',
    API_KEY_UPDATE: 'apiKeyUpdate',
    API_KEY_DELETE: 'apiKeyDelete',
    API_KEY_BALANCE: 'apiKeyBalance',
    PLATFORM_LIST: 'platformList',
    PLATFORM_ADD_MODEL: 'platformAddModel'
  }
}))

vi.mock('../../MatrixHttpClient', () => ({
  matrixHttpClient: { request: mockRequest }
}))

import { apiKeyService } from '../ApiKeyService'

describe('MatrixApiKeyService', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  it('page 调用 apiKeyPage 端点并传分页参数', async () => {
    mockRequest.mockResolvedValueOnce({ list: [], total: 0 })
    const result = await apiKeyService.page({ pageNo: 1, pageSize: 10 })
    expect(result).toEqual({ list: [], total: 0 })
    expect(mockRequest).toHaveBeenCalledWith({ url: 'apiKeyPage', params: { pageNo: 1, pageSize: 10 } }, undefined, {
      logPrefix: 'MatrixApiKey'
    })
  })

  it('simpleList 返回 ApiKey 数组', async () => {
    mockRequest.mockResolvedValueOnce([{ id: 'k1', name: 'n', apiKey: 'sk', platform: 'openai', status: 1 }])
    const result = await apiKeyService.simpleList()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('k1')
    expect(mockRequest).toHaveBeenCalledWith({ url: 'apiKeySimpleList' }, undefined, {
      logPrefix: 'MatrixApiKey'
    })
  })

  it('create POST 请求体并返回新建的 ApiKey', async () => {
    const body = { name: 'n', apiKey: 'sk', platform: 'openai', status: 1 }
    mockRequest.mockResolvedValueOnce({ id: 'k1', ...body })
    const result = await apiKeyService.create(body)
    expect(result.id).toBe('k1')
    expect(mockRequest).toHaveBeenCalledWith({ url: 'apiKeyCreate', method: 'POST', body }, undefined, {
      logPrefix: 'MatrixApiKey'
    })
  })

  it('create 支持可选的 url 字段', async () => {
    const body = { name: 'n', apiKey: 'sk', platform: 'openai', url: 'https://api.x', status: 1 }
    mockRequest.mockResolvedValueOnce({ id: 'k1', ...body })
    await apiKeyService.create(body)
    expect(mockRequest).toHaveBeenCalledWith({ url: 'apiKeyCreate', method: 'POST', body }, undefined, {
      logPrefix: 'MatrixApiKey'
    })
  })

  it('update POST 请求体（含 id）并返回更新后的 ApiKey', async () => {
    const body = { id: 'k1', name: 'n2', apiKey: 'sk2', platform: 'openai', status: 0 }
    mockRequest.mockResolvedValueOnce({ ...body })
    const result = await apiKeyService.update(body)
    expect(result.name).toBe('n2')
    expect(mockRequest).toHaveBeenCalledWith({ url: 'apiKeyUpdate', method: 'POST', body }, undefined, {
      logPrefix: 'MatrixApiKey'
    })
  })

  it('delete 透传 id 作为 query 参数并返回 true', async () => {
    mockRequest.mockResolvedValueOnce(undefined)
    const ok = await apiKeyService.delete({ id: 'k1' })
    expect(ok).toBe(true)
    expect(mockRequest).toHaveBeenCalledWith({ url: 'apiKeyDelete', params: { id: 'k1' } }, undefined, {
      logPrefix: 'MatrixApiKey'
    })
  })

  it('delete 在请求失败时抛出原错误', async () => {
    mockRequest.mockRejectedValueOnce(new Error('403'))
    await expect(apiKeyService.delete({ id: 'k1' })).rejects.toThrow('403')
  })

  it('balance 透传 id 作为 query 参数并返回 ApiKeyBalance', async () => {
    mockRequest.mockResolvedValueOnce({ balanceInfos: [{ totalBalance: '10.0', currency: 'USD' }] })
    const result = await apiKeyService.balance({ id: 'k1' })
    expect(result.balanceInfos).toHaveLength(1)
    expect(result.balanceInfos[0].totalBalance).toBe('10.0')
    expect(mockRequest).toHaveBeenCalledWith({ url: 'apiKeyBalance', params: { id: 'k1' } }, undefined, {
      logPrefix: 'MatrixApiKey'
    })
  })

  it('platformList 返回 Platform 数组', async () => {
    mockRequest.mockResolvedValueOnce([
      { label: 'OpenAI', platform: 'openai', examples: 'sk-xxx', docs: 'https://...' }
    ])
    const result = await apiKeyService.platformList()
    expect(result).toHaveLength(1)
    expect(result[0].platform).toBe('openai')
    expect(mockRequest).toHaveBeenCalledWith({ url: 'platformList' }, undefined, {
      logPrefix: 'MatrixApiKey'
    })
  })

  it('addPlatformModel POST { platform, model } 并返回 true', async () => {
    mockRequest.mockResolvedValueOnce(undefined)
    const ok = await apiKeyService.addPlatformModel('openai', 'gpt-4')
    expect(ok).toBe(true)
    expect(mockRequest).toHaveBeenCalledWith(
      { url: 'platformAddModel', method: 'POST', body: { platform: 'openai', model: 'gpt-4' } },
      undefined,
      { logPrefix: 'MatrixApiKey' }
    )
  })

  it('addPlatformModel 在请求失败时抛出原错误', async () => {
    mockRequest.mockRejectedValueOnce(new Error('500'))
    await expect(apiKeyService.addPlatformModel('openai', 'gpt-4')).rejects.toThrow('500')
  })
})
