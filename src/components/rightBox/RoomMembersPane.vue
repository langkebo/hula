<template>
  <div class="room-members-pane">
    <!-- 成员列表头部 -->
    <div class="room-members-pane__header" data-test="members-header">
      <span class="room-members-pane__title">{{ t('room.detail.members_title') }}</span>
      <span class="room-members-pane__count">{{ joinedMembers.length }}</span>
    </div>

    <!-- 邀请表单（仅管理员可见） -->
    <div v-if="canManage" class="room-members-pane__invite" data-test="invite-form">
      <input
        v-model="inviteUserId"
        class="room-members-pane__invite-input"
        type="text"
        :placeholder="t('room.detail.invite_placeholder')"
        data-test="invite-input"
        @keyup.enter="handleInvite" />
      <button class="room-members-pane__invite-btn" type="button" :disabled="inviteSubmitting" @click="handleInvite">
        {{ t('room.detail.invite_button') }}
      </button>
    </div>

    <!-- 空状态 -->
    <div v-if="allMembers.length === 0" class="room-members-pane__empty" data-test="empty-members">
      {{ t('room.detail.no_members') }}
    </div>

    <!-- 成员列表 -->
    <div v-else class="room-members-pane__list">
      <!-- 已加入成员 -->
      <div
        v-for="member in joinedMembers"
        :key="member.userId"
        class="room-members-pane__item"
        data-test="member-item"
        @click="emit('memberClick', member.userId)">
        <n-avatar :src="AvatarUtils.getAvatarUrl(member.avatar || member.avatarUrl || '')" :size="36" round />
        <div class="room-members-pane__item-info">
          <span class="room-members-pane__item-name">{{ member.name || member.displayName || member.userId }}</span>
          <span v-if="member.isCreator" class="room-members-pane__item-role">{{ t('room.detail.role_creator') }}</span>
          <span v-else-if="member.isModerator" class="room-members-pane__item-role">
            {{ t('room.detail.role_moderator') }}
          </span>
        </div>
        <!-- 管理操作（仅管理员，且不能操作创建者） -->
        <div v-if="canManage && !member.isCreator" class="room-members-pane__item-actions">
          <button
            class="room-members-pane__action-btn room-members-pane__action-btn--warning"
            type="button"
            data-test="kick-btn"
            :aria-label="t('room.detail.kick_member')"
            @click.stop="handleKick(member.userId)">
            <svg class="size-14px"><use href="#user-minus" /></svg>
          </button>
          <button
            class="room-members-pane__action-btn room-members-pane__action-btn--danger"
            type="button"
            data-test="ban-btn"
            :aria-label="t('room.detail.ban_member')"
            @click.stop="handleBan(member.userId)">
            <svg class="size-14px"><use href="#ban" /></svg>
          </button>
        </div>
      </div>

      <!-- 已封禁成员 -->
      <template v-if="bannedMembers.length > 0 && canManage">
        <div class="room-members-pane__section-divider">
          {{ t('room.detail.banned_members') }} ({{ bannedMembers.length }})
        </div>
        <div
          v-for="member in bannedMembers"
          :key="`banned-${member.userId}`"
          class="room-members-pane__item room-members-pane__item--banned"
          data-test="member-item">
          <n-avatar :src="AvatarUtils.getAvatarUrl(member.avatar || member.avatarUrl || '')" :size="36" round />
          <div class="room-members-pane__item-info">
            <span class="room-members-pane__item-name">{{ member.name || member.displayName || member.userId }}</span>
            <span class="room-members-pane__item-status">{{ t('room.detail.status_banned') }}</span>
          </div>
          <div v-if="canManage" class="room-members-pane__item-actions">
            <button
              class="room-members-pane__action-btn room-members-pane__action-btn--success"
              type="button"
              data-test="unban-btn"
              :aria-label="t('room.detail.unban_member')"
              @click.stop="handleUnban(member.userId)">
              <svg class="size-14px"><use href="#check" /></svg>
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup name="RoomMembersPane">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import type { MatrixRoomMember } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()

const props = defineProps<{
  roomId: string
  canManage: boolean
}>()

const emit = defineEmits<{
  memberClick: [userId: string]
}>()

// 邀请表单状态
const inviteUserId = ref('')
const inviteSubmitting = ref(false)

// 成员列表：从 groupStore.userList 获取
const allMembers = computed<MatrixRoomMember[]>(() => groupStore.userList)

// 已加入成员（membership === 'join'）
const joinedMembers = computed(() => allMembers.value.filter((m) => m.membership === 'join'))

// 已封禁成员（membership === 'ban'）
const bannedMembers = computed(() => allMembers.value.filter((m) => m.membership === 'ban'))

// 邀请成员
const handleInvite = async () => {
  const userId = inviteUserId.value.trim()
  if (!userId) {
    showFeedback(t('room.detail.invite_user_required'), 'warning')
    return
  }

  inviteSubmitting.value = true
  try {
    const success = await groupStore.inviteUser(props.roomId, userId)
    if (success) {
      showFeedback(t('room.detail.invite_success'), 'success')
      inviteUserId.value = '' // 成功后清空输入
    } else {
      showFeedback(t('room.detail.invite_failed'), 'error')
      // 失败时不清空输入，便于用户重试
    }
  } catch {
    showFeedback(t('room.detail.invite_failed'), 'error')
  } finally {
    inviteSubmitting.value = false
  }
}

// 踢出成员（带确认弹窗）
const handleKick = async (userId: string) => {
  if (!userId) return
  window.$dialog?.warning({
    title: t('room.detail.kick_member'),
    content: t('room.detail.kick_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const success = await groupStore.kickUser(props.roomId, userId)
        if (success) {
          showFeedback(t('room.detail.kick_success'), 'success')
        } else {
          showFeedback(t('room.detail.kick_failed'), 'error')
        }
      } catch {
        showFeedback(t('room.detail.kick_failed'), 'error')
      }
    }
  })
}

// 封禁成员（带确认弹窗）
const handleBan = async (userId: string) => {
  if (!userId) return
  window.$dialog?.warning({
    title: t('room.detail.ban_member'),
    content: t('room.detail.ban_confirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        const success = await groupStore.banUser(props.roomId, userId)
        if (success) {
          showFeedback(t('room.detail.ban_success'), 'success')
        } else {
          showFeedback(t('room.detail.ban_failed'), 'error')
        }
      } catch {
        showFeedback(t('room.detail.ban_failed'), 'error')
      }
    }
  })
}

// 解封成员（直接操作，无需确认）
const handleUnban = async (userId: string) => {
  if (!userId) return
  try {
    const success = await groupStore.unbanUser(props.roomId, userId)
    if (success) {
      showFeedback(t('room.detail.unban_success'), 'success')
    } else {
      showFeedback(t('room.detail.unban_failed'), 'error')
    }
  } catch {
    showFeedback(t('room.detail.unban_failed'), 'error')
  }
}
</script>

<style scoped lang="scss">
.room-members-pane {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.room-members-pane__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
}

.room-members-pane__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tjg-text-secondary);
}

.room-members-pane__count {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
  background: var(--tjg-surface-panel-muted);
  padding: 2px 8px;
  border-radius: 10px;
}

.room-members-pane__invite {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: var(--tjg-surface-panel-muted);
  border-radius: 8px;
}

.room-members-pane__invite-input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 6px;
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;

  &:focus-within {
    border-color: var(--tjg-color-primary-500);
  }
}

.room-members-pane__invite-btn {
  flex-shrink: 0;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: var(--tjg-color-primary-500);
  color: var(--tjg-text-inverse);
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover:not(:disabled) {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.room-members-pane__empty {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--tjg-text-tertiary);
}

.room-members-pane__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.room-members-pane__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.1s ease;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
}

.room-members-pane__item--banned {
  opacity: 0.6;
  cursor: default;

  &:hover {
    background: transparent;
  }
}

.room-members-pane__item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.room-members-pane__item-name {
  font-size: 13px;
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-members-pane__item-role {
  font-size: 11px;
  color: var(--tjg-color-primary-500);
}

.room-members-pane__item-status {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
}

.room-members-pane__item-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.room-members-pane__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;

  &--warning:hover {
    background: var(--tjg-color-warning-100, rgba(245, 158, 11, 0.1));
    color: var(--tjg-color-warning-500);
  }

  &--danger:hover {
    background: var(--tjg-color-danger-100, rgba(239, 68, 68, 0.1));
    color: var(--tjg-color-danger-500);
  }

  &--success:hover {
    background: var(--tjg-color-success-100, rgba(34, 197, 94, 0.1));
    color: var(--tjg-color-success-500);
  }
}

.room-members-pane__section-divider {
  padding: 8px 4px 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--tjg-text-tertiary);
  border-top: 1px solid var(--tjg-border-default);
  margin-top: 4px;
}
</style>
