<template>
  <div class="preferences-settings">
    <div class="settings-section">
      <h3 class="section-title">语言</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">界面语言</span>
          <span class="setting-desc">选择应用显示语言</span>
        </div>
        <n-select
          v-model:value="language"
          :options="languageOptions"
          style="width: 150px"
          @update:value="handleLanguageChange"
        />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">消息发送</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">发送键</span>
          <span class="setting-desc">选择发送消息的快捷键</span>
        </div>
        <n-select
          v-model:value="sendKey"
          :options="sendKeyOptions"
          style="width: 150px"
          @update:value="handleSendKeyChange"
        />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">消息确认</span>
          <span class="setting-desc">发送前显示确认对话框</span>
        </div>
        <n-switch v-model:value="messageConfirm" @update:value="handleConfirmChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">消息撤回时间</span>
          <span class="setting-desc">设置消息可撤回的时间窗口</span>
        </div>
        <n-select
          v-model:value="recallTime"
          :options="recallTimeOptions"
          style="width: 150px"
        />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">链接预览</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">启用链接预览</span>
          <span class="setting-desc">自动生成消息中链接的预览</span>
        </div>
        <n-switch v-model:value="linkPreview" @update:value="handleLinkPreviewChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">表情符号</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">自动转换表情</span>
          <span class="setting-desc">将 :) 等符号自动转换为表情</span>
        </div>
        <n-switch v-model:value="emojiConvert" @update:value="handleEmojiChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">表情大小</span>
          <span class="setting-desc">设置消息中表情的显示大小</span>
        </div>
        <n-select
          v-model:value="emojiSize"
          :options="emojiSizeOptions"
          style="width: 120px"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NSelect, NSwitch, NDivider, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'
import { useI18n } from 'vue-i18n'

defineOptions({
  name: 'PreferencesSettings'
})

const message = useMessage()
const { locale } = useI18n()
const settingStore = useSettingStore()
const { chat, page } = storeToRefs(settingStore)

const language = ref(page.value.lang || 'AUTO')
const languageOptions = [
  { label: '自动检测', value: 'AUTO' },
  { label: '简体中文', value: 'zh-CN' },
  { label: '繁體中文', value: 'zh-TW' },
  { label: 'English', value: 'en' },
  { label: '日本語', value: 'ja' }
]

const sendKey = ref(chat.value?.sendKey || 'Enter')
const sendKeyOptions = [
  { label: 'Enter', value: 'Enter' },
  { label: 'Ctrl + Enter', value: 'Ctrl+Enter' },
  { label: 'Shift + Enter', value: 'Shift+Enter' }
]

const recallTimeOptions = [
  { label: '2 分钟', value: 120 },
  { label: '5 分钟', value: 300 },
  { label: '10 分钟', value: 600 }
]

const emojiSizeOptions = [
  { label: '小', value: 'small' },
  { label: '中', value: 'medium' },
  { label: '大', value: 'large' }
]

const messageConfirm = ref(false)
const recallTime = ref(120)
const linkPreview = ref(true)
const emojiConvert = ref(true)
const emojiSize = ref('medium')

onMounted(() => {
  const savedConfirm = localStorage.getItem('hula-message-confirm')
  if (savedConfirm !== null) {
    messageConfirm.value = savedConfirm === 'true'
  }
  
  const savedLinkPreview = localStorage.getItem('hula-link-preview')
  if (savedLinkPreview !== null) {
    linkPreview.value = savedLinkPreview === 'true'
  }
  
  const savedEmoji = localStorage.getItem('hula-emoji-convert')
  if (savedEmoji !== null) {
    emojiConvert.value = savedEmoji === 'true'
  }
  
  const savedEmojiSize = localStorage.getItem('hula-emoji-size')
  if (savedEmojiSize) {
    emojiSize.value = savedEmojiSize
  }
})

function handleLanguageChange(value: string) {
  settingStore.page.lang = value
  if (value !== 'AUTO') {
    locale.value = value
  }
  message.success(`语言已切换为 ${languageOptions.find(l => l.value === value)?.label}`)
}

function handleSendKeyChange(value: string) {
  settingStore.setSendMessageShortcut(value)
  message.success(`发送键已设置为 ${sendKeyOptions.find(s => s.value === value)?.label}`)
}

function handleConfirmChange(value: boolean) {
  localStorage.setItem('hula-message-confirm', value.toString())
  message.success(value ? '已启用消息确认' : '已禁用消息确认')
}

function handleLinkPreviewChange(value: boolean) {
  localStorage.setItem('hula-link-preview', value.toString())
  message.success(value ? '已启用链接预览' : '已禁用链接预览')
}

function handleEmojiChange(value: boolean) {
  localStorage.setItem('hula-emoji-convert', value.toString())
  message.success(value ? '已启用表情转换' : '已禁用表情转换')
}
</script>

<style scoped>
.preferences-settings {
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
</style>
