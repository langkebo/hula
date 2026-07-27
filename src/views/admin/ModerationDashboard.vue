<template>
  <div class="moderation-dashboard" role="region" :aria-label="t('moderation.title')">
    <header class="moderation-dashboard__header">
      <svg
        class="moderation-dashboard__title-icon"
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
      <h2 class="moderation-dashboard__title">{{ t('moderation.title') }}</h2>
    </header>

    <n-spin :show="loading" class="moderation-dashboard__spin">
      <n-tabs v-model:value="activeTab" type="line" animated class="moderation-dashboard__tabs">
        <n-tab-pane v-for="tab in tabs" :key="tab.name" :name="tab.name" :tab="t(tab.label)">
          <n-empty v-if="reportsByStatus[tab.name].length === 0" :description="t('moderation.dashboard.empty')" />
          <n-list v-else bordered class="moderation-dashboard__list">
            <n-list-item v-for="report in reportsByStatus[tab.name]" :key="report.id">
              <article
                data-test="report-item"
                :class="[
                  'moderation-dashboard__report',
                  { 'moderation-dashboard__report--high': report.priority === 'high' }
                ]"
                :style="report.priority === 'high' ? { background: 'var(--hula-color-danger-100)' } : undefined">
                <div class="moderation-dashboard__report-header">
                  <n-tag :type="priorityTagType(report.priority)" size="small">
                    {{ t(`moderation.dashboard.priority_${report.priority}`) }}
                  </n-tag>
                  <span class="moderation-dashboard__reporter">
                    <svg
                      class="moderation-dashboard__field-icon"
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    {{ report.reporter }}
                  </span>
                  <span class="moderation-dashboard__time">{{ formatTime(report.timestamp) }}</span>
                </div>

                <div class="moderation-dashboard__report-body">
                  <div class="moderation-dashboard__field">
                    <svg
                      class="moderation-dashboard__field-icon"
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    <span class="moderation-dashboard__field-value">{{ report.reportedEvent }}</span>
                  </div>
                  <div class="moderation-dashboard__field">
                    <svg
                      class="moderation-dashboard__field-icon"
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                    <span class="moderation-dashboard__field-value">{{ report.reason }}</span>
                  </div>
                </div>

                <div v-if="report.status !== 'resolved'" class="moderation-dashboard__actions">
                  <n-button size="small" data-action="ignore" @click="handleAction(report.id, 'ignore')">
                    <template #icon>
                      <svg
                        class="moderation-dashboard__action-icon"
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M15 9l-6 6M9 9l6 6" />
                      </svg>
                    </template>
                    {{ t('moderation.dashboard.action_ignore') }}
                  </n-button>
                  <n-button size="small" type="warning" data-action="hide" @click="handleAction(report.id, 'hide')">
                    <template #icon>
                      <svg
                        class="moderation-dashboard__action-icon"
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <path
                          d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    </template>
                    {{ t('moderation.dashboard.action_hide') }}
                  </n-button>
                  <n-button size="small" type="error" data-action="ban" @click="handleAction(report.id, 'ban')">
                    <template #icon>
                      <svg
                        class="moderation-dashboard__action-icon"
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                    </template>
                    {{ t('moderation.dashboard.action_ban') }}
                  </n-button>
                  <n-button size="small" quaternary data-action="escalate" @click="handleAction(report.id, 'escalate')">
                    <template #icon>
                      <svg
                        class="moderation-dashboard__action-icon"
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round">
                        <path d="M12 19V5M5 12l7-7 7 7" />
                      </svg>
                    </template>
                    {{ t('moderation.dashboard.action_escalate') }}
                  </n-button>
                </div>
              </article>
            </n-list-item>
          </n-list>
        </n-tab-pane>
      </n-tabs>
    </n-spin>
  </div>
</template>

<script lang="ts">
type ModerationAction = 'ignore' | 'hide' | 'ban' | 'escalate'

export type ModerationReport = {
  id: string
  reporter: string
  reportedEvent: string
  reason: string
  timestamp: number
  priority: 'low' | 'normal' | 'high'
  status: 'pending' | 'processing' | 'resolved'
}

type ModerationTabName = 'pending' | 'processing' | 'resolved'
</script>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  reports: ModerationReport[]
  loading: boolean
}>()

const emit = defineEmits<{
  action: [reportId: string, action: ModerationAction]
}>()

const { t } = useI18n()

const tabs: ReadonlyArray<{ name: ModerationTabName; label: string }> = [
  { name: 'pending', label: 'moderation.dashboard.tab_pending' },
  { name: 'processing', label: 'moderation.dashboard.tab_processing' },
  { name: 'resolved', label: 'moderation.dashboard.tab_resolved' }
]

const activeTab = ref<ModerationTabName>('pending')

const reportsByStatus = computed(() => {
  const grouped: Record<ModerationTabName, ModerationReport[]> = {
    pending: [],
    processing: [],
    resolved: []
  }
  for (const report of props.reports) {
    grouped[report.status].push(report)
  }
  return grouped
})

function priorityTagType(priority: ModerationReport['priority']): 'default' | 'info' | 'error' {
  if (priority === 'high') return 'error'
  if (priority === 'low') return 'info'
  return 'default'
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

function handleAction(reportId: string, action: ModerationAction) {
  emit('action', reportId, action)
}
</script>

<style scoped lang="scss">
.moderation-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-3);
  padding: var(--hula-space-4);
  background: var(--hula-admin-card-bg);
  border-radius: var(--hula-radius-lg);
  box-shadow: var(--hula-admin-card-shadow);

  &__header {
    display: flex;
    align-items: center;
    gap: var(--hula-space-2);
  }

  &__title-icon {
    width: 18px;
    height: 18px;
    color: var(--hula-color-danger-500);
  }

  &__title {
    margin: 0;
    font-size: var(--hula-font-size-lg);
    font-weight: var(--hula-font-weight-semibold);
    color: var(--hula-admin-title-color);
  }

  &__spin {
    min-height: 120px;
  }

  &__tabs {
    width: 100%;
  }

  &__list {
    margin-top: var(--hula-space-2);
    border-radius: var(--hula-radius-md);
    overflow: hidden;
  }

  &__report {
    display: flex;
    flex-direction: column;
    gap: var(--hula-space-2);
    padding: var(--hula-space-3);
    border-radius: var(--hula-radius-sm);
    transition: background var(--hula-motion-duration-fast) var(--hula-motion-ease-standard);

    &--high {
      border-left: 3px solid var(--hula-color-danger-500);
    }
  }

  &__report-header {
    display: flex;
    align-items: center;
    gap: var(--hula-space-2);
    flex-wrap: wrap;
  }

  &__reporter {
    display: inline-flex;
    align-items: center;
    gap: var(--hula-space-1);
    font-size: var(--hula-font-size-sm);
    color: var(--hula-text-primary);
    font-weight: var(--hula-font-weight-medium);
  }

  &__time {
    margin-left: auto;
    font-size: var(--hula-font-size-xs);
    color: var(--hula-text-tertiary);
  }

  &__report-body {
    display: flex;
    flex-direction: column;
    gap: var(--hula-space-1);
    padding-left: var(--hula-space-1);
  }

  &__field {
    display: flex;
    align-items: center;
    gap: var(--hula-space-2);
    font-size: var(--hula-font-size-sm);
  }

  &__field-icon {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    color: var(--hula-text-tertiary);
  }

  &__field-value {
    color: var(--hula-text-secondary);
    word-break: break-all;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: var(--hula-space-2);
    flex-wrap: wrap;
    padding-top: var(--hula-space-1);
  }

  &__action-icon {
    width: 14px;
    height: 14px;
  }
}
</style>
