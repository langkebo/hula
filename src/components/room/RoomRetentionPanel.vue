<template>
  <div class="room-retention-panel" data-testid="room-retention-panel">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('room.retention.title') }}</span>
      </template>

      <n-spin :show="retention.isLoading.value" size="small">
        <p class="panel-subtitle">{{ t('room.retention.subtitle') }}</p>

        <n-radio-group :value="retention.mode.value" :disabled="!canEdit">
          <n-radio
            :radio-value="'unlimited'"
            :model-value="retention.mode.value"
            :disabled="!canEdit"
            data-testid="retention-mode-unlimited"
            @change="handleModeChange('unlimited')">
            {{ t('room.retention.mode_unlimited') }}
          </n-radio>
          <n-radio
            :radio-value="'by_days'"
            :model-value="retention.mode.value"
            :disabled="!canEdit"
            data-testid="retention-mode-by-days"
            @change="handleModeChange('by_days')">
            {{ t('room.retention.mode_by_days') }}
          </n-radio>
          <n-radio
            :radio-value="'by_count'"
            :model-value="retention.mode.value"
            :disabled="!canEdit"
            data-testid="retention-mode-by-count"
            @change="handleModeChange('by_count')">
            {{ t('room.retention.mode_by_count') }}
          </n-radio>
        </n-radio-group>

        <div v-if="retention.mode.value === 'by_days'" class="retention-field">
          <span class="field-label">{{ t('room.retention.days_label') }}</span>
          <n-input-number
            :value="retention.days.value"
            :min="1"
            :max="3650"
            :disabled="!canEdit"
            @update:value="(v: number | null) => retention.setDays(v ?? 1)" />
          <span class="field-hint">{{ t('room.retention.days_hint') }}</span>
        </div>

        <div v-if="retention.mode.value === 'by_count'" class="retention-field">
          <span class="field-label">{{ t('room.retention.count_label') }}</span>
          <n-input-number
            :value="retention.count.value"
            :min="1"
            :max="100000"
            :disabled="!canEdit"
            @update:value="(v: number | null) => retention.setCount(v ?? 1)" />
          <span class="field-hint">{{ t('room.retention.count_hint') }}</span>
        </div>

        <div v-if="!canEdit" class="read-only-hint">{{ t('room.retention.read_only_hint') }}</div>

        <n-button
          type="primary"
          size="small"
          :loading="retention.isSaving.value"
          :disabled="!canEdit || !retention.isConfigValid.value"
          data-testid="retention-save-btn"
          @click="handleSave">
          {{ t('room.retention.save') }}
        </n-button>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useRoomRetention } from '@/composables/room/useRoomRetention'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'

type RetentionMode = 'unlimited' | 'by_days' | 'by_count'

const props = withDefaults(
  defineProps<{
    roomId: string
    canEdit?: boolean
  }>(),
  { canEdit: false }
)

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const retention = useRoomRetention({
  sendStateEvent: async (roomId, _eventType, content) => {
    return await matrixRoomActionFacade.setRetentionPolicy(roomId, content)
  },
  getStateEvent: async (roomId, _eventType) => {
    return await matrixRoomActionFacade.getRetentionPolicy(roomId)
  }
})

onMounted(async () => {
  try {
    await retention.loadPolicy(props.roomId)
  } catch {
    showFeedback(t('room.retention.load_failed'), 'error')
  }
})

function handleModeChange(mode: RetentionMode): void {
  retention.setMode(mode)
}

async function handleSave(): Promise<void> {
  try {
    await retention.savePolicy(props.roomId)
    showFeedback(t('room.retention.save_success'), 'success')
  } catch {
    showFeedback(t('room.retention.save_failed'), 'error')
  }
}
</script>

<style scoped>
.room-retention-panel {
  width: 100%;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
}

.panel-subtitle {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--hula-text-tertiary);
  line-height: 1.5;
}

.retention-field {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.field-label {
  font-size: 13px;
  color: var(--hula-text-secondary);
}

.field-hint {
  font-size: 12px;
  color: var(--hula-text-tertiary);
}

.read-only-hint {
  margin-top: 12px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--hula-text-tertiary);
  background: var(--hula-surface-search);
  border-radius: 6px;
}

.n-button {
  margin-top: 12px;
}
</style>
