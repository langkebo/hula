<template>
  <BaseRightDrawer v-model:show="show" :title="t('ai_assistant.robot.model_management')">
    <template #header-extra>
      <n-button type="primary" size="small" @click="emit('add')">
        <template #icon>
          <Icon icon="mdi:plus" />
        </template>
        {{ t('ai_assistant.robot.add_model') }}
      </n-button>
    </template>

    <!-- 模型列表 -->
    <n-spin :show="loading">
      <EmptyState
        v-if="isEmptyModels"
        icon="mdi:package-variant-closed"
        :description="t('ai_assistant.robot.no_models')"
        :action-text="t('ai_assistant.robot.add_first_model')"
        @action="emit('add')" />

      <div v-else class="model-list">
        <ModelCard
          v-for="model in modelList"
          :key="model.id"
          :model="model"
          :is-creator="isModelCreator(model)"
          @edit="emit('edit', $event)"
          @delete="emit('delete', $event)" />
      </div>
    </n-spin>

    <!-- 分页 -->
    <n-flex v-if="pagination.total > pagination.pageSize" justify="center" class="mt-16px">
      <n-pagination
        v-model:page="pagination.pageNo"
        :page-size="pagination.pageSize"
        :page-count="Math.ceil(pagination.total / pagination.pageSize)"
        @update:page="emit('pageChange', $event)" />
    </n-flex>
  </BaseRightDrawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { useUserStore } from '@/stores/domains/user/user'
import ModelCard from './ModelCard.vue'

interface Pagination {
  pageNo: number
  pageSize: number
  total: number
}

const props = defineProps<{
  loading: boolean
  modelList: AIModel[]
  pagination: Pagination
}>()

const isEmptyModels = computed(() => props.modelList.length === 0)

const emit = defineEmits<{
  add: []
  edit: [model: AIModel]
  delete: [id: string]
  pageChange: [page: number]
}>()

const show = defineModel<boolean>('show', { default: false })

const { t } = useI18n()
const userStore = useUserStore()

// 检查当前用户是否是模型创建人
const isModelCreator = (model: AIModel) => {
  return userStore.userInfo?.uid === model.userId
}
</script>

<style scoped lang="scss">
.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
