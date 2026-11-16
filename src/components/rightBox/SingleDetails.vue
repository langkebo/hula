<template>
  <section class="single-details">
    <div class="single-details__hero">
      <n-avatar
        round
        :size="148"
        class="single-details__avatar"
        :src="AvatarUtils.getAvatarUrl(singleAvatar)"
        @dblclick="openAvatarImage" />
      <div class="single-details__name-row">
        <h2 class="single-details__name">{{ singleName }}</h2>
        <AccountStatusBadge v-if="!isBotUser" :user-id="singleUid" />
      </div>
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
        <span>{{ t('common.account_with_value', { account: singleAccount }) }}</span>
      </div>
    </div>

    <SingleDetailsActions
      v-if="!isBotUser"
      @send-message="handleSendMessage"
      @encrypted-chat="handleEncryptedChat"
      @voice-call="handleVoiceCall"
      @video-call="handleVideoCall" />

    <div v-if="!isBotUser" class="single-details__management">
      <ContactProfileEditors v-if="singleUid" :user-id="singleUid" :contact-info="contactInfo" />

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

      <RoomBurnSettings v-if="directRoomId" :room-id="directRoomId" />

      <div class="management-section management-section--danger">
        <n-button size="small" type="error" block @click="handleRemoveFriend">
          {{ t('friend.detail.remove_friend') }}
        </n-button>
      </div>
    </div>

    <FriendDetailsSections v-if="!isBotUser" :user-id="singleUid" @open-room="handleOpenRoom" />
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ContactProfileEditors from '@/components/friend/ContactProfileEditors.vue'
import AccountStatusBadge from '@/components/rightBox/AccountStatusBadge.vue'
import FriendDetailsSections from '@/components/rightBox/FriendDetailsSections.vue'
import SingleDetailsActions from '@/components/rightBox/SingleDetailsActions.vue'
import RoomBurnSettings from '@/components/room/RoomBurnSettings.vue'
import { useDetailsActions } from '@/composables/chat/useDetailsActions'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useImageViewer } from '@/composables/common/useImageViewer'
import { MsgEnum, OnlineEnum, RoomTypeEnum, UserType } from '@/enums'
import { contactAliasVersion, hasContactAlias } from '@/services/matrix/aliases/contactAliasRegistry'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { getContactDisplayName } from '@/stores/domains/chat/contacts/contactDisplay'
import { AvatarUtils } from '@/utils/AvatarUtils'

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

const { handleSendMessage, handleVoiceCall, handleVideoCall } = useDetailsActions(props.content)

const contactInfo = computed<Partial<MatrixContact>>(() => {
  if (props.content.type !== RoomTypeEnum.SINGLE || !props.content.uid) {
    return {}
  }
  return contactStore.getContactByUserId(props.content.uid) ?? {}
})

const singleName = computed(() => getContactDisplayName(contactInfo.value) || t('common.unknownUser'))
const singleUid = computed(() => contactInfo.value.userId || props.content.uid || '')

// 阅后即焚设置作用于 DM 房间；好友尚未建立 DM（directRoomId 为空）时不显示设置区
const directRoomId = computed(() => contactInfo.value.directRoomId || '')
const singleAccount = computed(
  () => contactInfo.value.account || singleUid.value.replace(/^@/, '').split(':')[0] || t('common.unknown')
)
const singleAvatar = computed(() => contactInfo.value.avatarUrl || '')
const singleSignature = computed(() => contactInfo.value.statusMessage || t('home.chat_details.single.empty_signature'))

const isBotUser = computed(() => {
  if (props.content.type !== RoomTypeEnum.SINGLE || !contactInfo.value.userId) return false
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
  // F-6：设了别名后不再展示对方在线状态。⚠️ 这只是**本机不显示**（presence 是账号级广播），
  // 文案不得写成"对方看不到你在线"。
  void contactAliasVersion.value
  const uid = singleUid.value
  if (uid && hasContactAlias(uid)) return ''
  if (contactInfo.value.activeStatus === OnlineEnum.ONLINE) return t('friend.list.online')
  if (contactInfo.value.lastOptTime && contactInfo.value.lastOptTime > 0) {
    return formatDate(contactInfo.value.lastOptTime)
  }
  return ''
})

const { openImageViewer } = useImageViewer()

// E-02：双击头像查看大图此前只打日志（空实现），这里接到既有图片查看器
const openAvatarImage = () => {
  const url = AvatarUtils.getAvatarUrl(singleAvatar.value)
  if (!url) return
  void openImageViewer(url, [MsgEnum.IMAGE], [url])
}

const handleEncryptedChat = async () => {
  if (!singleUid.value) return
  try {
    const roomId = await contactStore.startDirectRoom(singleUid.value, true)
    if (roomId) {
      const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
      await openMsgSessionByRoomId(roomId)
    } else {
      showFeedback(t('friend.detail.chat_error'), 'error', 'assertive')
    }
  } catch {
    showFeedback(t('friend.detail.chat_error'), 'error', 'assertive')
  }
}

const handleOpenRoom = async (roomId: string) => {
  if (!roomId) return
  try {
    const { openMsgSessionByRoomId } = await import('@/composables/chat/openMsgSession')
    await openMsgSessionByRoomId(roomId)
  } catch {
    showFeedback(t('friend.detail.chat_error'), 'error', 'assertive')
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
  background: var(--tjg-glass-tint);
  border: var(--tjg-glass-border-soft);
  border-radius: var(--tjg-radius-surface);
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

.single-details__name-row {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
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

.single-details__alias-hint {
  margin: -4px 0 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--tjg-text-tertiary);
}

.single-details__alias-clear {
  margin-bottom: 8px;
  padding: 0;
  border: none;
  background: none;
  font-size: 12px;
  color: var(--tjg-color-danger-500);
  cursor: pointer;
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
