<template>
  <section class="openclaw-workbench__advanced-settings">
    <div class="openclaw-workbench__advanced-settings-head">
      <div class="openclaw-workbench__settings-head-row">
        <div>
          <strong>{{ ctx.translate('ai_assistant.robot.openclaw_generation_settings_title') }}</strong>
          <span>{{ ctx.translate('ai_assistant.robot.openclaw_generation_settings_desc') }}</span>
        </div>
        <n-button
          size="small"
          quaternary
          :disabled="ctx.isLoading || ctx.isSending"
          @click="ctx.handleRestoreDefaultGenerationSettings()">
          {{ ctx.translate('ai_assistant.robot.openclaw_restore_defaults') }}
        </n-button>
      </div>
    </div>

    <div class="openclaw-workbench__tuning-grid">
      <div class="openclaw-workbench__tuning-card">
        <div class="openclaw-workbench__tuning-head">
          <div class="openclaw-workbench__field-label-group">
            <span class="openclaw-workbench__field-label">
              {{ ctx.translate('ai_assistant.robot.temperature_param') }}
            </span>
            <n-tooltip trigger="hover" :width="280">
              <template #trigger>
                <svg class="openclaw-workbench__info-icon"><use href="#info"></use></svg>
              </template>
              {{ ctx.translate('ai_assistant.robot.openclaw_temperature_tooltip') }}
            </n-tooltip>
          </div>
          <div class="openclaw-workbench__tuning-meta">
            <span class="openclaw-workbench__tuning-tag">{{ ctx.currentTemperaturePreset.label }}</span>
            <span class="openclaw-workbench__tuning-value">{{ ctx.openClawConfig.temperature.toFixed(1) }}</span>
          </div>
        </div>
        <n-slider
          v-model:value="ctx.openClawConfig.temperature"
          :min="0"
          :max="2"
          :step="0.1"
          :tooltip="false"
          :disabled="ctx.isLoading || ctx.isSending"
          @update:value="ctx.handlePersistConfig()" />
        <div class="openclaw-workbench__preset-group">
          <button
            v-for="preset in ctx.temperaturePresets"
            :key="preset.label"
            type="button"
            class="openclaw-workbench__preset-chip"
            :class="{ 'openclaw-workbench__preset-chip--active': ctx.openClawConfig.temperature === preset.value }"
            @click="ctx.handleSelectTemperaturePreset(preset.value)">
            {{ preset.label }}
          </button>
        </div>
        <span class="openclaw-workbench__field-hint">
          {{ ctx.translate('ai_assistant.robot.temperature_hint') }}
        </span>
        <span class="openclaw-workbench__field-note">
          {{ ctx.currentTemperaturePreset.desc }}
        </span>
      </div>

      <div class="openclaw-workbench__tuning-card">
        <div class="openclaw-workbench__tuning-head">
          <div class="openclaw-workbench__field-label-group">
            <span class="openclaw-workbench__field-label">{{ ctx.translate('ai_assistant.robot.max_token') }}</span>
            <n-tooltip trigger="hover" :width="280">
              <template #trigger>
                <svg class="openclaw-workbench__info-icon"><use href="#info"></use></svg>
              </template>
              {{ ctx.translate('ai_assistant.robot.openclaw_max_tokens_tooltip') }}
            </n-tooltip>
          </div>
          <div class="openclaw-workbench__tuning-meta">
            <span class="openclaw-workbench__tuning-tag">{{ ctx.currentMaxTokensPreset.label }}</span>
            <span class="openclaw-workbench__tuning-value">{{ ctx.openClawConfig.maxTokens }}</span>
          </div>
        </div>
        <n-slider
          v-model:value="ctx.openClawConfig.maxTokens"
          :min="1024"
          :max="16384"
          :step="256"
          :tooltip="false"
          :disabled="ctx.isLoading || ctx.isSending"
          @update:value="ctx.handlePersistConfig()" />
        <div class="openclaw-workbench__preset-group">
          <button
            v-for="preset in ctx.maxTokensPresets"
            :key="preset.label"
            type="button"
            class="openclaw-workbench__preset-chip"
            :class="{ 'openclaw-workbench__preset-chip--active': ctx.openClawConfig.maxTokens === preset.value }"
            @click="ctx.handleSelectMaxTokensPreset(preset.value)">
            {{ preset.label }}
          </button>
        </div>
        <span class="openclaw-workbench__field-hint">
          {{ ctx.translate('ai_assistant.robot.max_token_hint') }}
        </span>
        <span class="openclaw-workbench__field-note">
          {{ ctx.currentMaxTokensPreset.desc }}
        </span>
      </div>
    </div>

    <div class="openclaw-workbench__advanced-tuning">
      <n-collapse :arrow-placement="'right'">
        <n-collapse-item :title="ctx.translate('ai_assistant.robot.openclaw_advanced_settings')" name="advanced">
          <div class="openclaw-workbench__tuning-grid openclaw-workbench__tuning-grid--advanced">
            <div class="openclaw-workbench__tuning-card">
              <div class="openclaw-workbench__tuning-head">
                <div class="openclaw-workbench__field-label-group">
                  <span class="openclaw-workbench__field-label">
                    {{ ctx.translate('ai_assistant.robot.openclaw_top_p_param') }}
                  </span>
                  <n-tooltip trigger="hover" :width="280">
                    <template #trigger>
                      <svg class="openclaw-workbench__info-icon"><use href="#info"></use></svg>
                    </template>
                    {{ ctx.translate('ai_assistant.robot.openclaw_top_p_tooltip') }}
                  </n-tooltip>
                </div>
                <span class="openclaw-workbench__tuning-value">{{ ctx.openClawConfig.topP.toFixed(2) }}</span>
              </div>
              <n-slider
                v-model:value="ctx.openClawConfig.topP"
                :min="0"
                :max="1"
                :step="0.01"
                :tooltip="false"
                :disabled="ctx.isLoading || ctx.isSending"
                @update:value="ctx.handlePersistConfig()" />
            </div>

            <div class="openclaw-workbench__tuning-card">
              <div class="openclaw-workbench__tuning-head">
                <div class="openclaw-workbench__field-label-group">
                  <span class="openclaw-workbench__field-label">
                    {{ ctx.translate('ai_assistant.robot.openclaw_presence_penalty_param') }}
                  </span>
                  <n-tooltip trigger="hover" :width="280">
                    <template #trigger>
                      <svg class="openclaw-workbench__info-icon"><use href="#info"></use></svg>
                    </template>
                    {{ ctx.translate('ai_assistant.robot.openclaw_presence_penalty_tooltip') }}
                  </n-tooltip>
                </div>
                <span class="openclaw-workbench__tuning-value">
                  {{ ctx.openClawConfig.presencePenalty.toFixed(2) }}
                </span>
              </div>
              <n-slider
                v-model:value="ctx.openClawConfig.presencePenalty"
                :min="-2"
                :max="2"
                :step="0.01"
                :tooltip="false"
                :disabled="ctx.isLoading || ctx.isSending"
                @update:value="ctx.handlePersistConfig()" />
            </div>

            <div class="openclaw-workbench__tuning-card">
              <div class="openclaw-workbench__tuning-head">
                <div class="openclaw-workbench__field-label-group">
                  <span class="openclaw-workbench__field-label">
                    {{ ctx.translate('ai_assistant.robot.openclaw_frequency_penalty_param') }}
                  </span>
                  <n-tooltip trigger="hover" :width="280">
                    <template #trigger>
                      <svg class="openclaw-workbench__info-icon"><use href="#info"></use></svg>
                    </template>
                    {{ ctx.translate('ai_assistant.robot.openclaw_frequency_penalty_tooltip') }}
                  </n-tooltip>
                </div>
                <span class="openclaw-workbench__tuning-value">
                  {{ ctx.openClawConfig.frequencyPenalty.toFixed(2) }}
                </span>
              </div>
              <n-slider
                v-model:value="ctx.openClawConfig.frequencyPenalty"
                :min="-2"
                :max="2"
                :step="0.01"
                :tooltip="false"
                :disabled="ctx.isLoading || ctx.isSending"
                @update:value="ctx.handlePersistConfig()" />
            </div>
          </div>
        </n-collapse-item>

        <n-collapse-item :title="ctx.translate('ai_assistant.robot.openclaw_system_prompt')" name="system-prompt">
          <div class="openclaw-workbench__system-prompt-section">
            <span class="openclaw-workbench__field-hint">
              {{ ctx.translate('ai_assistant.robot.openclaw_system_prompt_desc') }}
            </span>
            <div class="openclaw-workbench__system-prompt-input-wrapper">
              <n-input
                v-model:value="ctx.openClawConfig.systemPrompt"
                type="textarea"
                :placeholder="ctx.translate('ai_assistant.robot.openclaw_system_prompt_placeholder')"
                :rows="4"
                :disabled="ctx.isLoading || ctx.isSending"
                @update:value="ctx.handlePersistConfig()" />
              <div class="openclaw-workbench__system-prompt-footer">
                <span class="openclaw-workbench__system-prompt-char-count">
                  {{
                    ctx.translate('ai_assistant.robot.openclaw_system_prompt_char_count', {
                      count: ctx.openClawConfig.systemPrompt.length
                    })
                  }}
                </span>
                <n-button
                  size="tiny"
                  quaternary
                  :disabled="ctx.isLoading || ctx.isSending || !ctx.openClawConfig.systemPrompt"
                  @click="
                    ctx.openClawConfig.systemPrompt = ''
                    ctx.handlePersistConfig()
                  ">
                  {{ ctx.translate('ai_assistant.robot.openclaw_system_prompt_reset') }}
                </n-button>
              </div>
            </div>
          </div>
        </n-collapse-item>
      </n-collapse>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useOpenClawContext } from '../composables/useOpenClawContext'

const ctx = useOpenClawContext()
</script>

<style scoped>
.openclaw-workbench__advanced-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px;
  border-radius: 16px;
  border: 1px solid var(--line-color);
  background: color-mix(in srgb, var(--bg-msg-hover) 86%, transparent);
}

.openclaw-workbench__advanced-settings-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.openclaw-workbench__settings-head-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.openclaw-workbench__advanced-settings-head strong {
  font-size: 14px;
  color: var(--text-color);
}

.openclaw-workbench__advanced-settings-head span {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.openclaw-workbench__tuning-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.openclaw-workbench__tuning-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 14px;
  border: 1px solid var(--line-color);
  background: var(--center-bg-color);
  transition: all 0.2s ease;
}

.openclaw-workbench__tuning-card:hover {
  border-color: var(--color-primary-hover);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transform: translateY(-1px);
}

.openclaw-workbench__tuning-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.openclaw-workbench__tuning-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.openclaw-workbench__tuning-tag {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 10%, transparent);
}

.openclaw-workbench__tuning-value {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-primary);
}

.openclaw-workbench__preset-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.openclaw-workbench__preset-chip {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--line-color);
  background: var(--bg-msg-hover);
  font-size: 12px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease,
    color 0.2s ease;
}

.openclaw-workbench__preset-chip:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--color-primary) 48%, var(--line-color));
}

.openclaw-workbench__preset-chip--active {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 58%, transparent);
  background: color-mix(in srgb, var(--color-primary) 10%, var(--bg-msg-hover));
}

.openclaw-workbench__field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.openclaw-workbench__field-label-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.openclaw-workbench__info-icon {
  width: 14px;
  height: 14px;
  color: var(--color-text-tertiary);
  cursor: help;
  transition: color 0.2s ease;
}

.openclaw-workbench__info-icon:hover {
  color: var(--color-primary);
}

.openclaw-workbench__field-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-tertiary);
}

.openclaw-workbench__field-note {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.openclaw-workbench__advanced-tuning {
  margin-top: 16px;
  padding: 0 4px;
}

:deep(.openclaw-workbench__advanced-tuning .n-collapse-item__header) {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  padding: 8px 0;
}

:deep(.openclaw-workbench__advanced-tuning .n-collapse-item__content-inner) {
  padding-top: 12px !important;
}

.openclaw-workbench__tuning-grid--advanced {
  margin-top: 0;
  gap: 16px;
}

.openclaw-workbench__system-prompt-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.openclaw-workbench__system-prompt-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.openclaw-workbench__system-prompt-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.openclaw-workbench__system-prompt-char-count {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

@media (max-width: 1080px) {
  .openclaw-workbench__tuning-grid {
    grid-template-columns: 1fr;
  }
}
</style>
