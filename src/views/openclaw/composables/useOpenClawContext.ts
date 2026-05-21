import type { Component, InjectionKey } from 'vue'
import { inject, provide } from 'vue'
import type { OpenClawInstallStatus } from '@/services/openclaw'
import type { OpenClawConfig, OpenClawConversation, OpenClawPresetOption, OpenClawPresetState } from '../types'

export interface SearchMatch {
  messageId: string
  messageIndex: number
}

export interface OpenClawWorkbenchContext {
  // Connection state
  isConnected: boolean
  isLoading: boolean
  connectionState: { state: string; lastError?: string | null }
  connectionStateText: string

  // Conversation state
  conversations: OpenClawConversation[]
  activeConversationId: string
  currentConversation: OpenClawConversation | null
  inputMessage: string
  isSending: boolean
  expandedReasoningIds: string[]

  // Config state
  openClawConfig: OpenClawConfig
  selectedModelId: string
  availableModels: string[]

  // Install state
  installStatus: OpenClawInstallStatus | null
  installStatusLoading: boolean
  installingOpenClaw: boolean
  installErrorMessage: string
  installLogs: string[]

  // Computed
  canSend: boolean
  resolvedErrorMessage: string

  // Presets
  temperaturePresets: OpenClawPresetOption[]
  maxTokensPresets: OpenClawPresetOption[]
  currentTemperaturePreset: OpenClawPresetState
  currentMaxTokensPreset: OpenClawPresetState

  // Markdown rendering
  markdownRender: Component | null
  markdownCustomId: string
  markdownThemes: string[]
  markdownCodeBlockProps: { showCopyButton: boolean; showExpandButton: boolean; showHeader: boolean }

  // Theme
  isDarkTheme: boolean

  // UI state
  copiedMessageId: string
  editingConversationId: string
  editingTitle: string

  // Search state
  searchQuery: string
  searchMatches: SearchMatch[]
  currentMatchIndex: number
  isSearchOpen: boolean

  // Translate helper
  translate: (key: string, params?: Record<string, unknown>) => string
  formatTime: (timestamp: number) => string
  getPreview: (conversation: OpenClawConversation) => string

  // Actions
  handleConnect: () => void
  handleDisconnect: () => void
  handleSend: (onSuccess?: () => void) => void
  handleStopGeneration: () => void
  handleRegenerate: (messageId: string, onStart?: () => void) => void
  handleCreateConversation: () => void
  handleDeleteConversation: (id: string) => void
  handleDeleteAllConversations: () => void
  updateCurrentConversation: (updater: (conversation: OpenClawConversation) => void) => void
  toggleReasoning: (messageId: string) => void
  loadInstallStatus: () => void
  handleInstallOpenClaw: () => void
  persistConnectionConfig: () => void
  handleCopyMessage: (content: string, id: string) => void
  handleRenameConversation: (id: string, title: string) => void
  submitRename: () => void
  cancelRename: () => void
  handleSelectConversation: (id: string) => void
  handleQuickPrompt: (prompt: string) => void
  handleSelectTemperaturePreset: (value: number) => void
  handleSelectMaxTokensPreset: (value: number) => void
  handlePersistConfig: () => void
  handleRestoreDefaultGenerationSettings: () => void
  focusConfigSection: () => void
  scrollToBottom: () => void
  openInstallDocs: () => void
}

export const OPENCLAW_WORKBENCH_KEY: InjectionKey<OpenClawWorkbenchContext> = Symbol('openclaw-workbench')

export function provideOpenClawContext(context: OpenClawWorkbenchContext) {
  provide(OPENCLAW_WORKBENCH_KEY, context)
}

export function useOpenClawContext(): OpenClawWorkbenchContext {
  const context = inject(OPENCLAW_WORKBENCH_KEY)
  if (!context) {
    throw new Error(
      'OpenClawWorkbenchContext not provided. Make sure to call provideOpenClawContext in the parent component.'
    )
  }
  return context
}
