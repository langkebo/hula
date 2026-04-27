import { computed, ref, type Ref } from 'vue'
import { useMitt } from '@/hooks/useMitt.ts'
import type { AIModel } from '@/services/matrix'
import { conversationService, modelService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'
import type { PaginationState } from './useRobotChat'

const logger = createLogger('AiModelManagement')

interface UseAiModelManagementOptions {
  currentChat: Ref<{ id: string }>
  clearVideoImage: () => void
  loadAudioVoices: (model: AIModel) => Promise<void>
  loadRemainingUsage: (modelId: string) => Promise<void>
}

export const useAiModelManagement = ({
  currentChat,
  clearVideoImage,
  loadAudioVoices,
  loadRemainingUsage
}: UseAiModelManagementOptions) => {
  const showModelPopover = ref(false)
  const modelLoading = ref(false)
  const modelSearch = ref('')
  const selectedModel = ref<AIModel | null>(null)
  const reasoningEnabled = ref(false)
  const supportsReasoning = computed(() => Boolean(selectedModel.value?.supportsReasoning))
  const modelPagination = ref<PaginationState>({
    pageNo: 1,
    pageSize: 10,
    total: 0
  })
  const modelList = ref<AIModel[]>([])
  const filteredModels = computed(() => {
    const search = modelSearch.value?.toLowerCase() || ''
    const filtered = search
      ? modelList.value.filter(
          (model) =>
            model.name?.toLowerCase().includes(search) ||
            model.description?.toLowerCase().includes(search) ||
            model.platform?.toLowerCase().includes(search)
        )
      : modelList.value.slice()

    return filtered.sort((a, b) => {
      const aOfficial = a.publicStatus === 0
      const bOfficial = b.publicStatus === 0
      if (aOfficial !== bOfficial) return aOfficial ? -1 : 1
      const aSort = a.sort ?? 0
      const bSort = b.sort ?? 0
      if (aSort !== bSort) return aSort - bSort
      return String(a.name || '').localeCompare(String(b.name || ''))
    })
  })
  const officialModels = computed(() => filteredModels.value.filter((item) => item.publicStatus === 0))
  const userModels = computed(() => filteredModels.value.filter((item) => item.publicStatus !== 0))

  const fetchModelList = async () => {
    modelLoading.value = true
    try {
      const data = await modelService.page({
        pageNo: modelPagination.value.pageNo,
        pageSize: modelPagination.value.pageSize
      })
      modelList.value = data.list || []
      modelPagination.value.total = data.total || 0
    } catch (error) {
      logger.error('获取模型列表失败:', error)
      window.$message.error('获取模型列表失败')
    } finally {
      modelLoading.value = false
    }
  }

  const handleModelClick = () => {
    showModelPopover.value = !showModelPopover.value
    if (showModelPopover.value && modelList.value.length === 0) {
      void fetchModelList()
    }
  }

  const handleModelPopoverShowChange = (show: boolean) => {
    showModelPopover.value = show
    if (show && modelList.value.length === 0) {
      void fetchModelList()
    }
  }

  const selectModel = async (model: AIModel) => {
    selectedModel.value = model ? { ...model } : null
    showModelPopover.value = false

    if (model.type !== 8) {
      clearVideoImage()
    }
    if (model.type === 3) {
      await loadAudioVoices(model)
    }

    if (currentChat.value.id && currentChat.value.id !== '0') {
      try {
        await conversationService.update({
          id: currentChat.value.id,
          modelId: String(model.id)
        })
      } catch (error) {
        logger.error('切换模型失败:', error)
        window.$message.destroyAll()
        window.$message.error('切换模型失败')
      }
    } else {
      window.$message.success(`已选择模型: ${model.name}`)
    }

    useMitt.emit('model-selected', model)
    if (model.id) {
      void loadRemainingUsage(model.id)
    }
  }

  const handleModelPageChange = (page: number) => {
    modelPagination.value.pageNo = page
    void fetchModelList()
  }

  const handleOpenModelManagement = () => {
    showModelPopover.value = false
    useMitt.emit('open-model-management')
  }

  const handleRefreshModelList = async () => {
    await fetchModelList()
    if (selectedModel.value?.id) {
      const selectedModelId = selectedModel.value.id
      const updatedModel = modelList.value.find((item) => item.id === selectedModelId)
      if (updatedModel) {
        const oldType = selectedModel.value.type
        selectedModel.value = { ...updatedModel }
        void loadRemainingUsage(updatedModel.id)
        if (oldType === 8 && updatedModel.type !== 8) {
          clearVideoImage()
        }
      }
    }
  }

  return {
    showModelPopover,
    modelLoading,
    modelSearch,
    selectedModel,
    reasoningEnabled,
    supportsReasoning,
    modelPagination,
    modelList,
    filteredModels,
    officialModels,
    userModels,
    fetchModelList,
    handleModelClick,
    handleModelPopoverShowChange,
    selectModel,
    handleModelPageChange,
    handleOpenModelManagement,
    handleRefreshModelList
  }
}
