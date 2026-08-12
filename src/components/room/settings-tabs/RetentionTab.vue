<template>
  <div class="rs-tab" data-testid="retention-tab">
    <n-spin :show="retention.isLoading.value">
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_retention_policy') }}</h4>

        <!-- Enable Toggle -->
        <div class="rs-tab__field-row">
          <span class="rs-tab__field-label" style="margin-bottom: 0">
            {{ t('room.settings_drawer.toggle_enable_retention') }}
          </span>
          <n-switch :value="retentionEnabled" @update:value="handleToggleRetention" />
        </div>

        <!-- Configurable area when enabled -->
        <template v-if="retentionEnabled">
          <!-- Mode Select -->
          <div class="rs-tab__field">
            <label class="rs-tab__field-label">{{ t('room.settings_drawer.section_retention_policy') }}</label>
            <n-select :value="retention.mode.value" :options="modeOptions" @update:value="handleModeChange" />
          </div>

          <!-- Days input (visible for by_days mode) -->
          <div v-if="retention.mode.value === 'by_days'" class="rs-tab__field">
            <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_retention_max_days') }}</label>
            <n-input-number
              :value="retention.days.value"
              :min="1"
              :max="3650"
              style="width: 100%"
              @update:value="(v: number | null) => retention.setDays(v ?? 1)" />
          </div>

          <!-- Count input (visible for by_count mode) -->
          <div v-if="retention.mode.value === 'by_count'" class="rs-tab__field">
            <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_retention_max_days') }}</label>
            <n-input-number
              :value="retention.count.value"
              :min="1"
              :max="100000"
              style="width: 100%"
              @update:value="(v: number | null) => retention.setCount(v ?? 1)" />
          </div>

          <!-- Action Select -->
          <div class="rs-tab__field">
            <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_retention_action') }}</label>
            <n-select v-model:value="action" :options="actionOptions" />
          </div>
        </template>
      </section>
    </n-spin>

    <div class="rs-tab__actions">
      <n-button
        type="primary"
        :loading="retention.isSaving.value"
        :disabled="!retention.isConfigValid.value"
        @click="handleSave">
        <template #icon>
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <path d="M17 21v-8H7v8" />
            <path d="M7 3v5h8" />
          </svg>
        </template>
        {{ t('room.settings_drawer.action_add') }}
      </n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useRoomRetention } from '@/composables/room/useRoomRetention'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'

type RetentionMode = 'unlimited' | 'by_days' | 'by_count'

const props = defineProps<{ roomId: string }>()
defineEmits<{ close: [] }>()

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

const action = ref<'delete' | 'archive'>('delete')

const retentionEnabled = computed<boolean>({
  get: () => retention.mode.value !== 'unlimited',
  set: (enabled: boolean) => {
    if (!enabled) {
      retention.setMode('unlimited')
    } else if (retention.mode.value === 'unlimited') {
      retention.setMode('by_days')
    }
  }
})

const modeOptions = computed(() => [
  { label: 'unlimited', value: 'unlimited' as RetentionMode },
  { label: 'by_days', value: 'by_days' as RetentionMode },
  { label: 'by_count', value: 'by_count' as RetentionMode }
])

const actionOptions = computed(() => [
  { label: t('room.settings_drawer.retention_delete'), value: 'delete' },
  { label: t('room.settings_drawer.retention_archive'), value: 'archive' }
])

function handleToggleRetention(enabled: boolean): void {
  retentionEnabled.value = enabled
}

function handleModeChange(mode: RetentionMode): void {
  retention.setMode(mode)
}

async function handleSave(): Promise<void> {
  try {
    await retention.savePolicy(props.roomId)
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  }
}

onMounted(async () => {
  try {
    await retention.loadPolicy(props.roomId)
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  }
})
</script>

<style scoped lang="scss">
.rs-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.rs-tab__section {
  display: flex;
  flex-direction: column;
}
.rs-tab__section-title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin: 0 0 10px 0;
}
.rs-tab__field {
  margin-bottom: 12px;
}
.rs-tab__field-label {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  margin-bottom: 5px;
}
.rs-tab__field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0;
}
.rs-tab__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

@media (prefers-reduced-motion: reduce) {
  .rs-tab,
  .rs-tab * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
