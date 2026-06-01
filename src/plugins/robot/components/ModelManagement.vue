<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="t('ai_assistant.robot.model_management')"
    style="width: 800px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <template #header-extra>
      <n-button type="primary" size="small" @click="handleAdd">
        <template #icon>
          <Icon icon="mdi:plus" />
        </template>
        {{ t('ai_assistant.robot.add_model') }}
      </n-button>
    </template>

    <!-- 模型列表 -->
    <n-spin :show="loading">
      <div v-if="modelList.length === 0" class="empty-container">
        <n-empty :description="t('ai_assistant.robot.no_models')" size="large">
          <template #icon>
            <Icon icon="mdi:package-variant-closed" class="text-48px color-[--hula-text-tertiary]" />
          </template>
          <template #extra>
            <n-button type="primary" @click="handleAdd">{{ t('ai_assistant.robot.add_first_model') }}</n-button>
          </template>
        </n-empty>
      </div>

      <div v-else class="model-list">
        <div v-for="model in modelList" :key="model.id" class="model-card">
          <div class="model-card-header">
            <n-flex align="center" :size="12">
              <n-avatar round :size="48" :src="getModelAvatar(model)" :fallback-src="getDefaultAvatar()" />
              <div class="flex-1">
                <n-flex align="center" :size="8">
                  <span class="model-name">{{ model.name }}</span>
                  <n-tag :type="model.status === 0 ? 'success' : 'error'" size="small">
                    {{ model.status === 0 ? t('ai_assistant.robot.available') : t('ai_assistant.robot.unavailable') }}
                  </n-tag>
                  <n-tag v-if="model.publicStatus === 0" type="info" size="small">
                    {{ t('ai_assistant.robot.public') }}
                  </n-tag>
                  <n-tag v-else type="warning" size="small">{{ t('ai_assistant.robot.private') }}</n-tag>
                  <n-tag v-if="model.type === 1" type="info" size="small">
                    {{ t('ai_assistant.robot.model_type_chat') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 2" type="success" size="small">
                    {{ t('ai_assistant.robot.model_type_image') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 3" type="primary" size="small">
                    {{ t('ai_assistant.robot.model_type_audio') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 4" type="warning" size="small">
                    {{ t('ai_assistant.robot.model_type_video') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 5" type="default" size="small">
                    {{ t('ai_assistant.robot.model_type_vector') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 6" type="default" size="small">
                    {{ t('ai_assistant.robot.model_type_rerank') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 7" type="warning" size="small">
                    {{ t('ai_assistant.robot.model_type_text2video') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 8" type="error" size="small">
                    {{ t('ai_assistant.robot.model_type_image2video') }}
                  </n-tag>
                </n-flex>
                <div class="model-meta">
                  <span class="meta-item">
                    {{ t('ai_assistant.robot.platform_label', { platform: model.platform }) }}
                  </span>
                  <span class="meta-item">{{ t('ai_assistant.robot.model_label', { model: model.model }) }}</span>
                </div>
              </div>
            </n-flex>
            <n-flex :size="8">
              <!-- 只有创建人才显示编辑按钮（公开和私有模型都可以编辑） -->
              <n-button v-if="isModelCreator(model)" size="small" @click="handleEdit(model)">
                <template #icon>
                  <Icon icon="mdi:pencil" />
                </template>
                {{ t('ai_assistant.robot.edit') }}
              </n-button>
              <!-- 只有创建人才显示删除按钮（公开和私有模型都可以删除） -->
              <n-popconfirm
                v-if="isModelCreator(model)"
                @positive-click="handleDelete(model.id)"
                :positive-text="t('ai_assistant.robot.delete')"
                :negative-text="t('ai_assistant.robot.cancel')">
                <template #trigger>
                  <n-button size="small" type="error">
                    <template #icon>
                      <Icon icon="mdi:delete" />
                    </template>
                    {{ t('ai_assistant.robot.delete') }}
                  </n-button>
                </template>
                <p>{{ t('ai_assistant.robot.confirm_delete_model', { name: model.name }) }}</p>
                <p class="text-red-500">{{ t('ai_assistant.robot.irreversible_warning') }}</p>
              </n-popconfirm>
            </n-flex>
          </div>

          <div class="model-card-body">
            <n-descriptions :column="3" size="small" bordered>
              <n-descriptions-item :label="t('ai_assistant.robot.temperature_param')">
                {{ model.temperature ?? '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('ai_assistant.robot.max_token')">
                {{ model.maxTokens ?? '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('ai_assistant.robot.max_context')">
                {{ model.maxContexts ?? '-' }}
              </n-descriptions-item>
            </n-descriptions>
          </div>
        </div>
      </div>
    </n-spin>

    <!-- 分页 -->
    <n-flex v-if="pagination.total > pagination.pageSize" justify="center" class="mt-16px">
      <n-pagination
        v-model:page="pagination.pageNo"
        :page-size="pagination.pageSize"
        :page-count="Math.ceil(pagination.total / pagination.pageSize)"
        @update:page="handlePageChange" />
    </n-flex>
  </n-modal>

  <!-- 新增/编辑模型弹窗 -->
  <n-modal
    v-model:show="showEditModal"
    preset="card"
    :title="editingModel ? t('ai_assistant.robot.edit_model') : t('ai_assistant.robot.add_model')"
    style="width: 750px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <n-scrollbar style="max-height: calc(80vh - 140px)">
      <n-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-placement="left"
        label-width="120px"
        style="padding-right: 12px">
        <n-form-item :label="t('ai_assistant.robot.api_key_label')" path="keyId">
          <n-flex :size="8" style="width: 100%">
            <n-select
              v-model:value="formData.keyId"
              :options="apiKeyOptions"
              :placeholder="t('ai_assistant.robot.select_api_key')"
              style="flex: 1"
              @update:value="handleKeyIdChange" />
            <n-button @click="handleOpenApiKeyManagement">
              <template #icon>
                <Icon icon="mdi:cog" />
              </template>
              {{ t('ai_assistant.robot.manage') }}
            </n-button>
          </n-flex>
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.platform_label_select')" path="platform">
          <n-input
            v-model:value="formData.platform"
            :placeholder="t('ai_assistant.robot.platform_auto_set')"
            disabled />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.model_avatar')" path="avatar">
          <n-flex :size="12" align="center" style="width: 100%">
            <n-avatar :key="formData.avatar" :src="formData.avatar" :size="60" round fallback-src="">
              <Icon v-if="!formData.avatar" icon="mdi:account-circle" :size="40" />
            </n-avatar>
            <n-flex vertical :size="8" style="flex: 1">
              <n-button size="small" @click="openAvatarCropper">
                <template #icon>
                  <Icon icon="mdi:upload" />
                </template>
                {{ formData.avatar ? t('ai_assistant.robot.change_avatar') : t('ai_assistant.robot.upload_avatar') }}
              </n-button>
              <span v-if="formData.avatar" class="text-(12px [--hula-text-tertiary])">
                {{ t('ai_assistant.robot.uploaded') }}
                <n-button text type="error" size="tiny" @click="formData.avatar = ''">
                  {{ t('ai_assistant.robot.clear') }}
                </n-button>
              </span>
            </n-flex>
          </n-flex>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleFileChange" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.model_type_label')" path="type">
          <n-flex :size="8" style="flex-wrap: wrap">
            <n-button :type="formData.type === 1 ? 'primary' : 'default'" size="small" @click="formData.type = 1">
              <template #icon>
                <Icon icon="mdi:message-text" />
              </template>
              {{ t('ai_assistant.robot.model_type_chat') }}
            </n-button>
            <n-button :type="formData.type === 2 ? 'primary' : 'default'" size="small" @click="formData.type = 2">
              <template #icon>
                <Icon icon="mdi:image" />
              </template>
              {{ t('ai_assistant.robot.model_type_image') }}
            </n-button>
            <n-button :type="formData.type === 3 ? 'primary' : 'default'" size="small" @click="formData.type = 3">
              <template #icon>
                <Icon icon="mdi:microphone" />
              </template>
              {{ t('ai_assistant.robot.model_type_audio') }}
            </n-button>
            <n-button :type="formData.type === 7 ? 'primary' : 'default'" size="small" @click="formData.type = 7">
              <template #icon>
                <Icon icon="mdi:video-outline" />
              </template>
              {{ t('ai_assistant.robot.model_type_text2video') }}
            </n-button>
            <n-button :type="formData.type === 8 ? 'primary' : 'default'" size="small" @click="formData.type = 8">
              <template #icon>
                <Icon icon="mdi:video-image" />
              </template>
              {{ t('ai_assistant.robot.model_type_image2video') }}
            </n-button>
          </n-flex>
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.model_name')" path="name">
          <n-input
            v-model:value="formData.name"
            :placeholder="t('ai_assistant.robot.model_name_placeholder')"
            @update:value="handleNameChange" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.model_flag')" path="model">
          <n-flex vertical :size="4" style="width: 100%">
            <n-flex :size="8" style="width: 100%">
              <n-select
                v-if="modelExamples.length > 0"
                v-model:value="formData.model"
                :options="modelExamples"
                :placeholder="modelPlaceholder"
                :disabled="!formData.platform"
                filterable
                tag
                style="flex: 1" />
              <n-input
                v-else
                v-model:value="formData.model"
                :placeholder="modelPlaceholder"
                :disabled="!formData.platform"
                style="flex: 1" />
              <n-button v-if="modelDocsUrl" text type="info" style="padding: 0" @click="openExternalUrl(modelDocsUrl)">
                {{ t('ai_assistant.robot.view_docs') }}
              </n-button>
            </n-flex>
            <n-text depth="3" style="font-size: 12px">
              {{ modelHint }}
            </n-text>
            <n-flex v-if="modelDocsUrl" align="center" :size="8" class="mt-4px">
              <n-text depth="3" style="font-size: 12px">{{ t('ai_assistant.robot.view_docs_label') }}</n-text>
              <n-button text type="info" style="font-size: 12px" @click="openExternalUrl(modelDocsUrl)">
                {{ modelDocsUrl }}
              </n-button>
            </n-flex>
          </n-flex>
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.status_label')" path="status">
          <n-select
            v-model:value="formData.status"
            :options="statusOptions"
            :placeholder="t('ai_assistant.robot.select_status')" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.sort_value')" path="sort">
          <n-input-number
            v-model:value="formData.sort"
            :min="0"
            :placeholder="t('ai_assistant.robot.sort_hint')"
            style="width: 100%" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.temperature_param')" path="temperature">
          <n-input-number
            v-model:value="formData.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :placeholder="t('ai_assistant.robot.temperature_hint')"
            style="width: 100%" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.max_token')" path="maxTokens">
          <n-input-number
            v-model:value="formData.maxTokens"
            :min="1"
            :placeholder="t('ai_assistant.robot.max_token_hint')"
            style="width: 100%" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.max_context')" path="maxContexts">
          <n-input-number
            v-model:value="formData.maxContexts"
            :min="1"
            :placeholder="t('ai_assistant.robot.max_context_hint')"
            style="width: 100%" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.is_public')" path="publicStatus">
          <n-switch :value="formData.publicStatus === 0" @update:value="handlePublicStatusChange">
            <template #checked>{{ t('ai_assistant.robot.public') }}</template>
            <template #unchecked>{{ t('ai_assistant.robot.private') }}</template>
          </n-switch>
        </n-form-item>
      </n-form>
    </n-scrollbar>

    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button @click="showEditModal = false">{{ t('ai_assistant.robot.cancel') }}</n-button>
        <n-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ editingModel ? t('ai_assistant.robot.save') : t('ai_assistant.robot.create') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>

  <!-- API 密钥管理弹窗 -->
  <ApiKeyManagement v-model="showApiKeyManagement" @refresh="handleApiKeyManagementRefresh" />
  <!-- 头像裁剪组件 -->
  <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FormInst, FormRules } from 'naive-ui'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { openExternalUrl } from '@/hooks/useLinkSegments'
import type { ApiKey, Platform } from '@/services/matrix/ai/ApiKeyService'
import { apiKeyService } from '@/services/matrix/ai/ApiKeyService'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { modelService } from '@/services/matrix/ai/ModelService'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'
import ApiKeyManagement from './ApiKeyManagement.vue'

type SelectOption = {
  label: string
  value: string
}

type FormModel = {
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

type ModelSubmitPayload = FormModel & {
  id?: string
}

type ValidationValue = number | null | undefined | ''

const logger = createLogger('ModelManagement')
const timerManager = useTimerManager()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const showModal = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  refresh: []
}>()

const userStore = useUserStore()

// 检查当前用户是否是模型创建人
const isModelCreator = (model: AIModel) => {
  return userStore.userInfo?.uid === model.userId
}

// 模型列表
const loading = ref(false)
const modelList = ref<AIModel[]>([])
const pagination = ref({
  pageNo: 1,
  pageSize: 10,
  total: 0
})

// API 密钥管理
const showApiKeyManagement = ref(false)
const apiKeyOptions = ref<SelectOption[]>([])
const apiKeyMap = ref<Map<string, ApiKey>>(new Map())

// 编辑相关
const showEditModal = ref(false)
const editingModel = ref<AIModel | null>(null)
const submitting = ref(false)
const formRef = ref<FormInst>()

// 表单数据
const formData = ref<FormModel>({
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
  publicStatus: 1 // 0=公开，1=私有
})

// 平台选项和模型信息
const platformOptions = ref<SelectOption[]>([])
const platformModelInfo = ref<Record<string, { examples: string; docs: string; hint: string }>>({})

// 加载平台列表
const loadPlatformList = async () => {
  try {
    const data = await apiKeyService.platformList()
    if (data && Array.isArray(data)) {
      platformOptions.value = data.map((item: Platform) => ({
        label: item.label,
        value: item.platform
      }))

      // 构建平台模型信息映射
      const infoMap: Record<string, { examples: string; docs: string; hint: string }> = {}
      data.forEach((item: Platform) => {
        infoMap[item.platform] = {
          examples: item.examples || '',
          docs: item.docs || '',
          hint: item.hint || ''
        }
      })
      platformModelInfo.value = infoMap
    }
  } catch (error) {
    // 如果加载失败，使用默认值
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

// 计算属性：模型示例列表（用于下拉选择）
const modelExamples = computed(() => {
  if (!formData.value.platform) {
    return []
  }
  const info = platformModelInfo.value[formData.value.platform]
  if (!info || !info.examples) {
    return []
  }
  // 将 examples 字符串按逗号分割，去重，并转换为选项格式
  const models = info.examples
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0)

  // 使用 Set 去重，保持顺序
  const uniqueModels = Array.from(new Set(models))

  return uniqueModels.map((model) => ({
    label: model,
    value: model
  }))
})

// 计算属性：模型文档链接
const modelDocsUrl = computed(() => {
  if (!formData.value.platform) {
    return ''
  }
  const info = platformModelInfo.value[formData.value.platform]
  return info ? info.docs : ''
})

// 计算属性：模型输入框的占位符
const modelPlaceholder = computed(() => {
  if (!formData.value.platform) {
    return t('ai_assistant.robot.select_platform_first')
  }
  const info = platformModelInfo.value[formData.value.platform]
  if (modelExamples.value.length > 0) {
    return t('ai_assistant.robot.select_or_input_model')
  }
  return info ? `例如: ${info.examples}` : t('ai_assistant.robot.input_model_flag')
})

// 计算属性：模型输入提示
const modelHint = computed(() => {
  if (!formData.value.platform) {
    return t('ai_assistant.robot.select_platform_before_model')
  }
  const info = platformModelInfo.value[formData.value.platform]
  return info ? info.hint : t('ai_assistant.robot.fill_model_flag')
})

// 监听模型输入变化，自动保存到后端
let saveModelTimeout: number | null = null
watch(
  () => formData.value.model,
  async (newModel, _oldModel) => {
    // 清除之前的定时器
    if (saveModelTimeout) {
      clearTimeout(saveModelTimeout)
    }

    // 如果模型为空或平台未选择，不处理
    if (!newModel || !formData.value.platform) {
      return
    }

    // 如果模型已经在示例列表中，不需要保存
    const existingModels = modelExamples.value.map((item) => item.value)
    if (existingModels.includes(newModel)) {
      return
    }

    // 防抖：用户停止输入 1 秒后再保存
    saveModelTimeout = timerManager.setTimeout(async () => {
      try {
        await apiKeyService.addPlatformModel(formData.value.platform, newModel)
        // 重新加载平台列表，更新示例
        await loadPlatformList()
        showFeedback(t('ai_assistant.robot.model_added_to_examples'), 'success')
      } catch (error) {
        logger.error('保存模型失败:', error)
        // 静默失败，不影响用户操作
      }
    }, 1000)
  }
)

// 状态选项
const statusOptions = [
  { label: t('ai_assistant.robot.available'), value: 0 },
  { label: t('ai_assistant.robot.unavailable'), value: 1 }
]

// 表单验证规则
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

// 获取默认头像
const getDefaultAvatar = () => {
  return 'https://img1.baidu.com/it/u=3613958228,3522035000&fm=253&fmt=auto&app=120&f=JPEG?w=500&h=500'
}

// 获取模型头像
const getModelAvatar = (model: AIModel | null) => {
  if (!model) return getDefaultAvatar()
  if (model.avatar) return model.avatar
  return getDefaultAvatar()
}

// 加载 API 密钥选项
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

// 加载模型列表
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

// 分页变化
const handlePageChange = (page: number) => {
  pagination.value.pageNo = page
  loadModelList()
}

// API密钥切换处理
const handleKeyIdChange = (keyId: string) => {
  if (keyId) {
    const apiKeyInfo = apiKeyMap.value.get(keyId)
    if (apiKeyInfo?.platform) {
      // 自动填充平台
      formData.value.platform = apiKeyInfo.platform
      // 清空模型标志，让用户重新输入
      formData.value.model = ''
    }
  }
}

// 模型名称变化处理 - 单向同步到模型标志
const handleNameChange = (value: string) => {
  // 将模型名称同步到模型标志（单向绑定）
  if (value) {
    formData.value.model = value
  }
}

// 公开状态变化处理
const handlePublicStatusChange = (checked: boolean) => {
  formData.value.publicStatus = checked ? 0 : 1
}

// 新增模型
const handleAdd = () => {
  editingModel.value = null
  formData.value = {
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
    publicStatus: 1 // 0=公开，1=私有
  }
  showEditModal.value = true
}

const {
  localImageUrl,
  showCropper,
  openAvatarCropper,
  handleFileChange,
  handleCrop: onCrop
} = useAvatarUpload({
  onSuccess: async (mxcUrl) => {
    formData.value.avatar = ''
    await nextTick()
    formData.value.avatar = mxcUrl
    await nextTick()
    showFeedback(t('ai_assistant.robot.avatar_upload_success'), 'success')
  }
})

const handleCrop = async (cropBlob: Blob) => {
  await onCrop(cropBlob)
}

// 编辑模型
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
    publicStatus: model.publicStatus ?? 0 // 0=公开，1=私有
  }
  showEditModal.value = true
}

// 提交表单
const handleSubmit = async () => {
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
    loadModelList()
    // 通知父组件刷新
    emit('refresh')
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'errors' in error) {
      // 表单验证错误
      return
    }
    logger.error('保存模型失败:', error)
    showFeedback(t('ai_assistant.robot.save_model_failed'), 'error')
  } finally {
    submitting.value = false
  }
}

// 删除模型
const handleDelete = async (id: string) => {
  try {
    await modelService.delete({ id })
    showFeedback(t('ai_assistant.robot.model_deleted'), 'success')
    loadModelList()
    // 通知父组件刷新
    emit('refresh')
  } catch (error) {
    logger.error('删除模型失败:', error)
    showFeedback(t('ai_assistant.robot.delete_model_failed'), 'error')
  }
}

// 打开 API 密钥管理
const handleOpenApiKeyManagement = () => {
  showApiKeyManagement.value = true
}

// API 密钥管理刷新后的回调
const handleApiKeyManagementRefresh = () => {
  loadApiKeyOptions()
}

// 监听弹窗显示状态
watch(showModal, (val) => {
  if (val) {
    loadApiKeyOptions()
    loadModelList()
    loadPlatformList()
  }
})

// 组件挂载时加载平台列表
onMounted(() => {
  loadPlatformList()
})
</script>

<style scoped lang="scss">
.empty-container {
  padding: 40px 0;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-card {
  border: 1px solid var(--hula-border-default);
  border-radius: 8px;
  padding: 16px;
  background: var(--hula-surface-panel);
  transition: all 0.3s;

  &:hover {
    box-shadow: var(--hula-shadow-card);
  }

  .model-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .model-name {
      font-size: 16px;
      font-weight: 500;
      color: var(--hula-text-primary);
    }

    .model-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;

      .meta-item {
        font-size: 12px;
        color: var(--hula-text-tertiary);
      }
    }
  }

  .model-card-body {
    margin-top: 12px;
  }
}
</style>
