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
            <Icon icon="mdi:package-variant-closed" class="text-48px color-[--tjg-text-tertiary]" />
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
              <span v-if="formData.avatar" class="text-(12px [--tjg-text-tertiary])">
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
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openExternalUrl } from '@/composables/common/useLinkSegments'
import { useAvatarUpload } from '@/composables/user/useAvatarUpload'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { useUserStore } from '@/stores/domains/user/user'
import { useApiKeyOptions } from '../composables/useApiKeyOptions'
import { useModelForm } from '../composables/useModelForm'
import { useModelList } from '../composables/useModelList'
import { usePlatformModels } from '../composables/usePlatformModels'
import ApiKeyManagement from './ApiKeyManagement.vue'

const showModal = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  refresh: []
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const userStore = useUserStore()

// 检查当前用户是否是模型创建人
const isModelCreator = (model: AIModel) => {
  return userStore.userInfo?.uid === model.userId
}

// Composables
const { loading, modelList, pagination, loadModelList, handlePageChange, deleteModel } = useModelList()

const {
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
  handleKeyIdChange: formKeyIdChange,
  handleSubmit: formSubmit
} = useModelForm()

const {
  platformOptions,
  platformModelInfo,
  modelExamples,
  modelDocsUrl,
  modelPlaceholder,
  modelHint,
  loadPlatformList
} = usePlatformModels(formData)

const { apiKeyOptions, apiKeyMap, loadApiKeyOptions } = useApiKeyOptions()

// API 密钥管理
const showApiKeyManagement = ref(false)

// API密钥切换处理（桥接 composable）
const handleKeyIdChange = (keyId: string) => {
  formKeyIdChange(keyId, apiKeyMap.value)
}

// 提交表单（桥接 composable + emit）
const handleSubmit = async () => {
  const success = await formSubmit()
  if (success) {
    loadModelList()
    emit('refresh')
  }
}

// 删除模型（桥接 composable + emit）
const handleDelete = async (id: string) => {
  const success = await deleteModel(id)
  if (success) {
    emit('refresh')
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
  border: 1px solid var(--tjg-border-default);
  border-radius: 8px;
  padding: 16px;
  background: var(--tjg-surface-panel);
  transition: all 0.3s;

  &:hover {
    box-shadow: var(--tjg-shadow-card);
  }

  .model-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .model-name {
      font-size: 16px;
      font-weight: 500;
      color: var(--tjg-text-primary);
    }

    .model-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;

      .meta-item {
        font-size: 12px;
        color: var(--tjg-text-tertiary);
      }
    }
  }

  .model-card-body {
    margin-top: 12px;
  }
}
</style>
