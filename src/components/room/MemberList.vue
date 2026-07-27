<template>
  <div class="member-list">
    <div class="member-header">
      <span class="member-title">{{ t('room.members.title') }}</span>
      <span class="member-count">{{ members.length }}</span>
      <n-button text size="tiny" @click="$emit('invite')">
        <template #icon>
          <svg class="size-16px">
            <use href="#add"></use>
          </svg>
        </template>
      </n-button>
    </div>

    <div class="member-filter">
      <n-input v-model:value="searchQuery" size="small" :placeholder="t('room.members.search_placeholder')" clearable>
        <template #prefix>
          <svg class="size-14px">
            <use href="#search"></use>
          </svg>
        </template>
      </n-input>
    </div>

    <div class="member-groups">
      <n-scrollbar style="max-height: 400px">
        <template v-if="adminMembers.length > 0">
          <div class="member-group">
            <span class="group-label">{{ t('room.members.admins') }} ({{ adminMembers.length }})</span>
            <div
              v-for="member in adminMembers"
              :key="member.userId"
              class="member-item"
              :class="{ 'is-selected': selectedMember?.userId === member.userId }"
              @click="handleMemberClick(member)"
              @contextmenu.prevent="handleContextMenu($event, member)">
              <n-avatar round :size="36" :src="member.avatarUrl" :fallback-src="defaultAvatar" />
              <div class="member-info">
                <span class="member-name">{{ member.displayName || member.userId }}</span>
                <span class="member-role">{{ t('room.members.admin') }}</span>
              </div>
              <div class="member-status" :class="member.membership">
                <span class="status-dot"></span>
              </div>
            </div>
          </div>
        </template>

        <template v-if="moderatorMembers.length > 0">
          <div class="member-group">
            <span class="group-label">{{ t('room.members.moderators') }} ({{ moderatorMembers.length }})</span>
            <div
              v-for="member in moderatorMembers"
              :key="member.userId"
              class="member-item"
              :class="{ 'is-selected': selectedMember?.userId === member.userId }"
              @click="handleMemberClick(member)"
              @contextmenu.prevent="handleContextMenu($event, member)">
              <n-avatar round :size="36" :src="member.avatarUrl" :fallback-src="defaultAvatar" />
              <div class="member-info">
                <span class="member-name">{{ member.displayName || member.userId }}</span>
                <span class="member-role">{{ t('room.members.moderator') }}</span>
              </div>
              <div class="member-status" :class="member.membership">
                <span class="status-dot"></span>
              </div>
            </div>
          </div>
        </template>

        <div class="member-group">
          <span class="group-label">{{ t('room.members.members') }} ({{ regularMembers.length }})</span>
          <div
            v-for="member in regularMembers"
            :key="member.userId"
            class="member-item"
            :class="{ 'is-selected': selectedMember?.userId === member.userId }"
            @click="handleMemberClick(member)"
            @contextmenu.prevent="handleContextMenu($event, member)">
            <n-avatar round :size="36" :src="member.avatarUrl" :fallback-src="defaultAvatar" />
            <div class="member-info">
              <span class="member-name">{{ member.displayName || member.userId }}</span>
            </div>
            <div class="member-status" :class="member.membership">
              <span class="status-dot"></span>
            </div>
          </div>
        </div>
      </n-scrollbar>
    </div>

    <!-- 选中成员操作栏 -->
    <div v-if="selectedMember" class="member-action-bar">
      <div class="action-bar-info">
        <n-avatar round :size="28" :src="selectedMember.avatarUrl" :fallback-src="defaultAvatar" />
        <span class="action-bar-name">{{ selectedMember.displayName || selectedMember.userId }}</span>
      </div>
      <div class="action-bar-buttons">
        <n-tooltip placement="top">
          <template #trigger>
            <n-button size="tiny" quaternary @click="handleSendMessage(selectedMember)">
              <template #icon>
                <svg class="size-14px"><use href="#message"></use></svg>
              </template>
            </n-button>
          </template>
          {{ t('room.members.send_message') }}
        </n-tooltip>
        <n-tooltip v-if="canKickBan && selectedMember.membership !== 'ban'" placement="top">
          <template #trigger>
            <n-button size="tiny" quaternary @click="handleKickAction(selectedMember)">
              <template #icon>
                <svg class="size-14px"><use href="#logout"></use></svg>
              </template>
            </n-button>
          </template>
          {{ t('room.members.kick') }}
        </n-tooltip>
        <n-tooltip v-if="canKickBan && selectedMember.membership !== 'ban'" placement="top">
          <template #trigger>
            <n-button size="tiny" quaternary type="error" @click="handleBanAction(selectedMember)">
              <template #icon>
                <svg class="size-14px"><use href="#forbid"></use></svg>
              </template>
            </n-button>
          </template>
          {{ t('room.members.ban') }}
        </n-tooltip>
        <n-tooltip v-if="canKickBan && selectedMember.membership === 'ban'" placement="top">
          <template #trigger>
            <n-button size="tiny" quaternary @click="handleUnbanAction(selectedMember)">
              <template #icon>
                <svg class="size-14px"><use href="#lock-open"></use></svg>
              </template>
            </n-button>
          </template>
          {{ t('room.members.unban') }}
        </n-tooltip>
      </div>
    </div>

    <!-- 右键菜单 -->
    <n-dropdown
      :show="showContextMenu"
      :x="contextMenuX"
      :y="contextMenuY"
      :options="contextMenuOptions"
      placement="bottom-start"
      trigger="manual"
      @select="handleMenuSelect"
      @clickoutside="showContextMenu = false" />

    <!-- Kick 原因对话框 -->
    <n-modal v-model:show="showKickDialog" preset="dialog" :title="t('room.members.kick_title')">
      <n-form>
        <n-form-item :label="t('room.members.reason_label')">
          <n-input
            v-model:value="kickReason"
            type="textarea"
            :rows="3"
            :placeholder="t('room.members.reason_placeholder')" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showKickDialog = false">{{ t('common.cancel') }}</n-button>
        <n-button type="warning" :loading="actionLoading" @click="confirmKick">
          {{ t('room.members.kick_confirm') }}
        </n-button>
      </template>
    </n-modal>

    <!-- Ban 原因对话框 -->
    <n-modal v-model:show="showBanDialog" preset="dialog" :title="t('room.members.ban_title')">
      <n-form>
        <n-form-item :label="t('room.members.reason_label')">
          <n-input
            v-model:value="banReason"
            type="textarea"
            :rows="3"
            :placeholder="t('room.members.reason_placeholder')" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showBanDialog = false">{{ t('common.cancel') }}</n-button>
        <n-button type="error" :loading="actionLoading" @click="confirmBan">
          {{ t('room.members.ban_confirm') }}
        </n-button>
      </template>
    </n-modal>

    <!-- Unban 确认对话框 -->
    <n-modal v-model:show="showUnbanDialog" preset="dialog" :title="t('room.members.unban_title')">
      <p>
        {{
          t('room.members.unban_confirm_text', {
            name: contextMenuMember?.displayName || contextMenuMember?.userId || ''
          })
        }}
      </p>
      <template #action>
        <n-button @click="showUnbanDialog = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="actionLoading" @click="confirmUnban">
          {{ t('room.members.unban_confirm') }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { openMsgSession } from '@/composables/chat/openMsgSession'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixRoomMembershipService } from '@/services/matrix/room/MembershipService'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'

interface RoomMember {
  userId: string
  displayName?: string
  avatarUrl?: string
  powerLevel: number
  membership: 'join' | 'invite' | 'leave' | 'ban'
}

const props = defineProps<{
  members: RoomMember[]
  roomId?: string
}>()

const emit = defineEmits<{
  (e: 'invite'): void
  (e: 'member-click', member: RoomMember): void
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()
const searchQuery = ref('')
const defaultAvatar = '/logoD.png'

// 选中成员状态
const selectedMember = ref<RoomMember | null>(null)

// 右键菜单状态
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)
const contextMenuMember = ref<RoomMember | null>(null)

// 对话框状态
const showKickDialog = ref(false)
const showBanDialog = ref(false)
const showUnbanDialog = ref(false)
const kickReason = ref('')
const banReason = ref('')
const actionLoading = ref(false)

// 当前用户权限检查
const canKickBan = computed(() => {
  return groupStore.isAdminOrLord()
})

// 当前用户不能对自己执行操作
const isSelf = (member: RoomMember) => {
  const myUserId = groupStore.getCurrentUser()?.userId
  return member.userId === myUserId
}

// 右键菜单选项
const contextMenuOptions = computed(() => {
  const member = contextMenuMember.value
  if (!member) return []

  const options: { label: string; key: string; icon?: () => VNode; disabled?: boolean; props?: { style?: string } }[] =
    []

  // 发送消息
  options.push({
    label: t('room.members.send_message'),
    key: 'send-message',
    icon: () => h('svg', { class: 'size-16px' }, [h('use', { href: '#message' })])
  })

  // Kick/Ban/Unban 操作（仅管理员可见，且不能对自己操作）
  if (canKickBan.value && !isSelf(member)) {
    if (member.membership === 'ban') {
      // 被封禁的成员显示解封选项
      options.push({
        label: t('room.members.unban'),
        key: 'unban',
        icon: () => h('svg', { class: 'size-16px' }, [h('use', { href: '#lock-open' })])
      })
    } else {
      // 正常成员显示踢出和封禁选项
      options.push({
        label: t('room.members.kick'),
        key: 'kick',
        icon: () => h('svg', { class: 'size-16px' }, [h('use', { href: '#logout' })]),
        props: { style: 'color: var(--hula-color-warning-500)' }
      })
      options.push({
        label: t('room.members.ban'),
        key: 'ban',
        icon: () => h('svg', { class: 'size-16px' }, [h('use', { href: '#forbid' })]),
        props: { style: 'color: var(--hula-color-danger-500)' }
      })
    }
  }

  return options
})

const filteredMembers = computed(() => {
  const query = searchQuery.value.toLowerCase()
  return props.members
    .filter((m) => m.membership === 'join')
    .filter((m) => !query || m.displayName?.toLowerCase().includes(query) || m.userId.toLowerCase().includes(query))
    .map((m) => ({
      ...m,
      avatarUrl: AvatarUtils.getAvatarUrl(m.avatarUrl || '')
    }))
})

const adminMembers = computed(() => filteredMembers.value.filter((m) => m.powerLevel >= 100))

const moderatorMembers = computed(() => filteredMembers.value.filter((m) => m.powerLevel >= 50 && m.powerLevel < 100))

const regularMembers = computed(() => filteredMembers.value.filter((m) => m.powerLevel < 50))

// 成员点击
function handleMemberClick(member: RoomMember) {
  selectedMember.value = selectedMember.value?.userId === member.userId ? null : member
  emit('member-click', member)
}

// 右键菜单
function handleContextMenu(e: MouseEvent, member: RoomMember) {
  contextMenuMember.value = member
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  showContextMenu.value = true
}

// 菜单选择
function handleMenuSelect(key: string) {
  showContextMenu.value = false
  const member = contextMenuMember.value
  if (!member) return

  switch (key) {
    case 'send-message':
      handleSendMessage(member)
      break
    case 'kick':
      handleKickAction(member)
      break
    case 'ban':
      handleBanAction(member)
      break
    case 'unban':
      handleUnbanAction(member)
      break
  }
}

// 发送消息（打开 DM）
async function handleSendMessage(member: RoomMember) {
  try {
    await openMsgSession(member.userId)
  } catch {
    showFeedback(t('room.members.send_message_failed'), 'error')
  }
}

// Kick 操作
function handleKickAction(member: RoomMember) {
  contextMenuMember.value = member
  kickReason.value = ''
  showKickDialog.value = true
}

async function confirmKick() {
  const member = contextMenuMember.value
  const roomId = props.roomId
  if (!member || !roomId) return

  actionLoading.value = true
  try {
    await matrixRoomMembershipService.kickUser(roomId, member.userId, kickReason.value || undefined)
    showFeedback(t('room.members.kick_success', { name: member.displayName || member.userId }), 'success')
    showKickDialog.value = false
    if (selectedMember.value?.userId === member.userId) {
      selectedMember.value = null
    }
    await groupStore.loadRoomMembers(roomId, true)
  } catch {
    showFeedback(t('room.members.kick_failed'), 'error')
  } finally {
    actionLoading.value = false
  }
}

// Ban 操作
function handleBanAction(member: RoomMember) {
  contextMenuMember.value = member
  banReason.value = ''
  showBanDialog.value = true
}

async function confirmBan() {
  const member = contextMenuMember.value
  const roomId = props.roomId
  if (!member || !roomId) return

  actionLoading.value = true
  try {
    await matrixRoomMembershipService.banUser(roomId, member.userId, banReason.value || undefined)
    showFeedback(t('room.members.ban_success', { name: member.displayName || member.userId }), 'success')
    showBanDialog.value = false
    if (selectedMember.value?.userId === member.userId) {
      selectedMember.value = null
    }
    await groupStore.loadRoomMembers(roomId, true)
  } catch {
    showFeedback(t('room.members.ban_failed'), 'error')
  } finally {
    actionLoading.value = false
  }
}

// Unban 操作
function handleUnbanAction(member: RoomMember) {
  contextMenuMember.value = member
  showUnbanDialog.value = true
}

async function confirmUnban() {
  const member = contextMenuMember.value
  const roomId = props.roomId
  if (!member || !roomId) return

  actionLoading.value = true
  try {
    await matrixRoomMembershipService.unbanUser(roomId, member.userId)
    showFeedback(t('room.members.unban_success', { name: member.displayName || member.userId }), 'success')
    showUnbanDialog.value = false
    if (selectedMember.value?.userId === member.userId) {
      selectedMember.value = null
    }
    await groupStore.loadRoomMembers(roomId, true)
  } catch {
    showFeedback(t('room.members.unban_failed'), 'error')
  } finally {
    actionLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.member-list {
  @apply flex flex-col gap-12px;
}

.member-header {
  @apply flex items-center gap-8px;
}

.member-title {
  @apply text-14px font-medium;
}

.member-count {
  @apply text-12px color-[--hula-text-tertiary];
}

.member-filter {
  @apply w-full;
}

.member-groups {
  @apply flex flex-col gap-12px;
}

.member-group {
  @apply flex flex-col gap-4px;
}

.group-label {
  @apply text-12px color-[--hula-text-tertiary] px-4px;
}

.member-item {
  @apply flex items-center gap-10px p-8px rounded-8px cursor-pointer transition-all;

  &:hover {
    background: var(--hula-fill-hover);
  }

  &.is-selected {
    background: var(--hula-fill-active);
  }
}

.member-info {
  @apply flex flex-col gap-2px flex-1 min-w-0;
}

.member-name {
  @apply text-14px truncate;
}

.member-role {
  @apply text-12px color-[--hula-color-primary-500];
}

.member-status {
  @apply flex-center;

  &.join .status-dot {
    @apply w-8px h-8px rounded-full bg-[--hula-color-success-500];
  }

  &.invite .status-dot {
    @apply w-8px h-8px rounded-full bg-[--hula-color-warning-500];
  }

  &.leave .status-dot,
  &.ban .status-dot {
    @apply w-8px h-8px rounded-full bg-[--hula-text-tertiary];
  }
}

.member-action-bar {
  @apply flex items-center justify-between p-8px rounded-8px;
  background: var(--hula-fill-hover);
}

.action-bar-info {
  @apply flex items-center gap-8px min-w-0;
}

.action-bar-name {
  @apply text-13px truncate;
}

.action-bar-buttons {
  @apply flex items-center gap-4px;
}
</style>
