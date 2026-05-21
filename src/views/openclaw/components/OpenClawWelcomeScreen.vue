<template>
  <div class="openclaw-workbench__welcome">
    <div class="openclaw-workbench__welcome-brand">
      <div class="openclaw-workbench__welcome-icon">
        <svg><use href="#robot"></use></svg>
      </div>
      <h3 class="openclaw-workbench__welcome-title">
        {{ ctx.translate('ai_assistant.robot.openclaw_empty_title') }}
      </h3>
      <p class="openclaw-workbench__welcome-description">
        {{ ctx.translate('ai_assistant.robot.openclaw_empty_description') }}
      </p>
    </div>

    <div class="openclaw-workbench__welcome-grid">
      <div
        class="openclaw-workbench__welcome-card"
        role="button"
        tabindex="0"
        @click="ctx.focusConfigSection()"
        @keydown.enter="ctx.focusConfigSection()">
        <div class="openclaw-workbench__welcome-card-icon">
          <svg><use href="#settings"></use></svg>
        </div>
        <div class="openclaw-workbench__welcome-card-content">
          <strong>{{ ctx.translate('ai_assistant.robot.openclaw_check_config') }}</strong>
          <span>{{ ctx.translate('ai_assistant.robot.openclaw_workspace_subtitle') }}</span>
        </div>
      </div>

      <div
        v-if="!ctx.isConnected"
        class="openclaw-workbench__welcome-card"
        role="button"
        tabindex="0"
        @click="ctx.handleConnect()"
        @keydown.enter="ctx.handleConnect()">
        <div class="openclaw-workbench__welcome-card-icon">
          <svg><use href="#server"></use></svg>
        </div>
        <div class="openclaw-workbench__welcome-card-content">
          <strong>{{ ctx.translate('ai_assistant.robot.openclaw_connect') }}</strong>
          <span>{{ ctx.translate('ai_assistant.robot.openclaw_gateway_placeholder') }}</span>
        </div>
      </div>

      <div
        class="openclaw-workbench__welcome-card"
        role="button"
        tabindex="0"
        @click="ctx.handleCreateConversation()"
        @keydown.enter="ctx.handleCreateConversation()">
        <div class="openclaw-workbench__welcome-card-icon">
          <svg><use href="#plus"></use></svg>
        </div>
        <div class="openclaw-workbench__welcome-card-content">
          <strong>{{ ctx.translate('ai_assistant.robot.openclaw_new_chat') }}</strong>
          <span>{{ ctx.translate('ai_assistant.robot.new_conversation_title') }}</span>
        </div>
      </div>
    </div>

    <div class="openclaw-workbench__quick-prompts">
      <button
        v-for="prompt in quickPrompts"
        :key="prompt"
        type="button"
        class="openclaw-workbench__quick-prompt"
        @click="ctx.handleQuickPrompt(prompt)">
        {{ prompt }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOpenClawContext } from '../composables/useOpenClawContext'

const ctx = useOpenClawContext()

const quickPrompts = computed(() => [
  ctx.translate('ai_assistant.robot.openclaw_quick_prompt_debug'),
  ctx.translate('ai_assistant.robot.openclaw_quick_prompt_explain'),
  ctx.translate('ai_assistant.robot.openclaw_quick_prompt_plan'),
  ctx.translate('ai_assistant.robot.openclaw_quick_prompt_refactor')
])
</script>

<style scoped>
.openclaw-workbench__welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 40px 20px;
  text-align: center;
}

.openclaw-workbench__welcome-brand {
  margin-bottom: 48px;
}

.openclaw-workbench__welcome-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-info));
  color: var(--hula-text-inverse);
  margin-bottom: 24px;
  box-shadow: 0 20px 40px color-mix(in srgb, var(--color-primary) 25%, transparent);
}

.openclaw-workbench__welcome-icon svg {
  width: 40px;
  height: 40px;
}

.openclaw-workbench__welcome-title {
  margin: 0 0 12px;
  font-size: 28px;
  font-weight: 800;
  color: var(--text-color);
  letter-spacing: -0.02em;
}

.openclaw-workbench__welcome-description {
  margin: 0;
  font-size: 16px;
  color: var(--color-text-secondary);
  max-width: 480px;
}

.openclaw-workbench__welcome-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  width: 100%;
  max-width: 900px;
  margin-bottom: 48px;
}

.openclaw-workbench__welcome-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 24px;
  border-radius: 20px;
  border: 1px solid var(--line-color);
  background: var(--center-bg-color);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.openclaw-workbench__welcome-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-primary-hover);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.06);
}

.openclaw-workbench__welcome-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--bg-msg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  color: var(--color-primary);
}

.openclaw-workbench__welcome-card-icon svg {
  width: 20px;
  height: 20px;
}

.openclaw-workbench__welcome-card-content strong {
  display: block;
  font-size: 15px;
  margin-bottom: 4px;
  color: var(--text-color);
}

.openclaw-workbench__welcome-card-content span {
  font-size: 13px;
  color: var(--color-text-tertiary);
  line-height: 1.5;
}

.openclaw-workbench__quick-prompts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  max-width: 800px;
}

.openclaw-workbench__quick-prompt {
  padding: 10px 18px;
  border-radius: 99px;
  border: 1px solid var(--line-color);
  background: var(--center-bg-color);
  font-size: 14px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.openclaw-workbench__quick-prompt:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 6%, transparent);
}
</style>
