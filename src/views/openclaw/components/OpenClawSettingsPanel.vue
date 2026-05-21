<template>
  <section ref="configSectionRef" class="openclaw-workbench__sidebar-meta">
    <div
      class="openclaw-workbench__status-pill"
      :data-state="connectionState.state"
      role="button"
      tabindex="0"
      aria-label="切换配置面板"
      @click="toggleConfig"
      @keydown.enter="toggleConfig">
      <span class="openclaw-workbench__status-dot"></span>
      <span>{{ connectionStateText }}</span>
    </div>

    <div v-if="showConfig" class="openclaw-workbench__config-panel">
      <OpenClawInstallSection />

      <OpenClawConnectionSettings />

      <OpenClawGenerationSettings />

      <div class="openclaw-workbench__config-foot">
        <div class="openclaw-workbench__status-group">
          <span class="openclaw-workbench__status-label">{{ connectionStateText }}</span>
          <span v-if="selectedModelLabel" class="openclaw-workbench__status-detail">
            {{ translate('ai_assistant.robot.openclaw_using_model', { model: selectedModelLabel }) }}
          </span>
          <span class="openclaw-workbench__status-detail">
            {{
              translate('ai_assistant.robot.openclaw_temperature_status', {
                value: openClawConfig.temperature.toFixed(1)
              })
            }}
            · {{ currentTemperaturePreset.label }}
          </span>
          <span class="openclaw-workbench__status-detail">
            {{ translate('ai_assistant.robot.openclaw_max_tokens_status', { value: openClawConfig.maxTokens }) }} ·
            {{ currentMaxTokensPreset.label }}
          </span>
        </div>
        <p v-if="resolvedErrorMessage" class="openclaw-workbench__error-text">
          {{ translate('ai_assistant.robot.openclaw_last_error', { error: resolvedErrorMessage }) }}
        </p>
        <div class="openclaw-workbench__config-actions">
          <n-button
            v-if="isConnected"
            secondary
            type="error"
            size="small"
            block
            :disabled="isLoading || isSending"
            @click="handleDisconnect()">
            {{ translate('ai_assistant.robot.openclaw_disconnect') }}
          </n-button>
          <n-button
            v-else
            type="primary"
            size="small"
            block
            :loading="isLoading"
            :disabled="isSending"
            @click="handleConnect()">
            {{ translate('ai_assistant.robot.openclaw_connect') }}
          </n-button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useOpenClawContext } from '../composables/useOpenClawContext'

const {
  isConnected,
  isLoading,
  isSending,
  connectionState,
  connectionStateText,
  openClawConfig,
  selectedModelId,
  resolvedErrorMessage,
  currentTemperaturePreset,
  currentMaxTokensPreset,
  translate,
  handleConnect,
  handleDisconnect
} = useOpenClawContext()

const showConfig = ref(false)
const configSectionRef = ref<HTMLElement | null>(null)

const selectedModelLabel = computed(() => selectedModelId || '')

const toggleConfig = () => {
  showConfig.value = !showConfig.value
}

defineExpose({
  show: () => {
    showConfig.value = true
  },
  hide: () => {
    showConfig.value = false
  },
  el: configSectionRef
})
</script>

<style scoped>
.openclaw-workbench__sidebar-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.openclaw-workbench__status-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: var(--bg-msg-hover);
  color: var(--color-text-secondary);
}

.openclaw-workbench__status-pill:hover {
  background: var(--center-bg-color);
}

.openclaw-workbench__status-pill[data-state='connected'] {
  color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 12%, transparent);
}

.openclaw-workbench__status-pill[data-state='connecting'],
.openclaw-workbench__status-pill[data-state='reconnecting'] {
  color: var(--color-warning);
  background: color-mix(in srgb, var(--color-warning) 12%, transparent);
}

.openclaw-workbench__status-pill[data-state='error'] {
  color: var(--danger-text);
  background: var(--danger-bg);
}

.openclaw-workbench__status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
}

.openclaw-workbench__config-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  border: 1px solid var(--line-color);
  border-radius: 20px;
  background: color-mix(in srgb, var(--center-bg-color) 94%, transparent);
  backdrop-filter: blur(20px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
}

.openclaw-workbench__config-foot {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
}

.openclaw-workbench__status-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.openclaw-workbench__status-label,
.openclaw-workbench__status-detail {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.openclaw-workbench__error-text {
  margin: 0;
  font-size: 12px;
  color: var(--danger-text);
}

.openclaw-workbench__config-actions {
  display: flex;
  gap: 10px;
  min-width: 120px;
}
</style>
