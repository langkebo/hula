<template>
  <div class="labs-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.labs.experimental_section') }}</h3>
      <p class="section-desc">{{ t('setting.labs.experimental_desc') }}</p>
    </div>

    <n-divider />

    <div class="settings-section">
      <n-spin :show="loading">
        <div class="labs-list">
          <div v-for="feature in labFeatures" :key="feature.id" class="lab-item">
            <div class="lab-info">
              <div class="lab-header">
                <span class="lab-name">{{ feature.name }}</span>
                <n-tag v-if="feature.status === 'beta'" type="warning" size="small">
                  {{ t('setting.labs.status_beta') }}
                </n-tag>
                <n-tag v-else-if="feature.status === 'alpha'" type="error" size="small">
                  {{ t('setting.labs.status_alpha') }}
                </n-tag>
                <n-tag v-else type="info" size="small">{{ t('setting.labs.status_experimental') }}</n-tag>
              </div>
              <div class="lab-desc">{{ feature.description }}</div>
              <div v-if="feature.warning" class="lab-warning">
                <Icon icon="mdi:alert-circle" :width="14" />
                <span>{{ feature.warning }}</span>
              </div>
            </div>
            <n-switch :value="feature.enabled" @update:value="(value) => handleToggleFeature(feature.id, value)" />
          </div>
        </div>
      </n-spin>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.labs.developer_options') }}</h3>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.labs.debug_mode') }}</span>
          <span class="setting-desc">{{ t('setting.labs.debug_mode_desc') }}</span>
        </div>
        <n-switch v-model:value="debugMode" @update:value="handleDebugModeChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.labs.show_performance') }}</span>
          <span class="setting-desc">{{ t('setting.labs.show_performance_desc') }}</span>
        </div>
        <n-switch v-model:value="showPerformanceMetrics" @update:value="handlePerformanceChange" />
      </div>

      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.labs.enable_devtools') }}</span>
          <span class="setting-desc">{{ t('setting.labs.enable_devtools_desc') }}</span>
        </div>
        <n-switch v-model:value="enableDevTools" @update:value="handleDevToolsChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.labs.reset_section') }}</h3>
      <n-button type="warning" @click="handleResetLabs">{{ t('setting.labs.reset_all') }}</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { NSwitch, NButton, NDivider, NSpin, NTag, useMessage, useDialog } from 'naive-ui'
import { Icon } from '@iconify/vue'
import { createLogger } from '@/utils/Logger'
import { useI18n } from 'vue-i18n'

const logger = createLogger('LabsSettings')

defineOptions({
  name: 'LabsSettings'
})

interface LabFeatureState {
  id: string
  status: 'alpha' | 'beta' | 'experimental'
  enabled: boolean
}

const message = useMessage()
const dialog = useDialog()
const { t } = useI18n()

const loading = ref(false)
const debugMode = ref(false)
const showPerformanceMetrics = ref(false)
const enableDevTools = ref(false)

const labFeatureStates = ref<LabFeatureState[]>([
  {
    id: 'threads',
    status: 'beta',
    enabled: false
  },
  {
    id: 'spaces',
    status: 'beta',
    enabled: false
  },
  {
    id: 'voip',
    status: 'alpha',
    enabled: false
  },
  {
    id: 'widget',
    status: 'experimental',
    enabled: false
  },
  {
    id: 'custom-status',
    status: 'beta',
    enabled: true
  },
  {
    id: 'message-editing',
    status: 'beta',
    enabled: false
  },
  {
    id: 'reactions',
    status: 'beta',
    enabled: true
  },
  {
    id: 'read-receipts',
    status: 'experimental',
    enabled: false
  }
])

const labFeatures = computed(() =>
  labFeatureStates.value.map((feature) => ({
    ...feature,
    name: t(`setting.labs.features.${feature.id}.name`),
    description: t(`setting.labs.features.${feature.id}.description`),
    warning: feature.id === 'voip' ? t('setting.labs.features.voip.warning') : undefined
  }))
)

onMounted(() => {
  loadSavedSettings()
})

function loadSavedSettings() {
  const savedFeatures = localStorage.getItem('hula-lab-features')
  if (savedFeatures) {
    try {
      const enabledIds = JSON.parse(savedFeatures) as string[]
      labFeatureStates.value.forEach((feature) => {
        feature.enabled = enabledIds.includes(feature.id)
      })
    } catch (e) {
      logger.error('Failed to parse saved lab features')
    }
  }

  const savedDebug = localStorage.getItem('hula-debug-mode')
  if (savedDebug) {
    debugMode.value = savedDebug === 'true'
  }

  const savedPerformance = localStorage.getItem('hula-show-performance')
  if (savedPerformance) {
    showPerformanceMetrics.value = savedPerformance === 'true'
  }

  const savedDevTools = localStorage.getItem('hula-enable-devtools')
  if (savedDevTools) {
    enableDevTools.value = savedDevTools === 'true'
  }
}

function saveFeatures() {
  const enabledIds = labFeatureStates.value.filter((f) => f.enabled).map((f) => f.id)
  localStorage.setItem('hula-lab-features', JSON.stringify(enabledIds))
}

function getFeatureName(featureId: string) {
  return t(`setting.labs.features.${featureId}.name`)
}

function handleToggleFeature(featureId: string, value: boolean) {
  const feature = labFeatureStates.value.find((item) => item.id === featureId)
  if (!feature) return

  feature.enabled = value
  saveFeatures()

  if (value) {
    message.success(t('setting.labs.feedback.feature_enabled', { name: getFeatureName(featureId) }))
  } else {
    message.info(t('setting.labs.feedback.feature_disabled', { name: getFeatureName(featureId) }))
  }
}

function handleDebugModeChange(value: boolean) {
  localStorage.setItem('hula-debug-mode', value.toString())
  message.success(t(value ? 'setting.labs.feedback.debug_mode_enabled' : 'setting.labs.feedback.debug_mode_disabled'))
}

function handlePerformanceChange(value: boolean) {
  localStorage.setItem('hula-show-performance', value.toString())
  message.success(
    t(value ? 'setting.labs.feedback.performance_metrics_shown' : 'setting.labs.feedback.performance_metrics_hidden')
  )
}

function handleDevToolsChange(value: boolean) {
  localStorage.setItem('hula-enable-devtools', value.toString())
  message.success(t(value ? 'setting.labs.feedback.devtools_enabled' : 'setting.labs.feedback.devtools_disabled'))
}

function handleResetLabs() {
  dialog.warning({
    title: t('setting.labs.reset_dialog.title'),
    content: t('setting.labs.reset_dialog.content'),
    positiveText: t('setting.labs.reset_dialog.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: () => {
      labFeatureStates.value.forEach((feature) => {
        feature.enabled = ['custom-status', 'reactions'].includes(feature.id)
      })
      saveFeatures()
      message.success(t('setting.labs.feedback.reset_success'))
    }
  })
}
</script>

<style scoped>
.labs-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin: 0 0 var(--hula-space-2) 0;
  color: var(--hula-text-primary);
}

.section-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin: 0;
}

.labs-list {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-4);
}

.lab-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--hula-space-3);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.lab-info {
  flex: 1;
  min-width: 0;
  margin-right: var(--hula-space-4);
}

.lab-header {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
  margin-bottom: var(--hula-space-1);
}

.lab-name {
  font-size: var(--hula-font-size-base);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
}

.lab-desc {
  font-size: 13px;
  color: var(--hula-text-secondary);
  line-height: 1.5;
}

.lab-warning {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: var(--hula-space-2);
  padding: var(--hula-space-2);
  background-color: var(--hula-settings-warning-bg);
  border-radius: var(--hula-radius-xs);
  font-size: var(--hula-font-size-sm);
  color: var(--hula-color-warning-500);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  flex: 1;
  min-width: 0;
}

.setting-label {
  display: block;
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  display: block;
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}
</style>
