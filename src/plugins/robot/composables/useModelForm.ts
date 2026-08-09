import type { FormRules } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { modelService } from '@/services/matrix/ai/ModelService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ModelForm')

// 表单校验入口（n-form 在 ModelFormModal 子组件内，通过 defineExpose 暴露 validate）
export interface FormValidator {
  validate: () => Promise<unknown> | undefined
}

export interface FormModel {
  keyId: string
  name: string
  model: string
  platform: string
  avatar: string
  type: number
  sort: number
  status: number
  temperature: number
  maxTokens: number
  maxContexts: number
  publicStatus: number
}

type ModelSubmitPayload = FormModel & { id?: string }
type ValidationValue = number | null | undefined | ''

const createDefaultFormData = (): FormModel => ({
  keyId: '',
  name: '',
  model: '',
  platform: '',
  avatar: '',
  type: 1,
  sort: 0,
  status: 0,
  temperature: 0.8,
  maxTokens: 4096,
  maxContexts: 10,
  publicStatus: 1
})

export const useModelForm = () => {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const showEditModal = ref(false)
  const editingModel = ref<AIModel | null>(null)
  const submitting = ref(false)
  const formRef = ref<FormValidator>()
  const formData = ref<FormModel>(createDefaultFormData())

  const statusOptions = [
    { label: t('ai_assistant.robot.available'), value: 0 },
    { label: t('ai_assistant.robot.unavailable'), value: 1 }
  ]

  const formRules: FormRules = {
    keyId: [{ required: true, message: t('ai_assistant.robot.select_api_key_required'), trigger: 'change' }],
    name: [{ required: true, message: t('ai_assistant.robot.input_model_name_required'), trigger: 'blur' }],
    model: [{ required: true, message: t('ai_assistant.robot.input_model_flag_required'), trigger: 'blur' }],
    platform: [{ required: true, message: t('ai_assistant.robot.select_platform_required'), trigger: 'change' }],
    type: [
      {
        required: true,
        type: 'number',
        message: t('ai_assistant.robot.select_model_type_required'),
        trigger: 'change',
        validator: (_rule: unknown, value: ValidationValue) => {
          return value !== undefined && value !== null && value !== ''
        }
      }
    ],
    sort: [
      {
        required: true,
        type: 'number',
        message: t('ai_assistant.robot.input_sort_required'),
        trigger: 'blur',
        validator: (_rule: unknown, value: ValidationValue) => {
          return value !== undefined && value !== null && value !== ''
        }
      }
    ],
    status: [
      {
        required: true,
        type: 'number',
        message: t('ai_assistant.robot.select_status_required'),
        trigger: 'change',
        validator: (_rule: unknown, value: ValidationValue) => {
          return value !== undefined && value !== null && value !== ''
        }
      }
    ]
  }

  const handleAdd = () => {
    editingModel.value = null
    formData.value = createDefaultFormData()
    showEditModal.value = true
  }

  const handleEdit = (model: AIModel) => {
    editingModel.value = model
    formData.value = {
      keyId: model.keyId || '',
      name: model.name,
      model: model.model,
      platform: model.platform,
      avatar: model.avatar || '',
      type: model.type ?? 1,
      sort: model.sort ?? 0,
      status: model.status ?? 0,
      temperature: model.temperature ?? 0.8,
      maxTokens: model.maxTokens ?? 4096,
      maxContexts: model.maxContexts ?? 10,
      publicStatus: model.publicStatus ?? 0
    }
    showEditModal.value = true
  }

  const handleNameChange = (value: string) => {
    if (value) {
      formData.value.model = value
    }
  }

  const handlePublicStatusChange = (checked: boolean) => {
    formData.value.publicStatus = checked ? 0 : 1
  }

  const handleKeyIdChange = (keyId: string, apiKeyMap: Map<string, { platform?: string }>) => {
    if (keyId) {
      const apiKeyInfo = apiKeyMap.get(keyId)
      if (apiKeyInfo?.platform) {
        formData.value.platform = apiKeyInfo.platform
        formData.value.model = ''
      }
    }
  }

  const handleSubmit = async (): Promise<boolean> => {
    try {
      await formRef.value?.validate()
      submitting.value = true

      const submitData: ModelSubmitPayload = {
        keyId: formData.value.keyId,
        name: formData.value.name,
        model: formData.value.model,
        platform: formData.value.platform,
        avatar: formData.value.avatar,
        type: formData.value.type,
        sort: formData.value.sort,
        status: formData.value.status,
        temperature: formData.value.temperature,
        maxTokens: formData.value.maxTokens,
        maxContexts: formData.value.maxContexts,
        publicStatus: formData.value.publicStatus
      }
      if (editingModel.value) {
        submitData.id = editingModel.value.id
        await modelService.update(submitData)
        showFeedback(t('ai_assistant.robot.model_updated'), 'success')
      } else {
        await modelService.update(submitData)
        showFeedback(t('ai_assistant.robot.model_created'), 'success')
      }

      showEditModal.value = false
      return true
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errors' in error) {
        return false
      }
      logger.error('保存模型失败:', error)
      showFeedback(t('ai_assistant.robot.save_model_failed'), 'error')
      return false
    } finally {
      submitting.value = false
    }
  }

  return {
    showEditModal,
    editingModel,
    submitting,
    formRef,
    formData,
    statusOptions,
    formRules,
    handleAdd,
    handleEdit,
    handleNameChange,
    handlePublicStatusChange,
    handleKeyIdChange,
    handleSubmit
  }
}
