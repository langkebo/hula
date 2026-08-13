import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn()
}))

vi.mock('@/services/backend', () => ({
  matrixExtensionEndpoints: {
    MODEL_PAGE: 'modelPage',
    MODEL_UPDATE: 'modelUpdate',
    MODEL_DELETE: 'modelDelete'
  }
}))

vi.mock('@/services/matrix/MatrixHttpClient', () => ({
  matrixHttpClient: { request: mockRequest }
}))

import { modelService } from '../ModelService'

describe('MatrixModelService', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  describe('page', () => {
    it('调用 modelPage 端点并传分页参数', async () => {
      mockRequest.mockResolvedValueOnce({ list: [{ id: 'm1' }], total: 1 })
      const result = await modelService.page({ pageNo: 1, pageSize: 20 })
      expect(result).toEqual({ list: [{ id: 'm1' }], total: 1 })
      expect(mockRequest).toHaveBeenCalledWith({ url: 'modelPage', params: { pageNo: 1, pageSize: 20 } }, undefined, {
        logPrefix: 'MatrixModel'
      })
    })

    it('不传参数时 params 为 undefined', async () => {
      mockRequest.mockResolvedValueOnce({ list: [], total: 0 })
      await modelService.page()
      expect(mockRequest).toHaveBeenCalledWith({ url: 'modelPage', params: undefined }, undefined, {
        logPrefix: 'MatrixModel'
      })
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('timeout'))
      await expect(modelService.page()).rejects.toThrow('timeout')
    })
  })

  describe('update', () => {
    it('POST 请求体并返回更新后的 AIModel', async () => {
      const body = { id: 'm1', name: 'GPT', platform: 'openai', temperature: 0.7 }
      mockRequest.mockResolvedValueOnce({ id: 'm1', name: 'GPT', platform: 'openai', temperature: 0.7 })
      const result = await modelService.update(body)
      expect(result.name).toBe('GPT')
      expect(mockRequest).toHaveBeenCalledWith({ url: 'modelUpdate', method: 'POST', body }, undefined, {
        logPrefix: 'MatrixModel'
      })
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('403'))
      await expect(modelService.update({ id: 'm1' })).rejects.toThrow('403')
    })
  })

  describe('delete', () => {
    it('传 id 作为 query 参数并返回 true', async () => {
      mockRequest.mockResolvedValueOnce(undefined)
      const ok = await modelService.delete({ id: 'm1' })
      expect(ok).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith({ url: 'modelDelete', params: { id: 'm1' } }, undefined, {
        logPrefix: 'MatrixModel'
      })
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('not found'))
      await expect(modelService.delete({ id: 'm1' })).rejects.toThrow('not found')
    })
  })
})
