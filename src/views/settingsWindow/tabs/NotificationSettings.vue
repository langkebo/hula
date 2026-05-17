<template>
  <div class="notification-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.notification.desktop.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.desktop.enable_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.desktop.enable_desc') }}</span>
        </div>
        <n-switch v-model:value="desktopNotification" @update:value="handleNotificationChange" />
      </div>
      <div v-if="desktopNotification" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.desktop.sound_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.desktop.sound_desc') }}</span>
        </div>
        <n-switch v-model:value="notificationSound" @update:value="handleSoundChange" />
      </div>
      <div v-if="notificationSound" class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.desktop.volume_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.desktop.volume_desc') }}</span>
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
      <h3 class="section-title">{{ t('setting.notification.content.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.content.message_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.content.message_desc') }}</span>
        </div>
        <n-switch v-model:value="showMessageContent" @update:value="handleContentChange" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.content.sender_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.content.sender_desc') }}</span>
        </div>
        <n-switch v-model:value="showSenderName" @update:value="handleSenderChange" />
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
        <n-switch v-model:value="keywordNotification" @update:value="handleKeywordToggle" />
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
          <span class="setting-label">{{ t('setting.notification.thread.reply_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.thread.reply_desc') }}</span>
        </div>
        <n-switch v-model:value="threadReplyNotify" @update:value="handleThreadReplyNotify" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.thread.participate_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.thread.participate_desc') }}</span>
        </div>
        <n-switch v-model:value="threadParticipateNotify" @update:value="handleThreadParticipateNotify" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.thread.mention_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.thread.mention_desc') }}</span>
        </div>
        <n-switch v-model:value="threadMentionNotify" @update:value="handleThreadMentionNotify" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.notification.space.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.space.new_room_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.space.new_room_desc') }}</span>
        </div>
        <n-switch v-model:value="spaceNewRoomNotify" @update:value="handleSpaceNewRoomNotify" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.space.member_change_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.space.member_change_desc') }}</span>
        </div>
        <n-switch v-model:value="spaceMemberChangeNotify" @update:value="handleSpaceMemberChangeNotify" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.notification.friend.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.friend.request_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.friend.request_desc') }}</span>
        </div>
        <n-switch v-model:value="friendRequestNotify" @update:value="handleFriendRequestNotify" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.notification.friend.accept_label') }}</span>
          <span class="setting-desc">{{ t('setting.notification.friend.accept_desc') }}</span>
        </div>
        <n-switch v-model:value="friendAcceptNotify" @update:value="handleFriendAcceptNotify" />
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
import { NButton, NDivider, NInput, NSlider, NSwitch, NTag } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSettingStore } from '@/stores/domains/settings/setting'
import PushSettings from '@/views/settingsWindow/tabs/PushSettings.vue'

defineOptions({
  name: 'NotificationSettings'
})

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const settingStore = useSettingStore()

const desktopNotification = ref(true)
const notificationSound = computed({
  get: () => settingStore.messageSoundEnabled,
  set: (value: boolean) => settingStore.setMessageSoundEnabled(value)
})
const soundVolume = computed({
  get: () => settingStore.notificationVolume,
  set: (value: number) => settingStore.setNotificationVolume(value)
})
const showMessageContent = ref(true)
const showSenderName = ref(true)
const keywordNotification = ref(false)
const newKeyword = ref('')
const keywords = ref<string[]>([])

const threadReplyNotify = ref(true)
const threadParticipateNotify = ref(true)
const threadMentionNotify = ref(true)

const spaceNewRoomNotify = ref(true)
const spaceMemberChangeNotify = ref(false)

const friendRequestNotify = ref(true)
const friendAcceptNotify = ref(true)

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

  const savedThreadReply = localStorage.getItem('hula-thread-reply-notify')
  if (savedThreadReply !== null) threadReplyNotify.value = savedThreadReply === 'true'
  const savedThreadParticipate = localStorage.getItem('hula-thread-participate-notify')
  if (savedThreadParticipate !== null) threadParticipateNotify.value = savedThreadParticipate === 'true'
  const savedThreadMention = localStorage.getItem('hula-thread-mention-notify')
  if (savedThreadMention !== null) threadMentionNotify.value = savedThreadMention === 'true'

  const savedSpaceNewRoom = localStorage.getItem('hula-space-new-room-notify')
  if (savedSpaceNewRoom !== null) spaceNewRoomNotify.value = savedSpaceNewRoom === 'true'
  const savedSpaceMember = localStorage.getItem('hula-space-member-change-notify')
  if (savedSpaceMember !== null) spaceMemberChangeNotify.value = savedSpaceMember === 'true'

  const savedFriendRequest = localStorage.getItem('hula-friend-request-notify')
  if (savedFriendRequest !== null) friendRequestNotify.value = savedFriendRequest === 'true'
  const savedFriendAccept = localStorage.getItem('hula-friend-accept-notify')
  if (savedFriendAccept !== null) friendAcceptNotify.value = savedFriendAccept === 'true'
})

async function handleNotificationChange(value: boolean) {
  if (value && 'Notification' in window) {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      showFeedback(t('setting.notification.feedback.permission_denied'), 'warning')
      desktopNotification.value = false
      return
    }
  }
  localStorage.setItem('hula-desktop-notification', value.toString())
  showFeedback(
    t('setting.notification.feedback.desktop', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function handleSoundChange(value: boolean) {
  settingStore.setMessageSoundEnabled(value)
  showFeedback(
    t('setting.notification.feedback.sound', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function handleVolumeChange(value: number) {
  settingStore.setNotificationVolume(value)
}

function handleContentChange(value: boolean) {
  localStorage.setItem('hula-show-content', value.toString())
  showFeedback(
    t('setting.notification.feedback.message_content', {
      state: t(value ? 'setting.notification.common.shown' : 'setting.notification.common.hidden')
    }),
    'success'
  )
}

function handleSenderChange(value: boolean) {
  localStorage.setItem('hula-show-sender', value.toString())
  showFeedback(
    t('setting.notification.feedback.sender_name', {
      state: t(value ? 'setting.notification.common.shown' : 'setting.notification.common.hidden')
    }),
    'success'
  )
}

function handleKeywordToggle(value: boolean) {
  localStorage.setItem('hula-keyword-notification', value.toString())
  showFeedback(
    t('setting.notification.feedback.keyword', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function addKeyword() {
  const keyword = newKeyword.value.trim()
  if (keyword && !keywords.value.includes(keyword)) {
    keywords.value.push(keyword)
    localStorage.setItem('hula-keywords', JSON.stringify(keywords.value))
    newKeyword.value = ''
    showFeedback(t('setting.notification.feedback.keyword_added', { keyword }), 'success')
  }
}

function removeKeyword(keyword: string) {
  keywords.value = keywords.value.filter((k) => k !== keyword)
  localStorage.setItem('hula-keywords', JSON.stringify(keywords.value))
  showFeedback(t('setting.notification.feedback.keyword_removed', { keyword }), 'success')
}

function handleThreadReplyNotify(value: boolean) {
  localStorage.setItem('hula-thread-reply-notify', value.toString())
  showFeedback(
    t('setting.notification.feedback.thread_reply', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function handleThreadParticipateNotify(value: boolean) {
  localStorage.setItem('hula-thread-participate-notify', value.toString())
  showFeedback(
    t('setting.notification.feedback.thread_participate', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function handleThreadMentionNotify(value: boolean) {
  localStorage.setItem('hula-thread-mention-notify', value.toString())
  showFeedback(
    t('setting.notification.feedback.thread_mention', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function handleSpaceNewRoomNotify(value: boolean) {
  localStorage.setItem('hula-space-new-room-notify', value.toString())
  showFeedback(
    t('setting.notification.feedback.space_new_room', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function handleSpaceMemberChangeNotify(value: boolean) {
  localStorage.setItem('hula-space-member-change-notify', value.toString())
  showFeedback(
    t('setting.notification.feedback.space_member_change', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function handleFriendRequestNotify(value: boolean) {
  localStorage.setItem('hula-friend-request-notify', value.toString())
  showFeedback(
    t('setting.notification.feedback.friend_request', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}

function handleFriendAcceptNotify(value: boolean) {
  localStorage.setItem('hula-friend-accept-notify', value.toString())
  showFeedback(
    t('setting.notification.feedback.friend_accept', {
      state: t(value ? 'setting.notification.common.enabled' : 'setting.notification.common.disabled')
    }),
    'success'
  )
}
</script>

<style scoped>
.notification-settings {
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

.volume-control {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
}

.volume-value {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-secondary);
  min-width: 36px;
}

.keywords-section {
  margin-top: var(--hula-space-3);
}

.keywords-control {
  display: flex;
  gap: var(--hula-space-2);
  margin-bottom: var(--hula-space-3);
}

.keywords-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--hula-space-2);
}

.section-desc {
  margin: calc(var(--hula-space-2) * -1) 0 var(--hula-space-4);
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
}
</style>
