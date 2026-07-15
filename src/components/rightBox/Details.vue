<template>
  <div class="details-panel">
    <section v-if="content.type === RoomTypeEnum.SINGLE" class="single-details">
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
      </div>
    </section>

    <n-flex v-else-if="content.type === RoomTypeEnum.GROUP" vertical align="center" :size="20" class="group-details">
      <n-image
        object-fit="cover"
        show-toolbar-tooltip
        preview-disabled
        width="120"
        height="120"
        style="border: 2px solid var(--hula-text-inverse)"
        class="rounded-12px select-none cursor-pointer"
        :src="AvatarUtils.getAvatarUrl(item.avatar)"
        @dblclick="openImageViewer"
        alt="群头像" />

      <span class="text-(18px [--hula-text-primary])">{{ item.name }}</span>

      <div v-if="announcementContent" class="announcement-container">
        <div class="announcement-header">
          <span class="text-14px">{{ t('home.chat_details.group.announcement.label') }}</span>
          <n-button text type="primary" size="small" @click="handleOpenAnnouncement">
            {{ t('home.chat_details.group.announcement.window_title') }}
          </n-button>
        </div>
        <div class="announcement-content">{{ announcementContent }}</div>
      </div>

      <div class="member-section">
        <div class="member-header">
          <span>{{ t('home.chat_details.group.members.count', { count: memberCount }) }}</span>
        </div>
        <n-grid :cols="4" :x-gap="12" :y-gap="12">
          <n-gi v-for="member in displayMembers" :key="member.uid">
            <div class="member-item" @click="handleMemberClick(member)">
              <n-avatar :src="AvatarUtils.getAvatarUrl(member.avatar)" :size="40" />
              <span class="member-name">{{ member.name }}</span>
            </div>
          </n-gi>
        </n-grid>
      </div>
    </n-flex>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { openMsgSession } from '@/composables/chat/openMsgSession'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useWindow } from '@/composables/common/useWindow'
import { CallTypeEnum, MittEnum, RoomTypeEnum, UserType } from '@/enums'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useContactStore } from '@/stores/domains/chat/contacts'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('Details')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()
const contactStore = useContactStore()
const { createWebviewWindow, startRtcCall } = useWindow()

const props = defineProps({
  content: {
    type: Object as PropType<{ type: RoomTypeEnum; uid: string }>,
    required: false,
    default: () => ({ type: RoomTypeEnum.SINGLE, uid: '' })
  }
})

const item = ref<
  Partial<MatrixGroupInfo> & {
    myName?: string
    account?: string
    uid?: string
    [key: string]: unknown
  }
>({})
const announcementContent = ref('')

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

watch(
  () => [props.content.type, props.content.uid] as const,
  async ([type, uid]) => {
    if (!uid) {
      item.value = {}
      announcementContent.value = ''
      return
    }

    if (type !== RoomTypeEnum.GROUP) {
      item.value = {}
      announcementContent.value = ''
      return
    }

    try {
      const response = await groupStore.loadGroupInfo(uid)
      item.value = (response as typeof item.value) || {}
      await fetchAnnouncement(uid)
    } catch (error) {
      logger.error('获取群组详情失败:', error)
      item.value = {}
      announcementContent.value = ''
    }
  },
  { immediate: true }
)

const fetchAnnouncement = async (_roomId: string) => {
  announcementContent.value = ''
}

const handleOpenAnnouncement = () => {
  if (!item.value?.roomId) return
  useMitt.emit(MittEnum.OPEN_ANNOUNCEMENT_PANEL, { roomId: item.value.roomId })
}

const memberCount = computed(() => groupStore.userList.length || 0)
const displayMembers = computed(() => groupStore.userList.slice(0, 8))

const ensureDirectSessionReady = async () => {
  if (!singleUid.value) {
    showFeedback(t('home.chat_details.single.friend_info_missing'), 'warning')
    return false
  }

  await openMsgSession(singleUid.value, RoomTypeEnum.SINGLE)
  await nextTick()
  return true
}

const handleSendMessage = async () => {
  await ensureDirectSessionReady()
}

const handleVoiceCall = async () => {
  if (!(await ensureDirectSessionReady())) return
  await startRtcCall(CallTypeEnum.AUDIO)
}

const handleVideoCall = async () => {
  if (!(await ensureDirectSessionReady())) return
  await startRtcCall(CallTypeEnum.VIDEO)
}

const handleMemberClick = (member: { uid?: string; userId?: string }) => {
  logger.debug('点击成员:', member.uid ?? member.userId)
}

const openImageViewer = () => {
  logger.debug('打开图片查看器')
}
</script>

<style scoped lang="scss">
.details-panel {
  height: 100%;
  padding: 24px 20px;
  box-sizing: border-box;
}

.single-details {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
}

.single-details__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.single-details__avatar {
  border: 3px solid var(--hula-overlay-mobile-sheet);
  box-shadow: var(--hula-shadow-lg);
}

.single-details__name {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  color: var(--hula-text-primary);
  font-weight: 600;
}

.single-details__uid {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--hula-text-tertiary);
}

.single-details__signature {
  margin: 0;
  max-width: 360px;
  font-size: 14px;
  line-height: 22px;
  color: var(--hula-text-secondary);
}

.single-details__meta {
  display: flex;
  align-items: center;
  gap: 22px;
  font-size: 14px;
  line-height: 20px;
  color: var(--hula-text-secondary);
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
  color: var(--hula-text-secondary);
}

.single-details__action:hover .single-details__action-icon {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(29, 163, 134, 0.22);
}

.single-details__action-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--hula-color-primary-500);
  color: var(--hula-text-inverse);
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
  color: var(--hula-text-secondary);
}

.group-details {
  margin-top: 30px;
}

.announcement-container {
  width: 100%;
  padding: 12px;
  background: var(--hula-surface-panel-muted);
  border-radius: 8px;
}

.announcement-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.announcement-content {
  font-size: 13px;
  color: var(--hula-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.member-section {
  width: 100%;
}

.member-header {
  margin-bottom: 12px;
  font-size: 14px;
  color: var(--hula-text-secondary);
}

.member-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--hula-surface-panel-muted);
  }
}

.member-name {
  margin-top: 4px;
  font-size: 12px;
  color: var(--hula-text-primary);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
