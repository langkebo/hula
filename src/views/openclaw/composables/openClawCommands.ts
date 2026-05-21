import type { OpenClawConversation } from '../types'

export type OpenClawFeedbackType = 'success' | 'warning' | 'error' | 'info'

export interface OpenClawCommandContext {
  translate: (key: string, params?: Record<string, unknown>) => string
  showFeedback: (message: string, type?: OpenClawFeedbackType) => void
  getCurrentConversation: () => OpenClawConversation | null
  updateCurrentConversation: (updater: (conversation: OpenClawConversation) => void) => void
  getAvailableModels: () => string[]
  getSelectedModelId: () => string
  setSelectedModelId: (modelId: string) => void
  isSending: () => boolean
  handleStopGeneration: () => void
  handleCreateConversation?: () => void
  openSearch?: () => void
  focusConfigSection?: () => void
}

export interface OpenClawCommandAction {
  id: string
  label: string
  description: string
  keywords?: string[]
  execute: () => void
}

type ParsedSlashCommand = {
  name: string
  args: string
}

const MODEL_LIST_LIMIT = 6

export function parseOpenClawSlashCommand(input: string): ParsedSlashCommand | null {
  const normalized = input.trim()
  if (!normalized.startsWith('/')) {
    return null
  }

  const [commandWithSlash, ...restParts] = normalized.split(/\s+/)
  const name = commandWithSlash.slice(1).toLowerCase()
  if (!name) {
    return null
  }

  return {
    name,
    args: restParts.join(' ').trim()
  }
}

function switchModel(modelId: string, context: OpenClawCommandContext) {
  context.setSelectedModelId(modelId)
  context.showFeedback(
    context.translate('ai_assistant.robot.slash_command_model_switched', { model: modelId }),
    'success'
  )
}

function handleModelCommand(args: string, context: OpenClawCommandContext): boolean {
  const models = context.getAvailableModels()
  if (!models.length) {
    context.showFeedback(context.translate('ai_assistant.robot.slash_command_no_models'), 'warning')
    return true
  }

  if (!args) {
    const currentIndex = models.indexOf(context.getSelectedModelId())
    const nextIndex = (currentIndex + 1 + models.length) % models.length
    switchModel(models[nextIndex], context)
    return true
  }

  if (args === 'list') {
    context.showFeedback(
      context.translate('ai_assistant.robot.slash_command_model_list', {
        models: models.slice(0, MODEL_LIST_LIMIT).join(', ')
      }),
      'info'
    )
    return true
  }

  const exactMatch = models.find((model) => model.toLowerCase() === args.toLowerCase())
  if (exactMatch) {
    switchModel(exactMatch, context)
    return true
  }

  const fuzzyMatch = models.find((model) => model.toLowerCase().includes(args.toLowerCase()))
  if (fuzzyMatch) {
    switchModel(fuzzyMatch, context)
    return true
  }

  context.showFeedback(context.translate('ai_assistant.robot.slash_command_model_not_found', { name: args }), 'warning')
  return true
}

export function executeOpenClawSlashCommand(input: string, context: OpenClawCommandContext): boolean {
  const parsed = parseOpenClawSlashCommand(input)
  if (!parsed) {
    return false
  }

  switch (parsed.name) {
    case 'stop':
      if (!context.isSending()) {
        context.showFeedback(context.translate('ai_assistant.robot.slash_command_no_generation'), 'warning')
        return true
      }
      context.handleStopGeneration()
      context.showFeedback(context.translate('ai_assistant.robot.openclaw_stop_generation'), 'success')
      return true
    case 'clear': {
      const conversation = context.getCurrentConversation()
      if (!conversation) {
        context.showFeedback(context.translate('ai_assistant.robot.slash_command_no_conversation'), 'warning')
        return true
      }
      context.updateCurrentConversation((current) => {
        current.messages = []
      })
      context.showFeedback(context.translate('ai_assistant.robot.slash_command_clear_done'), 'success')
      return true
    }
    case 'model':
      return handleModelCommand(parsed.args, context)
    default:
      return false
  }
}

export function buildOpenClawSlashCommands(context: OpenClawCommandContext): OpenClawCommandAction[] {
  return [
    {
      id: 'stop',
      label: '/stop',
      description: context.translate('ai_assistant.robot.slash_command_stop'),
      keywords: ['cancel', 'abort'],
      execute: () => {
        void executeOpenClawSlashCommand('/stop', context)
      }
    },
    {
      id: 'clear',
      label: '/clear',
      description: context.translate('ai_assistant.robot.slash_command_clear'),
      keywords: ['reset', 'messages'],
      execute: () => {
        void executeOpenClawSlashCommand('/clear', context)
      }
    },
    {
      id: 'model',
      label: '/model',
      description: context.translate('ai_assistant.robot.slash_command_model'),
      keywords: ['switch', 'llm'],
      execute: () => {
        void executeOpenClawSlashCommand('/model', context)
      }
    }
  ]
}

export function buildOpenClawPaletteCommands(context: OpenClawCommandContext): OpenClawCommandAction[] {
  const baseCommands: OpenClawCommandAction[] = [
    {
      id: 'new-chat',
      label: context.translate('ai_assistant.robot.palette_new_chat'),
      description: context.translate('ai_assistant.robot.palette_new_chat_desc'),
      keywords: ['conversation', 'new'],
      execute: () => {
        context.handleCreateConversation?.()
      }
    },
    {
      id: 'search-messages',
      label: context.translate('ai_assistant.robot.palette_search_messages'),
      description: context.translate('ai_assistant.robot.palette_search_messages_desc'),
      keywords: ['find', 'search'],
      execute: () => {
        context.openSearch?.()
      }
    },
    {
      id: 'open-settings',
      label: context.translate('ai_assistant.robot.palette_open_settings'),
      description: context.translate('ai_assistant.robot.palette_open_settings_desc'),
      keywords: ['config', 'settings'],
      execute: () => {
        context.focusConfigSection?.()
      }
    },
    ...buildOpenClawSlashCommands(context)
  ]

  const modelCommands = context.getAvailableModels().map<OpenClawCommandAction>((modelId) => ({
    id: `model:${modelId}`,
    label: context.translate('ai_assistant.robot.palette_switch_model', { model: modelId }),
    description:
      context.getSelectedModelId() === modelId
        ? context.translate('ai_assistant.robot.palette_current_model_desc')
        : context.translate('ai_assistant.robot.palette_switch_model_desc'),
    keywords: ['model', modelId],
    execute: () => {
      switchModel(modelId, context)
    }
  }))

  return [...baseCommands, ...modelCommands]
}
