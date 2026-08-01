import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useOpenClawConversationStore } from '../openClawConversation'

describe('useOpenClawConversationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('初始状态', () => {
    it('conversations 为空数组', () => {
      const store = useOpenClawConversationStore()
      expect(store.conversations).toEqual([])
    })

    it('activeConversationId 为空字符串', () => {
      const store = useOpenClawConversationStore()
      expect(store.activeConversationId).toBe('')
    })

    it('inputMessage 为空字符串', () => {
      const store = useOpenClawConversationStore()
      expect(store.inputMessage).toBe('')
    })

    it('isSending 为 false', () => {
      const store = useOpenClawConversationStore()
      expect(store.isSending).toBe(false)
    })

    it('expandedReasoningIds 为空数组', () => {
      const store = useOpenClawConversationStore()
      expect(store.expandedReasoningIds).toEqual([])
    })

    it('canSend 初始为 false（inputMessage 为空）', () => {
      const store = useOpenClawConversationStore()
      expect(store.canSend).toBe(false)
    })

    it('currentConversation 初始为 null', () => {
      const store = useOpenClawConversationStore()
      expect(store.currentConversation).toBeNull()
    })
  })

  describe('canSend computed', () => {
    it('inputMessage 非空且未发送时为 true', () => {
      const store = useOpenClawConversationStore()
      store.inputMessage = 'hello'
      expect(store.canSend).toBe(true)
    })

    it('inputMessage 仅空格时为 false', () => {
      const store = useOpenClawConversationStore()
      store.inputMessage = '   '
      expect(store.canSend).toBe(false)
    })

    it('isSending 为 true 时为 false', () => {
      const store = useOpenClawConversationStore()
      store.inputMessage = 'hello'
      store.isSending = true
      expect(store.canSend).toBe(false)
    })
  })

  describe('setTranslate', () => {
    it('设置翻译函数', () => {
      const store = useOpenClawConversationStore()
      const translateFn = vi.fn((key: string) => `T(${key})`)
      store.setTranslate(translateFn)
      // setTranslate 会触发 normalizePersistedState -> ensureConversation
      // 由于 conversations 为空，会创建一个新会话
      expect(store.conversations).toHaveLength(1)
      // 新会话的标题应使用 translateFn
      expect(translateFn).toHaveBeenCalledWith('ai_assistant.robot.new_conversation_title')
      expect(store.conversations[0].title).toBe('T(ai_assistant.robot.new_conversation_title)')
    })
  })

  describe('handleCreateConversation', () => {
    it('创建新会话并设为活跃', () => {
      const store = useOpenClawConversationStore()
      store.handleCreateConversation()
      expect(store.conversations).toHaveLength(1)
      expect(store.activeConversationId).toBe(store.conversations[0].id)
      expect(store.inputMessage).toBe('')
    })

    it('新会话插入到列表头部', () => {
      const store = useOpenClawConversationStore()
      store.handleCreateConversation()
      const firstId = store.conversations[0].id
      store.handleCreateConversation()
      expect(store.conversations).toHaveLength(2)
      expect(store.conversations[0].id).not.toBe(firstId)
      expect(store.activeConversationId).toBe(store.conversations[0].id)
    })

    it('currentConversation 返回当前活跃会话', () => {
      const store = useOpenClawConversationStore()
      store.handleCreateConversation()
      expect(store.currentConversation?.id).toBe(store.activeConversationId)
    })
  })

  describe('handleDeleteConversation', () => {
    it('删除指定会话', () => {
      const store = useOpenClawConversationStore()
      store.handleCreateConversation()
      store.handleCreateConversation()
      const firstId = store.conversations[0].id
      const secondId = store.conversations[1].id
      store.handleDeleteConversation(firstId)
      expect(store.conversations.map((c) => c.id)).toEqual([secondId])
    })

    it('删除当前活跃会话时切换到第一个', () => {
      const store = useOpenClawConversationStore()
      store.handleCreateConversation()
      store.handleCreateConversation()
      const activeId = store.activeConversationId
      store.handleDeleteConversation(activeId)
      expect(store.activeConversationId).toBe(store.conversations[0]?.id)
    })

    it('删除最后一个会话时自动创建新会话', () => {
      const store = useOpenClawConversationStore()
      store.handleCreateConversation()
      const onlyId = store.conversations[0].id
      store.handleDeleteConversation(onlyId)
      // ensureConversation 会创建新会话
      expect(store.conversations).toHaveLength(1)
      expect(store.conversations[0].id).not.toBe(onlyId)
      expect(store.activeConversationId).toBe(store.conversations[0].id)
    })

    it('删除不存在的 ID 不影响列表', () => {
      const store = useOpenClawConversationStore()
      store.handleCreateConversation()
      const before = store.conversations.length
      store.handleDeleteConversation('non-existent')
      expect(store.conversations).toHaveLength(before)
    })
  })

  describe('handleDeleteAllConversations', () => {
    it('无确认回调时直接清空并创建新会话', async () => {
      const store = useOpenClawConversationStore()
      store.handleCreateConversation()
      store.handleCreateConversation()
      await store.handleDeleteAllConversations()
      expect(store.conversations).toHaveLength(1)
      expect(store.activeConversationId).toBe(store.conversations[0].id)
    })

    it('确认回调返回 true 时清空', async () => {
      const store = useOpenClawConversationStore()
      store.setConfirmDeleteAllCallback(async () => true)
      store.handleCreateConversation()
      store.handleCreateConversation()
      await store.handleDeleteAllConversations()
      // 清空后 ensureConversation 创建一个新会话
      expect(store.conversations).toHaveLength(1)
    })

    it('确认回调返回 false 时不清空', async () => {
      const store = useOpenClawConversationStore()
      store.setConfirmDeleteAllCallback(async () => false)
      store.handleCreateConversation()
      store.handleCreateConversation()
      const before = store.conversations.length
      await store.handleDeleteAllConversations()
      expect(store.conversations).toHaveLength(before)
    })
  })

  describe('toggleReasoning', () => {
    it('添加未存在的 messageId', () => {
      const store = useOpenClawConversationStore()
      store.toggleReasoning('msg-1')
      expect(store.expandedReasoningIds).toEqual(['msg-1'])
    })

    it('再次切换移除已存在的 messageId', () => {
      const store = useOpenClawConversationStore()
      store.toggleReasoning('msg-1')
      store.toggleReasoning('msg-2')
      expect(store.expandedReasoningIds).toEqual(['msg-1', 'msg-2'])
      store.toggleReasoning('msg-1')
      expect(store.expandedReasoningIds).toEqual(['msg-2'])
    })
  })

  describe('sanitizeMessage', () => {
    it('规范化 user 消息', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeMessage({ role: 'user', content: 'hi' })
      expect(result).not.toBeNull()
      expect(result?.role).toBe('user')
      expect(result?.content).toBe('hi')
      expect(result?.status).toBe('done')
      expect(typeof result?.id).toBe('string')
      expect(typeof result?.createdAt).toBe('number')
    })

    it('规范化 assistant 消息', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeMessage({
        role: 'assistant',
        content: 'response',
        reasoningContent: 'thinking',
        model: 'gpt-4'
      })
      expect(result?.role).toBe('assistant')
      expect(result?.reasoningContent).toBe('thinking')
      expect(result?.model).toBe('gpt-4')
    })

    it('无效 role 返回 null', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeMessage({ role: 'system' as never, content: 'x' })
      expect(result).toBeNull()
    })

    it('保留有效的 status，无效的回退到 done', () => {
      const store = useOpenClawConversationStore()
      expect(store.sanitizeMessage({ role: 'user', content: 'a', status: 'streaming' })?.status).toBe('streaming')
      expect(store.sanitizeMessage({ role: 'user', content: 'b', status: 'error' })?.status).toBe('error')
      expect(store.sanitizeMessage({ role: 'user', content: 'c', status: 'invalid' as never })?.status).toBe('done')
      expect(store.sanitizeMessage({ role: 'user', content: 'd' })?.status).toBe('done')
    })

    it('保留提供的 id', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeMessage({ id: 'fixed-id', role: 'user', content: 'x' })
      expect(result?.id).toBe('fixed-id')
    })

    it('保留提供的 errorMessage', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeMessage({ role: 'assistant', content: 'x', errorMessage: 'oops' })
      expect(result?.errorMessage).toBe('oops')
    })
  })

  describe('sanitizeConversation', () => {
    it('规范化有效会话', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeConversation({
        id: 'conv-1',
        title: 'Hello',
        messages: [{ role: 'user', content: 'hi' } as never]
      })
      expect(result?.id).toBe('conv-1')
      expect(result?.title).toBe('Hello')
      expect(result?.messages).toHaveLength(1)
    })

    it('空标题回退到默认翻译', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeConversation({ id: 'conv-1', title: '' })
      expect(result?.title).toBe('ai_assistant.robot.new_conversation_title')
    })

    it('空白标题回退到默认翻译', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeConversation({ id: 'conv-1', title: '   ' })
      expect(result?.title).toBe('ai_assistant.robot.new_conversation_title')
    })

    it('缺少 id 返回 null', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeConversation({ title: 'no id' })
      expect(result).toBeNull()
    })

    it('空 id 返回 null', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeConversation({ id: '', title: 'x' })
      expect(result).toBeNull()
    })

    it('过滤无效消息', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeConversation({
        id: 'conv-1',
        title: 'T',
        messages: [
          { role: 'user', content: 'valid' },
          { role: 'system' as never, content: 'invalid' },
          { role: 'assistant', content: 'valid2' }
        ] as never
      })
      expect(result?.messages).toHaveLength(2)
      expect(result?.messages.map((m) => m.role)).toEqual(['user', 'assistant'])
    })

    it('messages 非数组时返回空数组', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeConversation({ id: 'conv-1', title: 'T', messages: 'not-an-array' as never })
      expect(result?.messages).toEqual([])
    })

    it('保留 createdAt 和 updatedAt', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeConversation({
        id: 'conv-1',
        title: 'T',
        createdAt: 1000,
        updatedAt: 2000
      })
      expect(result?.createdAt).toBe(1000)
      expect(result?.updatedAt).toBe(2000)
    })

    it('updatedAt 缺失时回退到 createdAt', () => {
      const store = useOpenClawConversationStore()
      const result = store.sanitizeConversation({
        id: 'conv-1',
        title: 'T',
        createdAt: 1000
      })
      expect(result?.updatedAt).toBe(1000)
    })
  })

  describe('buildConversationTitle', () => {
    it('短消息直接作为标题', () => {
      const store = useOpenClawConversationStore()
      expect(store.buildConversationTitle('Hello World')).toBe('Hello World')
    })

    it('超长消息截断到 24 字符并加省略号', () => {
      const store = useOpenClawConversationStore()
      const long = 'This is a very long message that exceeds twenty four characters'
      const result = store.buildConversationTitle(long)
      expect(result).toBe(`${long.slice(0, 24)}...`)
    })

    it('多个空白字符合并为单个空格', () => {
      const store = useOpenClawConversationStore()
      expect(store.buildConversationTitle('  hello   world  ')).toBe('hello world')
    })

    it('仅空白时返回默认翻译', () => {
      const store = useOpenClawConversationStore()
      expect(store.buildConversationTitle('   ')).toBe('ai_assistant.robot.new_conversation_title')
    })

    it('空字符串返回默认翻译', () => {
      const store = useOpenClawConversationStore()
      expect(store.buildConversationTitle('')).toBe('ai_assistant.robot.new_conversation_title')
    })
  })

  describe('sortConversations', () => {
    it('按 updatedAt 降序排序', () => {
      const store = useOpenClawConversationStore()
      // 直接操作 conversations 数组
      store.conversations = [
        { id: 'old', title: 'old', createdAt: 1, updatedAt: 1, messages: [] },
        { id: 'new', title: 'new', createdAt: 2, updatedAt: 100, messages: [] },
        { id: 'mid', title: 'mid', createdAt: 3, updatedAt: 50, messages: [] }
      ] as never
      store.sortConversations()
      expect(store.conversations.map((c) => c.id)).toEqual(['new', 'mid', 'old'])
    })
  })

  describe('normalizePersistedState', () => {
    it('过滤无效会话', () => {
      const store = useOpenClawConversationStore()
      store.conversations = [
        { id: 'valid', title: 'V', createdAt: 1, updatedAt: 1, messages: [] },
        { id: '', title: 'invalid', messages: [] },
        { title: 'no-id', messages: [] }
      ] as never
      store.normalizePersistedState()
      expect(store.conversations.map((c) => c.id)).toEqual(['valid'])
    })

    it('expandedReasoningIds 过滤空字符串', () => {
      const store = useOpenClawConversationStore()
      store.expandedReasoningIds = ['valid', '', 'also-valid'] as never
      store.normalizePersistedState()
      expect(store.expandedReasoningIds).toEqual(['valid', 'also-valid'])
    })
  })
})
