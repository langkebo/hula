<template>
  <div class="px-16px mb-12px z-1">
    <div v-if="loading" class="flex justify-center py-20px">
      <van-loading size="20px" />
    </div>
    <div v-else-if="results.length > 0" class="flex flex-col gap-8px">
      <div
        v-for="result in results"
        :key="result.userId"
        class="flex items-center gap-10px p-10px rounded-[--tjg-radius-lg] bg-[--tjg-glass-row-bg] border border-[--tjg-glass-border-color] shadow-[var(--tjg-glass-inner-highlight)]">
        <img
          class="size-40px rounded-full object-cover"
          :src="AvatarUtils.getAvatarUrl(result.avatarUrl || '', 96)"
          :alt="t('mobile_contact.avatar.default')"
          @error="($event.target as HTMLImageElement).src = '/logo.png'" />
        <div class="flex-1 min-w-0">
          <div class="text-[length:var(--tjg-font-size-base)] font-medium truncate text-[--tjg-text-primary]">
            {{ result.displayName || result.userId }}
          </div>
          <div class="text-[length:var(--tjg-font-size-sm)] text-[--tjg-text-tertiary] truncate">
            {{ result.userId }}
          </div>
        </div>
        <van-button
          size="small"
          type="primary"
          plain
          :loading="addingFriend === result.userId"
          @click="emit('add', result.userId)">
          {{ t('mobile_contact.button.add') }}
        </van-button>
      </div>
    </div>
    <div
      v-else-if="hasSearched"
      class="py-20px text-center text-[length:var(--tjg-font-size-md)] text-[--tjg-text-tertiary]">
      {{ t('mobile_contact.search_no_result') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { UserSearchResult } from '#/composables/friends/useFriendUserSearch'
import { AvatarUtils } from '@/utils/AvatarUtils'

defineProps<{
  results: UserSearchResult[]
  loading: boolean
  hasSearched: boolean
  addingFriend: string | null
}>()

const emit = defineEmits<{
  add: [userId: string]
}>()

const { t } = useI18n()
</script>
