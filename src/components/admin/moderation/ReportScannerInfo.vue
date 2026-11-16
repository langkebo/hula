<template>
  <div
    data-testid="report-scanner-info"
    class="mt-12px rounded-8px border border-[--tjg-border-muted] bg-[--tjg-surface-panel-muted] p-12px">
    <div class="mb-8px flex items-center justify-between gap-8px">
      <span class="text-13px font-medium text-[--tjg-text-primary]">
        {{ t('moderation.admin_reports.scanner.title') }}
      </span>
      <n-button size="tiny" text type="primary" data-testid="report-scanner-refresh" @click="emit('retry')">
        <template #icon>
          <Icon icon="ion:refresh-outline" />
        </template>
        {{ t('common.refresh') }}
      </n-button>
    </div>

    <div v-if="loading" data-testid="report-scanner-loading" class="text-12px text-[--tjg-text-tertiary]">
      {{ t('common.loading') }}
    </div>

    <n-alert v-else-if="error" data-testid="report-scanner-error" type="error" :show-icon="false">
      {{ error }}
      <n-button
        data-testid="report-scanner-retry"
        text
        type="primary"
        size="tiny"
        class="ml-8px"
        @click="emit('retry')">
        {{ t('common.retry') }}
      </n-button>
    </n-alert>

    <div v-else-if="!hasInfo" data-testid="report-scanner-empty" class="text-12px text-[--tjg-text-tertiary]">
      {{ t('moderation.admin_reports.scanner.empty') }}
    </div>

    <n-descriptions v-else data-testid="report-scanner-fields" :column="1" bordered size="small">
      <n-descriptions-item :label="t('moderation.admin_reports.scanner.scanner_id')">
        {{ info?.scanner_id || t('moderation.admin_reports.detail.none') }}
      </n-descriptions-item>
      <n-descriptions-item :label="t('moderation.admin_reports.scanner.scan_result')">
        {{ info?.scan_result || t('moderation.admin_reports.detail.none') }}
      </n-descriptions-item>
      <n-descriptions-item :label="t('moderation.admin_reports.scanner.confidence')">
        {{ info?.confidence ?? t('moderation.admin_reports.detail.none') }}
      </n-descriptions-item>
      <n-descriptions-item :label="t('moderation.admin_reports.scanner.scanned_at')">
        {{ scannedAtText }}
      </n-descriptions-item>
    </n-descriptions>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { NAlert, NButton, NDescriptions, NDescriptionsItem } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ScannerInfo } from '@/services/matrix/admin/AdminTypes'

defineOptions({
  name: 'ReportScannerInfo'
})

const props = defineProps<{
  info: ScannerInfo | null
  loading: boolean
  error: string | null
}>()

const emit = defineEmits<{
  retry: []
}>()

const { t } = useI18n()

/** 后端可能返回空对象（未接入扫描器），此时按「无扫描信息」空态展示 */
const hasInfo = computed(() => Boolean(props.info && (props.info.scanner_id || props.info.scan_result)))

const scannedAtText = computed(() => {
  const scannedAt = props.info?.scanned_at ?? 0
  return scannedAt > 0 ? new Date(scannedAt).toLocaleString() : t('moderation.admin_reports.detail.none')
})
</script>
