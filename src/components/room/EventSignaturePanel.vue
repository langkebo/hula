<template>
  <div class="event-signature-panel" data-testid="event-signature-panel">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('room.event_signature.title') }}</span>
      </template>

      <p class="panel-subtitle">{{ t('room.event_signature.subtitle') }}</p>

      <div class="event-input-row">
        <n-input
          :value="eventId"
          :placeholder="t('room.event_signature.event_id_placeholder')"
          data-testid="event-id-input"
          @update:value="handleEventIdChange" />
      </div>

      <div class="action-row">
        <n-button
          type="primary"
          size="small"
          :disabled="!eventId.trim() || signing"
          :loading="signing"
          data-testid="sign-btn"
          @click="handleSign">
          {{ t('room.event_signature.sign') }}
        </n-button>
        <n-button
          size="small"
          :disabled="!eventId.trim() || verifying"
          :loading="verifying"
          data-testid="verify-btn"
          @click="handleVerify">
          {{ t('room.event_signature.verify') }}
        </n-button>
      </div>

      <div v-if="signResult" class="result-row">
        <span class="result-label">{{ t('room.event_signature.sign_result') }}:</span>
        <code class="result-value">{{ formatResult(signResult) }}</code>
      </div>

      <div v-if="verifyResult" class="result-row">
        <span class="result-label">{{ t('room.event_signature.verify_result') }}:</span>
        <n-tag :type="verifyResult.valid ? 'success' : 'error'" size="small">
          {{ verifyResult.valid ? t('room.event_signature.valid') : t('room.event_signature.invalid') }}
        </n-tag>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixRoomAccountDataService } from '@/services/matrix/room/AccountDataService'

const props = defineProps<{
  roomId: string
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const eventId = ref('')
const signing = ref(false)
const verifying = ref(false)
const signResult = ref<Record<string, unknown> | null>(null)
const verifyResult = ref<{ valid: boolean } | null>(null)

function handleEventIdChange(value: string): void {
  eventId.value = value
}

function formatResult(result: Record<string, unknown>): string {
  return JSON.stringify(result)
}

async function handleSign(): Promise<void> {
  const id = eventId.value.trim()
  if (!id) return
  signing.value = true
  signResult.value = null
  try {
    signResult.value = await matrixRoomAccountDataService.signEvent(props.roomId, id)
    showFeedback(t('room.event_signature.sign_success'), 'success')
  } catch {
    showFeedback(t('room.event_signature.sign_failed'), 'error')
  } finally {
    signing.value = false
  }
}

async function handleVerify(): Promise<void> {
  const id = eventId.value.trim()
  if (!id) return
  verifying.value = true
  verifyResult.value = null
  try {
    const result = await matrixRoomAccountDataService.verifyEvent(props.roomId, id)
    verifyResult.value = { valid: Boolean(result.valid) }
    showFeedback(t('room.event_signature.verify_success'), 'success')
  } catch {
    showFeedback(t('room.event_signature.verify_failed'), 'error')
  } finally {
    verifying.value = false
  }
}
</script>

<style scoped>
.event-signature-panel {
  width: 100%;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
}

.panel-subtitle {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  line-height: 1.5;
}

.event-input-row {
  margin-bottom: 12px;
}

.action-row {
  display: flex;
  gap: 8px;
}

.result-row {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  flex-wrap: wrap;
}

.result-label {
  color: var(--tjg-text-tertiary);
}

.result-value {
  font-family: monospace;
  color: var(--tjg-text-primary);
  word-break: break-all;
  background: var(--tjg-surface-search);
  padding: 2px 6px;
  border-radius: 4px;
}

.result-verifier {
  color: var(--tjg-text-secondary);
  font-family: monospace;
}
</style>
