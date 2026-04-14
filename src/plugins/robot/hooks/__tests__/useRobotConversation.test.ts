import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRobotConversation } from '../useRobotConversation'

vi.mock('@/services/matrix', () => ({
  matrixAIService: {
    conversationCreate: vi.fn().mockResolvedValue({
      id: 'conv-1',
      title: '新的会话',
      createdAt: Date.now()
    }),
    conversationGetMy: vi.fn().mockResolvedValue([
      { id: 'conv-1', title: '会话1', createdAt: Date.now() },
      { id: 'conv-2', title: '会话2', createdAt: Date.now() }
    ]),
    conversationUpdate: vi.fn().mockResolvedValue(undefined),
    conversationDelete: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  })
}))

vi.stubGlobal('$message', {
  success: vi.fn(),
  error: vi.fn()
})

describe('useRobotConversation', () => {
  let robotConversation: ReturnType<typeof useRobotConversation>

  beforeEach(() => {
    vi.clearAllMocks()
    robotConversation = useRobotConversation()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      expect(robotConversation.currentConversation.value.id).toBe('0')
      expect(robotConversation.currentConversation.value.title).toBe('')
      expect(robotConversation.conversationList.value).toEqual([])
      expect(robotConversation.loadingConversations.value).toBe(false)
    })

    it('hasActiveConversation 应该返回 false', () => {
      expect(robotConversation.hasActiveConversation.value).toBe(false)
    })
  })

  describe('createConversation', () => {
    it('应该创建新会话', async () => {
      const result = await robotConversation.createConversation('测试会话')
      expect(result).not.toBeNull()
      expect(robotConversation.conversationList.value).toHaveLength(1)
    })

    it('创建会话后 hasActiveConversation 应该返回 true', async () => {
      await robotConversation.createConversation()
      expect(robotConversation.hasActiveConversation.value).toBe(true)
    })
  })

  describe('loadConversations', () => {
    it('应该加载会话列表', async () => {
      await robotConversation.loadConversations()
      expect(robotConversation.conversationList.value).toHaveLength(2)
    })
  })

  describe('selectConversation', () => {
    it('应该设置当前会话', () => {
      const conversation = {
        id: 'test-conv',
        title: '测试',
        messageCount: 5,
        createTime: Date.now()
      }
      robotConversation.selectConversation(conversation)
      expect(robotConversation.currentConversation.value.id).toBe('test-conv')
    })
  })

  describe('updateConversationTitle', () => {
    it('没有活动会话时应该返回 false', async () => {
      const result = await robotConversation.updateConversationTitle('新标题')
      expect(result).toBe(false)
    })

    it('有活动会话时应该更新标题', async () => {
      await robotConversation.createConversation('原标题')
      const result = await robotConversation.updateConversationTitle('新标题')
      expect(result).toBe(true)
      expect(robotConversation.currentConversation.value.title).toBe('新标题')
    })
  })

  describe('deleteConversation', () => {
    it('应该删除会话', async () => {
      await robotConversation.createConversation('测试会话')
      const convId = robotConversation.currentConversation.value.id
      const result = await robotConversation.deleteConversation(convId)
      expect(result).toBe(true)
      expect(robotConversation.conversationList.value).toHaveLength(0)
    })

    it('删除当前会话后应该重置', async () => {
      await robotConversation.createConversation()
      const convId = robotConversation.currentConversation.value.id
      await robotConversation.deleteConversation(convId)
      expect(robotConversation.currentConversation.value.id).toBe('0')
    })
  })

  describe('incrementMessageCount', () => {
    it('应该增加消息计数', async () => {
      await robotConversation.createConversation()
      const initialCount = robotConversation.currentConversation.value.messageCount
      robotConversation.incrementMessageCount()
      expect(robotConversation.currentConversation.value.messageCount).toBe(initialCount + 1)
    })
  })

  describe('resetCurrentConversation', () => {
    it('应该重置当前会话', async () => {
      await robotConversation.createConversation('测试')
      robotConversation.resetCurrentConversation()
      expect(robotConversation.currentConversation.value.id).toBe('0')
      expect(robotConversation.hasActiveConversation.value).toBe(false)
    })
  })
})
