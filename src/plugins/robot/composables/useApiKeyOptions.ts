import type { SelectOption } from 'naive-ui'
import { ref } from 'vue'
import type { ApiKey } from '@/services/matrix/ai/ApiKeyService'
import { apiKeyService } from '@/services/matrix/ai/ApiKeyService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ApiKeyOptions')

export const useApiKeyOptions = () => {
  const apiKeyOptions = ref<SelectOption[]>([])
  const apiKeyMap = ref<Map<string, ApiKey>>(new Map())

  const loadApiKeyOptions = async () => {
    try {
      const data = await apiKeyService.simpleList()
      apiKeyOptions.value = (data || []).map((item: ApiKey) => ({
        label: item.platform ? `${item.name} (${item.platform})` : item.name,
        value: item.id
      }))
      apiKeyMap.value = new Map((data || []).map((item: ApiKey) => [item.id, item]))
    } catch (error) {
      logger.error('加载 API 密钥列表失败:', error)
    }
  }

  return {
    apiKeyOptions,
    apiKeyMap,
    loadApiKeyOptions
  }
}
