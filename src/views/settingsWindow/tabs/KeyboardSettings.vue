<template>
  <div class="keyboard-settings">
    <div class="settings-section">
      <h3 class="section-title">全局快捷键</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">启用全局快捷键</span>
          <span class="setting-desc">在应用未激活时也能使用快捷键</span>
        </div>
        <n-switch v-model:value="globalEnabled" @update:value="handleGlobalShortcutChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">快捷键列表</h3>
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
      <h3 class="section-title">自定义快捷键</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">截图快捷键</span>
          <span class="setting-desc">设置截图功能的快捷键</span>
        </div>
        <n-input
          :value="shortcutsStore.screenshot"
          readonly
          style="width: 150px"
          @click="handleEditShortcut('screenshot')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">打开主面板</span>
          <span class="setting-desc">设置打开主面板的快捷键</span>
        </div>
        <n-input
          :value="shortcutsStore.openMainPanel"
          readonly
          style="width: 150px"
          @click="handleEditShortcut('openMainPanel')" />
      </div>
      <div class="reset-section">
        <n-button @click="resetShortcuts">恢复默认快捷键</n-button>
      </div>
    </div>
  </div>

  <n-modal v-model:show="editingShortcut" preset="dialog" title="编辑快捷键">
    <div class="shortcut-editor">
      <p>请按下新的快捷键组合...</p>
      <div class="current-keys">
        <kbd v-for="key in currentEditingKeys" :key="key" class="key">{{ key }}</kbd>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { NButton, NDivider, NSwitch, NInput, NModal, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'
import { isMac } from '@/utils/PlatformConstants'

defineOptions({
  name: 'KeyboardSettings'
})

const message = useMessage()
const settingStore = useSettingStore()
const { shortcuts: storeShortcuts } = storeToRefs(settingStore)

const shortcutsStore = reactive({
  screenshot: storeShortcuts.value?.screenshot || (isMac() ? 'Cmd+Ctrl+H' : 'Ctrl+Alt+H'),
  openMainPanel: storeShortcuts.value?.openMainPanel || (isMac() ? 'Cmd+Ctrl+P' : 'Ctrl+Alt+P')
})

const globalEnabled = ref(storeShortcuts.value?.globalEnabled ?? false)

const shortcutList = [
  { id: 1, action: '发送消息', description: '在聊天窗口发送消息', keys: ['Enter'] },
  { id: 2, action: '换行', description: '在输入框中换行', keys: ['Shift', 'Enter'] },
  { id: 3, action: '搜索', description: '打开搜索功能', keys: ['Ctrl', 'F'] },
  { id: 4, action: '新建会话', description: '创建新的聊天会话', keys: ['Ctrl', 'N'] },
  { id: 5, action: '关闭会话', description: '关闭当前会话窗口', keys: ['Ctrl', 'W'] },
  { id: 6, action: '设置', description: '打开设置页面', keys: ['Ctrl', ','] },
  { id: 7, action: '退出应用', description: '退出应用程序', keys: ['Ctrl', 'Q'] },
  { id: 8, action: '全屏', description: '切换全屏模式', keys: ['F11'] }
]

const shortcuts = ref(shortcutList)
const editingShortcut = ref(false)
const currentEditingType = ref('')
const currentEditingKeys = ref<string[]>([])

function handleGlobalShortcutChange(value: boolean) {
  settingStore.setGlobalShortcutEnabled(value)
  message.success(value ? '已启用全局快捷键' : '已禁用全局快捷键')
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
  if (event.metaKey) keys.push(isMac() ? 'Cmd' : 'Meta')

  const key = event.key.toUpperCase()
  if (!['CONTROL', 'ALT', 'SHIFT', 'META'].includes(key)) {
    keys.push(key)
  }

  currentEditingKeys.value = keys

  if (keys.length >= 2) {
    const shortcutStr = keys.join('+')
    if (currentEditingType.value === 'screenshot') {
      shortcutsStore.screenshot = shortcutStr
      settingStore.setScreenshotShortcut(shortcutStr)
    } else if (currentEditingType.value === 'openMainPanel') {
      shortcutsStore.openMainPanel = shortcutStr
      settingStore.setOpenMainPanelShortcut(shortcutStr)
    }
    editingShortcut.value = false
    message.success('快捷键已更新')
  }
}

function resetShortcuts() {
  const defaults = {
    screenshot: isMac() ? 'Cmd+Ctrl+H' : 'Ctrl+Alt+H',
    openMainPanel: isMac() ? 'Cmd+Ctrl+P' : 'Ctrl+Alt+P'
  }

  shortcutsStore.screenshot = defaults.screenshot
  shortcutsStore.openMainPanel = defaults.openMainPanel
  settingStore.setScreenshotShortcut(defaults.screenshot)
  settingStore.setOpenMainPanelShortcut(defaults.openMainPanel)
  message.success('快捷键已恢复默认设置')
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
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
}

:deep(.dark) .shortcut-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.shortcut-info {
  display: flex;
  flex-direction: column;
}

.shortcut-action {
  font-size: 14px;
}

.shortcut-desc {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.shortcut-keys {
  display: flex;
  gap: 4px;
}

.key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  font-family: monospace;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

:deep(.dark) .key {
  background-color: #333;
  border-color: #555;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.reset-section {
  margin-top: 16px;
}

.shortcut-editor {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 20px;
}

.current-keys {
  display: flex;
  gap: 8px;
}
</style>
