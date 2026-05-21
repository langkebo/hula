import { describe, expect, it, vi } from 'vitest'
import {
  buildOpenClawPaletteCommands,
  executeOpenClawSlashCommand,
  parseOpenClawSlashCommand
} from '../openClawCommands'

function createCommandContext() {
  const conversation = {
    id: 'conv-1',
    title: 'Test',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [{ id: 'm1', role: 'user' as const, content: 'hello', createdAt: Date.now() }]
  }
  const feedback = vi.fn()
  const stopGeneration = vi.fn()
  const createConversation = vi.fn()
  const openSearch = vi.fn()
  const focusConfigSection = vi.fn()
  let selectedModelId = 'gpt-4o-mini'

  return {
    context: {
      translate: (key: string) => key,
      showFeedback: feedback,
      getCurrentConversation: () => conversation,
      updateCurrentConversation: (updater: (value: typeof conversation) => void) => updater(conversation),
      getAvailableModels: () => ['gpt-4o-mini', 'deepseek-r1', 'claude-sonnet'],
      getSelectedModelId: () => selectedModelId,
      setSelectedModelId: (modelId: string) => {
        selectedModelId = modelId
      },
      isSending: () => true,
      handleStopGeneration: stopGeneration,
      handleCreateConversation: createConversation,
      openSearch,
      focusConfigSection
    },
    feedback,
    stopGeneration,
    createConversation,
    openSearch,
    focusConfigSection,
    getSelectedModelId: () => selectedModelId,
    conversation
  }
}

describe('openClawCommands', () => {
  it('parses slash command name and args', () => {
    expect(parseOpenClawSlashCommand('/model deepseek')).toEqual({
      name: 'model',
      args: 'deepseek'
    })
  })

  it('executes /clear and empties current conversation', () => {
    const { context, conversation, feedback } = createCommandContext()

    const handled = executeOpenClawSlashCommand('/clear', context)

    expect(handled).toBe(true)
    expect(conversation.messages).toEqual([])
    expect(feedback).toHaveBeenCalled()
  })

  it('executes /model <name> with fuzzy match', () => {
    const { context, getSelectedModelId, feedback } = createCommandContext()

    const handled = executeOpenClawSlashCommand('/model deepseek', context)

    expect(handled).toBe(true)
    expect(getSelectedModelId()).toBe('deepseek-r1')
    expect(feedback).toHaveBeenCalledWith('已切换模型：deepseek-r1', 'success')
  })

  it('builds command palette entries for actions and models', () => {
    const { context, createConversation, openSearch, focusConfigSection } = createCommandContext()

    const commands = buildOpenClawPaletteCommands(context)

    expect(commands.some((command) => command.id === 'new-chat')).toBe(true)
    expect(commands.some((command) => command.id === 'search-messages')).toBe(true)
    expect(commands.some((command) => command.id === 'open-settings')).toBe(true)
    expect(commands.some((command) => command.id === 'model:claude-sonnet')).toBe(true)

    commands.find((command) => command.id === 'new-chat')?.execute()
    commands.find((command) => command.id === 'search-messages')?.execute()
    commands.find((command) => command.id === 'open-settings')?.execute()

    expect(createConversation).toHaveBeenCalled()
    expect(openSearch).toHaveBeenCalled()
    expect(focusConfigSection).toHaveBeenCalled()
  })

  it('executes /stop only when generation is active', () => {
    const { context, stopGeneration } = createCommandContext()

    const handled = executeOpenClawSlashCommand('/stop', context)

    expect(handled).toBe(true)
    expect(stopGeneration).toHaveBeenCalled()
  })
})
