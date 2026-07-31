<template>
  <div class="room-vault-data-panel" data-testid="room-vault-data-panel">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('room.vault.title') }}</span>
      </template>

      <n-spin :show="loading" size="small">
        <p class="panel-subtitle">{{ t('room.vault.subtitle') }}</p>

        <template v-if="hasData">
          <n-descriptions bordered :column="1" label-placement="left" size="small">
            <n-descriptions-item v-for="(val, key) in editMode ? editDraft : vaultData" :key="key" :label="String(key)">
              <template v-if="editMode">
                <n-input
                  :value="String(editDraft[key] ?? '')"
                  :placeholder="t('room.vault.value_placeholder')"
                  data-testid="vault-edit-input"
                  @update:value="handleEditField(String(key), $event)" />
              </template>
              <template v-else>{{ formatValue(val) }}</template>
            </n-descriptions-item>
          </n-descriptions>
        </template>

        <n-empty v-else :description="t('room.vault.empty')" size="small" />

        <div v-if="editMode" class="vault-add-row">
          <n-input :value="newKey" :placeholder="t('room.vault.key_placeholder')" data-testid="vault-new-key" />
          <n-input :value="newValue" :placeholder="t('room.vault.value_placeholder')" data-testid="vault-new-value" />
          <n-button size="small" data-testid="vault-add-btn" @click="handleAddField">
            {{ t('room.vault.add_field') }}
          </n-button>
        </div>

        <div class="vault-actions">
          <template v-if="editMode">
            <n-button type="primary" size="small" :loading="saving" data-testid="vault-save-btn" @click="handleSave">
              {{ t('room.vault.save') }}
            </n-button>
            <n-button size="small" data-testid="vault-cancel-btn" @click="handleCancelEdit">
              {{ t('common.cancel') }}
            </n-button>
          </template>
          <n-button v-else size="small" data-testid="vault-edit-btn" @click="handleStartEdit">
            {{ t('room.vault.edit') }}
          </n-button>
        </div>
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixRoomAccountDataService } from '@/services/matrix/room/AccountDataService'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(true)
const saving = ref(false)
const vaultData = ref<Record<string, unknown>>({})
const editMode = ref(false)
const editDraft = ref<Record<string, unknown>>({})
const newKey = ref('')
const newValue = ref('')

const hasData = computed(() => {
  const data = editMode.value ? editDraft.value : vaultData.value
  return data && Object.keys(data).length > 0
})

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

async function loadVaultData() {
  loading.value = true
  try {
    vaultData.value = await matrixRoomAccountDataService.getVaultData(props.roomId)
  } catch {
    vaultData.value = {}
  } finally {
    loading.value = false
  }
}

function handleStartEdit(): void {
  editDraft.value = { ...vaultData.value }
  editMode.value = true
}

function handleCancelEdit(): void {
  editMode.value = false
  editDraft.value = {}
  newKey.value = ''
  newValue.value = ''
}

function handleEditField(key: string, value: string): void {
  editDraft.value = { ...editDraft.value, [key]: value }
}

function handleAddField(): void {
  const key = newKey.value.trim()
  if (!key) return
  editDraft.value = { ...editDraft.value, [key]: newValue.value }
  newKey.value = ''
  newValue.value = ''
}

async function handleSave(): Promise<void> {
  saving.value = true
  try {
    await matrixRoomAccountDataService.setVaultData(props.roomId, editDraft.value)
    vaultData.value = { ...editDraft.value }
    editMode.value = false
    showFeedback(t('room.vault.save_success'), 'success')
  } catch {
    showFeedback(t('room.vault.save_failed'), 'error')
  } finally {
    saving.value = false
  }
}

onMounted(loadVaultData)

watch(
  () => props.roomId,
  (newId) => {
    if (newId) loadVaultData()
  }
)
</script>

<style scoped>
.room-vault-data-panel {
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

.vault-add-row {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.vault-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}
</style>
