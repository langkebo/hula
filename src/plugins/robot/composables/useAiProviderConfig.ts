import { ref, watch } from 'vue'
import { useOpenClaw } from '@/services/openclaw'
import { useSiliconFlow } from '@/services/siliconflow'
import { useTrendRadar } from '@/services/trendradar'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiProviderConfig')

export type AIProvider = 'hula' | 'openclaw' | 'siliconflow' | 'trendradar'

const STORAGE_KEYS = {
  AI_PROVIDER: 'hula-chat-ai-provider',
  OPENCLAW_CONFIG: 'hula-chat-openclaw-config',
  TRENDRADAR_CONFIG: 'hula-chat-trendradar-config'
}

export interface UseAiProviderConfigOptions {
  fetchModelList: () => Promise<void>
  modelList: { value: unknown[] }
}

export const useAiProviderConfig = (options: UseAiProviderConfigOptions) => {
  const { fetchModelList, modelList } = options

  const aiProvider = ref<AIProvider>('openclaw')

  const openClawConfig = ref({
    gatewayUrl: 'http://127.0.0.1:18789',
    token:
      'sk-cp-l46Ur27NFasi28UCTJLIiehkD9PHSnpPCa6adzL40tN5A_TKnBjfY4ENtj3w45PSUilSQZofIMKKHObkVZXuPQz0JWzvABt19QXq6j5XMiXf3fvNzkyrIAM'
  })

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
    isConnected: isOpenClawConnected,
    availableModels: openClawModels,
    currentModel: openClawCurrentModel,
    connect: connectOpenClaw,
    sendMessage: sendOpenClawMessage
  } = useOpenClaw()

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
      if (savedProvider && ['hula', 'openclaw', 'siliconflow', 'trendradar'].includes(savedProvider)) {
        aiProvider.value = savedProvider as AIProvider
      }

      const savedOpenClawConfig = localStorage.getItem(STORAGE_KEYS.OPENCLAW_CONFIG)
      if (savedOpenClawConfig) {
        const parsed = JSON.parse(savedOpenClawConfig)
        if (parsed.gatewayUrl) openClawConfig.value.gatewayUrl = parsed.gatewayUrl
        if (parsed.token) openClawConfig.value.token = parsed.token
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

  const saveOpenClawConfig = () => {
    localStorage.setItem(STORAGE_KEYS.OPENCLAW_CONFIG, JSON.stringify(openClawConfig.value))
  }

  const saveTrendRadarConfig = () => {
    localStorage.setItem(STORAGE_KEYS.TRENDRADAR_CONFIG, JSON.stringify(trendRadarConfig.value))
  }

  watch(openClawConfig, saveOpenClawConfig, { deep: true })
  watch(trendRadarConfig, saveTrendRadarConfig, { deep: true })

  const handleProviderChange = async (provider: AIProvider) => {
    saveAiProvider(provider)

    if (provider === 'openclaw') {
      if (!isOpenClawConnected.value) {
        try {
          await connectOpenClaw({
            gatewayUrl: openClawConfig.value.gatewayUrl,
            token: openClawConfig.value.token
          })
        } catch (e) {
          logger.error('OpenClaw 连接失败:', e)
          window.$message.error('OpenClaw 连接失败，请确保 Gateway 已启动')
        }
      }
    } else if (provider === 'trendradar') {
      logger.debug('TrendRadar 模式，apiUrl:', trendRadarConfig.value.apiUrl)
    } else {
      if (modelList.value.length === 0) {
        await fetchModelList()
      }
    }
  }

  return {
    aiProvider,
    openClawConfig,
    siliconFlowConfig,
    trendRadarConfig,
    isOpenClawConnected,
    openClawModels,
    openClawCurrentModel,
    connectOpenClaw,
    sendOpenClawMessage,
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
