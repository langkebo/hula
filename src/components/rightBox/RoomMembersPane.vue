<template>
  <div class="room-members-pane">
    <!-- 成员列表头部 -->
    <div class="room-members-pane__header" data-test="members-header">
      <span class="room-members-pane__title">{{ t('room.detail.members_title') }}</span>
      <span class="room-members-pane__count">{{ joinedMembers.length }}</span>
    </div>

    <!-- 邀请表单（仅管理员可见） -->
    <RoomInviteForm v-if="canManage" :room-id="roomId" />

    <!-- 首载中：不再先闪一帧「暂无成员」 -->
    <div
      v-if="membersLoading && allMembers.length === 0"
      class="room-members-pane__loading"
      data-test="members-loading">
      {{ t('common.loading') }}
    </div>

    <!-- 空状态（统一走 EmptyState，与侧栏/管理端空态一致） -->
    <EmptyState
      v-else-if="allMembers.length === 0"
      data-test="empty-members"
      compact
      icon="mdi:account-multiple-outline"
      :description="t('room.detail.no_members')" />

    <!-- 成员列表 -->
    <div v-else class="room-members-pane__list" @scroll="handleMemberScroll">
      <!-- 已加入成员（窗口化渲染：大群首屏只挂载前 LIST_WINDOW_SIZE 行，滚到底再追加） -->
      <div
        v-for="member in visibleJoinedMembers"
        :key="member.userId"
        class="room-members-pane__item"
        data-test="member-item"
        @click="emit('memberClick', member.userId)">
        <n-avatar :src="AvatarUtils.getAvatarUrl(member.avatar || member.avatarUrl || '', 72)" :size="36" round />
        <!-- 联邦身份组合单元：显示名 + 联邦 chip + MXID（解析统一走 @/utils/userIdentity） -->
        <UserIdentity
          class="room-members-pane__identity"
          data-test="member-identity"
          :display-name="member.name || member.displayName || ''"
          :mxid="member.userId"
          :local-server="localDomain"
          :show-avatar="false"
          :mxid-max-length="30" />
        <div class="room-members-pane__item-roles">
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
            <svg class="size-14px" aria-hidden="true"><use href="#user-minus" /></svg>
          </button>
          <button
            class="room-members-pane__action-btn room-members-pane__action-btn--danger"
            type="button"
            data-test="ban-btn"
            :aria-label="t('room.detail.ban_member')"
            @click.stop="handleBan(member.userId)">
            <svg class="size-14px" aria-hidden="true"><use href="#ban" /></svg>
          </button>
        </div>
      </div>

      <!-- 已封禁成员 -->
      <template v-if="bannedMembers.length > 0 && canManage">
        <div class="room-members-pane__section-divider">
          {{ t('room.detail.banned_members') }} ({{ bannedMembers.length }})
        </div>
        <div
          v-for="member in visibleBannedMembers"
          :key="`banned-${member.userId}`"
          class="room-members-pane__item room-members-pane__item--banned"
          data-test="member-item">
          <n-avatar :src="AvatarUtils.getAvatarUrl(member.avatar || member.avatarUrl || '', 72)" :size="36" round />
          <UserIdentity
            class="room-members-pane__identity"
            data-test="banned-member-identity"
            :display-name="member.name || member.displayName || ''"
            :mxid="member.userId"
            :local-server="localDomain"
            :show-avatar="false"
            :mxid-max-length="30" />
          <div class="room-members-pane__item-roles">
            <span class="room-members-pane__item-status">{{ t('room.detail.status_banned') }}</span>
          </div>
          <div v-if="canManage" class="room-members-pane__item-actions">
            <button
              class="room-members-pane__action-btn room-members-pane__action-btn--success"
              type="button"
              data-test="unban-btn"
              :aria-label="t('room.detail.unban_member')"
              @click.stop="handleUnban(member.userId)">
              <svg class="size-14px" aria-hidden="true"><use href="#check" /></svg>
            </button>
          </div>
        </div>
        <!-- 封禁成员分页：与已加入成员的滚动窗口分开，避免两种数据源共用滚动比例 -->
        <button
          v-if="hasMoreBanned"
          class="room-members-pane__load-more"
          type="button"
          data-test="banned-load-more"
          @click="bannedVisibleCount += BANNED_PAGE_SIZE">
          {{ t('room.detail.load_more') }} ({{ bannedMembers.length - bannedVisibleCount }})
        </button>
      </template>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import UserIdentity from '@/components/common/UserIdentity.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import matrixClientService from '@/services/matrix/MatrixClientService'
import type { MatrixRoomMember } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import RoomInviteForm from './RoomInviteForm.vue'
import { useMemberListWindow } from './useMemberListWindow'

defineOptions({ name: 'RoomMembersPane' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()

/**
 * 本机 homeserver 域名 —— 联邦判定的对照基准。
 * 统一经 `matrixClientService.getServerDomain()` 获取；未初始化时为空串，
 * `UserIdentity` 会按「本地」处理（不会把所有人误标为联邦用户）。
 */
const localDomain = computed<string>(() => matrixClientService.getServerDomain())

const props = defineProps<{
  roomId: string
  canManage: boolean
}>()

const emit = defineEmits<{
  memberClick: [userId: string]
}>()

// 成员列表：从 groupStore.userList 获取
const allMembers = computed<MatrixRoomMember[]>(() => groupStore.userList)

const { joinedMembers, bannedMembers, visibleJoinedMembers, handleMemberScroll } = useMemberListWindow(
  allMembers,
  () => props.roomId
)

/** 首载态：成员还在拉取时先展示占位，避免空态提前闪现 */
const membersLoading = computed(() => groupStore.loadingRooms?.has(props.roomId) ?? false)

/** 封禁成员分页：一次性渲染上千条封禁记录会明显卡顿，按页追加 */
const BANNED_PAGE_SIZE = 50
const bannedVisibleCount = ref(BANNED_PAGE_SIZE)
const visibleBannedMembers = computed(() => bannedMembers.value.slice(0, bannedVisibleCount.value))
const hasMoreBanned = computed(() => bannedMembers.value.length > bannedVisibleCount.value)

watch(
  () => props.roomId,
  () => {
    bannedVisibleCount.value = BANNED_PAGE_SIZE
  }
)

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

.room-members-pane__loading {
  padding: 32px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--tjg-text-tertiary);
}

.room-members-pane__load-more {
  margin-top: 4px;
  padding: 6px 0;
  border: 0;
  border-radius: 6px;
  background: var(--tjg-surface-panel-muted);
  color: var(--tjg-color-primary-600);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: var(--tjg-surface-list-hover);
  }
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
  transition: background var(--tjg-motion-duration-fast) ease;

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

/* 联邦身份单元：占满头像与操作区之间的剩余宽度，MXID 过长时在组件内截断 */
.room-members-pane__identity {
  flex: 1;
  min-width: 0;
}

.room-members-pane__item-roles {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
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
  transition:
    color var(--tjg-motion-duration-fast) ease,
    background-color var(--tjg-motion-duration-fast) ease,
    border-color var(--tjg-motion-duration-fast) ease,
    box-shadow var(--tjg-motion-duration-fast) ease,
    opacity var(--tjg-motion-duration-fast) ease,
    transform var(--tjg-motion-duration-fast) ease;

  &--warning:hover {
    background: var(--tjg-color-warning-100, rgba(245, 158, 11, 0.1));
    color: var(--tjg-color-warning-500);
  }

  &--danger:hover {
    background: var(--tjg-color-danger-100);
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
