<template>
  <div class="rs-tab" data-testid="notifications-tab">
    <n-spin :show="loading">
      <!-- Section: Notification Level -->
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_notification') }}</h4>

        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_notification_level') }}</label>
          <n-select
            v-model:value="notificationLevel"
            :options="levelOptions"
            :placeholder="t('room.settings_drawer.field_notification_level')" />
        </div>

        <div class="rs-tab__actions">
          <n-button type="primary" :loading="saving" data-testid="notifications-save" @click="handleSave">
            {{ t('common.save') }}
          </n-button>
        </div>
      </section>

      <!-- Section: Local Toggles -->
      <section class="rs-tab__section">
        <div class="rs-tab__field-row">
          <span class="rs-tab__field-label rs-tab__field-label--inline">
            {{ t('room.settings_drawer.toggle_desktop_notification') }}
          </span>
          <n-switch v-model:value="desktopNotification" />
        </div>

        <div class="rs-tab__field-row">
          <span class="rs-tab__field-label rs-tab__field-label--inline">
            {{ t('room.settings_drawer.toggle_sound') }}
          </span>
          <n-switch v-model:value="soundAlert" />
        </div>

        <div class="rs-tab__field-row">
          <span class="rs-tab__field-label rs-tab__field-label--inline">
            {{ t('room.settings_drawer.toggle_preview_content') }}
          </span>
          <n-switch v-model:value="previewContent" />
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

type NotificationLevel = 'all' | 'mentions' | 'mute'

const props = defineProps<{ roomId: string }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const saving = ref(false)
const notificationLevel = ref<NotificationLevel>('all')
const desktopNotification = ref(true)
const soundAlert = ref(true)
const previewContent = ref(false)

const levelOptions = computed(() => [
  { label: t('room.settings_drawer.notification_all'), value: 'all' as NotificationLevel },
  { label: t('room.settings_drawer.notification_mentions'), value: 'mentions' as NotificationLevel },
  { label: t('room.settings_drawer.notification_mute'), value: 'mute' as NotificationLevel }
])

async function loadNotificationLevel() {
  loading.value = true
  try {
    const level = await matrixRoomActionFacade.getNotificationLevel(props.roomId)
    notificationLevel.value = level
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    await matrixRoomActionFacade.setNotificationLevel(props.roomId, notificationLevel.value)
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
    if (id) loadNotificationLevel()
  }
)

onMounted(() => {
  loadNotificationLevel()
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

.rs-tab__field-label--inline {
  display: inline;
  margin-bottom: 0;
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
