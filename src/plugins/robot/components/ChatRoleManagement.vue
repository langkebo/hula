<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="t('ai_assistant.robot.role_management')"
    style="width: 1000px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <template #header-extra>
      <n-button type="primary" size="small" @click="handleAdd">
        <template #icon>
          <Icon icon="mdi:plus" />
        </template>
        {{ t('ai_assistant.robot.add_role') }}
      </n-button>
    </template>

    <!-- 角色列表 - 添加滚动容器 -->
    <n-scrollbar style="max-height: calc(80vh - 140px)">
      <n-spin :show="loading">
        <div v-if="roleList.length === 0" class="empty-container">
          <n-empty :description="t('ai_assistant.robot.no_roles')" size="large">
            <template #icon>
              <Icon icon="mdi:account-circle" class="text-48px color-[--hula-text-tertiary]" />
            </template>
            <template #extra>
              <n-button type="primary" @click="handleAdd">{{ t('ai_assistant.robot.add_first_role') }}</n-button>
            </template>
          </n-empty>
        </div>

        <div v-else class="role-list">
          <div v-for="role in roleList" :key="role.id" class="role-card">
            <div class="role-card-header">
              <n-flex align="center" :size="12">
                <n-avatar :src="role.avatar" :size="48" round />
                <div class="flex-1">
                  <n-flex align="center" :size="8">
                    <span class="role-name">{{ role.name }}</span>
                    <n-tag :type="role.status === 0 ? 'success' : 'error'" size="small">
                      {{ role.status === 0 ? t('ai_assistant.robot.available') : t('ai_assistant.robot.unavailable') }}
                    </n-tag>
                    <n-tag v-if="role.publicStatus" type="info" size="small">
                      {{ t('ai_assistant.robot.public') }}
                    </n-tag>
                    <n-tag v-else type="warning" size="small">{{ t('ai_assistant.robot.private') }}</n-tag>
                  </n-flex>
                  <div class="role-meta">
                    <span class="meta-item">
                      {{ t('ai_assistant.robot.category_label', { category: role.category }) }}
                    </span>
                    <span class="meta-item">{{ t('ai_assistant.robot.sort_label', { sort: role.sort }) }}</span>
                  </div>
                </div>
              </n-flex>
              <n-flex :size="8">
                <!-- 只有创建人才显示编辑按钮 -->
                <n-button v-if="isRoleCreator(role)" size="small" @click="handleEdit(role)">
                  <template #icon>
                    <Icon icon="mdi:pencil" />
                  </template>
                  {{ t('ai_assistant.robot.edit') }}
                </n-button>
                <!-- 只有创建人才显示删除按钮 -->
                <n-popconfirm
                  v-if="isRoleCreator(role)"
                  @positive-click="handleDelete(role.id)"
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
                  <p>{{ t('ai_assistant.robot.confirm_delete_role', { name: role.name }) }}</p>
                  <p class="text-red-500">{{ t('ai_assistant.robot.irreversible_warning') }}</p>
                </n-popconfirm>
              </n-flex>
            </div>

            <div class="role-card-body">
              <n-descriptions :column="1" size="small" bordered>
                <n-descriptions-item :label="t('ai_assistant.robot.role_description')">
                  {{ role.description }}
                </n-descriptions-item>
                <n-descriptions-item :label="t('ai_assistant.robot.role_setting')">
                  {{ role.systemMessage }}
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
    </n-scrollbar>
  </n-modal>

  <n-modal
    v-model:show="showEditModal"
    preset="card"
    :title="editingRole ? t('ai_assistant.robot.edit_role') : t('ai_assistant.robot.add_role')"
    style="width: 700px"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }">
    <n-scrollbar style="max-height: calc(80vh - 140px)">
      <n-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-placement="left"
        label-width="100px"
        style="padding-right: 12px">
        <n-form-item :label="t('ai_assistant.robot.role_name')" path="name">
          <n-input v-model:value="formData.name" :placeholder="t('ai_assistant.robot.role_name_placeholder')" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.role_avatar')" path="avatar">
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
          <!-- 隐藏的文件输入 -->
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleFileChange" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.role_category')" path="category">
          <n-select
            v-model:value="formData.category"
            :options="categoryOptions"
            :placeholder="t('ai_assistant.robot.select_role_category')"
            filterable
            tag />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.model_label_short')" path="modelId">
          <n-select
            v-model:value="formData.modelId"
            :options="modelOptions"
            :placeholder="t('ai_assistant.robot.model_optional')"
            clearable />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.sort_value')" path="sort">
          <n-input-number
            v-model:value="formData.sort"
            :min="0"
            :placeholder="t('ai_assistant.robot.sort_hint')"
            style="width: 100%" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.status_label')" path="status">
          <n-select
            v-model:value="formData.status"
            :options="statusOptions"
            :placeholder="t('ai_assistant.robot.select_status')" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.is_public')" path="publicStatus">
          <n-switch v-model:value="formData.publicStatus">
            <template #checked>{{ t('ai_assistant.robot.public') }}</template>
            <template #unchecked>{{ t('ai_assistant.robot.private') }}</template>
          </n-switch>
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.role_description')" path="description">
          <n-input
            v-model:value="formData.description"
            type="textarea"
            :rows="3"
            :placeholder="t('ai_assistant.robot.role_description_placeholder')" />
        </n-form-item>

        <n-form-item :label="t('ai_assistant.robot.role_setting')" path="systemMessage">
          <n-input
            v-model:value="formData.systemMessage"
            type="textarea"
            :rows="5"
            :placeholder="t('ai_assistant.robot.role_setting_placeholder')" />
        </n-form-item>
      </n-form>
    </n-scrollbar>

    <template #footer>
      <n-flex justify="end" :size="12">
        <n-button @click="showEditModal = false">{{ t('ai_assistant.robot.cancel') }}</n-button>
        <n-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ editingRole ? t('ai_assistant.robot.save') : t('ai_assistant.robot.create') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>

  <!-- 头像裁剪组件 -->
  <AvatarCropper ref="cropperRef" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { FormInst, FormRules } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import AvatarCropper from '@/components/common/AvatarCropper.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAvatarUpload } from '@/hooks/useAvatarUpload'
import { useMitt } from '@/hooks/useMitt'
import type { ChatRole } from '@/services/matrix/ai/ChatRoleService'
import { chatRoleService } from '@/services/matrix/ai/ChatRoleService'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { modelService } from '@/services/matrix/ai/ModelService'
import { useUserStore } from '@/stores/domains/user/user'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('ChatRoleManagement')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const timerManager = useTimerManager()

const showModal = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  refresh: []
}>()

const userStore = useUserStore()

// 检查当前用户是否是角色创建人
const isRoleCreator = (role: ChatRole) => {
  return userStore.userInfo?.uid === role.userId
}

// 角色列表
const loading = ref(false)
const roleList = ref<ChatRole[]>([])
const pagination = ref({
  pageNo: 1,
  pageSize: 10,
  total: 0
})

// 编辑相关
const showEditModal = ref(false)
const editingRole = ref<ChatRole | null>(null)
const submitting = ref(false)
const formRef = ref<FormInst>()

// 表单数据
const formData = ref({
  modelId: '',
  name: '',
  avatar: '',
  category: 'AI助手',
  sort: 0,
  description: '',
  systemMessage: '',
  publicStatus: false,
  status: 0
})

type SelectOption = { label: string; value: string | number }

// 类别选项（默认选项）
const categoryOptions = ref<SelectOption[]>([
  { label: t('ai_assistant.robot.category_ai_assistant'), value: 'AI助手' },
  { label: t('ai_assistant.robot.category_writing'), value: '写作' },
  { label: t('ai_assistant.robot.category_programming'), value: '编程开发' },
  { label: t('ai_assistant.robot.category_education'), value: '学习教育' },
  { label: t('ai_assistant.robot.category_entertainment'), value: '生活娱乐' },
  { label: t('ai_assistant.robot.category_business'), value: '商务办公' },
  { label: t('ai_assistant.robot.category_creative'), value: '创意设计' },
  { label: t('ai_assistant.robot.category_data_analysis'), value: '数据分析' },
  { label: t('ai_assistant.robot.category_translation'), value: '翻译' },
  { label: t('ai_assistant.robot.category_other'), value: '其他' }
])

// 模型选项
const modelOptions = ref<SelectOption[]>([])

// 状态选项
const statusOptions = [
  { label: t('ai_assistant.robot.available'), value: 0 },
  { label: t('ai_assistant.robot.unavailable'), value: 1 }
]

// 表单验证规则
const formRules: FormRules = {
  name: [{ required: true, message: t('ai_assistant.robot.input_role_name_required'), trigger: 'blur' }],
  avatar: [{ required: true, message: t('ai_assistant.robot.input_role_avatar_required'), trigger: 'blur' }],
  category: [{ required: true, message: t('ai_assistant.robot.select_role_category_required'), trigger: 'change' }],
  sort: [
    {
      required: true,
      type: 'number',
      message: t('ai_assistant.robot.input_sort_required'),
      trigger: 'blur',
      validator: (_rule: unknown, value: unknown) => {
        return value !== undefined && value !== null && value !== ''
      }
    }
  ],
  description: [{ required: true, message: t('ai_assistant.robot.input_role_description_required'), trigger: 'blur' }],
  systemMessage: [{ required: true, message: t('ai_assistant.robot.input_role_setting_required'), trigger: 'blur' }],
  publicStatus: [
    {
      required: true,
      type: 'boolean',
      message: t('ai_assistant.robot.select_is_public_required'),
      trigger: 'change',
      validator: (_rule: unknown, value: unknown) => {
        return value !== undefined && value !== null
      }
    }
  ],
  status: [
    {
      required: true,
      type: 'number',
      message: t('ai_assistant.robot.select_status_required'),
      trigger: 'change',
      validator: (_rule: unknown, value: unknown) => {
        return value !== undefined && value !== null && value !== ''
      }
    }
  ]
}

// 头像上传
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

// 加载类别列表
const loadCategoryList = async () => {
  try {
    const data = await chatRoleService.categoryList()
    if (data && data.length > 0) {
      categoryOptions.value = data
    }
  } catch (error) {
    logger.error('加载角色类别列表失败:', error)
  }
}

// 加载模型列表
const loadModelList = async () => {
  try {
    const data = await modelService.page({ pageNo: 1, pageSize: 100 })
    modelOptions.value = (data.list || []).map((item: AIModel) => ({
      label: item.name,
      value: item.id
    }))
  } catch (error) {
    logger.error('加载模型列表失败:', error)
    showFeedback(t('ai_assistant.robot.load_models_failed'), 'error')
  }
}

// 加载角色列表
const loadRoleList = async () => {
  loading.value = true
  try {
    const data = await chatRoleService.page({
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })
    roleList.value = data.list || []
    pagination.value.total = data.total || 0
  } catch (error) {
    logger.error('加载角色列表失败:', error)
    showFeedback(t('ai_assistant.robot.load_role_list_failed'), 'error')
  } finally {
    loading.value = false
  }
}

// 分页变化
const handlePageChange = (page: number) => {
  pagination.value.pageNo = page
  loadRoleList()
}

// 新增角色
const handleAdd = () => {
  editingRole.value = null
  formData.value = {
    modelId: '',
    name: '',
    avatar: '',
    category: '',
    sort: 0,
    description: '',
    systemMessage: '',
    publicStatus: false,
    status: 0
  }
  showEditModal.value = true
}

// 编辑角色
const handleEdit = (role: ChatRole) => {
  editingRole.value = role
  formData.value = {
    modelId: role.modelId || '',
    name: role.name,
    avatar: role.avatar,
    category: role.category,
    sort: role.sort ?? 0,
    description: role.description,
    systemMessage: role.systemMessage,
    publicStatus: role.publicStatus ?? false,
    status: role.status ?? 0
  }
  showEditModal.value = true
}

// 提交表单
const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
    submitting.value = true

    const submitData: Partial<ChatRole> = {
      ...formData.value
    }

    if (editingRole.value) {
      // 更新
      await chatRoleService.update({
        id: editingRole.value.id,
        ...submitData
      })
      showFeedback(t('ai_assistant.robot.role_updated'), 'success')
    } else {
      // 创建
      await chatRoleService.create(submitData as ChatRole)
      showFeedback(t('ai_assistant.robot.role_created'), 'success')
    }

    showEditModal.value = false
    // 重置表单
    resetForm()
    loadRoleList()
    emit('refresh')
    // 通知左侧刷新角色状态
    useMitt.emit('refresh-roles')
  } catch (error) {
    if ((error as { errors?: unknown })?.errors) {
      return
    }
    logger.error('保存角色失败:', error)
    showFeedback(t('ai_assistant.robot.save_role_failed'), 'error')
  } finally {
    submitting.value = false
  }
}

// 重置表单
const resetForm = () => {
  formData.value = {
    modelId: '',
    name: '',
    avatar: '',
    category: '',
    sort: 0,
    description: '',
    systemMessage: '',
    publicStatus: false,
    status: 0
  }
  editingRole.value = null
  formRef.value?.restoreValidation()
}

// 删除角色
const handleDelete = async (id: string) => {
  try {
    await chatRoleService.delete({ id })
    showFeedback(t('ai_assistant.robot.role_deleted'), 'success')
    loadRoleList()
    emit('refresh')
    // 通知左侧刷新角色状态
    useMitt.emit('refresh-roles')
  } catch (error) {
    logger.error('删除角色失败:', error)
    showFeedback(t('ai_assistant.robot.delete_role_failed'), 'error')
  }
}

// 监听弹窗显示状态
watch(showModal, (val) => {
  if (val) {
    loadCategoryList()
    loadModelList()
    loadRoleList()
  }
})

// 监听编辑弹窗打开/关闭
watch(showEditModal, (val) => {
  if (val) {
    loadCategoryList()
    loadModelList()
  } else {
    // 延迟重置，避免关闭动画时看到数据清空
    timerManager.setTimeout(() => {
      resetForm()
    }, 300)
  }
})
</script>

<style scoped lang="scss">
.empty-container {
  padding: 40px 0;
}

.role-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.role-card {
  border: 1px solid var(--hula-border-default);
  border-radius: 8px;
  padding: 16px;
  background: var(--hula-surface-panel);
  transition: all 0.3s;

  &:hover {
    box-shadow: var(--hula-shadow-card);
  }

  .role-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .role-name {
      font-size: 16px;
      font-weight: 500;
      color: var(--hula-text-primary);
    }

    .role-meta {
      display: flex;
      gap: 12px;
      margin-top: 4px;

      .meta-item {
        font-size: 12px;
        color: var(--hula-text-tertiary);
      }
    }
  }

  .role-card-body {
    margin-top: 12px;
  }
}
</style>
