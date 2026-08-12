<template>
  <div class="rs-tab">
    <section class="rs-tab__section">
      <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_e2ee') }}</h4>

      <div v-if="loading" class="rs-tab__loading" data-testid="security-loading">
        <n-spin size="small" />
      </div>

      <template v-else>
        <div v-if="!isEncrypted" class="rs-tab__field">
          <div class="rs-tab__field-row">
            <div class="rs-tab__field-text">
              <span class="rs-tab__field-label-inline">{{ t('room.settings_drawer.toggle_enable_e2ee') }}</span>
            </div>
            <n-switch
              :value="enabling"
              :disabled="enabling"
              data-testid="security-enable-e2ee-switch"
              @update:value="handleEnableEncryption" />
          </div>
        </div>

        <div v-else class="rs-tab__encrypted-info">
          <div class="rs-tab__field">
            <span class="rs-tab__field-label">{{ t('room.settings_drawer.field_encryption_algorithm') }}</span>
            <n-input :value="algorithm" readonly data-testid="security-algorithm" />
          </div>
          <div class="rs-tab__field">
            <span class="rs-tab__field-label">{{ t('room.settings_drawer.field_key_rotation') }}</span>
            <n-input :value="rotationPeriod" readonly data-testid="security-rotation">
              <template #suffix>
                <span class="rs-tab__field-hint">{{ t('room.settings_drawer.field_key_rotation_hint') }}</span>
              </template>
            </n-input>
          </div>
        </div>

        <div class="rs-tab__field-row rs-tab__field-row--divider">
          <div class="rs-tab__field-text">
            <span class="rs-tab__field-label-inline">{{ t('room.settings_drawer.toggle_federation') }}</span>
          </div>
          <n-switch
            v-model:value="isPublic"
            :loading="savingVisibility"
            data-testid="security-federation-switch"
            @update:value="handleVisibilityChange" />
        </div>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useEncryption } from '@/composables/encryption/useEncryption'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'

const props = defineProps<{
  roomId: string
}>()

defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const encryption = useEncryption()

const loading = ref(false)
const enabling = ref(false)
const savingVisibility = ref(false)
const isEncrypted = ref(false)
const algorithm = ref('')
const rotationPeriod = ref('')
const isPublic = ref(false)

const DAY_MS = 24 * 60 * 60 * 1000

const formatRotation = (ms: number | undefined): string => {
  if (!ms || ms <= 0) return '—'
  const days = Math.round(ms / DAY_MS)
  if (days >= 1) return String(days)
  const hours = Math.round(ms / (60 * 60 * 1000))
  return String(hours)
}

async function loadStatus() {
  loading.value = true
  try {
    const [encrypted, visibility] = await Promise.all([
      encryption.isRoomEncrypted(props.roomId),
      matrixRoomActionFacade.getRoomVisibility(props.roomId)
    ])
    isEncrypted.value = encrypted
    isPublic.value = visibility === 'public'

    if (encrypted) {
      try {
        const settings = await encryption.getEncryptionSettings(props.roomId)
        algorithm.value = (settings?.algorithm as string | undefined) ?? 'm.megolm.v1.aes-sha2'
        rotationPeriod.value = formatRotation(settings?.rotationPeriodMs as number | undefined)
      } catch {
        algorithm.value = 'm.megolm.v1.aes-sha2'
        rotationPeriod.value = '—'
      }
    }
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleEnableEncryption(value: boolean) {
  if (!value) return
  enabling.value = true
  try {
    await encryption.enableRoomEncryption(props.roomId)
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
    await loadStatus()
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    enabling.value = false
  }
}

async function handleVisibilityChange(value: boolean) {
  savingVisibility.value = true
  try {
    await matrixRoomActionFacade.setRoomVisibility(props.roomId, value ? 'public' : 'private')
    isPublic.value = value
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    isPublic.value = !value
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    savingVisibility.value = false
  }
}

onMounted(() => {
  loadStatus()
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
  padding: var(--tjg-space-4) 0;
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

.rs-tab__field-row--divider {
  margin-top: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--tjg-border-muted);
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

.rs-tab__field-hint {
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
}

.rs-tab__encrypted-info {
  display: flex;
  flex-direction: column;
}

@media (prefers-reduced-motion: reduce) {
  .rs-tab__field-row {
    transition: none;
  }
}
</style>
