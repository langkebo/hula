<template>
  <div class="model-card">
    <div class="model-card-header">
      <n-flex align="center" :size="12">
        <n-avatar round :size="48" :src="modelAvatar" :fallback-src="getDefaultAvatar()" />
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
        <n-button v-if="isCreator" size="small" @click="emit('edit', model)">
          <template #icon>
            <Icon icon="mdi:pencil" />
          </template>
          {{ t('ai_assistant.robot.edit') }}
        </n-button>
        <!-- 只有创建人才显示删除按钮（公开和私有模型都可以删除） -->
        <n-popconfirm
          v-if="isCreator"
          @positive-click="emit('delete', model.id)"
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
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import type { AIModel } from '@/services/matrix/ai/ModelService'

const props = defineProps<{
  model: AIModel
  isCreator: boolean
}>()

const emit = defineEmits<{
  edit: [model: AIModel]
  delete: [id: string]
}>()

const { t } = useI18n()

// 获取默认头像
const getDefaultAvatar = () => {
  return 'https://img1.baidu.com/it/u=3613958228,3522035000&fm=253&fmt=auto&app=120&f=JPEG?w=500&h=500'
}

// 获取模型头像
const modelAvatar = computed(() => {
  return props.model.avatar || getDefaultAvatar()
})
</script>

<style scoped lang="scss">
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
