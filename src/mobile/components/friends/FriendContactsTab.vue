<template>
  <div class="px-8px pt-4px">
    <van-search
      :model-value="keyword"
      shape="round"
      background="transparent"
      clearable
      data-testid="friends-local-search"
      :placeholder="t('mobile_contact.search_friend_placeholder')"
      @update:model-value="onKeywordUpdate" />
  </div>
  <div v-if="isInitialLoading" class="flex items-center justify-center text-[--tjg-text-secondary] min-h-240px">
    <van-loading size="24px" />
  </div>
  <div v-else-if="viewState === 'capability'" class="flex items-center justify-center px-16px text-center min-h-240px">
    <van-empty :description="t('friend.list.capability_unavailable_description')">
      <template #image>
        <svg class="size-40px color-[--tjg-text-tertiary]"><use href="#friends"></use></svg>
      </template>
      <template #bottom>
        <div class="mt-8px text-[length:var(--tjg-font-size-base)] font-600 text-[--tjg-text-primary]">
          {{ t('friend.list.capability_unavailable_title') }}
        </div>
      </template>
    </van-empty>
  </div>
  <div v-else-if="viewState === 'error'" class="flex items-center justify-center px-16px text-center min-h-240px">
    <van-empty :description="errorMessage">
      <template #image>
        <svg class="size-40px color-[--tjg-text-tertiary]"><use href="#warning"></use></svg>
      </template>
      <template #bottom>
        <div class="mt-8px flex flex-col items-center gap-12px">
          <div class="text-[length:var(--tjg-font-size-base)] font-600 text-[--tjg-text-primary]">
            {{ t('common.error') }}
          </div>
          <van-button size="small" type="primary" plain @click="emit('retry')">
            {{ t('common.retry') }}
          </van-button>
        </div>
      </template>
    </van-empty>
  </div>
  <van-pull-refresh
    v-else
    :model-value="refreshing"
    class="min-h-240px"
    data-testid="friends-pull-refresh"
    @update:model-value="onRefreshingUpdate"
    @refresh="emit('refresh')">
    <div v-if="viewState === 'empty'" class="flex items-center justify-center px-16px text-center min-h-240px">
      <van-empty :description="t('friend.list.empty')" />
    </div>
    <div v-else-if="isLocalSearchEmpty" class="flex items-center justify-center px-16px text-center min-h-240px">
      <van-empty :description="t('mobile_contact.search_no_result')" />
    </div>
    <van-collapse v-else :model-value="activeCollapseNames" @update:model-value="onCollapseUpdate">
      <div>
        <!-- 特殊关心分组 -->
        <van-collapse-item v-if="specialContacts.length > 0" name="special">
          <template #title>
            <div class="flex items-center gap-8px">
              <svg class="size-14px color-[--tjg-color-warning-500]"><use href="#star-fill"></use></svg>
              <span>{{ t('mobile_contact.group.special') }}</span>
            </div>
          </template>
          <template #value>
            <span class="text-[length:var(--tjg-font-size-xs)] text-[--tjg-text-secondary]">
              {{ specialOnlineCount }}/{{ specialContacts.length }}
            </span>
          </template>
          <div class="max-h-[var(--friends-list-max-height)] overflow-y-auto">
            <div>
              <div
                v-for="item in specialContacts"
                :key="item.userId"
                @click="emit('select', item.userId)"
                :class="[
                  { active: activeId === item.userId },
                  'item-box w-full h-[var(--friends-item-height)] mb-5px flex items-center gap-10px'
                ]">
                <FriendContactRow
                  :user-id="item.userId"
                  :name="item.remark || item.displayName || item.account"
                  :avatar="item.avatarUrl || ''"
                  :active-status="item.activeStatus"
                  :is-bot="isBotUser(item.userId)"
                  :state="getUserState(item.userId)" />
              </div>
            </div>
          </div>
        </van-collapse-item>

        <!-- 普通好友分组 -->
        <van-collapse-item name="normal">
          <template #title>
            <div class="flex items-center gap-8px">
              <svg class="size-14px color-[--tjg-text-secondary]"><use href="#friends"></use></svg>
              <span>{{ t('mobile_contact.group.normal') }}</span>
            </div>
          </template>
          <template #value>
            <span class="text-[length:var(--tjg-font-size-xs)] text-[--tjg-text-secondary]">
              {{ normalOnlineCount }}/{{ normalContacts.length }}
            </span>
          </template>
          <div class="max-h-[var(--friends-list-max-height)] overflow-y-auto">
            <div>
              <van-swipe-cell v-for="item in normalContacts" :key="item.userId">
                <div
                  @click="emit('select', item.userId)"
                  :class="[
                    { active: activeId === item.userId },
                    'item-box w-full h-[var(--friends-item-height)] mb-5px flex items-center gap-10px'
                  ]">
                  <FriendContactRow
                    :user-id="item.userId"
                    :name="item.remark || item.displayName || item.account"
                    :avatar="item.avatarUrl || ''"
                    :active-status="item.activeStatus"
                    :is-bot="isBotUser(item.userId)"
                    :state="getUserState(item.userId)" />
                </div>
                <template #right>
                  <van-button square type="danger" class="h-full" @click="emit('delete-contact', item.userId)">
                    {{ t('common.delete') }}
                  </van-button>
                </template>
              </van-swipe-cell>
            </div>
          </div>
        </van-collapse-item>

        <!-- 屏蔽好友分组 -->
        <van-collapse-item v-if="blockedContacts.length > 0" name="blocked">
          <template #title>
            <div class="flex items-center gap-8px">
              <svg class="size-14px color-[--tjg-text-tertiary]"><use href="#forbidden"></use></svg>
              <span>{{ t('mobile_contact.group.blocked') }}</span>
            </div>
          </template>
          <template #value>
            <span class="text-[length:var(--tjg-font-size-xs)] text-[--tjg-text-secondary]">
              {{ blockedContacts.length }}
            </span>
          </template>
          <div class="max-h-[var(--friends-list-max-height)] overflow-y-auto">
            <div>
              <div
                v-for="item in blockedContacts"
                :key="item.userId"
                @click="emit('select', item.userId)"
                :class="[
                  { active: activeId === item.userId },
                  'item-box w-full h-[var(--friends-item-height)] mb-5px opacity-60 flex items-center gap-10px'
                ]">
                <img
                  class="size-44px rounded-full object-cover grayscale border-(1px solid var(--avatar-border-color))"
                  :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.userId)?.avatar!, 96)"
                  :alt="t('mobile_contact.avatar.user')"
                  @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                <div class="flex flex-col justify-between h-fit flex-1 truncate">
                  <span class="text-[length:var(--tjg-font-size-base)] leading-tight flex-1 truncate">
                    {{ groupStore.getUserInfo(item.userId)?.name }}
                  </span>
                  <div class="text leading-tight text-[length:var(--tjg-font-size-sm)] text-[--tjg-text-tertiary]">
                    [{{ t('mobile_contact.status.blocked') }}]
                  </div>
                </div>
              </div>
            </div>
          </div>
        </van-collapse-item>
      </div>
    </van-collapse>
  </van-pull-refresh>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FriendListViewState, FriendUserState } from '#/composables/friends/useFriendListLoadState'
import FriendContactRow from '@/mobile/components/friend/FriendContactRow.vue'
import type { MatrixContact } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'

defineProps<{
  keyword: string
  isInitialLoading: boolean
  viewState: FriendListViewState
  errorMessage: string
  isLocalSearchEmpty: boolean
  refreshing: boolean
  activeCollapseNames: string[]
  specialContacts: MatrixContact[]
  normalContacts: MatrixContact[]
  blockedContacts: MatrixContact[]
  specialOnlineCount: number
  normalOnlineCount: number
  activeId: string | null
  isBotUser: (userId: string) => boolean
  getUserState: (userId: string) => FriendUserState | null
}>()

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:refreshing': [value: boolean]
  'update:activeCollapseNames': [value: string[]]
  refresh: []
  retry: []
  select: [userId: string]
  'delete-contact': [userId: string]
}>()

const { t } = useI18n()
const groupStore = useGroupStore()

const onKeywordUpdate = (value: string) => emit('update:keyword', value)
const onRefreshingUpdate = (value: boolean) => emit('update:refreshing', value)
const onCollapseUpdate = (value: string[]) => emit('update:activeCollapseNames', value)
</script>
