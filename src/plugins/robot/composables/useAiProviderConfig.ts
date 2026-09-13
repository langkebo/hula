import { ref, watch } from 'vue'
import { useSiliconFlow } from '@/services/siliconflow'
import { useTrendRadar } from '@/services/trendradar'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AiProviderConfig')

export type AIProvider = 'tjg' | 'siliconflow' | 'trendradar'

const STORAGE_KEYS = {
  AI_PROVIDER: 'tjg-chat-ai-provider',
  TRENDRADAR_CONFIG: 'tjg-chat-trendradar-config'
}

interface UseAiProviderConfigOptions {
  fetchModelList: () => Promise<void>
  modelList: { value: unknown[] }
}

export const useAiProviderConfig = (options: UseAiProviderConfigOptions) => {
  const { fetchModelList, modelList } = options

  const aiProvider = ref<AIProvider>('tjg')

  const siliconFlowConfig = ref({
    apiKey: '',
    baseUrl: 'https://api.siliconflow.cn',
    model: 'deepseek-ai/DeepSeek-V3'
  })

  const trendRadarConfig = ref({
    // F-4 修复：默认地址抽为环境变量，生产构建可覆盖；保留本地联调默认值作为 fallback
    apiUrl: import.meta.env.VITE_TRENDRADAR_API_URL || 'http://127.0.0.1:3333/mcp',
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
      if (savedProvider && ['tjg', 'siliconflow', 'trendradar'].includes(savedProvider)) {
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
    // F-9 修复：apiKey 是敏感凭据，绝不能落入 Tauri webview 的 localStorage（磁盘明文，
    // 可被备份同步 / 磁盘访问 / XSS 读取）。持久化时剥离 apiKey，仅保留 apiUrl 等非敏感字段；
    // apiKey 只存在于内存 ref 中，随会话生命周期失效。
    localStorage.setItem(STORAGE_KEYS.TRENDRADAR_CONFIG, JSON.stringify({ apiUrl: trendRadarConfig.value.apiUrl }))
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
