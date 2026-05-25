<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="t('ai_assistant.robot.api_key_management')"
    style="width: 900px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <template #header-extra>
      <n-button type="primary" size="small" @click="handleAdd">
        <template #icon>
          <Icon icon="mdi:plus" />
        </template>
        {{ t('ai_assistant.robot.add_api_key') }}
      </n-button>
    </template>

    <!-- 密钥列表 -->
    <n-spin :show="loading">
      <div v-if="apiKeyList.length === 0" class="empty-container">
        <n-empty :description="t('ai_assistant.robot.no_api_keys')" size="large">
          <template #icon>
            <Icon icon="mdi:key-variant" class="text-48px color-[--hula-text-tertiary]" />
          </template>
          <template #extra>
            <n-button type="primary" @click="handleAdd">{{ t('ai_assistant.robot.add_first_key') }}</n-button>
          </template>
        </n-empty>
      </div>

      <div v-else class="api-key-list">
        <div v-for="apiKey in apiKeyList" :key="apiKey.id" class="api-key-card">
          <div class="api-key-card-header">
            <n-flex align="center" :size="12">
              <Icon icon="mdi:key-variant" class="text-32px color-primary" />
              <div class="flex-1">
                <n-flex align="center" :size="8">
                  <span class="api-key-name">{{ apiKey.name }}</span>
                  <n-tag :type="apiKey.status === 0 ? 'success' : 'error'" size="small">
                    {{ apiKey.status === 0 ? t('ai_assistant.robot.available') : t('ai_assistant.robot.unavailable') }}
                  </n-tag>
                  <n-tag v-if="apiKey.publicStatus" type="info" size="small">
                    {{ t('ai_assistant.robot.public') }}
                  </n-tag>
                  <n-tag v-else type="warning" size="small">{{ t('ai_assistant.robot.private') }}</n-tag>
                </n-flex>
                <div class="api-key-meta">
                  <span class="meta-item">
                    {{ t('ai_assistant.robot.platform_label', { platform: apiKey.platform }) }}
                  </span>
                  <span class="meta-item">
                    {{ t('ai_assistant.robot.key_label', { key: maskApiKey(apiKey.apiKey) }) }}
                  </span>
                </div>
              </div>
            </n-flex>
            <n-flex :size="8">
              <!-- 查询余额按钮 -->
              <n-button
                size="small"
                type="info"
                :loading="balanceLoadingMap[apiKey.id]"
                @click="handleQueryBalance(apiKey.id)">
                <template #icon>
                  <Icon icon="mdi:cash-multiple" />
                </template>
                {{ t('ai_assistant.robot.query_balance') }}
              </n-button>
              <!-- 只有私有密钥才显示编辑按钮 -->
              <n-button v-if="!apiKey.publicStatus" size="small" @click="handleEdit(apiKey)">
                <template #icon>
                  <Icon icon="mdi:pencil" />
                </template>
                {{ t('ai_assistant.robot.edit') }}
              </n-button>
              <!-- 只有私有密钥才显示删除按钮 -->
              <n-popconfirm
                v-if="!apiKey.publicStatus"
                @positive-click="handleDelete(apiKey.id)"
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
                <p>{{ t('ai_assistant.robot.confirm_delete_key', { name: apiKey.name }) }}</p>
                <p class="text-red-500">{{ t('ai_assistant.robot.irreversible_warning') }}</p>
              </n-popconfirm>
            </n-flex>
          </div>

          <div v-if="apiKey.url || balanceMap[apiKey.id]" class="api-key-card-body">
            <n-descriptions :column="1" size="small" bordered>
              <n-descriptions-item v-if="apiKey.url" :label="t('ai_assistant.robot.api_address')">
                {{ apiKey.url }}
              </n-descriptions-item>
              <n-descriptions-item v-if="balanceMap[apiKey.id]" :label="t('ai_assistant.robot.account_balance')">
                <n-flex align="center" :size="8">
                  <span class="text-primary font-600 text-16px">
                    {{ balanceMap[apiKey.id].balanceInfos[0].totalBalance || '0' }}
                  </span>
                  <span class="text-gray-500">{{ balanceMap[apiKey.id].balanceInfos[0].currency || 'USD' }}</span>
                </n-flex>
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

  <!-- 新增/编辑密钥弹窗 -->
  <n-modal
    v-model:show="showEditModal"
    preset="card"
    :title="editingApiKey ? t('ai_assistant.robot.edit_api_key') : t('ai_assistant.robot.new_api_key')"
    style="width: 600px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <n-form ref="formRef" :model="formData" :rules="formRules" label-placement="left" label-width="100px">
      <n-form-item :label="t('ai_assistant.robot.key_name')" path="name">
        <n-input v-model:value="formData.name" :placeholder="t('ai_assistant.robot.key_name_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('ai_assistant.robot.api_key_input')" path="apiKey">
        <n-input
          v-model:value="formData.apiKey"
          type="password"
          show-password-on="click"
          :placeholder="t('ai_assistant.robot.api_key_input_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('ai_assistant.robot.platform_label_select')" path="platform">
        <n-select
          v-model:value="formData.platform"
          :options="platformOptions"
          :placeholder="t('ai_assistant.robot.select_platform')" />
      </n-form-item>

      <n-form-item :label="t('ai_assistant.robot.api_address')" path="url">
        <n-input v-model:value="formData.url" :placeholder="t('ai_assistant.robot.api_address_placeholder')" />
      </n-form-item>

      <n-form-item :label="t('ai_assistant.robot.status_label')" path="status">
        <n-select
          v-model:value="formData.status"
          :options="statusOptions"
          :placeholder="t('ai_assistant.robot.select_status')" />
      </n-form-item>
    </n-form>

    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button @click="showEditModal = false">{{ t('ai_assistant.robot.cancel') }}</n-button>
        <n-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ editingApiKey ? t('ai_assistant.robot.save') : t('ai_assistant.robot.create') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FormInst, FormRules } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { ApiKey, ApiKeyBalance, Platform } from '@/services/matrix/ai/ApiKeyService'
import { apiKeyService } from '@/services/matrix/ai/ApiKeyService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('ApiKeyManagement')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const hasValidationErrors = (value: unknown): value is { errors: unknown } => {
  return typeof value === 'object' && value !== null && 'errors' in value
}

const showModal = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  refresh: []
}>()

// 密钥列表
const loading = ref(false)
const apiKeyList = ref<ApiKey[]>([])
const pagination = ref({
  pageNo: 1,
  pageSize: 10,
  total: 0
})

// 余额相关
const balanceMap = ref<Record<string, ApiKeyBalance>>({}) // 存储每个密钥的余额信息
const balanceLoadingMap = ref<Record<string, boolean>>({}) // 存储每个密钥的余额加载状态

// 编辑相关
const showEditModal = ref(false)
const editingApiKey = ref<ApiKey | null>(null)
const submitting = ref(false)
const formRef = ref<FormInst>()

// 表单数据
const formData = ref({
  name: '',
  apiKey: '',
  platform: '',
  url: '',
  status: 0
})

// 平台选项
const platformOptions = ref<Array<{ label: string; value: string }>>([])

// 加载平台列表
const loadPlatformList = async () => {
  try {
    const data = await apiKeyService.platformList()

    if (data && Array.isArray(data)) {
      platformOptions.value = data.map((item: Platform) => ({
        label: item.label,
        value: item.platform
      }))
    } else {
      logger.warn(t('ai_assistant.robot.platform_list_format_error'), data)
      platformOptions.value = []
    }
  } catch (error) {
    // 如果加载失败，使用默认值
    platformOptions.value = [
      { label: t('ai_assistant.robot.siliconflow_label'), value: 'SiliconFlow' },
      { label: t('ai_assistant.robot.gitee_ai_label'), value: 'GiteeAI' }
    ]
  }
}

// 状态选项
const statusOptions = [
  { label: t('ai_assistant.robot.available'), value: 0 },
  { label: t('ai_assistant.robot.unavailable'), value: 1 }
]

// 表单验证规则
const formRules: FormRules = {
  name: [{ required: true, message: t('ai_assistant.robot.input_key_name_required'), trigger: 'blur' }],
  apiKey: [{ required: true, message: t('ai_assistant.robot.input_api_key_required'), trigger: 'blur' }],
  platform: [{ required: true, message: t('ai_assistant.robot.select_platform_required_key'), trigger: 'change' }],
  status: [
    {
      required: true,
      type: 'number',
      message: t('ai_assistant.robot.select_status_required_key'),
      trigger: 'change',
      validator: (_rule: unknown, value: unknown) => {
        return value !== undefined && value !== null && value !== ''
      }
    }
  ]
}

// 掩码显示 API 密钥
const maskApiKey = (key: string) => {
  if (!key) return ''
  if (key.length <= 8) return '***'
  return key.substring(0, 4) + '***' + key.substring(key.length - 4)
}

// 加载密钥列表
const loadApiKeyList = async () => {
  loading.value = true
  try {
    const data = await apiKeyService.page({
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })
    apiKeyList.value = data.list || []
    pagination.value.total = data.total || 0
  } catch (error) {
    logger.error('加载 API 密钥列表失败:', error)
    showFeedback(t('ai_assistant.robot.load_keys_failed'), 'error')
  } finally {
    loading.value = false
  }
}

// 分页变化
const handlePageChange = (page: number) => {
  pagination.value.pageNo = page
  loadApiKeyList()
}

// 新增密钥
const handleAdd = () => {
  editingApiKey.value = null
  formData.value = {
    name: '',
    apiKey: '',
    platform: '',
    url: '',
    status: 0
  }
  showEditModal.value = true
}

// 编辑密钥
const handleEdit = (apiKey: ApiKey) => {
  editingApiKey.value = apiKey
  formData.value = {
    name: apiKey.name,
    apiKey: apiKey.apiKey,
    platform: apiKey.platform,
    url: apiKey.url || '',
    status: apiKey.status ?? 0
  }
  showEditModal.value = true
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitting.value = true

    const submitData: Partial<ApiKey> = {
      name: formData.value.name,
      apiKey: formData.value.apiKey,
      platform: formData.value.platform,
      status: formData.value.status
    }

    if (formData.value.url) {
      submitData.url = formData.value.url
    }

    if (editingApiKey.value) {
      // 更新
      const updateData = {
        ...submitData,
        id: editingApiKey.value.id
      } as ApiKey
      await apiKeyService.update(updateData)
      showFeedback(t('ai_assistant.robot.key_updated'), 'success')
    } else {
      // 创建
      await apiKeyService.create(submitData as ApiKey)
      showFeedback(t('ai_assistant.robot.key_created'), 'success')
    }

    showEditModal.value = false
    loadApiKeyList()
    emit('refresh')
  } catch (error) {
    if (hasValidationErrors(error)) {
      return
    }
    logger.error('保存密钥失败:', error)
    showFeedback(t('ai_assistant.robot.save_key_failed'), 'error')
  } finally {
    submitting.value = false
  }
}

// 删除密钥
const handleDelete = async (id: string) => {
  try {
    await apiKeyService.delete({ id })
    showFeedback(t('ai_assistant.robot.key_deleted'), 'success')
    loadApiKeyList()
    emit('refresh')
  } catch (error) {
    logger.error('删除密钥失败:', error)
    showFeedback(t('ai_assistant.robot.delete_key_failed'), 'error')
  }
}

// 查询余额
const handleQueryBalance = async (id: string) => {
  try {
    balanceLoadingMap.value[id] = true
    const data = await apiKeyService.balance({ id })
    balanceMap.value[id] = data
    showFeedback(t('ai_assistant.robot.balance_query_success'), 'success')
  } catch (error) {
    logger.error('查询余额失败:', error)
    showFeedback(t('ai_assistant.robot.balance_query_failed'), 'error')
  } finally {
    balanceLoadingMap.value[id] = false
  }
}

// 监听弹窗显示状态
watch(showModal, (val) => {
  if (val) {
    loadApiKeyList()
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

.api-key-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.api-key-card {
  border: 1px solid var(--hula-border-default);
  border-radius: 8px;
  padding: 16px;
  background: var(--hula-surface-panel);
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .api-key-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .api-key-name {
      font-size: 16px;
      font-weight: 500;
      color: var(--hula-text-primary);
    }

    .api-key-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;

      .meta-item {
        font-size: 12px;
        color: var(--hula-text-tertiary);
      }
    }
  }

  .api-key-card-body {
    margin-top: 12px;
  }
}
</style>
