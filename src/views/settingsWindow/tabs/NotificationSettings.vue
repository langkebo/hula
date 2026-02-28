<template>
  <div class="notification-settings">
    <div class="settings-section">
      <h3 class="section-title">桌面通知</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">启用桌面通知</span>
          <span class="setting-desc">接收新消息时显示桌面通知</span>
        </div>
        <n-switch v-model:value="desktopNotification" @update:value="handleNotificationChange" />
      </div>
      <div v-if="desktopNotification" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">通知声音</span>
          <span class="setting-desc">收到通知时播放声音</span>
        </div>
        <n-switch v-model:value="notificationSound" @update:value="handleSoundChange" />
      </div>
      <div v-if="notificationSound" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">音量</span>
          <span class="setting-desc">调整通知声音音量</span>
        </div>
        <div class="volume-control">
          <n-slider
            v-model:value="soundVolume"
            :min="0"
            :max="100"
            :step="10"
            style="width: 100px"
            @update:value="handleVolumeChange" />
          <span class="volume-value">{{ soundVolume }}%</span>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">通知内容</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示消息内容</span>
          <span class="setting-desc">在通知中显示消息内容</span>
        </div>
        <n-switch v-model:value="showMessageContent" @update:value="handleContentChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示发送者名称</span>
          <span class="setting-desc">在通知中显示发送者名称</span>
        </div>
        <n-switch v-model:value="showSenderName" @update:value="handleSenderChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">关键词通知</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">启用关键词通知</span>
          <span class="setting-desc">当消息包含指定关键词时发送通知</span>
        </div>
        <n-switch v-model:value="keywordNotification" @update:value="handleKeywordToggle" />
      </div>
      <div v-if="keywordNotification" class="keywords-section">
        <div class="keywords-control">
          <n-input v-model:value="newKeyword" placeholder="输入关键词后按回车添加" @keyup.enter="addKeyword" />
          <n-button type="primary" @click="addKeyword">添加</n-button>
        </div>
        <div class="keywords-list">
          <n-tag v-for="keyword in keywords" :key="keyword" closable @close="removeKeyword(keyword)">
            {{ keyword }}
          </n-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NSwitch, NSlider, NDivider, NInput, NButton, NTag, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/setting'

defineOptions({
  name: 'NotificationSettings'
})

const message = useMessage()
const settingStore = useSettingStore()
const { notification } = storeToRefs(settingStore)

const desktopNotification = ref(true)
const notificationSound = ref(notification.value?.messageSound ?? true)
const soundVolume = ref(notification.value?.volume ?? 80)
const showMessageContent = ref(true)
const showSenderName = ref(true)
const keywordNotification = ref(false)
const newKeyword = ref('')
const keywords = ref<string[]>([])

onMounted(() => {
  const savedDesktopNotification = localStorage.getItem('hula-desktop-notification')
  if (savedDesktopNotification !== null) {
    desktopNotification.value = savedDesktopNotification === 'true'
  }

  const savedShowContent = localStorage.getItem('hula-show-content')
  if (savedShowContent !== null) {
    showMessageContent.value = savedShowContent === 'true'
  }

  const savedShowSender = localStorage.getItem('hula-show-sender')
  if (savedShowSender !== null) {
    showSenderName.value = savedShowSender === 'true'
  }

  const savedKeywords = localStorage.getItem('hula-keywords')
  if (savedKeywords) {
    keywords.value = JSON.parse(savedKeywords)
  }

  const savedKeywordNotification = localStorage.getItem('hula-keyword-notification')
  if (savedKeywordNotification !== null) {
    keywordNotification.value = savedKeywordNotification === 'true'
  }
})

async function handleNotificationChange(value: boolean) {
  if (value && 'Notification' in window) {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      message.warning('请在系统设置中允许通知权限')
      desktopNotification.value = false
      return
    }
  }
  localStorage.setItem('hula-desktop-notification', value.toString())
  message.success(value ? '已启用桌面通知' : '已禁用桌面通知')
}

function handleSoundChange(value: boolean) {
  settingStore.setMessageSoundEnabled(value)
  message.success(value ? '已启用通知声音' : '已禁用通知声音')
}

function handleVolumeChange(value: number) {
  settingStore.setNotificationVolume(value)
}

function handleContentChange(value: boolean) {
  localStorage.setItem('hula-show-content', value.toString())
  message.success(value ? '通知将显示消息内容' : '通知将隐藏消息内容')
}

function handleSenderChange(value: boolean) {
  localStorage.setItem('hula-show-sender', value.toString())
  message.success(value ? '通知将显示发送者' : '通知将隐藏发送者')
}

function handleKeywordToggle(value: boolean) {
  localStorage.setItem('hula-keyword-notification', value.toString())
  message.success(value ? '已启用关键词通知' : '已禁用关键词通知')
}

function addKeyword() {
  const keyword = newKeyword.value.trim()
  if (keyword && !keywords.value.includes(keyword)) {
    keywords.value.push(keyword)
    localStorage.setItem('hula-keywords', JSON.stringify(keywords.value))
    newKeyword.value = ''
    message.success(`已添加关键词: ${keyword}`)
  }
}

function removeKeyword(keyword: string) {
  keywords.value = keywords.value.filter((k) => k !== keyword)
  localStorage.setItem('hula-keywords', JSON.stringify(keywords.value))
  message.success(`已移除关键词: ${keyword}`)
}
</script>

<style scoped>
.notification-settings {
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

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.volume-value {
  font-size: 12px;
  color: #666;
  min-width: 36px;
}

.keywords-section {
  margin-top: 12px;
}

.keywords-control {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
