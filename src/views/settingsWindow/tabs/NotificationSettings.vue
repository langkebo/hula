<template>
  <div class="notification-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.notification.desktop.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.desktop.enable_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.desktop.enable_desc') }}</span>
        </div>
        <n-switch :value="desktopNotification" @update:value="handleNotificationChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.notification.content.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.content.message_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.content.message_desc') }}</span>
        </div>
        <n-switch :value="showMessageContent" @update:value="handleContentChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.content.sender_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.content.sender_desc') }}</span>
        </div>
        <n-switch :value="showSenderName" @update:value="handleSenderChange" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.notification.keyword.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.keyword.enable_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.keyword.enable_desc') }}</span>
        </div>
        <n-switch :value="keywordNotification" @update:value="handleKeywordToggle" />
      </div>
      <div v-if="keywordNotification" class="keywords-section">
        <div class="keywords-control">
          <n-input
            v-model:value="newKeyword"
            :placeholder="t('setting.notification.keyword.input_placeholder')"
            @keyup.enter="addKeyword" />
          <n-button type="primary" @click="addKeyword">
            {{ t('setting.notification.keyword.add') }}
          </n-button>
        </div>
        <div class="keywords-list">
          <n-tag v-for="keyword in keywords" :key="keyword" closable @close="removeKeyword(keyword)">
            {{ keyword }}
          </n-tag>
        </div>
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.notification.thread.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.thread.mention_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.thread.mention_desc') }}</span>
        </div>
        <n-switch :value="threadMentionNotify" @update:value="handleThreadMentionNotify" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.notification.push_section.title') }}</h3>
      <p class="section-desc">{{ t('setting.notification.push_section.desc') }}</p>
      <PushSettings embedded />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NDivider, NInput, NSwitch, NTag } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'
import {
  loadNotificationDisplayPreferences,
  type NotificationDisplayPreferences,
  parseNotificationKeywords,
  saveNotificationDisplayPreferences
} from '@/services/matrix/notifications/notificationDisplayPreferences'
import PushSettings from '@/views/settingsWindow/tabs/PushSettings.vue'

defineOptions({
  name: 'NotificationSettings'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

// 桌面通知/消息内容/发送者/线程提及四项配置持久化在 tjg-notification-config，由
// MatrixNotificationService.getConfig() + shouldNotifyMessage() 在实际发送路径
// （chat 收到消息时）读取；组件只读写这份服务配置，不自己消费。
const notificationConfig = ref(matrixNotificationService.getConfig())

// 关键词开关 + 关键词列表的唯一来源是 notificationDisplayPreferences
// （tjg-notification-display-preferences），与上面的事件开关不重叠、不互相镜像。
const displayPreferences = ref(loadNotificationDisplayPreferences())

type NotificationToggle = 'enableDesktop' | 'showMessageContent' | 'showSender'

// 单一写入者：模板只保留 `:value` + `@update:value`（不再 v-model:value），
// 由 handler 负责写入，避免 setter 与 handler 双触发导致每次点击两次持久化 / 两次 account data PUT。
function writeConfig(patch: Partial<Record<NotificationToggle, boolean>>) {
  const changed = (Object.keys(patch) as NotificationToggle[]).some(
    (key) => patch[key] !== notificationConfig.value[key]
  )
  if (!changed) {
    return
  }

  notificationConfig.value = { ...notificationConfig.value, ...patch }
  matrixNotificationService.updateConfig(patch)
}

function writeDisplayPreferences(patch: Partial<NotificationDisplayPreferences>) {
  displayPreferences.value = { ...displayPreferences.value, ...patch }
  saveNotificationDisplayPreferences(displayPreferences.value)
}

const desktopNotification = computed({
  get: () => notificationConfig.value.enableDesktop,
  set: (value: boolean) => writeConfig({ enableDesktop: value })
})
const showMessageContent = computed({
  get: () => notificationConfig.value.showMessageContent,
  set: (value: boolean) => writeConfig({ showMessageContent: value })
})
const showSenderName = computed({
  get: () => notificationConfig.value.showSender,
  set: (value: boolean) => writeConfig({ showSender: value })
})
const keywordNotification = computed({
  get: () => displayPreferences.value.keywordNotifications,
  set: (value: boolean) => writeDisplayPreferences({ keywordNotifications: value })
})
const keywords = computed(() => displayPreferences.value.keywords)
const newKeyword = ref('')

// events.thread_mention 缺省即开启，因此未写入过时开关显示为打开。
const threadMentionNotify = computed({
  get: () => notificationConfig.value.events?.thread_mention ?? true,
  set: (value: boolean) => {
    notificationConfig.value = {
      ...notificationConfig.value,
      events: { ...notificationConfig.value.events, thread_mention: value }
    }
    matrixNotificationService.setEventNotificationEnabled('thread_mention', value)
  }
})

onMounted(() => {
  notificationConfig.value = matrixNotificationService.getConfig()
  displayPreferences.value = loadNotificationDisplayPreferences()
})

async function handleNotificationChange(value: boolean) {
  try {
    if (value && 'Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        showFeedback(t('setting.notification.feedback.permission_denied'), 'warning')
        desktopNotification.value = false
        return
      }
    }
    desktopNotification.value = value
    showFeedback(
      t('setting.notification.feedback.desktop', {
        state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
      }),
      'success'
    )
  } catch (err) {
    // 权限请求可能 reject（插件不可用等）：回滚开关并给出反馈，不能留下"开着但不生效"的状态
    desktopNotification.value = false
    showFeedback(t('setting.notification.feedback.permission_denied'), 'error')
  }
}

function handleContentChange(value: boolean) {
  showMessageContent.value = value
  showFeedback(
    t('setting.notification.feedback.message_content', {
      state: t(value ? 'setting.notification.common.shown' : 'setting.notification.common.hidden')
    }),
    'success'
  )
}

function handleSenderChange(value: boolean) {
  showSenderName.value = value
  showFeedback(
    t('setting.notification.feedback.sender_name', {
      state: t(value ? 'setting.notification.common.shown' : 'setting.notification.common.hidden')
    }),
    'success'
  )
}

function handleKeywordToggle(value: boolean) {
  keywordNotification.value = value
  showFeedback(
    t('setting.notification.feedback.keyword', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function addKeyword() {
  const keyword = newKeyword.value.trim()
  if (!keyword) {
    return
  }

  const current = keywords.value
  const next = parseNotificationKeywords([...current, keyword].join(','))
  if (next.length === current.length) {
    return
  }

  writeDisplayPreferences({ keywords: next })
  newKeyword.value = ''
  showFeedback(t('setting.notification.feedback.keyword_added', { keyword }), 'success')
}

function removeKeyword(keyword: string) {
  writeDisplayPreferences({ keywords: keywords.value.filter((k) => k !== keyword) })
  showFeedback(t('setting.notification.feedback.keyword_removed', { keyword }), 'success')
}

function handleThreadMentionNotify(value: boolean) {
  threadMentionNotify.value = value
  showFeedback(
    t('setting.notification.feedback.thread_mention', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}
</script>

<style scoped>
.notification-settings {
  padding: 0 var(--tjg-space-2);
}

.settings-section {
  margin-bottom: var(--tjg-space-4);
}

.section-title {
  font-size: var(--tjg-font-size-lg);
  font-weight: var(--tjg-font-weight-medium);
  margin-bottom: var(--tjg-space-4);
  color: var(--tjg-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--tjg-space-3) 0;
  border-bottom: 1px solid var(--tjg-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--tjg-font-size-base);
  color: var(--tjg-text-primary);
}

.setting-desc {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
  margin-top: var(--tjg-space-1);
}

.keywords-section {
  margin-top: var(--tjg-space-3);
}

.keywords-control {
  display: flex;
  gap: var(--tjg-space-2);
  margin-bottom: var(--tjg-space-3);
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tjg-space-2);
}

.section-desc {
  margin: calc(var(--tjg-space-2) * -1) 0 var(--tjg-space-4);
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-quaternary);
}
</style>
