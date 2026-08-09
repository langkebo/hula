<template>
  <div
    class="room-detail-stats grid gap-[--tjg-space-2]"
    data-testid="stat-grid"
    role="list"
    style="grid-template-columns: repeat(3, 1fr)">
    <div
      class="room-detail-stats__card flex flex-col items-center justify-center py-[--tjg-space-3] rounded-[--tjg-radius-md] bg-[--tjg-surface-subtle]"
      data-testid="stat-card-members"
      role="listitem">
      <span
        class="room-detail-stats__value text-[length:var(--tjg-font-size-xl)] font-[--tjg-font-weight-semibold] color-[--tjg-text-primary]"
        data-testid="stat-card-value">
        {{ memberCount }}
      </span>
      <span class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary] mt-2px">
        {{ t('room.detail.members') }}
      </span>
    </div>

    <div
      class="room-detail-stats__card flex flex-col items-center justify-center py-[--tjg-space-3] rounded-[--tjg-radius-md] bg-[--tjg-surface-subtle]"
      data-testid="stat-card-online"
      role="listitem">
      <span
        class="room-detail-stats__value text-[length:var(--tjg-font-size-xl)] font-[--tjg-font-weight-semibold] color-[--tjg-color-success-500]"
        data-testid="stat-card-value">
        {{ onlineCount }}
      </span>
      <span class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary] mt-2px">
        {{ t('room.detail.online') }}
      </span>
    </div>

    <div
      class="room-detail-stats__card flex flex-col items-center justify-center py-[--tjg-space-3] rounded-[--tjg-radius-md] bg-[--tjg-surface-subtle]"
      data-testid="stat-card-announcements"
      role="listitem">
      <span
        class="room-detail-stats__value text-[length:var(--tjg-font-size-xl)] font-[--tjg-font-weight-semibold] color-[--tjg-color-primary-500]"
        data-testid="stat-card-value">
        {{ announcementCount }}
      </span>
      <span class="text-[length:var(--tjg-font-size-2xs)] color-[--tjg-text-tertiary] mt-2px">
        {{ t('room.detail.announcement') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  memberCount: number
  onlineCount: number
  announcementCount: number
}>()

const { t } = useI18n()
</script>
