<template>
  <n-popover
    :show="show"
    trigger="click"
    placement="top-start"
    :show-arrow="false"
    style="padding: 0; width: 320px"
    @update:show="emit('update:show', $event)">
    <template #trigger>
      <div class="flex items-center gap-6px cursor-pointer">
        <svg><use href="#model"></use></svg>
        <span class="text-(12px [--tjg-text-primary])">
          {{ selectedModel ? selectedModel.name : t('ai_assistant.robot.select_model') }}
        </span>
      </div>
    </template>
    <div class="model-selector">
      <div class="model-header">
        <span class="model-title">{{ t('ai_assistant.robot.select_model') }}</span>
        <n-flex :size="8">
          <n-button size="small" @click="emit('open-management')">
            <template #icon>
              <Icon icon="mdi:cog" />
            </template>
            {{ t('ai_assistant.robot.manage_short') }}
          </n-button>
          <n-input
            :value="modelSearch"
            :placeholder="t('ai_assistant.robot.search_model')"
            clearable
            size="small"
            style="width: 140px"
            @update:value="emit('update:model-search', $event)">
            <template #prefix>
              <Icon icon="mdi:magnify" class="text-16px color-[--tjg-text-tertiary]" />
            </template>
          </n-input>
        </n-flex>
      </div>

      <div class="model-list">
        <div v-if="modelLoading" class="loading-container">
          <n-spin size="small" />
          <span class="loading-text">{{ t('ai_assistant.robot.loading') }}</span>
        </div>

        <div v-else-if="filteredModels.length === 0" class="empty-container">
          <n-empty :description="t('ai_assistant.robot.no_model_data')" size="small">
            <template #icon>
              <Icon icon="mdi:package-variant-closed" class="text-24px color-[--tjg-text-tertiary]" />
            </template>
          </n-empty>
        </div>

        <div v-else class="models-container">
          <div v-if="officialModels.length > 0">
            <div class="model-section-title">{{ t('ai_assistant.robot.official_models') }}</div>
            <div
              v-for="model in officialModels"
              :key="model.id"
              :class="['model-item', { 'model-item-active': selectedModel?.id === model.id }]"
              @click="emit('select-model', model)">
              <n-avatar
                round
                :size="40"
                :src="getModelAvatar(model)"
                :fallback-src="getDefaultAvatar()"
                class="mr-12px flex-shrink-0" />
              <div class="model-info">
                <div class="model-name">
                  {{ model.name }}
                  <n-tag v-if="model.type === 1" size="tiny" type="info" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_chat') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 2" size="tiny" type="success" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_image') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 3" size="tiny" type="primary" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_audio') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 4" size="tiny" type="warning" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_video') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 5" size="tiny" type="default" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_vector') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 6" size="tiny" type="default" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_rerank') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 7" size="tiny" type="warning" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_text2video') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 8" size="tiny" type="error" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_image2video') }}
                  </n-tag>
                </div>
                <div class="model-description">{{ model.description || t('ai_assistant.robot.no_description') }}</div>
                <div class="model-meta">
                  <span class="model-provider">{{ model.platform }}</span>
                  <span class="model-version">v{{ model.model }}</span>
                </div>
              </div>
              <div class="model-status">
                <n-tag v-if="model.status === 0" type="success" size="small">
                  {{ t('ai_assistant.robot.available') }}
                </n-tag>
                <n-tag v-else type="error" size="small">{{ t('ai_assistant.robot.unavailable') }}</n-tag>
              </div>
            </div>
          </div>

          <div v-if="officialModels.length > 0 && userModels.length > 0" class="model-divider"></div>

          <div v-if="userModels.length > 0">
            <div class="model-section-title">{{ t('ai_assistant.robot.custom_models') }}</div>
            <div
              v-for="model in userModels"
              :key="model.id"
              :class="['model-item', { 'model-item-active': selectedModel?.id === model.id }]"
              @click="emit('select-model', model)">
              <n-avatar
                round
                :size="40"
                :src="getModelAvatar(model)"
                :fallback-src="getDefaultAvatar()"
                class="mr-12px flex-shrink-0" />
              <div class="model-info">
                <div class="model-name">
                  {{ model.name }}
                  <n-tag v-if="model.type === 1" size="tiny" type="info" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_chat') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 2" size="tiny" type="success" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_image') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 3" size="tiny" type="primary" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_audio') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 4" size="tiny" type="warning" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_video') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 5" size="tiny" type="default" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_vector') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 6" size="tiny" type="default" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_rerank') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 7" size="tiny" type="warning" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_text2video') }}
                  </n-tag>
                  <n-tag v-else-if="model.type === 8" size="tiny" type="error" class="ml-4px">
                    {{ t('ai_assistant.robot.model_type_image2video') }}
                  </n-tag>
                </div>
                <div class="model-description">{{ model.description || t('ai_assistant.robot.no_description') }}</div>
                <div class="model-meta">
                  <span class="model-provider">{{ model.platform }}</span>
                  <span class="model-version">v{{ model.model }}</span>
                </div>
              </div>
              <div class="model-status">
                <n-tag v-if="model.status === 0" type="success" size="small">
                  {{ t('ai_assistant.robot.available') }}
                </n-tag>
                <n-tag v-else type="error" size="small">{{ t('ai_assistant.robot.unavailable') }}</n-tag>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="modelPagination.total > modelPagination.pageSize" class="model-pagination">
        <n-pagination
          :page="modelPagination.pageNo"
          :page-size="modelPagination.pageSize"
          :page-count="Math.ceil(modelPagination.total / modelPagination.pageSize)"
          size="small"
          @update:page="emit('page-change', $event)" />
      </div>
    </div>
  </n-popover>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import type { PaginationState } from '@/plugins/robot/composables/useRobotChat'
import type { AIModel } from '@/services/matrix/ai/ModelService'

const { t } = useI18n()

defineProps<{
  show: boolean
  selectedModel: AIModel | null
  modelSearch: string
  modelLoading: boolean
  filteredModels: AIModel[]
  officialModels: AIModel[]
  userModels: AIModel[]
  modelPagination: PaginationState
  getDefaultAvatar: () => string
  getModelAvatar: (model: AIModel | null) => string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'update:model-search': [value: string]
  'select-model': [model: AIModel]
  'open-management': []
  'page-change': [page: number]
}>()
</script>
