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
          @update:value="handleLanguageChange" />
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
          @update:value="handleSendKeyChange" />
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
        <n-select v-model:value="recallTime" :options="recallTimeOptions" style="width: 150px" />
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
        <n-select v-model:value="emojiSize" :options="emojiSizeOptions" style="width: 120px" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">阅后即焚默认</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">新私聊默认开启阅后即焚</span>
          <span class="setting-desc">创建新私聊时自动开启阅后即焚</span>
        </div>
        <n-switch v-model:value="burnDefaultEnabled" @update:value="handleBurnDefaultToggle" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">默认焚毁时间</span>
          <span class="setting-desc">阅后即焚消息的默认焚毁时间</span>
        </div>
        <n-select
          v-model:value="burnDefaultDuration"
          :options="burnDurationOptions"
          style="width: 130px"
          @update:value="handleBurnDurationChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示焚毁倒计时</span>
          <span class="setting-desc">在消息上显示焚毁倒计时进度</span>
        </div>
        <n-switch v-model:value="burnShowCountdown" @update:value="handleBurnCountdownToggle" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">线程偏好</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">参与线程时自动订阅</span>
          <span class="setting-desc">在线程中发送消息后自动订阅该线程</span>
        </div>
        <n-switch v-model:value="threadAutoSubscribe" @update:value="handleThreadAutoSubscribe" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">在房间内显示线程入口</span>
          <span class="setting-desc">在消息列表中显示线程入口图标</span>
        </div>
        <n-switch v-model:value="threadShowInRoom" @update:value="handleThreadShowInRoom" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">线程通知级别</span>
          <span class="setting-desc">控制线程消息的通知行为</span>
        </div>
        <n-select
          v-model:value="threadNotificationLevel"
          :options="threadNotificationOptions"
          style="width: 130px"
          @update:value="handleThreadNotificationChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">空间偏好</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">加入空间时自动加入其房间</span>
          <span class="setting-desc">加入空间后自动加入其中的所有房间</span>
        </div>
        <n-switch v-model:value="spaceAutoJoinRooms" @update:value="handleSpaceAutoJoin" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">显示子空间</span>
          <span class="setting-desc">在空间列表中显示嵌套的子空间</span>
        </div>
        <n-switch v-model:value="spaceShowSubspaces" @update:value="handleSpaceShowSubspaces" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">空间默认通知</span>
          <span class="setting-desc">新加入空间的默认通知级别</span>
        </div>
        <n-select
          v-model:value="spaceDefaultNotification"
          :options="spaceNotificationOptions"
          style="width: 130px"
          @update:value="handleSpaceNotificationChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">隐私偏好</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">发送已读回执</span>
          <span class="setting-desc">让对方知道你已读消息</span>
        </div>
        <n-switch v-model:value="sendReadReceipts" @update:value="handleReadReceiptsToggle" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">发送输入状态</span>
          <span class="setting-desc">让对方看到你正在输入</span>
        </div>
        <n-switch v-model:value="sendTypingNotifications" @update:value="handleTypingToggle" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NSelect, NSwitch, NDivider, useMessage } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useSettingStore } from '@/stores/domains/settings/setting'
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

const burnDefaultEnabled = ref(false)
const burnDefaultDuration = ref(60)
const burnShowCountdown = ref(true)

const threadAutoSubscribe = ref(true)
const threadShowInRoom = ref(true)
const threadNotificationLevel = ref('participate')

const spaceAutoJoinRooms = ref(false)
const spaceShowSubspaces = ref(true)
const spaceDefaultNotification = ref('all_messages')

const sendReadReceipts = ref(true)
const sendTypingNotifications = ref(true)

const burnDurationOptions = [
  { label: '30秒', value: 30 },
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
  { label: '1小时', value: 3600 },
  { label: '24小时', value: 86400 }
]

const threadNotificationOptions = [
  { label: '所有消息', value: 'all' },
  { label: '仅参与的', value: 'participate' },
  { label: '无通知', value: 'none' }
]

const spaceNotificationOptions = [
  { label: '所有消息', value: 'all_messages' },
  { label: '仅提及', value: 'mentions_only' },
  { label: '无通知', value: 'none' }
]

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

  const savedBurnDefault = localStorage.getItem('hula-burn-default-enabled')
  if (savedBurnDefault !== null) {
    burnDefaultEnabled.value = savedBurnDefault === 'true'
  }
  const savedBurnDuration = localStorage.getItem('hula-burn-default-duration')
  if (savedBurnDuration) {
    burnDefaultDuration.value = parseInt(savedBurnDuration, 10)
  }
  const savedBurnCountdown = localStorage.getItem('hula-burn-show-countdown')
  if (savedBurnCountdown !== null) {
    burnShowCountdown.value = savedBurnCountdown === 'true'
  }

  const savedThreadAuto = localStorage.getItem('hula-thread-auto-subscribe')
  if (savedThreadAuto !== null) {
    threadAutoSubscribe.value = savedThreadAuto === 'true'
  }
  const savedThreadShow = localStorage.getItem('hula-thread-show-in-room')
  if (savedThreadShow !== null) {
    threadShowInRoom.value = savedThreadShow === 'true'
  }
  const savedThreadNotif = localStorage.getItem('hula-thread-notification-level')
  if (savedThreadNotif) {
    threadNotificationLevel.value = savedThreadNotif
  }

  const savedSpaceAutoJoin = localStorage.getItem('hula-space-auto-join')
  if (savedSpaceAutoJoin !== null) {
    spaceAutoJoinRooms.value = savedSpaceAutoJoin === 'true'
  }
  const savedSpaceShowSub = localStorage.getItem('hula-space-show-subspaces')
  if (savedSpaceShowSub !== null) {
    spaceShowSubspaces.value = savedSpaceShowSub === 'true'
  }
  const savedSpaceNotif = localStorage.getItem('hula-space-default-notification')
  if (savedSpaceNotif) {
    spaceDefaultNotification.value = savedSpaceNotif
  }

  const savedReadReceipts = localStorage.getItem('hula-send-read-receipts')
  if (savedReadReceipts !== null) {
    sendReadReceipts.value = savedReadReceipts === 'true'
  }
  const savedTyping = localStorage.getItem('hula-send-typing-notifications')
  if (savedTyping !== null) {
    sendTypingNotifications.value = savedTyping === 'true'
  }
})

function handleLanguageChange(value: string) {
  settingStore.page.lang = value
  if (value !== 'AUTO') {
    locale.value = value
  }
  message.success(`语言已切换为 ${languageOptions.find((l) => l.value === value)?.label}`)
}

function handleSendKeyChange(value: string) {
  settingStore.setSendMessageShortcut(value)
  message.success(`发送键已设置为 ${sendKeyOptions.find((s) => s.value === value)?.label}`)
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

function handleBurnDefaultToggle(value: boolean) {
  localStorage.setItem('hula-burn-default-enabled', value.toString())
  message.success(value ? '已启用新私聊默认阅后即焚' : '已禁用新私聊默认阅后即焚')
}

function handleBurnDurationChange(value: number) {
  localStorage.setItem('hula-burn-default-duration', value.toString())
  const label = burnDurationOptions.find((o) => o.value === value)?.label
  message.success(`默认焚毁时间已设置为${label}`)
}

function handleBurnCountdownToggle(value: boolean) {
  localStorage.setItem('hula-burn-show-countdown', value.toString())
  message.success(value ? '已启用焚毁倒计时' : '已禁用焚毁倒计时')
}

function handleThreadAutoSubscribe(value: boolean) {
  localStorage.setItem('hula-thread-auto-subscribe', value.toString())
  message.success(value ? '已启用线程自动订阅' : '已禁用线程自动订阅')
}

function handleThreadShowInRoom(value: boolean) {
  localStorage.setItem('hula-thread-show-in-room', value.toString())
  message.success(value ? '已启用房间内线程入口' : '已禁用房间内线程入口')
}

function handleThreadNotificationChange(value: string) {
  localStorage.setItem('hula-thread-notification-level', value)
  const label = threadNotificationOptions.find((o) => o.value === value)?.label
  message.success(`线程通知级别已设置为${label}`)
}

function handleSpaceAutoJoin(value: boolean) {
  localStorage.setItem('hula-space-auto-join', value.toString())
  message.success(value ? '已启用空间自动加入房间' : '已禁用空间自动加入房间')
}

function handleSpaceShowSubspaces(value: boolean) {
  localStorage.setItem('hula-space-show-subspaces', value.toString())
  message.success(value ? '已启用显示子空间' : '已禁用显示子空间')
}

function handleSpaceNotificationChange(value: string) {
  localStorage.setItem('hula-space-default-notification', value)
  const label = spaceNotificationOptions.find((o) => o.value === value)?.label
  message.success(`空间默认通知已设置为${label}`)
}

function handleReadReceiptsToggle(value: boolean) {
  localStorage.setItem('hula-send-read-receipts', value.toString())
  message.success(value ? '已启用发送已读回执' : '已禁用发送已读回执')
}

function handleTypingToggle(value: boolean) {
  localStorage.setItem('hula-send-typing-notifications', value.toString())
  message.success(value ? '已启用发送输入状态' : '已禁用发送输入状态')
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
  color: var(--color-text-quaternary);
  margin-top: 4px;
}
</style>
