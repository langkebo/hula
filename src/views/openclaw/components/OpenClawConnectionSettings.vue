<template>
  <section class="openclaw-workbench__connection-settings">
    <div class="openclaw-workbench__config-grid">
      <label class="openclaw-workbench__field">
        <span class="openclaw-workbench__field-label">
          {{ ctx.translate('ai_assistant.robot.openclaw_gateway_label') }}
        </span>
        <n-input
          v-model:value="ctx.openClawConfig.gatewayUrl"
          :placeholder="ctx.translate('ai_assistant.robot.openclaw_gateway_placeholder')"
          :disabled="ctx.isLoading || ctx.isSending"
          @blur="ctx.handlePersistConfig()" />
      </label>

      <label class="openclaw-workbench__field">
        <span class="openclaw-workbench__field-label">
          {{ ctx.translate('ai_assistant.robot.openclaw_token_label') }}
        </span>
        <n-input
          v-model:value="ctx.openClawConfig.token"
          type="password"
          show-password-on="click"
          :placeholder="ctx.translate('ai_assistant.robot.openclaw_token_placeholder')"
          :disabled="ctx.isLoading || ctx.isSending"
          @blur="ctx.handlePersistConfig()" />
      </label>
    </div>

    <section class="openclaw-workbench__advanced-settings">
      <div class="openclaw-workbench__advanced-settings-head">
        <strong>{{ ctx.translate('ai_assistant.robot.openclaw_advanced_settings_title') }}</strong>
        <span>{{ ctx.translate('ai_assistant.robot.openclaw_advanced_settings_desc') }}</span>
      </div>

      <div class="openclaw-workbench__switch-grid">
        <div class="openclaw-workbench__switch-card">
          <div class="openclaw-workbench__switch-copy">
            <strong>{{ ctx.translate('ai_assistant.robot.openclaw_auto_connect_label') }}</strong>
            <span>{{ ctx.translate('ai_assistant.robot.openclaw_auto_connect_hint') }}</span>
          </div>
          <n-switch v-model:value="ctx.openClawConfig.autoConnect" @update:value="ctx.handlePersistConfig()" />
        </div>

        <div class="openclaw-workbench__switch-card">
          <div class="openclaw-workbench__switch-copy">
            <strong>{{ ctx.translate('ai_assistant.robot.openclaw_reconnect_toggle_label') }}</strong>
            <span>{{ ctx.translate('ai_assistant.robot.openclaw_reconnect_toggle_hint') }}</span>
          </div>
          <n-switch v-model:value="ctx.openClawConfig.reconnect" @update:value="ctx.handlePersistConfig()" />
        </div>
      </div>

      <div class="openclaw-workbench__config-grid openclaw-workbench__config-grid--advanced">
        <label class="openclaw-workbench__field">
          <span class="openclaw-workbench__field-label">
            {{ ctx.translate('ai_assistant.robot.openclaw_reconnect_interval_label') }}
          </span>
          <n-input-number
            v-model:value="ctx.openClawConfig.reconnectInterval"
            :min="500"
            :step="500"
            :precision="0"
            :disabled="!ctx.openClawConfig.reconnect || ctx.isLoading || ctx.isSending"
            @update:value="ctx.handlePersistConfig()" />
          <span class="openclaw-workbench__field-hint">
            {{ ctx.translate('ai_assistant.robot.openclaw_reconnect_interval_hint') }}
          </span>
        </label>

        <label class="openclaw-workbench__field">
          <span class="openclaw-workbench__field-label">
            {{ ctx.translate('ai_assistant.robot.openclaw_max_reconnect_attempts_label') }}
          </span>
          <n-input-number
            v-model:value="ctx.openClawConfig.maxReconnectAttempts"
            :min="1"
            :step="1"
            :precision="0"
            :disabled="!ctx.openClawConfig.reconnect || ctx.isLoading || ctx.isSending"
            @update:value="ctx.handlePersistConfig()" />
          <span class="openclaw-workbench__field-hint">
            {{ ctx.translate('ai_assistant.robot.openclaw_max_reconnect_attempts_hint') }}
          </span>
        </label>

        <label class="openclaw-workbench__field">
          <span class="openclaw-workbench__field-label">
            {{ ctx.translate('ai_assistant.robot.openclaw_heartbeat_interval_label') }}
          </span>
          <n-input-number
            v-model:value="ctx.openClawConfig.heartbeatInterval"
            :min="1000"
            :step="1000"
            :precision="0"
            :disabled="ctx.isLoading || ctx.isSending"
            @update:value="ctx.handlePersistConfig()" />
          <span class="openclaw-workbench__field-hint">
            {{ ctx.translate('ai_assistant.robot.openclaw_heartbeat_interval_hint') }}
          </span>
        </label>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { useOpenClawContext } from '../composables/useOpenClawContext'

const ctx = useOpenClawContext()
</script>

<style scoped>
.openclaw-workbench__connection-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.openclaw-workbench__config-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.openclaw-workbench__config-grid--advanced {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

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

.openclaw-workbench__advanced-settings-head strong {
  font-size: 14px;
  color: var(--text-color);
}

.openclaw-workbench__advanced-settings-head span {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.openclaw-workbench__switch-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.openclaw-workbench__switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid var(--line-color);
  background: var(--center-bg-color);
}

.openclaw-workbench__switch-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.openclaw-workbench__switch-copy strong {
  font-size: 13px;
  color: var(--text-color);
}

.openclaw-workbench__switch-copy span {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-tertiary);
}

.openclaw-workbench__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.openclaw-workbench__field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.openclaw-workbench__field-hint {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text-tertiary);
}

@media (max-width: 1080px) {
  .openclaw-workbench__config-grid,
  .openclaw-workbench__config-grid--advanced,
  .openclaw-workbench__switch-grid {
    grid-template-columns: 1fr;
  }
}
</style>
