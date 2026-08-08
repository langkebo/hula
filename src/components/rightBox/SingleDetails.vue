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

    <div v-if="!isBotUser" class="single-details__group-section management-section">
      <div class="management-header">
        <span class="management-label">{{ t('friend.detail.group_section') }}</span>
      </div>
      <n-select
        v-model:value="selectedGroupIds"
        multiple
        :options="groupOptions"
        :placeholder="t('friend.detail.group_placeholder')"
        :loading="loadingGroups"
        :disabled="loadingGroups"
        size="small"
        @update:value="handleGroupSelectionChange" />
      <p v-if="groupLoadError" class="single-details__section-error">{{ groupLoadError }}</p>
    </div>

    <div v-if="!isBotUser" class="single-details__device-section management-section">
      <div class="management-header">
        <span class="management-label">{{ t('friend.detail.devices_section') }}</span>
        <button
          v-if="!loadingDevices && devices.length > 0"
          type="button"
          class="single-details__refresh"
          :aria-label="t('friend.detail.devices_section')"
          @click="loadDevices">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 12a8 8 0 0 1 13.66-5.66L20 8M20 4v4h-4" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M20 12a8 8 0 0 1-13.66 5.66L4 16M4 20v-4h4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <p v-if="loadingDevices" class="single-details__section-hint">{{ t('friend.detail.devices_loading') }}</p>
      <p v-else-if="deviceError" class="single-details__section-error">{{ deviceError }}</p>
      <p v-else-if="devices.length === 0" class="single-details__section-hint">
        {{ t('friend.detail.devices_empty') }}
      </p>

      <ul v-else class="single-details__device-list">
        <li v-for="device in devices" :key="device.device_id" class="single-details__device-item">
          <div class="single-details__device-info">
            <span class="single-details__device-name">
              {{ device.display_name || t('friend.detail.device_unknown') }}
            </span>
            <span class="single-details__device-meta">
              {{ t('friend.detail.device_last_seen') }}：{{ formatDeviceLastSeen(device.last_seen_ts) }}
            </span>
          </div>
          <span
            class="single-details__device-verified"
            :class="device.verified ? 'single-details__device-verified--ok' : 'single-details__device-verified--warn'">
            {{ device.verified ? t('friend.detail.device_verified') : t('friend.detail.device_unverified') }}
          </span>
        </li>
      </ul>
    </div>

    <div v-if="!isBotUser" class="single-details__federation-section management-section">
      <div class="management-header">
        <span class="management-label">{{ t('friend.detail.federation_section') }}</span>
      </div>
      <div class="single-details__federation-row">
        <span class="single-details__federation-label">{{ t('friend.detail.server_address') }}</span>
        <span class="single-details__federation-value">{{ serverName || '-' }}</span>
      </div>
      <div class="single-details__federation-row">
        <span class="single-details__federation-label">{{ t('friend.detail.federated_user') }}</span>
        <span
          class="single-details__federation-badge"
          :class="isFederatedUser ? 'single-details__federation-badge--warn' : 'single-details__federation-badge--ok'">
          {{ isFederatedUser ? t('friend.detail.federated_user') : t('friend.detail.local_user') }}
        </span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import InlineEdit from '@/components/atomic/InlineEdit.vue'
import { useDetailsActions } from '@/composables/chat/useDetailsActions'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { OnlineEnum, RoomTypeEnum, UserType } from '@/enums'
import type { FriendGroup } from '@/services/matrix/friends/MatrixFriendService'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import matrixClientService from '@/services/matrix/MatrixClientService'
import type { Device } from '@/services/matrix/user/MatrixDeviceService'
import { matrixDeviceService } from '@/services/matrix/user/MatrixDeviceService'
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

// ==================== 分组分配区 ====================

const availableGroups = ref<FriendGroup[]>([])
const selectedGroupIds = ref<string[]>([])
const currentGroupIds = ref<string[]>([])
const loadingGroups = ref(false)
const groupLoadError = ref('')

const groupOptions = computed(() => availableGroups.value.map((g) => ({ label: g.name, value: g.group_id })))

const loadGroups = async () => {
  if (!singleUid.value) return
  loadingGroups.value = true
  groupLoadError.value = ''
  try {
    const [all, assigned] = await Promise.all([
      matrixFriendService.getFriendGroups(),
      matrixFriendService.getFriendGroupsByUser(singleUid.value)
    ])
    availableGroups.value = all
    const assignedIds = assigned.map((g) => g.group_id)
    currentGroupIds.value = assignedIds
    selectedGroupIds.value = [...assignedIds]
  } catch (err) {
    logger.error('加载好友分组失败', err)
    groupLoadError.value = t('friend.detail.group_load_error')
  } finally {
    loadingGroups.value = false
  }
}

const handleGroupSelectionChange = async (next: string[]) => {
  if (!singleUid.value) return
  const prev = currentGroupIds.value
  const toAdd = next.filter((id) => !prev.includes(id))
  const toRemove = prev.filter((id) => !next.includes(id))
  // 乐观更新当前引用，避免 NSelect 抖动
  currentGroupIds.value = [...next]

  for (const groupId of toAdd) {
    try {
      await matrixFriendService.addFriendToGroup(groupId, singleUid.value)
      showFeedback(t('friend.detail.group_assign_success'), 'success', 'polite')
    } catch (err) {
      logger.error('分配分组失败', err)
      showFeedback(t('friend.detail.group_assign_error'), 'error', 'assertive')
    }
  }
  for (const groupId of toRemove) {
    try {
      await matrixFriendService.removeFriendFromGroup(groupId, singleUid.value)
      showFeedback(t('friend.detail.group_remove_success'), 'success', 'polite')
    } catch (err) {
      logger.error('移出分组失败', err)
      showFeedback(t('friend.detail.group_remove_error'), 'error', 'assertive')
    }
  }
}

// ==================== 设备列表区 ====================

const devices = ref<Device[]>([])
const loadingDevices = ref(false)
const deviceError = ref('')

const formatDeviceLastSeen = (ts?: number): string => {
  if (!ts || ts <= 0) return '-'
  return formatDate(ts)
}

const loadDevices = async () => {
  if (!singleUid.value) return
  loadingDevices.value = true
  deviceError.value = ''
  devices.value = []
  try {
    devices.value = await matrixDeviceService.getUserDevices(singleUid.value)
  } catch (err) {
    logger.error('加载设备列表失败', err)
    deviceError.value = t('friend.detail.devices_load_error')
  } finally {
    loadingDevices.value = false
  }
}

// ==================== 联邦/服务器信息区 ====================

/**
 * 从 Matrix user ID `@localpart:server.name` 中解析出 server name。
 * 输入不符合 MXID 规范时返回空字符串。
 */
const parseServerName = (userId: string): string => {
  const colonIdx = userId.indexOf(':')
  if (colonIdx <= 0 || colonIdx === userId.length - 1) return ''
  return userId.slice(colonIdx + 1)
}

const localDomain = computed<string>(() => {
  try {
    const client = matrixClientService.getClient()
    return client?.getDomain?.() ?? ''
  } catch {
    return ''
  }
})

const serverName = computed(() => parseServerName(singleUid.value))
const isFederatedUser = computed(() => {
  const server = serverName.value
  if (!server || !localDomain.value) return false
  return server !== localDomain.value
})

// ==================== 联动加载 ====================

watch(
  singleUid,
  (uid) => {
    if (!uid || isBotUser.value) return
    void loadGroups()
    void loadDevices()
  },
  { immediate: true }
)

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

// ==================== 新增字段区：分组 / 设备 / 联邦 ====================

.single-details__refresh {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--tjg-text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  transition: color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    color: var(--tjg-text-secondary);
  }

  svg {
    width: 14px;
    height: 14px;
  }
}

.single-details__section-hint,
.single-details__section-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
}

.single-details__section-hint {
  color: var(--tjg-text-tertiary);
}

.single-details__section-error {
  color: var(--tjg-color-danger-500);
}

.single-details__device-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.single-details__device-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  background: var(--tjg-surface-input);
  border-radius: 6px;
}

.single-details__device-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.single-details__device-name {
  font-size: 13px;
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.single-details__device-meta {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
}

.single-details__device-verified {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: var(--tjg-radius-full);
  border: 1px solid transparent;
}

.single-details__device-verified--ok {
  color: var(--tjg-color-success-600);
  background: var(--tjg-color-success-100);
  border-color: var(--tjg-color-success-100);
}

.single-details__device-verified--warn {
  color: var(--tjg-color-warning-600);
  background: var(--tjg-color-warning-100);
  border-color: var(--tjg-color-warning-100);
}

.single-details__federation-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: var(--tjg-radius-full);
  border: 1px solid transparent;
}

.single-details__federation-badge--ok {
  color: var(--tjg-color-success-600);
  background: var(--tjg-color-success-100);
  border-color: var(--tjg-color-success-100);
}

.single-details__federation-badge--warn {
  color: var(--tjg-color-warning-600);
  background: var(--tjg-color-warning-100);
  border-color: var(--tjg-color-warning-100);
}

.single-details__federation-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
}

.single-details__federation-label {
  color: var(--tjg-text-secondary);
}

.single-details__federation-value {
  color: var(--tjg-text-primary);
  word-break: break-all;
  text-align: right;
}
</style>
