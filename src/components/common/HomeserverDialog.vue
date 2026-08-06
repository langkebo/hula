<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="t('menu.homeserver')"
    :style="{ width: '400px' }"
    :mask-closable="false"
    :closable="true"
    @close="handleClose">
    <div class="homeserver-config">
      <div class="config-item">
        <div class="config-label">{{ t('menu.homeserver_url') }}</div>
        <n-input
          v-model:value="homeserverUrl"
          :placeholder="t('menu.homeserver_placeholder')"
          clearable
          @keyup.enter="handleSave" />
      </div>
      <div class="config-hint">
        <p>{{ t('menu.homeserver_hint') }}</p>
        <p class="example">{{ t('menu.homeserver_example') }}: http://localhost:8008</p>
      </div>
    </div>
    <template #footer>
      <div class="modal-footer">
        <n-button @click="handleClose">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="saving" @click="handleSave">{{ t('common.save') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { NButton, NInput, NModal } from 'naive-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import {
  discoverAndSaveMatrixEndpoints,
  isPotentialHomeserverInput,
  resolveMatrixEndpointConfig,
  saveMatrixIdentityServerUrl
} from '@/services/backend'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('HomeserverDialog')

type HomeserverEndpointPayload = {
  homeserverUrl: string
  identityServerUrl: string
}

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const showModal = defineModel<boolean>('show', { default: false })

const homeserverUrl = ref('')
const saving = ref(false)

const emit = defineEmits<(e: 'save', endpoint: HomeserverEndpointPayload) => void>()

watch(
  () => showModal.value,
  (val) => {
    if (val) {
      homeserverUrl.value = resolveMatrixEndpointConfig().homeserverUrl
    }
  }
)

function handleClose() {
  showModal.value = false
}

async function handleSave() {
  if (!homeserverUrl.value.trim()) {
    showFeedback(t('menu.homeserver_empty'), 'warning')
    return
  }

  const rawValue = homeserverUrl.value.trim()

  if (!isPotentialHomeserverInput(rawValue)) {
    showFeedback(t('menu.homeserver_invalid'), 'warning')
    return
  }

  saving.value = true

  try {
    const discovery = await discoverAndSaveMatrixEndpoints(rawValue, resolveMatrixEndpointConfig())
    homeserverUrl.value = discovery.homeserverUrl
    if (!discovery.identityServerUrl) {
      saveMatrixIdentityServerUrl('')
    }
    emit('save', {
      homeserverUrl: discovery.homeserverUrl,
      identityServerUrl: discovery.identityServerUrl
    })
    showFeedback(t('menu.homeserver_saved'), 'success')
    showModal.value = false
  } catch (error) {
    logger.error('Failed to save homeserver URL:', error)
    showFeedback(t('menu.homeserver_save_failed'), 'error')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.homeserver-config {
  padding: 8px 0;
}

.config-item {
  margin-bottom: 16px;
}

.config-label {
  font-size: 14px;
  color: var(--tjg-text-primary);
  margin-bottom: 8px;
}

.config-hint {
  font-size: 12px;
  color: var(--tjg-text-quaternary);
  line-height: 1.6;
}

.config-hint .example {
  margin-top: 4px;
  color: var(--tjg-text-secondary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
