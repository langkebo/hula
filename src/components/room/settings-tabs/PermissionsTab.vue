<template>
  <div class="rs-tab">
    <section class="rs-tab__section">
      <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_permissions_matrix') }}</h4>

      <div v-if="loading" class="rs-tab__loading" data-testid="permissions-loading">
        <n-spin size="small" />
      </div>

      <template v-else>
        <div class="rs-tab__power-matrix">
          <template v-for="row in permissionRows" :key="row.key">
            <div class="rs-tab__power-cell rs-tab__power-cell--label">
              {{ t(row.labelKey) }}
            </div>
            <div class="rs-tab__power-cell">
              <n-select
                v-model:value="row.draft"
                :options="levelOptions"
                size="small"
                data-testid="permissions-level-select" />
            </div>
            <div class="rs-tab__power-cell rs-tab__power-cell--current" data-testid="permissions-current-value">
              {{ row.current }}
            </div>
          </template>
        </div>

        <div class="rs-tab__actions">
          <n-button
            type="primary"
            :loading="saving"
            :disabled="!hasChanges"
            data-testid="permissions-save-button"
            @click="handleSave">
            {{ t('common.save') }}
          </n-button>
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'

const props = defineProps<{
  roomId: string
}>()

defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const saving = ref(false)
const powerLevels = ref<Record<string, unknown>>({})

interface PermissionRow {
  key: string
  labelKey: string
  draft: number
  current: number
}

const levelOptions = [
  { label: t('room.settings_drawer.permission_level_0'), value: 0 },
  { label: t('room.settings_drawer.permission_level_50'), value: 50 },
  { label: t('room.settings_drawer.permission_level_100'), value: 100 }
]

const readLevel = (map: Record<string, unknown>, topKey: string, eventKey?: string, fallbackKey?: string): number => {
  if (eventKey) {
    const events = (map['events'] as Record<string, unknown> | undefined) ?? {}
    if (events[eventKey] !== undefined) return Number(events[eventKey]) || 0
  }
  if (fallbackKey && map[fallbackKey] !== undefined) return Number(map[fallbackKey]) || 0
  if (map[topKey] !== undefined) return Number(map[topKey]) || 0
  return 0
}

const permissionRows = reactive<PermissionRow[]>([
  { key: 'kick', labelKey: 'room.settings_drawer.permission_kick', draft: 0, current: 0 },
  { key: 'invite', labelKey: 'room.settings_drawer.permission_invite', draft: 0, current: 0 },
  { key: 'send_message', labelKey: 'room.settings_drawer.permission_send_message', draft: 0, current: 0 },
  { key: 'modify_topic', labelKey: 'room.settings_drawer.permission_modify_topic', draft: 0, current: 0 },
  { key: 'modify_name', labelKey: 'room.settings_drawer.permission_modify_name', draft: 0, current: 0 }
])

const syncRowsFromLevels = () => {
  const map = powerLevels.value
  const updates: Array<{ row: PermissionRow; value: number }> = [
    { row: permissionRows[0], value: readLevel(map, 'ban') },
    { row: permissionRows[1], value: readLevel(map, 'invite') },
    { row: permissionRows[2], value: readLevel(map, 'events_default', 'm.room.message', 'events_default') },
    { row: permissionRows[3], value: readLevel(map, 'state_default', 'm.room.topic', 'state_default') },
    { row: permissionRows[4], value: readLevel(map, 'state_default', 'm.room.name', 'state_default') }
  ]
  updates.forEach(({ row, value }) => {
    row.current = value
    row.draft = value
  })
}

const hasChanges = computed(() => permissionRows.some((row) => row.draft !== row.current))

async function loadPowerLevels() {
  loading.value = true
  try {
    const content = await matrixRoomActionFacade.getPowerLevels(props.roomId)
    powerLevels.value = content ?? {}
    syncRowsFromLevels()
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  saving.value = true
  try {
    const content: Record<string, unknown> = { ...powerLevels.value }
    const events = { ...((content['events'] as Record<string, unknown> | undefined) ?? {}) }
    const rowByKey = new Map(permissionRows.map((r) => [r.key, r]))

    const banRow = rowByKey.get('kick')!
    content['ban'] = banRow.draft

    const inviteRow = rowByKey.get('invite')!
    content['invite'] = inviteRow.draft

    const sendRow = rowByKey.get('send_message')!
    content['events_default'] = sendRow.draft
    events['m.room.message'] = sendRow.draft

    const topicRow = rowByKey.get('modify_topic')!
    content['state_default'] = topicRow.draft
    events['m.room.topic'] = topicRow.draft

    const nameRow = rowByKey.get('modify_name')!
    events['m.room.name'] = nameRow.draft

    content['events'] = events

    await matrixRoomActionFacade.setPowerLevels(props.roomId, content)
    powerLevels.value = content
    syncRowsFromLevels()
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadPowerLevels()
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

.rs-tab__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--tjg-space-6) 0;
}

.rs-tab__power-matrix {
  display: grid;
  grid-template-columns: 140px 1fr 60px;
  gap: 6px;
  font-size: var(--tjg-font-size-xs);
  align-items: center;
}

.rs-tab__power-cell {
  padding: 6px 8px;
  background: var(--tjg-surface-app);
  border-radius: var(--tjg-radius-sm);
  color: var(--tjg-text-primary);
}

.rs-tab__power-cell--label {
  font-size: var(--tjg-font-size-sm);
}

.rs-tab__power-cell--current {
  text-align: center;
  color: var(--tjg-text-secondary);
}

.rs-tab__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 14px;
}

@media (prefers-reduced-motion: reduce) {
  .rs-tab__power-cell {
    transition: none;
  }
}
</style>
