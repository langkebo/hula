<template>
  <div class="session-item" :data-testid="`widget-session-${session.session_id}`">
    <div class="session-info">
      <div class="session-row">
        <span class="session-label">{{ t('common.widget.session_id') }}:</span>
        <span class="session-value">{{ session.session_id }}</span>
      </div>
      <div class="session-row">
        <span class="session-label">{{ t('common.widget.session_user') }}:</span>
        <span class="session-value">{{ session.user_id ?? '-' }}</span>
      </div>
      <div class="session-row">
        <span class="session-label">{{ t('common.widget.session_created') }}:</span>
        <span class="session-value">{{ formatTs(session.created_ts ?? session.created_at) }}</span>
      </div>
      <div class="session-row">
        <span class="session-label">{{ t('common.widget.session_last_active') }}:</span>
        <span class="session-value">{{ formatTs(session.last_active_ts ?? session.last_active) }}</span>
      </div>
      <template v-if="detail">
        <div class="session-row">
          <span class="session-label">{{ t('common.widget.session_device') }}:</span>
          <span class="session-value">{{ detail.device_id || '-' }}</span>
        </div>
        <div class="session-row">
          <span class="session-label">{{ t('common.widget.session_expires') }}:</span>
          <span class="session-value">{{ formatTs(detail.expires_at) }}</span>
        </div>
        <div class="session-row">
          <span class="session-label">{{ t('common.widget.session_status') }}:</span>
          <span class="session-value">
            {{
              detail.is_active === false
                ? t('common.widget.session_status_inactive')
                : t('common.widget.session_status_active')
            }}
          </span>
        </div>
      </template>
      <div v-if="detailFailed" data-testid="widget-session-detail-error">
        <ErrorState compact :title="t('common.load_failed')" :retry-text="t('common.retry')" @retry="loadDetail" />
      </div>
    </div>
    <div class="session-actions">
      <n-button
        text
        size="small"
        :loading="detailLoading"
        data-testid="widget-session-detail-toggle"
        @click="toggleDetail">
        {{ detail ? t('common.widget.session_detail_hide') : t('common.widget.session_detail') }}
      </n-button>
      <n-popconfirm @positive-click="emit('terminate', session.session_id)">
        <template #trigger>
          <n-button type="error" size="small">
            {{ t('common.widget.terminate_session') }}
          </n-button>
        </template>
        {{ t('common.widget.terminate_session_confirm') }}
      </n-popconfirm>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NPopconfirm } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ErrorState from '@/components/common/ErrorState.vue'
import { matrixWidgetService } from '@/services/matrix/widget/MatrixWidgetService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('WidgetSessionItem')
const { t } = useI18n()

const props = defineProps<{
  session: {
    session_id: string
    user_id?: string
    created_ts?: number | null
    created_at?: number | string
    last_active_ts?: number | null
    last_active?: number | string
  }
}>()

const emit = defineEmits<{ terminate: [sessionId: string] }>()

interface SessionDetail {
  device_id?: string | null
  expires_at?: number | null
  is_active?: boolean
}

const detail = ref<SessionDetail | null>(null)
const detailLoading = ref(false)
const detailFailed = ref(false)

function formatTs(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-'
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '-'
  return new Date(timestamp).toLocaleString()
}

async function loadDetail() {
  detailLoading.value = true
  detailFailed.value = false
  try {
    const result = await matrixWidgetService.getWidgetSession(props.session.session_id, true)
    const payload = (result as Record<string, unknown> | null)?.session
    detail.value = (payload as SessionDetail | undefined) ?? (result as SessionDetail | null)
  } catch (e) {
    logger.error('Failed to load widget session detail', e)
    detail.value = null
    detailFailed.value = true
  } finally {
    detailLoading.value = false
  }
}

async function toggleDetail() {
  if (detail.value) {
    detail.value = null
    return
  }
  await loadDetail()
}
</script>

<style scoped lang="scss">
.session-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 6px;

  .session-info {
    flex: 1;

    .session-row {
      display: flex;
      gap: 8px;
      margin-bottom: 4px;
      font-size: 13px;

      .session-label {
        color: var(--tjg-text-secondary);
        min-width: 80px;
      }

      .session-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }

  .session-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}
</style>
