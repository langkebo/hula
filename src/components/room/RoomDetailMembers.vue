<template>
  <section class="room-detail-members" data-testid="room-detail-members">
    <header class="room-detail-members__header flex items-center justify-between">
      <h4 class="text-[length:var(--tjg-font-size-sm)] font-[--tjg-font-weight-semibold] color-[--tjg-text-secondary]">
        {{ t('room.detail.members_title') }}
      </h4>
      <span
        v-if="!loading && members.length > 0"
        class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary]"
        data-testid="room-detail-members-count">
        {{ members.length }}
      </span>
    </header>

    <div
      v-if="loading"
      class="room-detail-members__loading flex-center py-[--tjg-space-4]"
      data-testid="room-detail-members-loading">
      <svg
        class="size-24px color-[--tjg-text-tertiary] animate-spin"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>

    <template v-else>
      <PartialStateBanner
        v-if="error"
        compact
        class="mb-[--tjg-space-2]"
        data-testid="room-detail-members-partial"
        :message="t('room.detail.members_load_failed')"
        :detail="error"
        :retry-text="t('common.retry')"
        @retry="emit('retry')" />

      <EmptyState
        v-if="isEmptyMembers && !error"
        compact
        data-testid="room-detail-members-empty"
        :description="t('room.detail.no_members')" />

      <ul
        v-else-if="!isEmptyMembers"
        class="room-detail-members__list flex flex-col gap-[--tjg-space-1] mt-[--tjg-space-2]">
        <li
          v-for="member in coreMembers"
          :key="member.userId"
          class="room-detail-members__item flex items-center gap-[--tjg-space-2] py-[--tjg-space-1] px-[--tjg-space-2] rounded-[--tjg-radius-sm] hover:bg-[--tjg-surface-list-hover] transition-colors"
          data-testid="room-detail-member-item">
          <div class="relative shrink-0">
            <div
              class="size-[28px] rounded-full overflow-hidden flex-center bg-[--tjg-surface-subtle] color-[--tjg-text-secondary] text-[length:var(--tjg-font-size-xs)] font-[--tjg-font-weight-medium]">
              <img
                v-if="member.avatar"
                :src="member.avatar"
                :alt="''"
                class="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                data-testid="room-detail-member-avatar-img" />
              <span v-else data-testid="room-detail-member-avatar-placeholder">{{ avatarPlaceholder(member) }}</span>
            </div>
            <span
              v-if="isOnline(member)"
              class="absolute right-0 bottom-0 size-[8px] rounded-full bg-[--tjg-status-online] border border-[--tjg-surface-panel]"
              data-testid="room-detail-member-status-online"
              aria-hidden="true" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-[--tjg-space-1]">
              <span class="text-[length:var(--tjg-font-size-sm)] color-[--tjg-text-primary] truncate">
                {{ displayName(member) }}
              </span>
              <span
                v-if="member.isCreator"
                class="inline-flex items-center px-[6px] py-[1px] rounded-[--tjg-radius-xs] bg-[--tjg-color-primary-100] text-[--tjg-color-primary-600] text-[length:var(--tjg-font-size-2xs)] font-[--tjg-font-weight-medium]"
                data-testid="room-detail-member-role-creator">
                {{ t('room.detail.role_creator') }}
              </span>
              <span
                v-else-if="member.isModerator"
                class="inline-flex items-center px-[6px] py-[1px] rounded-[--tjg-radius-xs] bg-[--tjg-color-info-100] text-[--tjg-color-info-600] text-[length:var(--tjg-font-size-2xs)] font-[--tjg-font-weight-medium]"
                data-testid="room-detail-member-role-moderator">
                {{ t('room.detail.role_moderator') }}
              </span>
            </div>
            <div class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary] truncate">
              {{ member.userId }}
            </div>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import { OnlineEnum } from '@/enums'
import type { MatrixRoomMember } from '@/stores/domains/chat/group/types'

const props = defineProps<{
  members: MatrixRoomMember[]
  loading?: boolean
  /** 成员加载失败原因；非空时展示局部失败横幅，已缓存成员仍继续渲染 */
  error?: string
}>()

const emit = defineEmits<{
  retry: []
}>()

const MAX_CORE_MEMBERS = 6

const { t } = useI18n()

const compareMembers = (a: MatrixRoomMember, b: MatrixRoomMember): number => {
  // 在线优先
  const aOnline = a.activeStatus === OnlineEnum.ONLINE ? 1 : 0
  const bOnline = b.activeStatus === OnlineEnum.ONLINE ? 1 : 0
  if (aOnline !== bOnline) return bOnline - aOnline
  // power level 降序
  return b.powerLevel - a.powerLevel
}

// 只取前 MAX_CORE_MEMBERS 名：大房间里对全量成员排序是 O(N log N) 的纯开销，
// 这里用 O(N·K) 的有序插入代替，结果与「全量稳定排序后 slice」完全一致。
const coreMembers = computed<MatrixRoomMember[]>(() => {
  const selected: MatrixRoomMember[] = []
  for (const member of props.members) {
    const insertAt = selected.findIndex((existing) => compareMembers(member, existing) < 0)
    if (insertAt === -1) {
      if (selected.length < MAX_CORE_MEMBERS) selected.push(member)
      continue
    }
    selected.splice(insertAt, 0, member)
    if (selected.length > MAX_CORE_MEMBERS) selected.pop()
  }
  return selected
})

const isOnline = (member: MatrixRoomMember) => member.activeStatus === OnlineEnum.ONLINE

const isEmptyMembers = computed(() => props.members.length === 0)

const displayName = (member: MatrixRoomMember) => member.displayName || member.name || member.account || member.userId

const avatarPlaceholder = (member: MatrixRoomMember) => {
  const name = displayName(member)
  return name?.charAt(0) || '?'
}
</script>
