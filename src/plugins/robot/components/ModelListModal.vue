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
      <div v-if="modelList.length === 0" class="empty-container">
        <n-empty :description="t('ai_assistant.robot.no_models')" size="large">
          <template #icon>
            <Icon icon="mdi:package-variant-closed" class="text-48px color-[--tjg-text-tertiary]" />
          </template>
          <template #extra>
            <n-button type="primary" @click="emit('add')">{{ t('ai_assistant.robot.add_first_model') }}</n-button>
          </template>
        </n-empty>
      </div>

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
import { useI18n } from 'vue-i18n'
import type { AIModel } from '@/services/matrix/ai/ModelService'
import { useUserStore } from '@/stores/domains/user/user'
import ModelCard from './ModelCard.vue'

interface Pagination {
  pageNo: number
  pageSize: number
  total: number
}

defineProps<{
  loading: boolean
  modelList: AIModel[]
  pagination: Pagination
}>()

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
.empty-container {
  padding: 40px 0;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
