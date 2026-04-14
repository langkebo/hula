import { ref } from 'vue'
import { matrixModelService, type AIModel } from '@/services/matrix/MatrixModelService'
import { createLogger } from '@/utils/Logger'
const logger = createLogger('AssistantModelPresets')

export type AssistantModelPreset = {
  id: string
  modelKey: string
  modelName: string
  modelUrl: string
  description: string
  status: boolean
  version: string
}

const assistantModelPresets = ref<AssistantModelPreset[]>([])
const assistantModelLoaded = ref(false)
const assistantModelLoading = ref(false)
const assistantModelError = ref<unknown>(null)
const assistantModelMeta = ref<Record<string, { name: string; version: string }>>({})

const fetchAssistantModelPresets = async (force = false) => {
  if (assistantModelLoading.value || (assistantModelLoaded.value && !force)) return
  assistantModelLoading.value = true
  assistantModelError.value = null
  try {
    const response = await matrixModelService.page({ pageNo: 1, pageSize: 100 })
    const normalized = (response.list ?? []).map((model: AIModel) => ({
      id: model.id,
      modelKey: model.model,
      modelName: model.name,
      modelUrl: model.platform,
      description: model.name,
      status: model.status === 1,
      version: String(model.updatedAt ?? Date.now())
    }))
    const sorted = normalized.slice().sort((a, b) => Number(a.id) - Number(b.id))
    const metaMap: Record<string, { name: string; version: string }> = {}
    for (const preset of sorted) {
      metaMap[preset.modelKey] = {
        name: preset.modelName,
        version: preset.version
      }
    }
    assistantModelMeta.value = metaMap
    assistantModelPresets.value = sorted
  } catch (error) {
    logger.error('获取 AI 模型列表失败:', error)
    assistantModelError.value = error
    assistantModelPresets.value = []
    assistantModelMeta.value = {}
  } finally {
    assistantModelLoading.value = false
    assistantModelLoaded.value = true
  }
}

const resetAssistantModelPresets = () => {
  assistantModelPresets.value = []
  assistantModelLoaded.value = false
  assistantModelError.value = null
  assistantModelMeta.value = {}
}

export const useAssistantModelPresets = () => ({
  presets: assistantModelPresets,
  metaMap: assistantModelMeta,
  loaded: assistantModelLoaded,
  loading: assistantModelLoading,
  error: assistantModelError,
  fetchAssistantModelPresets,
  resetAssistantModelPresets
})
