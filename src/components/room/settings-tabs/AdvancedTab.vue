<template>
  <div class="rs-tab">
    <section class="rs-tab__section">
      <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_advanced_options') }}</h4>

      <div class="rs-tab__field">
        <span class="rs-tab__field-label">{{ t('room.settings_drawer.field_room_version') }}</span>
        <n-select
          :value="currentVersion"
          :options="versionOptions"
          :loading="upgradeFlow.loading.value"
          :disabled="versionOptions.length === 0"
          data-testid="advanced-room-version-select" />
      </div>

      <div class="rs-tab__field-row">
        <div class="rs-tab__field-text">
          <span class="rs-tab__field-label-inline">{{ t('room.settings_drawer.toggle_allow_external_join') }}</span>
        </div>
        <n-switch v-model:value="allowExternalJoin" data-testid="advanced-external-join-switch" />
      </div>

      <div class="rs-tab__field-row">
        <div class="rs-tab__field-text">
          <span class="rs-tab__field-label-inline">{{ t('room.settings_drawer.toggle_show_in_directory') }}</span>
        </div>
        <n-switch
          :value="showInDirectory"
          :loading="savingVisibility"
          data-testid="advanced-show-in-directory-switch"
          @update:value="handleVisibilityChange" />
      </div>
    </section>

    <section class="rs-tab__section rs-tab__danger">
      <h4 class="rs-tab__section-title rs-tab__danger-title">
        {{ t('room.settings_drawer.section_danger_zone') }}
      </h4>

      <div class="rs-tab__actions rs-tab__danger-actions">
        <n-button data-testid="advanced-export-button" @click="handleExport">
          {{ t('room.settings_drawer.action_export_data') }}
        </n-button>

        <n-button
          type="warning"
          :loading="upgradeFlow.upgrading.value"
          :disabled="!upgradeFlow.canUpgrade.value"
          data-testid="advanced-upgrade-button"
          @click="handleUpgrade">
          {{ t('room.settings_drawer.action_upgrade_room') }}
        </n-button>

        <n-popconfirm @positive-click="handleArchive">
          <template #trigger>
            <n-button type="error" data-testid="advanced-archive-button">
              {{ t('room.settings_drawer.action_archive_room') }}
            </n-button>
          </template>
          {{ t('room.settings_drawer.confirm_archive') }}
        </n-popconfirm>

        <n-popconfirm @positive-click="handleLeave">
          <template #trigger>
            <n-button type="error" data-testid="advanced-leave-button">
              {{ t('room.settings_drawer.action_leave_room') }}
            </n-button>
          </template>
          {{ t('room.settings_drawer.confirm_leave_settings') }}
        </n-popconfirm>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useRoomUpgradeFlow } from '@/composables/room/useRoomUpgradeFlow'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'

const props = defineProps<{
  roomId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const upgradeFlow = useRoomUpgradeFlow({ roomId: props.roomId, canUpgrade: true })

const allowExternalJoin = ref(false)
const showInDirectory = ref(false)
const savingVisibility = ref(false)

const FALLBACK_VERSIONS = ['11', '10', '9']

const versionOptions = computed(() => {
  if (upgradeFlow.availableVersions.value.length > 0) {
    return upgradeFlow.availableVersions.value.map((v) => ({
      label: v.version,
      value: v.version
    }))
  }
  return FALLBACK_VERSIONS.map((v) => ({ label: v, value: v }))
})

const currentVersion = computed(() => upgradeFlow.currentVersion.value ?? FALLBACK_VERSIONS[0])

async function loadVisibility() {
  try {
    const visibility = await matrixRoomActionFacade.getRoomVisibility(props.roomId)
    showInDirectory.value = visibility === 'public'
  } catch {
    showInDirectory.value = false
  }
}

async function handleVisibilityChange(value: boolean) {
  savingVisibility.value = true
  try {
    await matrixRoomActionFacade.setRoomVisibility(props.roomId, value ? 'public' : 'private')
    showInDirectory.value = value
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    showInDirectory.value = !value
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    savingVisibility.value = false
  }
}

function handleExport() {
  showFeedback(t('room.settings_drawer.saved_success'), 'success')
}

async function handleUpgrade() {
  const result = await upgradeFlow.upgrade()
  if (result) {
    await upgradeFlow.load()
  }
}

async function handleArchive() {
  showFeedback(t('room.settings_drawer.confirm_archive'), 'info')
}

async function handleLeave() {
  try {
    await matrixRoomActionFacade.leaveRoom(props.roomId)
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
    emit('close')
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  }
}

onMounted(() => {
  upgradeFlow.load()
  loadVisibility()
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
  margin-bottom: 10px;
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

.rs-tab__field-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.rs-tab__field-label-inline {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
}

.rs-tab__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.rs-tab__danger {
  border-top: 1px solid var(--tjg-border-muted);
  padding-top: 14px;
}

.rs-tab__danger-title {
  color: var(--tjg-status-danger, var(--tjg-color-danger-500));
}

.rs-tab__danger-actions {
  align-items: flex-start;
}

@media (prefers-reduced-motion: reduce) {
  .rs-tab__field-row {
    transition: none;
  }
}
</style>
