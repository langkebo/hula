<template>
  <section class="single-details">
    <div class="single-details__hero">
      <n-avatar
        round
        :size="148"
        class="single-details__avatar"
        :src="AvatarUtils.getAvatarUrl(singleAvatar)"
        @dblclick="openImageViewer" />
      <h2 class="single-details__name">{{ singleName }}</h2>
      <p class="single-details__uid">{{ singleUid }}</p>
      <p class="single-details__signature">{{ singleSignature }}</p>

      <div v-if="friendStatusLabel" class="single-details__status">
        <n-tag :type="friendStatusTagType" size="small" round>{{ friendStatusLabel }}</n-tag>
      </div>

      <div v-if="lastSeenText" class="single-details__last-seen">
        <span class="single-details__last-seen-label">{{ t('friend.detail.last_seen') }}</span>
        <span class="single-details__last-seen-value">{{ lastSeenText }}</span>
      </div>

      <div class="single-details__meta">
        <span>{{ t('home.chat_details.single.region', { place: t('home.chat_details.single.unknown') }) }}</span>
        <span>账号：{{ singleAccount }}</span>
      </div>
    </div>

    <div v-if="!isBotUser" class="single-details__actions">
      <button class="single-details__action" type="button" @click="handleSendMessage">
        <span class="single-details__action-icon">
          <svg><use href="#message" /></svg>
        </span>
        <span class="single-details__action-label">{{ t('home.chat_details.actions.message') }}</span>
      </button>

      <button class="single-details__action" type="button" @click="handleEncryptedChat">
        <span class="single-details__action-icon single-details__action-icon--encrypted">
          <svg><use href="#lock" /></svg>
        </span>
        <span class="single-details__action-label">{{ t('friend.detail.encrypted_chat') }}</span>
      </button>

      <button class="single-details__action" type="button" @click="handleVoiceCall">
        <span class="single-details__action-icon">
          <svg><use href="#phone" /></svg>
        </span>
        <span class="single-details__action-label">{{ t('home.chat_details.single.footer.audio_call') }}</span>
      </button>

      <button class="single-details__action" type="button" @click="handleVideoCall">
        <span class="single-details__action-icon">
          <svg><use href="#video" /></svg>
        </span>
        <span class="single-details__action-label">{{ t('home.chat_details.single.footer.video_call') }}</span>
      </button>

      <button v-if="!isMobile" class="single-details__action" type="button" @click="handleOpenInNewWindow">
        <span class="single-details__action-icon">
          <svg><use href="#expand" /></svg>
        </span>
        <span class="single-details__action-label">{{ t('chat.header.open_in_new_window', '在新窗口打开') }}</span>
      </button>
    </div>

    <div v-if="!isBotUser" class="single-details__management">
      <InlineEdit
        class="management-section"
        :label="t('friend.detail.note')"
        :value="contactInfo.note || contactInfo.remark || ''"
        :placeholder="t('friend.detail.note_placeholder')"
        :loading="savingNote"
        :edit-aria-label="t('friend.detail.note_section')"
        :maxlength="200"
        @submit="handleSaveNote" />

      <InlineEdit
        class="management-section"
        :label="t('friend.detail.display_name')"
        :value="contactInfo.remark || contactInfo.displayName || ''"
        :placeholder="t('friend.detail.display_name_placeholder')"
        :loading="savingDisplayName"
        :edit-aria-label="t('friend.detail.edit_display_name')"
        :maxlength="100"
        @submit="handleSaveDisplayName" />

      <div class="management-section">
        <div class="management-header">
          <span class="management-label">{{ t('friend.detail.status_section') }}</span>
        </div>
        <div class="management-actions">
          <n-button
            size="small"
            :type="contactInfo.friendStatus === 'favorite' ? 'warning' : 'default'"
            @click="handleSetFavorite">
            {{ t('friend.context.set_favorite') }}
          </n-button>
          <n-button
            size="small"
            :type="!contactInfo.friendStatus || contactInfo.friendStatus === 'normal' ? 'info' : 'default'"
            @click="handleSetNormal">
            {{ t('friend.context.set_normal') }}
          </n-button>
          <n-button
            size="small"
            :type="contactInfo.friendStatus === 'blocked' ? 'error' : 'default'"
            @click="handleSetBlocked">
            {{ t('friend.context.set_blocked') }}
          </n-button>
        </div>
      </div>

      <div class="management-section management-section--danger">
        <n-button size="small" type="error" block @click="handleRemoveFriend">
          {{ t('friend.detail.remove_friend') }}
        </n-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import InlineEdit from '@/components/atomic/InlineEdit.vue'
import { useDetailsActions } from '@/composables/chat/useDetailsActions'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { OnlineEnum, RoomTypeEnum, UserType } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SingleDetails')
const { t } = useI18n()
const router = useRouter()
const { showFeedback } = useActionFeedback()
const contactStore = useContactStore()

const props = defineProps({
  content: {
    type: Object as PropType<{ type: RoomTypeEnum; uid: string }>,
    required: false,
    default: () => ({ type: RoomTypeEnum.SINGLE, uid: '' })
  }
})

const { isMobile, handleSendMessage, handleVoiceCall, handleVideoCall, handleOpenInNewWindow } = useDetailsActions(
  props.content
)

const savingNote = ref(false)
const savingDisplayName = ref(false)

const contactInfo = computed<Partial<MatrixContact>>(() => {
  if (props.content.type !== RoomTypeEnum.SINGLE || !props.content.uid) {
    return {}
  }
  return contactStore.getContactByUserId(props.content.uid) ?? {}
})

const singleName = computed(() => contactInfo.value.name || contactInfo.value.displayName || '未知用户')
const singleUid = computed(() => contactInfo.value.uid || props.content.uid || '')
const singleAccount = computed(
  () => contactInfo.value.account || singleUid.value.replace(/^@/, '').split(':')[0] || '未知'
)
const singleAvatar = computed(() => contactInfo.value.avatar || contactInfo.value.avatarUrl || '')
const singleSignature = computed(() => contactInfo.value.statusMessage || t('home.chat_details.single.empty_signature'))

const isBotUser = computed(() => {
  if (props.content.type !== RoomTypeEnum.SINGLE || !contactInfo.value.uid) return false
  return contactInfo.value.account === UserType.BOT
})

const friendStatusTagType = computed(() => {
  const status = contactInfo.value.friendStatus
  if (status === 'favorite') return 'warning'
  if (status === 'blocked') return 'error'
  return 'info'
})

const friendStatusLabel = computed(() => {
  const status = contactInfo.value.friendStatus
  if (status === 'favorite') return t('friend.status.favorite')
  if (status === 'blocked') return t('friend.status.blocked')
  if ((status as string) === 'hidden') return t('friend.status.hidden')
  return t('friend.status.normal')
})

const formatDate = (ts: number): string => {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('friend.detail.just_now')
  if (diffMins < 60) return t('friend.detail.minutes_ago', { count: diffMins })
  if (diffHours < 24) return t('friend.detail.hours_ago', { count: diffHours })
  if (diffDays < 7) return t('friend.detail.days_ago', { count: diffDays })
  return date.toLocaleDateString()
}

const lastSeenText = computed(() => {
  if (!contactInfo.value) return ''
  if (contactInfo.value.activeStatus === OnlineEnum.ONLINE) return t('friend.list.online')
  if (contactInfo.value.lastOptTime && contactInfo.value.lastOptTime > 0) {
    return formatDate(contactInfo.value.lastOptTime)
  }
  return ''
})

const openImageViewer = () => {
  logger.debug('打开图片查看器')
}

const handleEncryptedChat = async () => {
  if (!singleUid.value) return
  try {
    const roomId = await contactStore.startDirectRoom(singleUid.value, true)
    if (roomId) {
      const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
      await openMsgSessionByRoomId(roomId)
    }
  } catch {
    showFeedback(t('friend.detail.chat_error'), 'error', 'assertive')
  }
}

const handleSaveNote = async (newValue: string) => {
  if (!singleUid.value || !newValue) return
  savingNote.value = true
  try {
    const success = await contactStore.setFriendNote(singleUid.value, newValue)
    if (success) {
      showFeedback(t('friend.detail.note_saved'), 'success', 'polite')
    }
  } catch {
    showFeedback(t('friend.detail.note_error'), 'error', 'assertive')
  } finally {
    savingNote.value = false
  }
}

const handleSaveDisplayName = async (newValue: string) => {
  if (!singleUid.value || !newValue) return
  savingDisplayName.value = true
  try {
    const success = await contactStore.setFriendDisplayName(singleUid.value, newValue)
    if (success) {
      showFeedback(t('friend.detail.display_name_saved'), 'success', 'polite')
    }
  } catch {
    showFeedback(t('friend.detail.display_name_error'), 'error', 'assertive')
  } finally {
    savingDisplayName.value = false
  }
}

const handleSetFavorite = async () => {
  if (!singleUid.value) return
  await contactStore.setFriendStatus(singleUid.value, 'favorite')
}

const handleSetNormal = async () => {
  if (!singleUid.value) return
  await contactStore.setFriendStatus(singleUid.value, 'normal')
}

const handleSetBlocked = async () => {
  if (!singleUid.value) return
  await contactStore.setFriendStatus(singleUid.value, 'blocked')
}

const handleRemoveFriend = async () => {
  if (!singleUid.value) return
  window.$dialog?.warning({
    title: t('friend.detail.remove_confirm.title'),
    content: t('friend.detail.remove_confirm.content'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const success = await contactStore.removeFromContacts(singleUid.value)
      if (success) {
        showFeedback(t('friend.detail.remove_success'), 'success', 'polite')
        if (window.history.length > 1) {
          void router.back()
        } else {
          void router.push('/friend')
        }
      } else {
        showFeedback(t('friend.detail.remove_error'), 'error', 'assertive')
      }
    }
  })
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

.single-details {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 8px 0;
  overflow-y: auto;
}

.single-details__hero {
  @include liquid-glass(20px, 0.85, 1.8);
  border-radius: 16px;
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.single-details__avatar {
  border: 3px solid var(--tjg-overlay-mobile-sheet);
  box-shadow: var(--tjg-shadow-lg);
}

.single-details__name {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  color: var(--tjg-text-primary);
  font-weight: 600;
}

.single-details__uid {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--tjg-text-tertiary);
}

.single-details__signature {
  margin: 0;
  max-width: 360px;
  font-size: 14px;
  line-height: 22px;
  color: var(--tjg-text-secondary);
}

.single-details__meta {
  display: flex;
  align-items: center;
  gap: 22px;
  font-size: 14px;
  line-height: 20px;
  color: var(--tjg-text-secondary);
}

.single-details__status {
  margin-top: 4px;
}

.single-details__last-seen {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--tjg-text-tertiary);
}

.single-details__last-seen-label {
  color: var(--tjg-text-tertiary);
}

.single-details__last-seen-value {
  color: var(--tjg-text-secondary);
}

.single-details__actions {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: 34px;
}

.single-details__action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--tjg-text-secondary);
}

.single-details__action:hover .single-details__action-icon {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px color-mix(in srgb, var(--tjg-color-primary-500) 22%, transparent);
}

.single-details__action-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;

  svg {
    width: 20px;
    height: 20px;
  }
}

.single-details__action-label {
  font-size: 12px;
  line-height: 16px;
  color: var(--tjg-text-secondary);
}

.single-details__action-icon--encrypted {
  background: var(--tjg-color-success-500);
}

.single-details__management {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 8px;
  box-sizing: border-box;
}

.management-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.management-section--danger {
  background: transparent;
  padding: 4px 0;
}

.management-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.management-label {
  font-size: 13px;
  color: var(--tjg-text-secondary);
  font-weight: 500;
}

.management-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
