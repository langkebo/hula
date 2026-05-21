<template>
  <footer class="openclaw-workbench__composer">
    <div class="openclaw-workbench__composer-inner">
      <div class="openclaw-workbench__composer-input-wrapper">
        <n-input
          ref="inputRef"
          :value="ctx.inputMessage"
          type="textarea"
          :placeholder="ctx.translate('ai_assistant.input_placeholder')"
          :autosize="{ minRows: 2, maxRows: 8 }"
          :disabled="ctx.isSending"
          @update:value="handleInputUpdate"
          @keydown="handleKeydown"
          @blur="handleBlur" />

        <div v-show="showCommandMenu" class="openclaw-workbench__command-menu">
          <div class="openclaw-workbench__command-menu-title">
            {{ ctx.translate('ai_assistant.robot.slash_command_title') }}
          </div>
          <div
            v-for="(cmd, index) in filteredCommands"
            :key="cmd.id"
            class="openclaw-workbench__command-item"
            :class="{ 'openclaw-workbench__command-item--active': index === activeCommandIndex }"
            role="button"
            tabindex="0"
            @mousedown.prevent="selectCommand(cmd)"
            @keydown.enter="selectCommand(cmd)"
            @mouseenter="activeCommandIndex = index">
            <span class="openclaw-workbench__command-label">{{ cmd.label }}</span>
          </div>
          <div v-if="filteredCommands.length === 0" class="openclaw-workbench__command-empty">
            {{ ctx.translate('ai_assistant.robot.slash_command_no_match') }}
          </div>
        </div>
      </div>

      <div class="openclaw-workbench__composer-foot">
        <p class="openclaw-workbench__composer-hint">
          {{ composerHint }}
        </p>
        <div class="openclaw-workbench__composer-actions">
          <n-button v-if="ctx.isSending" type="warning" secondary size="small" @click="ctx.handleStopGeneration()">
            <template #icon>
              <svg><use href="#stop"></use></svg>
            </template>
            {{ ctx.translate('ai_assistant.robot.openclaw_stop_generation') }}
          </n-button>
          <n-button
            type="primary"
            size="small"
            :disabled="!ctx.canSend"
            :loading="ctx.isSending"
            @click="ctx.handleSend(ctx.scrollToBottom)">
            <template #icon>
              <svg v-if="!ctx.isSending"><use href="#send"></use></svg>
            </template>
            {{ ctx.translate('editor.send') }}
          </n-button>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import {
  buildOpenClawSlashCommands,
  executeOpenClawSlashCommand,
  type OpenClawCommandAction
} from '../composables/openClawCommands'
import { useOpenClawContext } from '../composables/useOpenClawContext'

const ctx = useOpenClawContext()
const { showFeedback } = useActionFeedback()

const inputRef = ref<InstanceType<(typeof import('naive-ui'))['NInput']> | null>(null)
const activeCommandIndex = ref(0)

const composerHint = computed(() => {
  if (ctx.isSending) return ctx.translate('ai_assistant.robot.openclaw_sending')
  if (!ctx.isConnected) return ctx.translate('ai_assistant.robot.openclaw_disconnected')
  if (!ctx.selectedModelId) return ctx.translate('ai_assistant.robot.openclaw_no_model')
  return ctx.translate('ai_assistant.robot.openclaw_ready')
})

const commandContext = computed(() => ({
  translate: ctx.translate,
  showFeedback: (message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    showFeedback(message, type)
  },
  getCurrentConversation: () => ctx.currentConversation,
  updateCurrentConversation: ctx.updateCurrentConversation,
  getAvailableModels: () => ctx.availableModels,
  getSelectedModelId: () => ctx.selectedModelId,
  setSelectedModelId: (modelId: string) => {
    ctx.selectedModelId = modelId
  },
  isSending: () => ctx.isSending,
  handleStopGeneration: ctx.handleStopGeneration
}))

const allCommands = computed(() => buildOpenClawSlashCommands(commandContext.value))

// --- Slash command state ---
const slashQuery = computed(() => {
  const input = ctx.inputMessage
  if (!input.startsWith('/')) return ''
  // Only treat as slash command if there's no space after the slash (still typing the command)
  const spaceIndex = input.indexOf(' ')
  if (spaceIndex !== -1) return ''
  return input.slice(1).toLowerCase()
})

const showCommandMenu = computed(() => {
  return slashQuery.value !== '' && !ctx.isSending
})

const filteredCommands = computed(() => {
  const query = slashQuery.value
  if (!query) return allCommands.value
  return allCommands.value.filter((cmd) => cmd.id.startsWith(query))
})

watch(filteredCommands, () => {
  activeCommandIndex.value = 0
})

// --- Event handlers ---
const handleInputUpdate = (value: string) => {
  ctx.inputMessage = value
}

const handleKeydown = (e: KeyboardEvent) => {
  if (!showCommandMenu.value) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (executeOpenClawSlashCommand(ctx.inputMessage, commandContext.value)) {
        ctx.inputMessage = ''
        return
      }
      ctx.handleSend(ctx.scrollToBottom)
    }
    return
  }

  // Command menu navigation
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeCommandIndex.value = (activeCommandIndex.value + 1) % filteredCommands.value.length
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeCommandIndex.value =
      (activeCommandIndex.value - 1 + filteredCommands.value.length) % filteredCommands.value.length
    return
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (filteredCommands.value.length > 0) {
      selectCommand(filteredCommands.value[activeCommandIndex.value])
    }
    return
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    ctx.inputMessage = ''
    return
  }
  if (e.key === 'Tab') {
    e.preventDefault()
    if (filteredCommands.value.length > 0) {
      selectCommand(filteredCommands.value[activeCommandIndex.value])
    }
    return
  }
}

const selectCommand = (cmd: OpenClawCommandAction) => {
  cmd.execute()
  ctx.inputMessage = ''
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

const handleBlur = () => {
  setTimeout(() => {
    ctx.handlePersistConfig()
  }, 150)
}
</script>

<style scoped>
.openclaw-workbench__composer-input-wrapper {
  position: relative;
}

.openclaw-workbench__command-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--center-bg-color);
  border: 1px solid var(--line-color);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  z-index: 20;
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 4px;
}

.openclaw-workbench__command-menu-title {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.openclaw-workbench__command-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-color);
  border-radius: 4px;
  margin: 0 4px;
  transition: background-color 0.15s ease;
}

.openclaw-workbench__command-item--active {
  background: var(--hover-bg-color);
}

.openclaw-workbench__command-label {
  font-family: monospace;
}

.openclaw-workbench__command-empty {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
</style>
