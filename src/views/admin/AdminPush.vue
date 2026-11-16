<template>
  <div class="admin-push">
    <n-alert :bordered="false" type="warning">{{ t('admin.push.hint') }}</n-alert>

    <n-alert
      v-if="configError"
      data-testid="admin-push-config-error"
      class="mt-16px"
      type="error"
      closable
      @close="configError = null">
      {{ configError }}
    </n-alert>

    <n-card :title="t('admin.push.configTitle')" class="mt-16px">
      <template #header-extra>
        <n-button data-testid="admin-push-config-refresh" :loading="configLoading" @click="loadConfig">
          {{ t('admin.common.refresh') }}
        </n-button>
      </template>

      <n-space vertical size="large">
        <div>
          <div class="section-label">{{ t('admin.push.initializedProviders') }}</div>
          <n-space v-if="config && config.initialized_providers.length > 0" size="small">
            <n-tag v-for="provider in config.initialized_providers" :key="provider" size="small" type="success">
              {{ provider }}
            </n-tag>
          </n-space>
          <EmptyState v-else compact variant="subtle" :description="t('admin.push.noProviders')" />
        </div>

        <div>
          <div class="section-label">{{ t('admin.push.supportedKeys') }}</div>
          <n-space v-if="config?.supported_keys && config.supported_keys.length > 0" size="small">
            <n-tag v-for="key in config.supported_keys" :key="key" size="small">{{ key }}</n-tag>
          </n-space>
          <EmptyState v-else compact variant="subtle" :description="t('admin.push.noSupportedKeys')" />
        </div>

        <n-data-table
          :columns="configColumns"
          :data="configRows"
          :loading="configLoading"
          :row-key="(row: ConfigRow) => row.key"
          :scroll-x="640" />

        <EmptyState
          v-if="!configLoading && configRows.length === 0"
          compact
          data-testid="admin-push-config-empty"
          :description="t('admin.push.configEmpty')" />
      </n-space>
    </n-card>

    <n-card :title="t('admin.push.patchTitle')" class="mt-16px">
      <n-space vertical>
        <n-alert :bordered="false" type="info">{{ t('admin.push.patchHint') }}</n-alert>
        <n-space align="center" :wrap="true">
          <n-input
            v-model:value="patchKey"
            data-testid="admin-push-patch-key"
            :placeholder="t('admin.push.patchKeyPlaceholder')"
            class="w-[240px]" />
          <n-input
            v-model:value="patchValue"
            data-testid="admin-push-patch-value"
            :placeholder="t('admin.push.patchValuePlaceholder')"
            class="w-[280px]" />
          <n-button
            data-testid="admin-push-patch-submit"
            type="primary"
            :loading="configSaving"
            @click="handleSaveConfig">
            {{ t('admin.push.patchSubmit') }}
          </n-button>
        </n-space>
      </n-space>
    </n-card>

    <n-card :title="t('admin.push.processTitle')" class="mt-16px">
      <n-space vertical>
        <n-alert :bordered="false" type="info">{{ t('admin.push.processHint') }}</n-alert>
        <n-space align="center" :wrap="true">
          <n-input-number
            v-model:value="batchSize"
            data-testid="admin-push-process-batch"
            :min="1"
            :max="500"
            class="w-[180px]" />
          <n-button data-testid="admin-push-process-submit" :loading="processing" @click="handleProcessQueue">
            {{ t('admin.push.processSubmit') }}
          </n-button>
        </n-space>
        <n-alert
          v-if="processError"
          data-testid="admin-push-process-error"
          type="error"
          closable
          @close="processError = null">
          {{ processError }}
        </n-alert>
        <n-alert v-else-if="processResult" data-testid="admin-push-process-result" type="success">
          {{ t('admin.push.processResult', { processed: processResult.processed }) }}
          <span v-if="processResult.message">· {{ processResult.message }}</span>
        </n-alert>
      </n-space>
    </n-card>

    <n-card :title="t('admin.push.cleanupTitle')" class="mt-16px">
      <n-space vertical>
        <n-alert :bordered="false" type="info">{{ t('admin.push.cleanupHint') }}</n-alert>
        <n-space align="center" :wrap="true">
          <n-input-number
            v-model:value="retentionDays"
            data-testid="admin-push-cleanup-days"
            :min="1"
            :max="200"
            class="w-[180px]" />
          <n-button
            data-testid="admin-push-cleanup-submit"
            type="warning"
            :loading="cleaning"
            @click="confirmCleanupLogs">
            {{ t('admin.push.cleanupSubmit') }}
          </n-button>
        </n-space>
        <n-alert
          v-if="cleanupError"
          data-testid="admin-push-cleanup-error"
          type="error"
          closable
          @close="cleanupError = null">
          {{ cleanupError }}
        </n-alert>
        <n-alert v-else-if="cleanupResult" data-testid="admin-push-cleanup-result" type="success">
          {{ t('admin.push.cleanupResult', { cleaned: cleanupResult.cleaned }) }}
          <span v-if="cleanupResult.message">· {{ cleanupResult.message }}</span>
        </n-alert>
      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import {
  type DataTableColumns,
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NInput,
  NInputNumber,
  NSpace,
  NTag,
  useDialog
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminPush } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'

defineOptions({ name: 'AdminPush' })

interface ConfigRow {
  key: string
  value: string
}

const logger = createLogger('AdminPush')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()

const {
  config,
  configLoading,
  configSaving,
  configError,
  processing,
  processResult,
  processError,
  cleaning,
  cleanupResult,
  cleanupError,
  loadConfig,
  saveConfig,
  processQueue,
  cleanupLogs
} = useAdminPush()

const patchKey = ref('')
const patchValue = ref('')
const batchSize = ref(100)
const retentionDays = ref(30)

const configRows = computed<ConfigRow[]>(() => {
  const source = config.value?.config ?? {}
  return Object.keys(source)
    .sort()
    .map((key) => ({ key, value: source[key] ?? '' }))
})

const configColumns: DataTableColumns<ConfigRow> = [
  { title: t('admin.push.column.key'), key: 'key', width: 260, ellipsis: { tooltip: true } },
  { title: t('admin.push.column.value'), key: 'value', ellipsis: { tooltip: true } }
]

async function handleSaveConfig(): Promise<void> {
  const key = patchKey.value.trim()
  if (!key) {
    showFeedback(t('admin.push.requiredKey'), 'error')
    return
  }
  const raw = patchValue.value
  const ok = await saveConfig({ config: { [key]: raw.length > 0 ? raw : null } })
  showFeedback(ok ? t('admin.push.patchSuccess') : t('admin.push.patchFailed'), ok ? 'success' : 'error')
  if (ok) {
    patchKey.value = ''
    patchValue.value = ''
  }
}

async function handleProcessQueue(): Promise<void> {
  const ok = await processQueue(batchSize.value ?? 100)
  showFeedback(ok ? t('admin.push.processSuccess') : t('admin.push.processFailed'), ok ? 'success' : 'error')
}

function confirmCleanupLogs(): void {
  dialog.warning({
    title: t('admin.push.cleanupConfirmTitle'),
    content: t('admin.push.cleanupConfirmContent', { days: retentionDays.value ?? 30 }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      const ok = await cleanupLogs(retentionDays.value ?? 30)
      showFeedback(ok ? t('admin.push.cleanupSuccess') : t('admin.push.cleanupFailed'), ok ? 'success' : 'error')
      if (!ok) {
        logger.error('Failed to clean up push logs')
      }
    }
  })
}

onMounted(() => {
  void loadConfig()
})
</script>

<style scoped>
@use '@/styles/scss/global/responsive.scss' as responsive;

.admin-push {
  max-width: 1200px;
}

.mt-16px {
  margin-top: 16px;
}

.section-label {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--tjg-text-secondary);
}

@media (prefers-reduced-motion: reduce) {
  .admin-push {
    transition: none;
  }
}

@include responsive.down('md') {
  .section-label {
    margin-bottom: 6px;
  }
}
</style>
