/**
 * AI 生成历史与媒体预览状态管理。
 *
 * 从 `useRobotChat` 抽离的两个逻辑相关、彼此完全自包含的子模块：
 * - 历史抽屉：分页查看图像 / 视频 / 音频生成记录
 * - 媒体预览：从消息流或历史抽屉打开图像 / 视频预览弹窗
 *
 * `handleOpenHistory` 由 `mitt('open-generation-history')` 触发，订阅 / 退订
 * 在本 composable 内自管理；调用方仅需透传 `selectedModel` 以便决定默认 tab。
 */
import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { useMitt } from '@/hooks/useMitt.ts'
import { aiService } from '@/services/matrix'
import type { AIModel } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'
import type { HistoryItem, PaginationState, PreviewItem } from './useRobotChat'

const logger = createLogger('AiHistoryView')

export interface UseAiHistoryViewOptions {
  selectedModel: Ref<AIModel | null>
}

export const useAiHistoryView = ({ selectedModel }: UseAiHistoryViewOptions) => {
  const showHistoryModal = ref(false)
  const historyType = ref<'image' | 'video' | 'audio'>('image')
  const historyLoading = ref(false)
  const historyList = ref<HistoryItem[]>([])
  const historyPagination = ref<PaginationState>({
    pageNo: 1,
    pageSize: 12,
    total: 0
  })

  const showImagePreview = ref(false)
  const showVideoPreview = ref(false)
  const previewItem = ref<PreviewItem | null>(null)

  const loadHistory = async () => {
    historyLoading.value = true
    try {
      let data: { list: HistoryItem[]; total: number }
      if (historyType.value === 'image') {
        data = await aiService.imageMyPage({
          pageNo: historyPagination.value.pageNo,
          pageSize: historyPagination.value.pageSize
        })
      } else if (historyType.value === 'audio') {
        data = await aiService.audioMyPage({
          pageNo: historyPagination.value.pageNo,
          pageSize: historyPagination.value.pageSize
        })
      } else {
        data = await aiService.videoMyPage({
          pageNo: historyPagination.value.pageNo,
          pageSize: historyPagination.value.pageSize
        })
      }
      historyList.value = data.list || []
      historyPagination.value.total = data.total || 0
    } catch (error) {
      logger.error('加载历史记录失败:', error)
      window.$message.error('加载历史记录失败')
    } finally {
      historyLoading.value = false
    }
  }

  const handleOpenHistory = () => {
    if (selectedModel.value) {
      if (selectedModel.value.type === 2) {
        historyType.value = 'image'
      } else if (selectedModel.value.type === 3) {
        historyType.value = 'audio'
      } else if ([4, 7, 8].includes(selectedModel.value.type)) {
        historyType.value = 'video'
      } else {
        historyType.value = 'image'
      }
    } else {
      historyType.value = 'image'
    }

    historyPagination.value.pageNo = 1
    showHistoryModal.value = true
    void loadHistory()
  }

  const switchHistoryType = (type: 'image' | 'video' | 'audio') => {
    historyType.value = type
    historyPagination.value.pageNo = 1
    void loadHistory()
  }

  const handleHistoryPageChange = (page: number) => {
    historyPagination.value.pageNo = page
    void loadHistory()
  }

  const handleImagePreview = (imageUrl: string) => {
    previewItem.value = { picUrl: imageUrl }
    showImagePreview.value = true
  }

  const handlePreviewImage = (item: HistoryItem) => {
    previewItem.value = item
    showImagePreview.value = true
  }

  const handlePreviewVideo = (item: HistoryItem) => {
    previewItem.value = item
    showVideoPreview.value = true
  }

  onMounted(() => {
    useMitt.on('open-generation-history', handleOpenHistory)
  })

  onUnmounted(() => {
    useMitt.off('open-generation-history', handleOpenHistory)
  })

  return {
    showHistoryModal,
    historyType,
    historyLoading,
    historyList,
    historyPagination,
    showImagePreview,
    showVideoPreview,
    previewItem,
    loadHistory,
    handleOpenHistory,
    switchHistoryType,
    handleHistoryPageChange,
    handleImagePreview,
    handlePreviewImage,
    handlePreviewVideo
  }
}
