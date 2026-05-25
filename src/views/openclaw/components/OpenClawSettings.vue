<template>
  <n-modal
    :show="show"
    @update:show="(val) => emit('update:show', val)"
    preset="card"
    :title="t('ai_assistant.openclaw.settingsStore.title')"
    class="openclaw-settings-modal w-600px max-w-90vw"
    :bordered="false"
    size="huge"
    :segmented="{
      content: 'soft',
      footer: 'soft'
    }">
    <div class="openclaw-settings-content max-h-60vh overflow-y-auto pr-4">
      <n-form ref="formRef" :model="settingsStore" label-placement="top" require-mark-placement="right-hanging">
        <n-divider title-placement="left">{{ t('ai_assistant.openclaw.settingsStore.general') }}</n-divider>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.theme')">
          <n-select v-model:value="settingsStore.theme" :options="themeOptions" />
        </n-form-item>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.sendKey')">
          <n-select v-model:value="settingsStore.sendKey" :options="sendKeyOptions" />
        </n-form-item>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.fontSize')">
          <n-slider v-model:value="settingsStore.fontSize" :min="12" :max="24" :step="1" />
        </n-form-item>

        <n-divider title-placement="left">{{ t('ai_assistant.openclaw.settingsStore.api_config') }}</n-divider>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.apiEndpoint')">
          <n-input v-model:value="settingsStore.apiEndpoint" placeholder="https://api.openai.com/v1" />
        </n-form-item>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.apiKey')">
          <n-input v-model:value="settingsStore.apiKey" type="password" show-password-on="click" placeholder="sk-..." />
        </n-form-item>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.selectedModel')">
          <n-input v-model:value="settingsStore.selectedModel" placeholder="gpt-4o, gpt-3.5-turbo..." />
        </n-form-item>

        <n-divider title-placement="left">{{ t('ai_assistant.openclaw.settingsStore.parameters') }}</n-divider>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.randomness') + ' (Temperature)'">
          <n-slider v-model:value="settingsStore.randomness" :min="0" :max="20" :step="1" />
        </n-form-item>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.topP')">
          <n-slider v-model:value="settingsStore.topP" :min="0" :max="10" :step="1" />
        </n-form-item>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.maxTokens')">
          <n-input-number v-model:value="settingsStore.maxTokens" :min="100" :max="128000" :step="100" />
        </n-form-item>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.presencePenalty')">
          <n-slider v-model:value="settingsStore.presencePenalty" :min="0" :max="20" :step="1" />
        </n-form-item>
        <n-form-item :label="t('ai_assistant.openclaw.settingsStore.frequencyPenalty')">
          <n-slider v-model:value="settingsStore.frequencyPenalty" :min="0" :max="20" :step="1" />
        </n-form-item>

        <n-divider title-placement="left">{{ t('ai_assistant.openclaw.settingsStore.features') }}</n-divider>
        <n-form-item>
          <n-checkbox v-model:checked="settingsStore.autoGenerateTitle">
            {{ t('ai_assistant.openclaw.settingsStore.autoGenerateTitle') }}
          </n-checkbox>
        </n-form-item>
        <n-form-item>
          <n-checkbox v-model:checked="settingsStore.historySummary">
            {{ t('ai_assistant.openclaw.settingsStore.historySummary') }}
          </n-checkbox>
        </n-form-item>
      </n-form>
    </div>
    <template #footer>
      <div class="flex justify-end gap-2">
        <n-button @click="handleReset">{{ t('ai_assistant.openclaw.settingsStore.reset') }}</n-button>
        <n-button type="primary" @click="emit('update:show', false)">{{ t('common.confirm') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRobotChatSettingsStore } from '@/stores/domains/chat/robotChatSettings'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<(e: 'update:show', val: boolean) => void>()

const { t } = useI18n()
const settingsStore = useRobotChatSettingsStore()

const themeOptions = computed(() => [
  { label: t('ai_assistant.openclaw.settingsStore.theme_auto'), value: 'auto' },
  { label: t('ai_assistant.openclaw.settingsStore.theme_light'), value: 'light' },
  { label: t('ai_assistant.openclaw.settingsStore.theme_dark'), value: 'dark' }
])

const sendKeyOptions = computed(() => [
  { label: 'Enter', value: 'Enter' },
  { label: 'Ctrl+Enter', value: 'Ctrl+Enter' },
  { label: 'Cmd+Enter', value: 'Cmd+Enter' }
])

const handleReset = () => {
  settingsStore.resetAllSettings()
}
</script>

<style scoped lang="scss">
.openclaw-settings-modal {
  font-family: var(--hula-font-family);
}
</style>
