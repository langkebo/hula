<template>
  <div class="rs-tab">
    <section class="rs-tab__section">
      <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_member_manage') }}</h4>

      <div class="rs-tab__invite">
        <n-input
          v-model:value="inviteInput"
          :placeholder="t('room.detail.invite_placeholder')"
          clearable
          data-testid="members-invite-input"
          @keyup.enter="handleInvite" />
        <n-button
          type="primary"
          :loading="inviting"
          :disabled="!inviteInput.trim()"
          data-testid="members-invite-button"
          @click="handleInvite">
          {{ t('room.settings_drawer.action_invite') }}
        </n-button>
      </div>
    </section>

    <section class="rs-tab__section">
      <div v-if="loading" class="rs-tab__loading" data-testid="members-loading">
        <n-spin size="small" />
      </div>

      <div v-else-if="members.length === 0" class="rs-tab__empty" data-testid="members-empty">
        {{ t('room.detail.no_members') }}
      </div>

      <div v-else class="rs-tab__member-list">
        <div v-for="member in sortedMembers" :key="member.userId" class="rs-tab__member-row" data-testid="members-row">
          <n-avatar :size="32" :src="member.avatar || undefined" round>
            {{ avatarPlaceholder(member) }}
          </n-avatar>

          <div class="rs-tab__member-info">
            <div class="rs-tab__member-name">
              <span class="rs-tab__member-displayname">{{ displayName(member) }}</span>
              <n-tag
                v-if="member.isCreator || member.powerLevel >= 100"
                size="small"
                type="success"
                :bordered="false"
                data-testid="members-role-creator">
                {{ t('room.detail.role_creator') }}
              </n-tag>
              <n-tag
                v-else-if="member.isModerator || member.powerLevel >= 50"
                size="small"
                type="info"
                :bordered="false"
                data-testid="members-role-moderator">
                {{ t('room.detail.role_moderator') }}
              </n-tag>
            </div>
            <span class="rs-tab__member-userid">{{ member.userId }}</span>
          </div>

          <div v-if="canModerate(member)" class="rs-tab__member-actions">
            <n-popconfirm @positive-click="handleKick(member)">
              <template #trigger>
                <n-button size="small" quaternary data-testid="members-kick-button">
                  {{ t('room.detail.kick_member') }}
                </n-button>
              </template>
              {{ t('room.detail.kick_confirm') }}
            </n-popconfirm>

            <n-popconfirm @positive-click="handleBan(member)">
              <template #trigger>
                <n-button size="small" quaternary type="error" data-testid="members-ban-button">
                  {{ t('room.detail.ban_member') }}
                </n-button>
              </template>
              {{ t('room.detail.ban_confirm') }}
            </n-popconfirm>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'
import { useGroupStore } from '@/stores/domains/chat/group'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types'

const props = defineProps<{
  roomId: string
}>()

defineEmits<{
  close: []
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const groupStore = useGroupStore()

const inviteInput = ref('')
const inviting = ref(false)
const loading = ref(false)
const currentUserId = matrixClientService.getUserId()

const members = computed<MatrixRoomMember[]>(() => groupStore.getMembersByRoomId(props.roomId))

const sortedMembers = computed<MatrixRoomMember[]>(() => {
  return [...members.value].sort((a, b) => {
    if (b.powerLevel !== a.powerLevel) return b.powerLevel - a.powerLevel
    return displayName(a).localeCompare(displayName(b))
  })
})

const displayName = (member: MatrixRoomMember) => member.displayName || member.name || member.account || member.userId

const avatarPlaceholder = (member: MatrixRoomMember) => {
  const name = displayName(member)
  return name?.charAt(0) || '?'
}

const canModerate = (member: MatrixRoomMember) => {
  if (!currentUserId) return false
  if (member.userId === currentUserId) return false
  return member.powerLevel < 100
}

async function loadMembers() {
  loading.value = true
  try {
    await groupStore.loadRoomMembers(props.roomId, true)
  } finally {
    loading.value = false
  }
}

async function handleInvite() {
  const userId = inviteInput.value.trim()
  if (!userId) {
    showFeedback(t('room.detail.invite_user_required'), 'warning')
    return
  }
  inviting.value = true
  try {
    await matrixRoomActionFacade.inviteUser(props.roomId, userId)
    showFeedback(t('room.detail.invite_success'), 'success')
    inviteInput.value = ''
    await loadMembers()
  } catch {
    showFeedback(t('room.detail.invite_failed'), 'error')
  } finally {
    inviting.value = false
  }
}

async function handleKick(member: MatrixRoomMember) {
  try {
    await matrixRoomActionFacade.kickUser(props.roomId, member.userId)
    showFeedback(t('room.detail.kick_success'), 'success')
    await loadMembers()
  } catch {
    showFeedback(t('room.detail.kick_failed'), 'error')
  }
}

async function handleBan(member: MatrixRoomMember) {
  try {
    await matrixRoomActionFacade.banUser(props.roomId, member.userId)
    showFeedback(t('room.detail.ban_success'), 'success')
    await loadMembers()
  } catch {
    showFeedback(t('room.detail.ban_failed'), 'error')
  }
}

onMounted(() => {
  loadMembers()
})
</script>

<style scoped lang="scss">
.rs-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.rs-tab__section {
  display: flex;
  flex-direction: column;
}

.rs-tab__section-title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin-bottom: 10px;
}

.rs-tab__invite {
  display: flex;
  gap: 8px;
  align-items: center;
}

.rs-tab__loading,
.rs-tab__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--tjg-space-6) 0;
  color: var(--tjg-text-tertiary);
  font-size: var(--tjg-font-size-sm);
}

.rs-tab__member-list {
  display: flex;
  flex-direction: column;
}

.rs-tab__member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--tjg-radius-sm);
  background: var(--tjg-surface-app);
  margin-bottom: 6px;
}

.rs-tab__member-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rs-tab__member-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rs-tab__member-displayname {
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rs-tab__member-userid {
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rs-tab__member-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

@media (prefers-reduced-motion: reduce) {
  .rs-tab__member-row {
    transition: none;
  }
}
</style>
