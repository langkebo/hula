<template>
  <div class="keyboard-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.keyboard.global_title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.keyboard.global_label') }}</span>
          <span class="setting-desc">{{ t('setting.keyboard.global_desc') }}</span>
        </div>
        <n-switch v-model:value="globalEnabled" @update:value="handleGlobalShortcutChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.keyboard.list_title') }}</h3>
      <div class="shortcut-list">
        <div v-for="shortcut in shortcuts" :key="shortcut.id" class="shortcut-item">
          <div class="shortcut-info">
            <span class="shortcut-action">{{ shortcut.action }}</span>
            <span class="shortcut-desc">{{ shortcut.description }}</span>
          </div>
          <div class="shortcut-keys">
            <kbd v-for="key in shortcut.keys" :key="key" class="key">{{ key }}</kbd>
          </div>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.keyboard.custom_title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.keyboard.screenshot_label') }}</span>
          <span class="setting-desc">{{ t('setting.keyboard.screenshot_desc') }}</span>
        </div>
        <n-input
          :value="shortcutsStore.screenshot"
          readonly
          style="width: 150px"
          @click="handleEditShortcut('screenshot')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.keyboard.open_main_panel_label') }}</span>
          <span class="setting-desc">{{ t('setting.keyboard.open_main_panel_desc') }}</span>
        </div>
        <n-input
          :value="shortcutsStore.openMainPanel"
          readonly
          style="width: 150px"
          @click="handleEditShortcut('openMainPanel')" />
      </div>
      <div class="reset-section">
        <n-button @click="resetShortcuts">{{ t('setting.keyboard.reset') }}</n-button>
      </div>
    </div>
  </div>

  <n-modal v-model:show="editingShortcut" preset="dialog" :title="t('setting.keyboard.edit_title')">
    <div class="shortcut-editor">
      <p>{{ t('setting.keyboard.edit_hint') }}</p>
      <div class="current-keys">
        <kbd v-for="key in currentEditingKeys" :key="key" class="key">{{ key }}</kbd>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted, onUnmounted } from 'vue'
import { NButton, NDivider, NSwitch, NInput, NModal, useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useSettingStore } from '@/stores/domains/settings/setting'

defineOptions({
  name: 'KeyboardSettings'
})

const message = useMessage()
const { t } = useI18n()
const settingStore = useSettingStore()

const shortcutsStore = reactive({
  screenshot: settingStore.screenshotShortcut,
  openMainPanel: settingStore.openMainPanelShortcut
})

const globalEnabled = computed({
  get: () => settingStore.globalShortcutEnabled,
  set: (value: boolean) => handleGlobalShortcutChange(value)
})

const shortcuts = computed(() => [
  {
    id: 1,
    action: t('setting.keyboard.actions.send_message'),
    description: t('setting.keyboard.descriptions.send_message'),
    keys: ['Enter']
  },
  {
    id: 2,
    action: t('setting.keyboard.actions.new_line'),
    description: t('setting.keyboard.descriptions.new_line'),
    keys: ['Shift', 'Enter']
  },
  {
    id: 3,
    action: t('setting.keyboard.actions.search'),
    description: t('setting.keyboard.descriptions.search'),
    keys: ['Ctrl', 'F']
  },
  {
    id: 4,
    action: t('setting.keyboard.actions.new_session'),
    description: t('setting.keyboard.descriptions.new_session'),
    keys: ['Ctrl', 'N']
  },
  {
    id: 5,
    action: t('setting.keyboard.actions.close_session'),
    description: t('setting.keyboard.descriptions.close_session'),
    keys: ['Ctrl', 'W']
  },
  {
    id: 6,
    action: t('setting.keyboard.actions.settings'),
    description: t('setting.keyboard.descriptions.settings'),
    keys: ['Ctrl', ',']
  },
  {
    id: 7,
    action: t('setting.keyboard.actions.quit_app'),
    description: t('setting.keyboard.descriptions.quit_app'),
    keys: ['Ctrl', 'Q']
  },
  {
    id: 8,
    action: t('setting.keyboard.actions.fullscreen'),
    description: t('setting.keyboard.descriptions.fullscreen'),
    keys: ['F11']
  }
])
const editingShortcut = ref(false)
const currentEditingType = ref('')
const currentEditingKeys = ref<string[]>([])

function handleGlobalShortcutChange(value: boolean) {
  settingStore.setGlobalShortcutEnabled(value)
  message.success(value ? t('setting.keyboard.enabled') : t('setting.keyboard.disabled'))
}

function handleEditShortcut(type: string) {
  currentEditingType.value = type
  currentEditingKeys.value = []
  editingShortcut.value = true
}

function handleKeyDown(event: KeyboardEvent) {
  if (!editingShortcut.value) return

  event.preventDefault()

  const keys: string[] = []
  if (event.ctrlKey) keys.push('Ctrl')
  if (event.altKey) keys.push('Alt')
  if (event.shiftKey) keys.push('Shift')
  if (event.metaKey) keys.push('Meta')

  const key = event.key.toUpperCase()
  if (!['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) {
    keys.push(key)
  }

  currentEditingKeys.value = keys

  if (keys.length >= 2) {
    const shortcutStr = keys.join('+')

    // Conflict detection
    const conflictingShortcut = Object.entries(shortcutsStore).find(
      ([key, value]) => key !== currentEditingType.value && value === shortcutStr
    )

    if (conflictingShortcut) {
      message.error(t('setting.keyboard.conflict_error'))
      return
    }

    if (currentEditingType.value === 'screenshot') {
      shortcutsStore.screenshot = shortcutStr
      settingStore.setScreenshotShortcut(shortcutStr)
    } else if (currentEditingType.value === 'openMainPanel') {
      shortcutsStore.openMainPanel = shortcutStr
      settingStore.setOpenMainPanelShortcut(shortcutStr)
    }
    editingShortcut.value = false
    message.success(t('setting.keyboard.updated'))
  }
}

function resetShortcuts() {
  settingStore.resetGlobalShortcuts()
  shortcutsStore.screenshot = settingStore.screenshotShortcut
  shortcutsStore.openMainPanel = settingStore.openMainPanelShortcut
  message.success(t('setting.keyboard.reset_success'))
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.keyboard-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-4);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-medium);
  margin-bottom: var(--hula-space-4);
  color: var(--hula-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-2);
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) var(--hula-space-4);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.shortcut-info {
  display: flex;
  flex-direction: column;
}

.shortcut-action {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.shortcut-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: 2px;
}

.shortcut-keys {
  display: flex;
  gap: var(--hula-space-1);
}

.key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 var(--hula-space-2);
  font-size: var(--hula-font-size-sm);
  font-family: monospace;
  background-color: var(--hula-surface-panel);
  border: 1px solid var(--hula-border-default);
  border-radius: var(--hula-radius-xs);
  box-shadow: var(--hula-shadow-sm);
}

.reset-section {
  margin-top: var(--hula-space-4);
}

.shortcut-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--hula-space-4);
  padding: 20px;
}

.current-keys {
  display: flex;
  gap: var(--hula-space-2);
}
</style>
