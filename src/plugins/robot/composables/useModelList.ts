import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { modelService } from '@/services/matrix/ai/ModelService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ModelList')

export const useModelList = () => {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const loading = ref(false)
  const modelList = ref<AIModel[]>([])
  const pagination = ref({
    pageNo: 1,
    pageSize: 10,
    total: 0
  })

  const loadModelList = async () => {
    loading.value = true
    try {
      const data = await modelService.page({
        pageNo: pagination.value.pageNo,
        pageSize: pagination.value.pageSize
      })
      modelList.value = data.list || []
      pagination.value.total = data.total || 0
    } catch (error) {
      logger.error('加载模型列表失败:', error)
      showFeedback(t('ai_assistant.robot.load_models_failed'), 'error')
    } finally {
      loading.value = false
    }
  }

  const handlePageChange = (page: number) => {
    pagination.value.pageNo = page
    loadModelList()
  }

  const deleteModel = async (id: string) => {
    try {
      await modelService.delete({ id })
      showFeedback(t('ai_assistant.robot.model_deleted'), 'success')
      loadModelList()
      return true
    } catch (error) {
      logger.error('删除模型失败:', error)
      showFeedback(t('ai_assistant.robot.delete_model_failed'), 'error')
      return false
    }
  }

  return {
    loading,
    modelList,
    pagination,
    loadModelList,
    handlePageChange,
    deleteModel
  }
}
