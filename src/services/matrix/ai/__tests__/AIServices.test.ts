import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/backend', () => ({
  matrixExtensionEndpoints: {
    CONVERSATION_GET_MY: '/api/ai/conversation/my',
    CONVERSATION_CREATE_MY: '/api/ai/conversation/create',
    CONVERSATION_UPDATE_MY: '/api/ai/conversation/update',
    CONVERSATION_DELETE_MY: '/api/ai/conversation/delete',
    MESSAGE_SAVE_GENERATED_CONTENT: '/api/ai/message/save',
    MESSAGE_LIST_BY_CONVERSATION_ID: '/api/ai/message/list',
    MESSAGE_DELETE: '/api/ai/message/delete',
    MESSAGE_DELETE_BY_CONVERSATION_ID: '/api/ai/message/deleteByConversation',
    MODEL_PAGE: '/api/ai/model/page',
    MODEL_REMAINING_USAGE: '/api/ai/model/remaining',
    IMAGE_DRAW: '/api/ai/image/draw',
    IMAGE_MY_PAGE: '/api/ai/image/my/page',
    IMAGE_MY_LIST_BY_IDS: '/api/ai/image/my/list',
    VIDEO_MY_PAGE: '/api/ai/video/my/page',
    VIDEO_MY_LIST_BY_IDS: '/api/ai/video/my/list',
    VIDEO_GENERATE: '/api/ai/video/generate',
    AUDIO_MY_PAGE: '/api/ai/audio/my/page',
    AUDIO_MY_LIST_BY_IDS: '/api/ai/audio/my/list',
    AUDIO_GENERATE: '/api/ai/audio/generate',
    AUDIO_VOICES: '/api/ai/audio/voices',
    CHAT_ROLE_PAGE: '/api/ai/chat-role/page',
    MODEL_UPDATE: '/api/ai/model/update',
    MODEL_DELETE: '/api/ai/model/delete',
    CHAT_ROLE_CREATE: '/api/ai/chat-role/create',
    CHAT_ROLE_UPDATE: '/api/ai/chat-role/update',
    CHAT_ROLE_DELETE: '/api/ai/chat-role/delete',
    CHAT_ROLE_CATEGORY_LIST: '/api/ai/chat-role/category-list',
    API_KEY_PAGE: '/api/ai/api-key/page',
    API_KEY_SIMPLE_LIST: '/api/ai/api-key/simple-list',
    API_KEY_CREATE: '/api/ai/api-key/create',
    API_KEY_UPDATE: '/api/ai/api-key/update',
    API_KEY_DELETE: '/api/ai/api-key/delete',
    API_KEY_BALANCE: '/api/ai/api-key/balance',
    PLATFORM_LIST: '/api/ai/platform/list',
    PLATFORM_ADD_MODEL: '/api/ai/platform/add-model',
    CONVERSATION_PAGE: '/api/ai/conversation/page'
  }
}))

const mockRequest = vi.fn()
vi.mock('../../MatrixHttpClient', () => ({
  matrixHttpClient: { request: mockRequest }
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: { getClient: vi.fn() }
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: vi.fn()
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

describe('AI Services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequest.mockReset()
  })

  describe('ModelService', () => {
    let modelService: typeof import('../ModelService').modelService

    beforeEach(async () => {
      modelService = (await import('../ModelService')).modelService
    })

    it('should get model page', async () => {
      mockRequest.mockResolvedValue({ list: [{ id: 'm1', name: 'GPT-4' }], total: 1 })
      const result = await modelService.page()
      expect(result.list).toHaveLength(1)
    })

    it('should update model', async () => {
      mockRequest.mockResolvedValue({ id: 'm1', name: 'Updated' })
      const result = await modelService.update({ id: 'm1', name: 'Updated' })
      expect(result.name).toBe('Updated')
    })

    it('should delete model', async () => {
      mockRequest.mockResolvedValue(undefined)
      const result = await modelService.delete({ id: 'm1' })
      expect(result).toBe(true)
    })
  })

  describe('ChatRoleService', () => {
    let chatRoleService: typeof import('../ChatRoleService').chatRoleService

    beforeEach(async () => {
      chatRoleService = (await import('../ChatRoleService')).chatRoleService
    })

    it('should get chat role page', async () => {
      mockRequest.mockResolvedValue({ list: [{ id: 'r1', name: 'Assistant' }], total: 1 })
      const result = await chatRoleService.page()
      expect(result.list).toHaveLength(1)
    })

    it('should create chat role', async () => {
      mockRequest.mockResolvedValue({ id: 'r1', name: 'New Role' })
      const result = await chatRoleService.create({
        name: 'New Role',
        avatar: '',
        category: 'general',
        sort: 0,
        description: '',
        systemMessage: '',
        publicStatus: true,
        status: 1
      })
      expect(result.id).toBe('r1')
    })

    it('should delete chat role', async () => {
      mockRequest.mockResolvedValue(undefined)
      const result = await chatRoleService.delete({ id: 'r1' })
      expect(result).toBe(true)
    })
  })

  describe('ApiKeyService', () => {
    let apiKeyService: typeof import('../ApiKeyService').apiKeyService

    beforeEach(async () => {
      apiKeyService = (await import('../ApiKeyService')).apiKeyService
    })

    it('should get api key page', async () => {
      mockRequest.mockResolvedValue({ list: [{ id: 'k1', name: 'OpenAI' }], total: 1 })
      const result = await apiKeyService.page()
      expect(result.list).toHaveLength(1)
    })

    it('should create api key', async () => {
      mockRequest.mockResolvedValue({ id: 'k1', name: 'New Key' })
      const result = await apiKeyService.create({ name: 'New Key', apiKey: 'sk-xxx', platform: 'openai', status: 1 })
      expect(result.id).toBe('k1')
    })

    it('should get platform list', async () => {
      mockRequest.mockResolvedValue([{ label: 'OpenAI', platform: 'openai' }])
      const result = await apiKeyService.platformList()
      expect(result).toHaveLength(1)
    })
  })

  describe('ConversationService', () => {
    let conversationService: typeof import('../ConversationService').conversationService

    beforeEach(async () => {
      conversationService = (await import('../ConversationService')).conversationService
    })

    it('should get conversation page', async () => {
      mockRequest.mockResolvedValue({ list: [{ id: 'c1', title: 'Chat' }], total: 1 })
      const result = await conversationService.page()
      expect(result.list).toHaveLength(1)
    })

    it('should create conversation', async () => {
      mockRequest.mockResolvedValue({ id: 'c1', title: 'New Chat' })
      const result = await conversationService.create({ roleId: 'r1' })
      expect(result.id).toBe('c1')
    })

    it('should delete conversations', async () => {
      mockRequest.mockResolvedValue(undefined)
      const result = await conversationService.delete({ conversationIdList: ['c1'] })
      expect(result).toBe(true)
    })
  })

  describe('error branches', () => {
    it('ModelService.page propagates request failures', async () => {
      const { modelService } = await import('../ModelService')
      mockRequest.mockRejectedValueOnce(new Error('500'))
      await expect(modelService.page()).rejects.toThrow('500')
    })

    it('ModelService.delete rejects on backend error', async () => {
      const { modelService } = await import('../ModelService')
      mockRequest.mockRejectedValueOnce(new Error('forbidden'))
      await expect(modelService.delete({ id: 'm1' })).rejects.toThrow('forbidden')
    })

    it('ChatRoleService.create rejects on backend error', async () => {
      const { chatRoleService } = await import('../ChatRoleService')
      mockRequest.mockRejectedValueOnce(new Error('invalid payload'))
      await expect(
        chatRoleService.create({
          name: 'r',
          avatar: '',
          category: 'g',
          sort: 0,
          description: '',
          systemMessage: '',
          publicStatus: true,
          status: 1
        })
      ).rejects.toThrow('invalid payload')
    })

    it('ApiKeyService.simpleList returns list from backend', async () => {
      const { apiKeyService } = await import('../ApiKeyService')
      mockRequest.mockResolvedValueOnce([{ id: 'k1', name: 'a', apiKey: 'sk', platform: 'p', status: 1 }])
      const result = await apiKeyService.simpleList()
      expect(result).toHaveLength(1)
    })

    it('ApiKeyService.delete returns true on success', async () => {
      const { apiKeyService } = await import('../ApiKeyService')
      mockRequest.mockResolvedValueOnce(undefined)
      const ok = await apiKeyService.delete({ id: 'k1' })
      expect(ok).toBe(true)
    })

    it('ApiKeyService.addPlatformModel re-throws backend errors', async () => {
      const { apiKeyService } = await import('../ApiKeyService')
      mockRequest.mockRejectedValueOnce(new Error('conflict'))
      await expect(apiKeyService.addPlatformModel('openai', 'gpt-4')).rejects.toThrow('conflict')
    })

    it('ConversationService.page propagates errors', async () => {
      const { conversationService } = await import('../ConversationService')
      mockRequest.mockRejectedValueOnce(new Error('network'))
      await expect(conversationService.page()).rejects.toThrow('network')
    })

    it('ConversationService.messageDelete returns true on success', async () => {
      const { conversationService } = await import('../ConversationService')
      mockRequest.mockResolvedValueOnce(undefined)
      const ok = await conversationService.messageDelete({ id: 'm1' })
      expect(ok).toBe(true)
    })
  })
})
