<template>
  <div class="rs-tab" data-testid="history-tab">
    <n-spin :show="loading">
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_history_visibility') }}</h4>

        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_history_visibility') }}</label>
          <n-select
            v-model:value="historyVisibility"
            :options="historyOptions"
            :placeholder="t('room.settings_drawer.field_history_visibility')" />
        </div>

        <div class="rs-tab__actions">
          <n-button
            type="primary"
            :loading="saving"
            :disabled="!historyVisibility"
            data-testid="history-save"
            @click="handleSave">
            {{ t('common.save') }}
          </n-button>
        </div>
      </section>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'

type HistoryVisibility = 'shared' | 'invited' | 'world_readable'

const props = defineProps<{ roomId: string }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const saving = ref(false)
const historyVisibility = ref<HistoryVisibility | ''>('')

const historyOptions = computed(() => [
  { label: t('room.settings_drawer.history_shared'), value: 'shared' as HistoryVisibility },
  { label: t('room.settings_drawer.history_invited'), value: 'invited' as HistoryVisibility },
  { label: t('room.settings_drawer.history_world_readable'), value: 'world_readable' as HistoryVisibility }
])

async function loadHistoryVisibility() {
  loading.value = true
  try {
    const value = await matrixRoomActionFacade.getHistoryVisibility(props.roomId)
    historyVisibility.value = (value as HistoryVisibility) || 'shared'
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!historyVisibility.value) return
  saving.value = true
  try {
    await matrixRoomActionFacade.setHistoryVisibility(props.roomId, historyVisibility.value)
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    saving.value = false
  }
}

watch(
  () => props.roomId,
  (id) => {
    if (id) loadHistoryVisibility()
  }
)

onMounted(() => {
  loadHistoryVisibility()
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
