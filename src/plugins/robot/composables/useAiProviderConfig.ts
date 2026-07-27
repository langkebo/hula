import { ref, watch } from 'vue'
import { useSiliconFlow } from '@/services/siliconflow'
import { useTrendRadar } from '@/services/trendradar'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiProviderConfig')

export type AIProvider = 'hula' | 'siliconflow' | 'trendradar'

const STORAGE_KEYS = {
  AI_PROVIDER: 'hula-chat-ai-provider',
  TRENDRADAR_CONFIG: 'hula-chat-trendradar-config'
}

interface UseAiProviderConfigOptions {
  fetchModelList: () => Promise<void>
  modelList: { value: unknown[] }
}

export const useAiProviderConfig = (options: UseAiProviderConfigOptions) => {
  const { fetchModelList, modelList } = options

  const aiProvider = ref<AIProvider>('hula')

  const siliconFlowConfig = ref({
    apiKey: '',
    baseUrl: 'https://api.siliconflow.cn',
    model: 'deepseek-ai/DeepSeek-V3'
  })

  const trendRadarConfig = ref({
    apiUrl: 'http://127.0.0.1:3333/mcp',
    apiKey: ''
  })

  const {
    isConnected: isSiliconFlowConnected,
    isConnecting: isSiliconFlowConnecting,
    availableModels: siliconFlowModels,
    currentModel: siliconFlowCurrentModel,
    error: siliconFlowError,
    connect: connectSiliconFlow,
    testConnection: testSiliconFlow,
    sendMessage: sendSiliconFlowMessage
  } = useSiliconFlow()

  const { isConnected: isTrendRadarConnected, setupTrendRadar, client: trendRadarClient } = useTrendRadar()

  const loadSavedConfig = () => {
    try {
      const savedProvider = localStorage.getItem(STORAGE_KEYS.AI_PROVIDER)
      if (savedProvider && ['hula', 'siliconflow', 'trendradar'].includes(savedProvider)) {
        aiProvider.value = savedProvider as AIProvider
      }

      const savedTrendRadarConfig = localStorage.getItem(STORAGE_KEYS.TRENDRADAR_CONFIG)
      if (savedTrendRadarConfig) {
        const parsed = JSON.parse(savedTrendRadarConfig)
        if (parsed.apiUrl) trendRadarConfig.value.apiUrl = parsed.apiUrl
      }
    } catch (e) {
      logger.error('加载保存的配置失败:', e)
    }
  }

  const saveAiProvider = (provider: AIProvider) => {
    localStorage.setItem(STORAGE_KEYS.AI_PROVIDER, provider)
  }

  const saveTrendRadarConfig = () => {
    localStorage.setItem(STORAGE_KEYS.TRENDRADAR_CONFIG, JSON.stringify(trendRadarConfig.value))
  }

  watch(trendRadarConfig, saveTrendRadarConfig, { deep: true })

  const handleProviderChange = async (provider: AIProvider) => {
    saveAiProvider(provider)

    if (provider === 'trendradar') {
      logger.debug('TrendRadar 模式，apiUrl:', trendRadarConfig.value.apiUrl)
    } else {
      if (modelList.value.length === 0) {
        await fetchModelList()
      }
    }
  }

  return {
    aiProvider,
    siliconFlowConfig,
    trendRadarConfig,
    isSiliconFlowConnected,
    isSiliconFlowConnecting,
    siliconFlowModels,
    siliconFlowCurrentModel,
    siliconFlowError,
    connectSiliconFlow,
    testSiliconFlow,
    sendSiliconFlowMessage,
    isTrendRadarConnected,
    setupTrendRadar,
    trendRadarClient,
    loadSavedConfig,
    handleProviderChange
  }
}
