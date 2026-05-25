import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useOpenClawConversationStore } from './openClawConversation'

const STORE_ID = 'robotChatSettings'

export const useRobotChatSettingsStore = defineStore(
  STORE_ID,
  () => {
    // --- State ---
    const sendKey = ref<'Enter' | 'Ctrl+Enter' | 'Cmd+Enter'>('Enter')
    const theme = ref<'light' | 'dark' | 'auto'>('auto')
    const fontSize = ref(14)
    const autoGenerateTitle = ref(true)
    const showStartPage = ref(true)
    const hideBuiltinIdentity = ref(false)
    const disablePromptAutocomplete = ref(false)
    const modelProvider = ref('hula')
    const apiEndpoint = ref('')
    const apiKey = ref('')
    const selectedModel = ref('')
    const randomness = ref(5)
    const topP = ref(5)
    const maxTokens = ref(4000)
    const presencePenalty = ref(5)
    const frequencyPenalty = ref(5)
    const injectSystemPrompt = ref(false)
    const userInputPreprocess = ref('')
    const historyMessageCount = ref(5)
    const historyCompressThreshold = ref(1000)
    const historySummary = ref(true)

    // --- Actions ---
    const resetAllSettings = () => {
      sendKey.value = 'Enter'
      theme.value = 'auto'
      fontSize.value = 14
      autoGenerateTitle.value = true
      showStartPage.value = true
      hideBuiltinIdentity.value = false
      disablePromptAutocomplete.value = false
      modelProvider.value = 'hula'
      apiEndpoint.value = ''
      apiKey.value = ''
      selectedModel.value = ''
      randomness.value = 5
      topP.value = 5
      maxTokens.value = 4000
      presencePenalty.value = 5
      frequencyPenalty.value = 5
      injectSystemPrompt.value = false
      userInputPreprocess.value = ''
      historyMessageCount.value = 5
      historyCompressThreshold.value = 1000
      historySummary.value = true
    }

    const clearAllData = () => {
      resetAllSettings()
      const openClawConversation = useOpenClawConversationStore()
      openClawConversation.handleDeleteAllConversations()
    }

    return {
      // State
      sendKey,
      theme,
      fontSize,
      autoGenerateTitle,
      showStartPage,
      hideBuiltinIdentity,
      disablePromptAutocomplete,
      modelProvider,
      apiEndpoint,
      apiKey,
      selectedModel,
      randomness,
      topP,
      maxTokens,
      presencePenalty,
      frequencyPenalty,
      injectSystemPrompt,
      userInputPreprocess,
      historyMessageCount,
      historyCompressThreshold,
      historySummary,

      // Actions
      resetAllSettings,
      clearAllData
    }
  },
  {
    persist: {
      key: 'robotChatSettings',
      pick: [
        'sendKey',
        'theme',
        'fontSize',
        'autoGenerateTitle',
        'showStartPage',
        'hideBuiltinIdentity',
        'disablePromptAutocomplete',
        'modelProvider',
        'apiEndpoint',
        'apiKey',
        'selectedModel',
        'randomness',
        'topP',
        'maxTokens',
        'presencePenalty',
        'frequencyPenalty',
        'injectSystemPrompt',
        'userInputPreprocess',
        'historyMessageCount',
        'historyCompressThreshold',
        'historySummary'
      ]
    }
  }
)
