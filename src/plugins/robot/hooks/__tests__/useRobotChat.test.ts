import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRobotChat, type Message, type ModelInfo, type RoleInfo } from '../useRobotChat'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    })
  }
})()

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
})

vi.mock('@/stores/setting', () => ({
  useSettingStore: vi.fn(() => ({
    page: { shadow: false },
    themes: { value: { content: 'light' } }
  }))
}))

vi.mock('@/stores/user', () => ({
  useUserStore: vi.fn(() => ({
    userInfo: { uid: 'test-user-id', avatar: 'test-avatar' }
  }))
}))

vi.mock('@/services/matrix', () => ({
  matrixAIService: {
    getModelRemainingUsage: vi.fn().mockResolvedValue(100)
  },
  matrixConversationService: {},
  matrixMessageRelationService: {
    deleteMessage: vi.fn().mockResolvedValue(undefined)
  }
}))

vi.mock('@/utils/PathUtil', () => ({
  persistAiImageFile: vi.fn().mockResolvedValue({ absolutePath: '/test/path' }),
  resolveAiImagePath: vi.fn().mockResolvedValue({ exists: false, absolutePath: '/test/path' })
}))

vi.mock('@/utils/Md5Util', () => ({
  md5FromString: vi.fn().mockResolvedValue('test-hash')
}))

vi.mock('@/services/openclaw', () => ({
  useOpenClaw: vi.fn(() => ({
    isConnected: { value: false },
    availableModels: { value: [] },
    currentModel: { value: '' },
    connect: vi.fn(),
    sendMessage: vi.fn()
  }))
}))

vi.mock('@/services/siliconflow', () => ({
  useSiliconFlow: vi.fn(() => ({
    isConnected: { value: false },
    isConnecting: { value: false },
    availableModels: { value: [] },
    currentModel: { value: '' },
    error: { value: null },
    connect: vi.fn(),
    testConnection: vi.fn(),
    sendMessage: vi.fn()
  }))
}))

vi.mock('@/services/trendradar', () => ({
  useTrendRadar: vi.fn(() => ({
    isConnected: { value: false },
    setupTrendRadar: vi.fn(),
    client: { value: null }
  }))
}))

describe('useRobotChat', () => {
  let robotChat: ReturnType<typeof useRobotChat>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    robotChat = useRobotChat()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      expect(robotChat.aiProvider.value).toBe('openclaw')
      expect(robotChat.messageList.value).toEqual([])
      expect(robotChat.loadingMessages.value).toBe(false)
      expect(robotChat.selectedModel.value).toBeNull()
      expect(robotChat.selectedRole.value).toBeNull()
    })

    it('currentChat 应该有默认值', () => {
      expect(robotChat.currentChat.value).toEqual({
        id: '0',
        title: '',
        messageCount: 0,
        createTime: 0
      })
    })
  })

  describe('消息管理', () => {
    it('addMessage 应该添加消息到列表', () => {
      const message: Message = {
        type: 'user',
        content: '测试消息'
      }
      robotChat.addMessage(message)
      expect(robotChat.messageList.value).toHaveLength(1)
      expect(robotChat.messageList.value[0].content).toBe('测试消息')
    })

    it('消息超过最大数量时应该移除最早的消息', () => {
      for (let i = 0; i < 45; i++) {
        robotChat.addMessage({ type: 'user', content: `消息 ${i}` })
      }
      expect(robotChat.messageList.value.length).toBeLessThanOrEqual(40)
    })

    it('updateMessage 应该更新指定索引的消息', () => {
      robotChat.addMessage({ type: 'user', content: '原始消息' })
      robotChat.updateMessage(0, { content: '更新后的消息' })
      expect(robotChat.messageList.value[0].content).toBe('更新后的消息')
    })

    it('clearMessages 应该清空消息列表', () => {
      robotChat.addMessage({ type: 'user', content: '消息1' })
      robotChat.addMessage({ type: 'assistant', content: '消息2' })
      robotChat.clearMessages()
      expect(robotChat.messageList.value).toHaveLength(0)
    })
  })

  describe('会话管理', () => {
    it('setCurrentChat 应该更新当前会话', () => {
      const chat = {
        id: 'test-chat-id',
        title: '测试会话',
        messageCount: 10,
        createTime: Date.now()
      }
      robotChat.setCurrentChat(chat)
      expect(robotChat.currentChat.value.id).toBe('test-chat-id')
      expect(robotChat.currentChat.value.title).toBe('测试会话')
    })
  })

  describe('模型和角色选择', () => {
    it('selectModel 应该设置选中的模型', async () => {
      const model: ModelInfo = {
        id: 'model-1',
        name: 'GPT-4',
        status: 0,
        type: 1
      }
      await robotChat.selectModel(model)
      expect(robotChat.selectedModel.value?.id).toBe('model-1')
      expect(robotChat.selectedModel.value?.name).toBe('GPT-4')
    })

    it('selectRole 应该设置选中的角色', () => {
      const role: RoleInfo = {
        id: 'role-1',
        name: '助手',
        status: 0
      }
      robotChat.selectRole(role)
      expect(robotChat.selectedRole.value?.id).toBe('role-1')
    })

    it('selectRole 传入 null 应该清除选中的角色', () => {
      robotChat.selectRole({ id: 'role-1', name: '助手', status: 0 })
      robotChat.selectRole(null)
      expect(robotChat.selectedRole.value).toBeNull()
    })
  })

  describe('AI Provider 管理', () => {
    it('handleProviderChange 应该更新 aiProvider', () => {
      robotChat.handleProviderChange('hula')
      expect(robotChat.aiProvider.value).toBe('hula')
    })

    it('handleProviderChange 应该保存到 localStorage', () => {
      robotChat.handleProviderChange('siliconflow')
      expect(localStorage.getItem('hula-chat-ai-provider')).toBe('siliconflow')
    })
  })

  describe('Token 计算', () => {
    it('conversationTokens 应该正确计算总 token', () => {
      robotChat.addMessage({ type: 'user', content: 'Hello world' })
      robotChat.addMessage({ type: 'assistant', content: 'Hi there' })
      expect(robotChat.conversationTokens.value).toBeGreaterThan(0)
    })
  })

  describe('推理支持检测', () => {
    it('supportsReasoning 应该对 DeepSeek R 模型返回 true', () => {
      robotChat.selectedModel.value = {
        id: 'ds-r1',
        name: 'DeepSeek R1',
        status: 0,
        type: 1
      }
      expect(robotChat.supportsReasoning.value).toBe(true)
    })

    it('supportsReasoning 应该对普通模型返回 false', () => {
      robotChat.selectedModel.value = {
        id: 'gpt-4',
        name: 'GPT-4',
        status: 0,
        type: 1
      }
      expect(robotChat.supportsReasoning.value).toBe(false)
    })
  })

  describe('消息气泡类名', () => {
    it('用户消息应该有 bubble-user 类', () => {
      const classes = robotChat.getMessageBubbleClass({ type: 'user', content: 'test' })
      expect(classes).toContain('bubble')
      expect(classes).toContain('bubble-user')
    })

    it('助手消息应该有 bubble-ai 类', () => {
      const classes = robotChat.getMessageBubbleClass({ type: 'assistant', content: 'test' })
      expect(classes).toContain('bubble')
      expect(classes).toContain('bubble-ai')
    })
  })

  describe('媒体 URL 检测', () => {
    it('isLikelyMediaUrl 应该正确检测 HTTP URL', () => {
      expect(robotChat.isLikelyMediaUrl('http://example.com/image.png')).toBe(true)
      expect(robotChat.isLikelyMediaUrl('https://example.com/video.mp4')).toBe(true)
    })

    it('isLikelyMediaUrl 应该正确检测 asset URL', () => {
      expect(robotChat.isLikelyMediaUrl('asset://localhost/file.png')).toBe(true)
    })

    it('isLikelyMediaUrl 应该对非 URL 返回 false', () => {
      expect(robotChat.isLikelyMediaUrl('这是一段文字')).toBe(false)
      expect(robotChat.isLikelyMediaUrl('')).toBe(false)
    })
  })

  describe('AI 图片渲染检测', () => {
    it('isRenderableAiImage 应该对可渲染图片返回 true', () => {
      const message: Message = {
        type: 'assistant',
        content: 'http://example.com/image.png'
      }
      expect(robotChat.isRenderableAiImage(message)).toBe(true)
    })

    it('isRenderableAiImage 应该对非 URL 内容返回 false', () => {
      const message: Message = {
        type: 'assistant',
        content: '这是一段文字'
      }
      expect(robotChat.isRenderableAiImage(message)).toBe(false)
    })
  })

  describe('占位文本', () => {
    it('生成中的消息应该显示"生成中..."', () => {
      const message: Message = {
        type: 'assistant',
        content: '',
        isGenerating: true
      }
      expect(robotChat.getAiPlaceholderText(message)).toBe('生成中...')
    })

    it('空内容应该显示"内容加载失败"', () => {
      const message: Message = {
        type: 'assistant',
        content: ''
      }
      expect(robotChat.getAiPlaceholderText(message)).toBe('内容加载失败')
    })
  })

  describe('头像获取', () => {
    it('getDefaultAvatar 应该返回默认头像路径', () => {
      expect(robotChat.getDefaultAvatar()).toBe('/logoD.png')
    })

    it('getModelAvatar 有头像时应该返回模型头像', () => {
      const model: ModelInfo = {
        id: 'model-1',
        name: 'Test',
        status: 0,
        type: 1,
        avatar: 'custom-avatar.png'
      }
      expect(robotChat.getModelAvatar(model)).toBe('custom-avatar.png')
    })

    it('getModelAvatar 无头像时应该返回默认头像', () => {
      expect(robotChat.getModelAvatar(null)).toBe('/logoD.png')
    })
  })

  describe('剩余使用次数显示', () => {
    it('remainingUsageDisplay 应该正确显示次数', () => {
      robotChat.remainingUsage.value = 50
      expect(robotChat.remainingUsageDisplay.value).toBe('50')
    })

    it('remainingUsageDisplay 无限次数应该显示"无限"', () => {
      robotChat.remainingUsage.value = -1
      expect(robotChat.remainingUsageDisplay.value).toBe('无限')
    })

    it('remainingUsageTagType 应该返回正确的标签类型', () => {
      robotChat.remainingUsage.value = -1
      expect(robotChat.remainingUsageTagType.value).toBe('success')

      robotChat.remainingUsage.value = 50
      expect(robotChat.remainingUsageTagType.value).toBe('info')

      robotChat.remainingUsage.value = 0
      expect(robotChat.remainingUsageTagType.value).toBe('error')
    })
  })
})
