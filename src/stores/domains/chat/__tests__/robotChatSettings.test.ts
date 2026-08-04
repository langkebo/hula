import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock 依赖的 openClawConversation store
const { handleDeleteAllConversationsMock } = vi.hoisted(() => ({
  handleDeleteAllConversationsMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('../openClawConversation', () => ({
  useOpenClawConversationStore: () => ({
    handleDeleteAllConversations: handleDeleteAllConversationsMock
  })
}))

import { useRobotChatSettingsStore } from '../robotChatSettings'

describe('useRobotChatSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    handleDeleteAllConversationsMock.mockClear().mockResolvedValue(undefined)
  })

  describe('初始状态', () => {
    it('所有默认值正确', () => {
      const store = useRobotChatSettingsStore()
      expect(store.sendKey).toBe('Enter')
      expect(store.theme).toBe('auto')
      expect(store.fontSize).toBe(14)
      expect(store.autoGenerateTitle).toBe(true)
      expect(store.showStartPage).toBe(true)
      expect(store.hideBuiltinIdentity).toBe(false)
      expect(store.disablePromptAutocomplete).toBe(false)
      expect(store.modelProvider).toBe('tjg')
      expect(store.apiEndpoint).toBe('')
      expect(store.apiKey).toBe('')
      expect(store.selectedModel).toBe('')
      expect(store.randomness).toBe(5)
      expect(store.topP).toBe(5)
      expect(store.maxTokens).toBe(4000)
      expect(store.presencePenalty).toBe(5)
      expect(store.frequencyPenalty).toBe(5)
      expect(store.injectSystemPrompt).toBe(false)
      expect(store.userInputPreprocess).toBe('')
      expect(store.historyMessageCount).toBe(5)
      expect(store.historyCompressThreshold).toBe(1000)
      expect(store.historySummary).toBe(true)
    })
  })

  describe('状态可修改', () => {
    it('sendKey 可修改为 Ctrl+Enter', () => {
      const store = useRobotChatSettingsStore()
      store.sendKey = 'Ctrl+Enter'
      expect(store.sendKey).toBe('Ctrl+Enter')
    })

    it('theme 可修改为 dark', () => {
      const store = useRobotChatSettingsStore()
      store.theme = 'dark'
      expect(store.theme).toBe('dark')
    })

    it('fontSize 可修改', () => {
      const store = useRobotChatSettingsStore()
      store.fontSize = 18
      expect(store.fontSize).toBe(18)
    })

    it('modelProvider 可修改为 openclaw', () => {
      const store = useRobotChatSettingsStore()
      store.modelProvider = 'openclaw'
      expect(store.modelProvider).toBe('openclaw')
    })

    it('apiKey 可修改', () => {
      const store = useRobotChatSettingsStore()
      store.apiKey = 'sk-xxx'
      expect(store.apiKey).toBe('sk-xxx')
    })

    it('selectedModel 可修改', () => {
      const store = useRobotChatSettingsStore()
      store.selectedModel = 'gpt-4'
      expect(store.selectedModel).toBe('gpt-4')
    })

    it('randomness 可修改', () => {
      const store = useRobotChatSettingsStore()
      store.randomness = 8
      expect(store.randomness).toBe(8)
    })

    it('maxTokens 可修改', () => {
      const store = useRobotChatSettingsStore()
      store.maxTokens = 8000
      expect(store.maxTokens).toBe(8000)
    })

    it('injectSystemPrompt 可修改', () => {
      const store = useRobotChatSettingsStore()
      store.injectSystemPrompt = true
      expect(store.injectSystemPrompt).toBe(true)
    })

    it('historyMessageCount 可修改', () => {
      const store = useRobotChatSettingsStore()
      store.historyMessageCount = 10
      expect(store.historyMessageCount).toBe(10)
    })

    it('historySummary 可修改为 false', () => {
      const store = useRobotChatSettingsStore()
      store.historySummary = false
      expect(store.historySummary).toBe(false)
    })
  })

  describe('resetAllSettings', () => {
    it('将所有设置重置为默认值', () => {
      const store = useRobotChatSettingsStore()
      // 修改多个值
      store.sendKey = 'Ctrl+Enter'
      store.theme = 'dark'
      store.fontSize = 20
      store.autoGenerateTitle = false
      store.showStartPage = false
      store.hideBuiltinIdentity = true
      store.disablePromptAutocomplete = true
      store.modelProvider = 'openclaw'
      store.apiEndpoint = 'http://x'
      store.apiKey = 'key'
      store.selectedModel = 'gpt-4'
      store.randomness = 9
      store.topP = 9
      store.maxTokens = 9999
      store.presencePenalty = 9
      store.frequencyPenalty = 9
      store.injectSystemPrompt = true
      store.userInputPreprocess = 'preprocess'
      store.historyMessageCount = 99
      store.historyCompressThreshold = 9999
      store.historySummary = false

      store.resetAllSettings()

      // 验证全部恢复默认
      expect(store.sendKey).toBe('Enter')
      expect(store.theme).toBe('auto')
      expect(store.fontSize).toBe(14)
      expect(store.autoGenerateTitle).toBe(true)
      expect(store.showStartPage).toBe(true)
      expect(store.hideBuiltinIdentity).toBe(false)
      expect(store.disablePromptAutocomplete).toBe(false)
      expect(store.modelProvider).toBe('tjg')
      expect(store.apiEndpoint).toBe('')
      expect(store.apiKey).toBe('')
      expect(store.selectedModel).toBe('')
      expect(store.randomness).toBe(5)
      expect(store.topP).toBe(5)
      expect(store.maxTokens).toBe(4000)
      expect(store.presencePenalty).toBe(5)
      expect(store.frequencyPenalty).toBe(5)
      expect(store.injectSystemPrompt).toBe(false)
      expect(store.userInputPreprocess).toBe('')
      expect(store.historyMessageCount).toBe(5)
      expect(store.historyCompressThreshold).toBe(1000)
      expect(store.historySummary).toBe(true)
    })

    it('多次调用 resetAllSettings 安全', () => {
      const store = useRobotChatSettingsStore()
      store.fontSize = 20
      store.resetAllSettings()
      store.resetAllSettings()
      expect(store.fontSize).toBe(14)
    })
  })

  describe('clearAllData', () => {
    it('调用 resetAllSettings 并清空 openClawConversation', () => {
      const store = useRobotChatSettingsStore()
      store.apiKey = 'sk-test'
      store.fontSize = 18

      store.clearAllData()

      expect(store.apiKey).toBe('')
      expect(store.fontSize).toBe(14)
      expect(handleDeleteAllConversationsMock).toHaveBeenCalledTimes(1)
    })

    it('不传 confirmCallback 时仍调用 handleDeleteAllConversations', () => {
      const store = useRobotChatSettingsStore()
      store.clearAllData()
      expect(handleDeleteAllConversationsMock).toHaveBeenCalled()
    })
  })
})
