import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockRequest } = vi.hoisted(() => ({
  mockRequest: vi.fn()
}))

vi.mock('@/services/backend', () => ({
  matrixExtensionEndpoints: {
    CONVERSATION_PAGE: 'conversationPage',
    CONVERSATION_CREATE_MY: 'conversationCreateMy',
    CONVERSATION_UPDATE_MY: 'conversationUpdateMy',
    CONVERSATION_DELETE_MY: 'conversationDeleteMy',
    MESSAGE_LIST_BY_CONVERSATION_ID: 'messageListByConversationId',
    MESSAGE_DELETE: 'messageDelete',
    MESSAGE_DELETE_BY_CONVERSATION_ID: 'messageDeleteByConversationId'
  }
}))

vi.mock('@/services/matrix/MatrixHttpClient', () => ({
  matrixHttpClient: { request: mockRequest }
}))

import { conversationService } from '../ConversationService'

describe('MatrixConversationService', () => {
  beforeEach(() => {
    mockRequest.mockReset()
  })

  describe('page', () => {
    it('调用 conversationPage 端点并传分页参数', async () => {
      mockRequest.mockResolvedValueOnce({ list: [{ id: 'c1' }], total: 1 })
      const result = await conversationService.page({ pageNo: 1, pageSize: 50 })
      expect(result).toEqual({ list: [{ id: 'c1' }], total: 1 })
      expect(mockRequest).toHaveBeenCalledWith(
        { url: 'conversationPage', params: { pageNo: 1, pageSize: 50 } },
        undefined,
        {
          logPrefix: 'MatrixConversation'
        }
      )
    })

    it('不传参数时 params 为 undefined', async () => {
      mockRequest.mockResolvedValueOnce({ list: [], total: 0 })
      await conversationService.page()
      expect(mockRequest).toHaveBeenCalledWith({ url: 'conversationPage', params: undefined }, undefined, {
        logPrefix: 'MatrixConversation'
      })
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('network down'))
      await expect(conversationService.page()).rejects.toThrow('network down')
    })
  })

  describe('create', () => {
    it('POST 请求体并返回新建的 Conversation', async () => {
      const params = { roleId: 'r1', title: '标题', modelId: 'm1' }
      mockRequest.mockResolvedValueOnce({ id: 'c1', ...params })
      const result = await conversationService.create(params)
      expect(result.id).toBe('c1')
      expect(mockRequest).toHaveBeenCalledWith(
        { url: 'conversationCreateMy', method: 'POST', body: params },
        undefined,
        {
          logPrefix: 'MatrixConversation'
        }
      )
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('403'))
      await expect(conversationService.create({ roleId: 'r1' })).rejects.toThrow('403')
    })
  })

  describe('update', () => {
    it('POST 请求体（含 id）并返回更新后的 Conversation', async () => {
      const params = { id: 'c1', title: '新标题', isPinned: true }
      mockRequest.mockResolvedValueOnce({ id: 'c1', title: '新标题', isPinned: true })
      const result = await conversationService.update(params)
      expect(result.title).toBe('新标题')
      expect(mockRequest).toHaveBeenCalledWith(
        { url: 'conversationUpdateMy', method: 'POST', body: params },
        undefined,
        {
          logPrefix: 'MatrixConversation'
        }
      )
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('timeout'))
      await expect(conversationService.update({ id: 'c1' })).rejects.toThrow('timeout')
    })
  })

  describe('delete', () => {
    it('POST 请求体并返回 true', async () => {
      mockRequest.mockResolvedValueOnce(undefined)
      const ok = await conversationService.delete({ conversationIdList: ['c1', 'c2'] })
      expect(ok).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith(
        { url: 'conversationDeleteMy', method: 'POST', body: { conversationIdList: ['c1', 'c2'] } },
        undefined,
        { logPrefix: 'MatrixConversation' }
      )
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('500'))
      await expect(conversationService.delete({ conversationIdList: ['c1'] })).rejects.toThrow('500')
    })
  })

  describe('messageListByConversationId', () => {
    it('传 conversationId 作为 query 参数并返回消息数组', async () => {
      const messages = [{ id: 'msg1', conversationId: 'c1', role: 'user', content: 'hi' }]
      mockRequest.mockResolvedValueOnce(messages)
      const result = await conversationService.messageListByConversationId({ conversationId: 'c1' })
      expect(result).toEqual(messages)
      expect(mockRequest).toHaveBeenCalledWith(
        { url: 'messageListByConversationId', params: { conversationId: 'c1' } },
        undefined,
        { logPrefix: 'MatrixConversation' }
      )
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('404'))
      await expect(conversationService.messageListByConversationId({ conversationId: 'c1' })).rejects.toThrow('404')
    })
  })

  describe('messageDelete', () => {
    it('传 id 作为 query 参数并返回 true', async () => {
      mockRequest.mockResolvedValueOnce(undefined)
      const ok = await conversationService.messageDelete({ id: 'msg1' })
      expect(ok).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith({ url: 'messageDelete', params: { id: 'msg1' } }, undefined, {
        logPrefix: 'MatrixConversation'
      })
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('forbidden'))
      await expect(conversationService.messageDelete({ id: 'msg1' })).rejects.toThrow('forbidden')
    })
  })

  describe('messageDeleteByConversationId', () => {
    it('传 conversationId 作为 query 参数并返回 true', async () => {
      mockRequest.mockResolvedValueOnce(undefined)
      const ok = await conversationService.messageDeleteByConversationId({ conversationId: 'c1' })
      expect(ok).toBe(true)
      expect(mockRequest).toHaveBeenCalledWith(
        { url: 'messageDeleteByConversationId', params: { conversationId: 'c1' } },
        undefined,
        { logPrefix: 'MatrixConversation' }
      )
    })

    it('请求失败时抛出原错误', async () => {
      mockRequest.mockRejectedValueOnce(new Error('server error'))
      await expect(conversationService.messageDeleteByConversationId({ conversationId: 'c1' })).rejects.toThrow(
        'server error'
      )
    })
  })
})
