<template>
  <!-- 模型列表弹窗 -->
  <ModelListModal
    v-model:show="showModal"
    :loading="loading"
    :model-list="modelList"
    :pagination="pagination"
    @add="handleAdd"
    @edit="handleEdit"
    @delete="handleDelete"
    @page-change="handlePageChange" />

  <!-- 新增/编辑模型弹窗 -->
  <ModelFormModal
    ref="formRef"
    v-model:show="showEditModal"
    :editing-model="editingModel"
    :submitting="submitting"
    :form-data="formData"
    :form-rules="formRules"
    :status-options="statusOptions"
    :api-key-options="apiKeyOptions"
    :model-examples="modelExamples"
    :model-docs-url="modelDocsUrl"
    :model-placeholder="modelPlaceholder"
    :model-hint="modelHint"
    @submit="handleSubmit"
    @key-id-change="handleKeyIdChange"
    @name-change="handleNameChange"
    @public-status-change="handlePublicStatusChange"
    @open-api-key-management="showApiKeyManagement = true" />

  <!-- API 密钥管理弹窗 -->
  <ApiKeyManagement v-model="showApiKeyManagement" @refresh="loadApiKeyOptions" />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useApiKeyOptions } from '../composables/useApiKeyOptions'
import { useModelForm } from '../composables/useModelForm'
import { useModelList } from '../composables/useModelList'
import { usePlatformModels } from '../composables/usePlatformModels'
import ApiKeyManagement from './ApiKeyManagement.vue'
import ModelFormModal from './ModelFormModal.vue'
import ModelListModal from './ModelListModal.vue'

const showModal = defineModel<boolean>({ default: false })
const emit = defineEmits<{
  refresh: []
}>()

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

const { modelExamples, modelDocsUrl, modelPlaceholder, modelHint, loadPlatformList } = usePlatformModels(formData)

const { apiKeyOptions, apiKeyMap, loadApiKeyOptions } = useApiKeyOptions()

// API 密钥管理弹窗
const showApiKeyManagement = ref(false)

// API 密钥切换处理（桥接 composable）
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
