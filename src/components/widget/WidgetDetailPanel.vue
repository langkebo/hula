<template>
  <div v-if="widget" class="widget-detail-panel">
    <n-divider />
    <div class="detail-header">
      <h4>{{ widget.name || widget.id }}</h4>
      <n-button text :aria-label="t('common.close')" @click="emit('close')">
        <template #icon>
          <n-icon><Icon icon="mdi:close" /></n-icon>
        </template>
      </n-button>
    </div>

    <n-tabs v-model:value="detailTab" type="line" size="small">
      <!-- Config -->
      <n-tab-pane name="config" :tab="t('common.widget.config')">
        <n-spin :show="configLoading">
          <div class="config-section">
            <div class="section-toolbar">
              <n-button size="small" :disabled="configLoadFailed" @click="emit('edit-config')">
                <template #icon>
                  <n-icon><Icon icon="mdi:pencil" /></n-icon>
                </template>
                {{ t('common.widget.edit_config') }}
              </n-button>
            </div>
            <div v-if="configLoadFailed" data-test="widget-config-error">
              <ErrorState
                compact
                :title="t('common.load_failed')"
                :retry-text="t('common.retry')"
                @retry="loadWidgetConfig" />
            </div>
            <EmptyState
              v-else-if="!widgetConfig || Object.keys(widgetConfig).length === 0"
              compact
              :description="t('common.widget.no_config')" />
            <n-descriptions v-else bordered :column="1" label-placement="left" size="small">
              <n-descriptions-item v-for="(value, key) in widgetConfig" :key="String(key)" :label="String(key)">
                <template v-if="typeof value === 'object' && value !== null">
                  {{ JSON.stringify(value) }}
                </template>
                <template v-else>{{ value }}</template>
              </n-descriptions-item>
            </n-descriptions>
          </div>
        </n-spin>
      </n-tab-pane>

      <!-- Capabilities -->
      <n-tab-pane name="capabilities" :tab="t('common.widget.capabilities')">
        <n-spin :show="capabilitiesLoading">
          <div class="capabilities-section">
            <div class="section-toolbar">
              <n-button
                size="small"
                :disabled="capabilitiesLoadFailed"
                @click="emit('edit-capabilities', capabilities)">
                <template #icon>
                  <n-icon><Icon icon="mdi:pencil" /></n-icon>
                </template>
                {{ t('common.widget.edit_capabilities') }}
              </n-button>
            </div>
            <div v-if="capabilitiesLoadFailed" data-test="widget-capabilities-error">
              <ErrorState
                compact
                :title="t('common.load_failed')"
                :retry-text="t('common.retry')"
                @retry="loadCapabilities" />
            </div>
            <EmptyState
              v-else-if="capabilities.length === 0"
              compact
              :description="t('common.widget.no_capabilities')" />
            <div v-else class="capabilities-tags">
              <n-tag v-for="cap in capabilities" :key="cap" size="small" type="info" class="cap-tag">
                {{ cap }}
              </n-tag>
            </div>
          </div>
        </n-spin>
      </n-tab-pane>

      <!-- Sessions -->
      <n-tab-pane name="sessions" :tab="t('common.widget.sessions')">
        <n-spin :show="sessionsLoading">
          <div v-if="sessionsLoadFailed" data-test="widget-sessions-error">
            <ErrorState
              compact
              :title="t('common.load_failed')"
              :retry-text="t('common.retry')"
              @retry="loadSessions" />
          </div>
          <EmptyState v-else-if="sessions.length === 0" compact :description="t('common.widget.no_sessions')" />
          <div v-else class="sessions-list">
            <WidgetSessionItem
              v-for="session in sessions"
              :key="session.session_id"
              :session="session"
              @terminate="handleTerminateSession" />
          </div>
        </n-spin>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import ErrorState from '@/components/common/ErrorState.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { Widget } from '@/composables/widget'
import { matrixWidgetService } from '@/services/matrix/widget/MatrixWidgetService'
import { createLogger } from '@/utils/Logger'
import WidgetSessionItem from './WidgetSessionItem.vue'

const logger = createLogger('WidgetDetailPanel')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  widget: Widget | null
  roomId: string
}>()

const emit = defineEmits<{
  close: []
  'edit-config': []
  'edit-capabilities': [capabilities: string[]]
}>()

const detailTab = ref('config')

// ===== Widget Config =====
const widgetConfig = ref<Record<string, unknown>>({})
const configLoading = ref(false)
// 读取失败不能落成 {}：那会被渲染成「没有配置」，与「读不到」混淆
const configLoadFailed = ref(false)

async function loadWidgetConfig() {
  if (!props.widget) return
  configLoading.value = true
  configLoadFailed.value = false
  try {
    const result = await matrixWidgetService.getWidgetConfig(props.widget.id, false)
    widgetConfig.value = result ?? {}
  } catch (e) {
    logger.error('Failed to load widget config', e)
    widgetConfig.value = {}
    configLoadFailed.value = true
  } finally {
    configLoading.value = false
  }
}

// ===== Capabilities =====
const capabilities = ref<string[]>([])
const capabilitiesLoading = ref(false)
const capabilitiesLoadFailed = ref(false)

async function loadCapabilities() {
  if (!props.widget) return
  capabilitiesLoading.value = true
  capabilitiesLoadFailed.value = false
  try {
    const result = await matrixWidgetService.getWidgetCapabilities(props.roomId, props.widget.id, false)
    capabilities.value = result?.capabilities ?? []
  } catch (e) {
    logger.error('Failed to load widget capabilities', e)
    capabilities.value = []
    capabilitiesLoadFailed.value = true
  } finally {
    capabilitiesLoading.value = false
  }
}

// ===== Sessions =====
interface WidgetSession {
  session_id: string
  user_id?: string
  created_ts?: number | null
  created_at?: number | string
  last_active_ts?: number | null
  last_active?: number | string
}

const sessions = ref<WidgetSession[]>([])
const sessionsLoading = ref(false)
const sessionsLoadFailed = ref(false)

async function loadSessions() {
  if (!props.widget) return
  sessionsLoading.value = true
  sessionsLoadFailed.value = false
  try {
    const result = await matrixWidgetService.getWidgetSessions(props.widget.id, false)
    if (Array.isArray(result)) {
      sessions.value = result as WidgetSession[]
    } else if (result && typeof result === 'object') {
      const sessionsData = (result as Record<string, unknown>).sessions
      if (Array.isArray(sessionsData)) {
        sessions.value = sessionsData as WidgetSession[]
      } else {
        sessions.value = []
      }
    } else {
      sessions.value = []
    }
  } catch (e) {
    logger.error('Failed to load widget sessions', e)
    sessions.value = []
    sessionsLoadFailed.value = true
  } finally {
    sessionsLoading.value = false
  }
}

async function handleTerminateSession(sessionId: string) {
  try {
    const ok = await matrixWidgetService.terminateWidgetSession(sessionId, true)
    if (ok) {
      showFeedback(t('common.widget.session_terminated'), 'success')
      await loadSessions()
    } else {
      showFeedback(t('common.widget.session_terminate_failed'), 'error')
    }
  } catch (e) {
    logger.error('Failed to terminate widget session', e)
    showFeedback(t('common.widget.session_terminate_failed'), 'error')
  }
}

// ===== Reload all data =====
async function reload() {
  await Promise.all([loadWidgetConfig(), loadCapabilities(), loadSessions()])
}

// ===== Watch widget prop =====
watch(
  () => props.widget,
  (widget) => {
    if (!widget) return
    detailTab.value = 'config'
    capabilities.value = []
    sessions.value = []
    widgetConfig.value = {}
    configLoadFailed.value = false
    capabilitiesLoadFailed.value = false
    sessionsLoadFailed.value = false
    void reload()
  },
  { immediate: true }
)

defineExpose({ reload })
</script>

<style scoped lang="scss">
.widget-detail-panel {
  margin-top: 8px;

  .detail-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;

    h4 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
    }
  }
}

.capabilities-section {
  .section-toolbar {
    margin-bottom: 12px;
  }

  .capabilities-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .cap-tag {
      font-size: 12px;
    }
  }
}

.sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
