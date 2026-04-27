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
              @click="$emit('member-click', member)">
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
              @click="$emit('member-click', member)">
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
            @click="$emit('member-click', member)">
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
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { AvatarUtils } from '@/utils/AvatarUtils'

export interface RoomMember {
  userId: string
  displayName?: string
  avatarUrl?: string
  powerLevel: number
  membership: 'join' | 'invite' | 'leave' | 'ban'
}

const props = defineProps<{
  members: RoomMember[]
}>()

defineEmits<{
  (e: 'invite'): void
  (e: 'member-click', member: RoomMember): void
}>()

const { t } = useI18n()
const searchQuery = ref('')
const defaultAvatar = '/logoD.png'

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
</style>
