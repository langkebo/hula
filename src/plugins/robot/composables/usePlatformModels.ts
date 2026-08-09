import type { SelectOption } from 'naive-ui'
import { computed, type Ref, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { Platform } from '@/services/matrix/ai/ApiKeyService'
import { apiKeyService } from '@/services/matrix/ai/ApiKeyService'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('PlatformModels')

interface PlatformModelInfo {
  examples: string
  docs: string
  hint: string
}

export const usePlatformModels = (formData: Ref<{ platform: string; model: string }>) => {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()
  const timerManager = useTimerManager()

  const platformOptions = ref<SelectOption[]>([])
  const platformModelInfo = ref<Record<string, PlatformModelInfo>>({})

  const loadPlatformList = async () => {
    try {
      const data = await apiKeyService.platformList()
      if (data && Array.isArray(data)) {
        platformOptions.value = data.map((item: Platform) => ({
          label: item.label,
          value: item.platform
        }))

        const infoMap: Record<string, PlatformModelInfo> = {}
        data.forEach((item: Platform) => {
          infoMap[item.platform] = {
            examples: item.examples || '',
            docs: item.docs || '',
            hint: item.hint || ''
          }
        })
        platformModelInfo.value = infoMap
      }
    } catch {
      platformOptions.value = [
        { label: t('ai_assistant.robot.openai_default'), value: 'OpenAI' },
        { label: t('ai_assistant.robot.deepseek_default'), value: 'DeepSeek' }
      ]
      platformModelInfo.value = {
        OpenAI: {
          examples: 'gpt-4, gpt-4-turbo, gpt-3.5-turbo',
          docs: 'https://platform.openai.com/docs/models',
          hint: t('ai_assistant.robot.openai_hint')
        },
        DeepSeek: {
          examples: 'deepseek-chat, deepseek-reasoner, deepseek-coder',
          docs: 'https://platform.deepseek.com/api-docs',
          hint: t('ai_assistant.robot.deepseek_hint')
        }
      }
    }
  }

  const modelExamples = computed(() => {
    if (!formData.value.platform) return []
    const info = platformModelInfo.value[formData.value.platform]
    if (!info?.examples) return []
    const models = info.examples
      .split(',')
      .map((model) => model.trim())
      .filter((model) => model.length > 0)
    const uniqueModels = Array.from(new Set(models))
    return uniqueModels.map((model) => ({ label: model, value: model }))
  })

  const modelDocsUrl = computed(() => {
    if (!formData.value.platform) return ''
    const info = platformModelInfo.value[formData.value.platform]
    return info ? info.docs : ''
  })

  const modelPlaceholder = computed(() => {
    if (!formData.value.platform) return t('ai_assistant.robot.select_platform_first')
    const info = platformModelInfo.value[formData.value.platform]
    if (modelExamples.value.length > 0) return t('ai_assistant.robot.select_or_input_model')
    return info ? `例如: ${info.examples}` : t('ai_assistant.robot.input_model_flag')
  })

  const modelHint = computed(() => {
    if (!formData.value.platform) return t('ai_assistant.robot.select_platform_before_model')
    const info = platformModelInfo.value[formData.value.platform]
    return info ? info.hint : t('ai_assistant.robot.fill_model_flag')
  })

  // 监听模型输入变化，自动保存到后端
  let saveModelTimeout: number | null = null
  watch(
    () => formData.value.model,
    async (newModel) => {
      if (saveModelTimeout) clearTimeout(saveModelTimeout)
      if (!newModel || !formData.value.platform) return
      const existingModels = modelExamples.value.map((item) => item.value)
      if (existingModels.includes(newModel)) return

      saveModelTimeout = timerManager.setTimeout(async () => {
        try {
          await apiKeyService.addPlatformModel(formData.value.platform, newModel)
          await loadPlatformList()
          showFeedback(t('ai_assistant.robot.model_added_to_examples'), 'success')
        } catch (error) {
          logger.error('保存模型失败:', error)
        }
      }, 1000)
    }
  )

  return {
    platformOptions,
    platformModelInfo,
    modelExamples,
    modelDocsUrl,
    modelPlaceholder,
    modelHint,
    loadPlatformList
  }
}
