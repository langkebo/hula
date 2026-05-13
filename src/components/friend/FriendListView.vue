<template>
  <div class="friend-list-view">
    <n-flex vertical :size="12" class="p-12px">
      <n-flex align="center" justify="space-between">
        <n-flex align="center" :size="8">
          <span class="text-16px font-semibold">{{ t('friend.list.title') }}</span>
          <n-badge :value="incomingRequestsCount" :max="99" :show="incomingRequestsCount > 0" />
        </n-flex>
        <n-flex :size="8">
          <n-button quaternary circle size="small" @click="showAddFriend = true">
            <template #icon>
              <n-icon>
                <svg><use href="#plus" /></svg>
              </n-icon>
            </template>
          </n-button>
          <n-button quaternary circle size="small" @click="showFriendRequest = true">
            <template #icon>
              <n-icon>
                <svg><use href="#bell" /></svg>
              </n-icon>
            </template>
          </n-button>
        </n-flex>
      </n-flex>

      <n-input v-model:value="searchValue" :placeholder="t('friend.list.search')" size="small" clearable>
        <template #prefix>
          <n-icon size="16">
            <svg><use href="#search" /></svg>
          </n-icon>
        </template>
      </n-input>

      <n-flex :size="4">
        <n-button
          v-for="filter in filterOptions"
          :key="filter.value"
          :type="currentFilter === filter.value ? 'primary' : 'default'"
          size="tiny"
          quaternary
          @click="handleFilterChange(filter.value)">
          {{ filter.label }}
          <n-badge
            v-if="filter.value !== 'all'"
            :value="getFilterCount(filter.value)"
            :max="99"
            :show="getFilterCount(filter.value) > 0"
            type="info"
            class="ml-4px" />
        </n-button>
      </n-flex>
    </n-flex>

    <n-divider style="margin: 0" />

    <n-spin :show="isLoading">
      <n-scrollbar style="height: calc(100vh - 200px)">
        <n-empty
          v-if="filteredFriends.length === 0 && !isLoading"
          :description="t('friend.list.empty')"
          class="mt-40px" />
        <div v-else class="friend-items">
          <div
            v-for="friend in filteredFriends"
            :key="friend.userId"
            class="friend-item"
            @click="handleSelectFriend(friend)"
            @contextmenu="handleContextMenu($event, friend)">
            <n-flex align="center" :size="12">
              <n-badge :dot="friend.friendStatus === 'favorite'" color="#f0a020" :offset="[-4, 4]">
                <n-avatar
                  :size="44"
                  :src="AvatarUtils.getAvatarUrl(friend.avatarUrl)"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  round />
              </n-badge>
              <n-flex vertical :size="4" class="flex-1 truncate">
                <span class="text-14px truncate">
                  {{ friend.remark || friend.displayName || friend.name }}
                </span>
                <n-flex align="center" :size="4">
                  <n-badge :color="friend.activeStatus === OnlineEnum.ONLINE ? '#1ab292' : '#909090'" dot />
                  <span class="text-12px text-gray-500">
                    {{ friend.activeStatus === OnlineEnum.ONLINE ? t('friend.list.online') : getLastSeenText(friend) }}
                  </span>
                  <n-tag v-if="friend.friendStatus === 'blocked'" type="error" size="tiny">
                    {{ t('friend.status.blocked') }}
                  </n-tag>
                </n-flex>
              </n-flex>
            </n-flex>
          </div>
        </div>
      </n-scrollbar>
    </n-spin>

    <ContextMenu ref="contextMenuRef" :menu="contextMenuItems" @select="handleContextMenuSelect" />

    <FriendRequestDialog v-model:show="showFriendRequest" />
    <AddFriendDialog v-model:show="showAddFriend" />
    <FriendDetailDrawer v-model:show="showDetail" v-model:user-id="selectedUserId" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ContextMenu from '@/components/common/ContextMenu.vue'
import { OnlineEnum, ThemeEnum } from '@/enums'
import type { FriendStatus } from '@/services/matrix/friends/MatrixFriendService'
import { matrixSpecialFriendService } from '@/services/matrix/friends/MatrixSpecialFriendService'
import { type MatrixContact, useContactStore } from '@/stores/domains/chat/contacts'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { AvatarUtils } from '@/utils/AvatarUtils'
import AddFriendDialog from './AddFriendDialog.vue'
import FriendDetailDrawer from './FriendDetailDrawer.vue'
import FriendRequestDialog from './FriendRequestDialog.vue'

const { t } = useI18n()
const contactStore = useContactStore()
const settingStore = useSettingStore()

const searchValue = ref('')
const currentFilter = ref<FriendStatus | 'all'>('all')
const showFriendRequest = ref(false)
const showAddFriend = ref(false)
const showDetail = ref(false)
const selectedUserId = ref('')
const contextMenuRef = ref()
const selectedFriend = ref<MatrixContact | null>(null)

const isLoading = computed(() => contactStore.isLoading)
const incomingRequestsCount = computed(() => contactStore.incomingRequestsCount)

const filterOptions = computed(() => [
  { value: 'all' as const, label: t('friend.filter.all') },
  { value: 'favorite' as FriendStatus, label: t('friend.filter.favorite') },
  { value: 'normal' as FriendStatus, label: t('friend.filter.normal') },
  { value: 'blocked' as FriendStatus, label: t('friend.filter.blocked') }
])

const filteredFriends = computed(() => {
  let friends =
    currentFilter.value === 'all'
      ? contactStore.contactsList
      : contactStore.contactsList.filter((f) => f.friendStatus === currentFilter.value)

  if (searchValue.value.trim()) {
    const query = searchValue.value.toLowerCase()
    friends = friends.filter(
      (f) =>
        f.userId.toLowerCase().includes(query) ||
        f.displayName?.toLowerCase().includes(query) ||
        f.name.toLowerCase().includes(query) ||
        f.remark?.toLowerCase().includes(query)
    )
  }

  return friends.sort((a, b) => {
    if (a.friendStatus === 'favorite' && b.friendStatus !== 'favorite') return -1
    if (a.friendStatus !== 'favorite' && b.friendStatus === 'favorite') return 1
    if (a.activeStatus === OnlineEnum.ONLINE && b.activeStatus !== OnlineEnum.ONLINE) return -1
    if (a.activeStatus !== OnlineEnum.ONLINE && b.activeStatus === OnlineEnum.ONLINE) return 1
    return 0
  })
})

const getFilterCount = (status: FriendStatus) => {
  return contactStore.contactsList.filter((f) => f.friendStatus === status).length
}

const getLastSeenText = (friend: MatrixContact): string => {
  if (friend.activeStatus === OnlineEnum.ONLINE) return t('friend.list.online')
  if (friend.lastOptTime && friend.lastOptTime > 0) {
    const diffMs = Date.now() - friend.lastOptTime
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return t('friend.list.online')
    if (diffHours < 24) return t('friend.detail.hours_ago', { count: diffHours })
    if (diffDays < 7) return t('friend.detail.days_ago', { count: diffDays })
  }
  return t('friend.list.offline')
}

const handleFilterChange = (filter: FriendStatus | 'all') => {
  currentFilter.value = filter
}

const handleSelectFriend = (friend: MatrixContact) => {
  selectedUserId.value = friend.userId
  showDetail.value = true
}

const contextMenuItems = computed(() => {
  const items = [
    { label: t('friend.context.send_message'), icon: 'message' },
    { label: t('friend.context.encrypted_chat'), icon: 'lock' },
    { label: t('friend.context.secret_chat'), icon: 'eye-close' },
    { label: 'divider', icon: '' },
    { label: t('friend.context.set_note'), icon: 'edit' },
    { label: t('friend.context.set_display_name'), icon: 'tag' },
    { label: 'divider', icon: '' },
    { label: t('friend.context.set_favorite'), icon: 'star' },
    { label: t('friend.context.set_normal'), icon: 'user' },
    { label: t('friend.context.set_blocked'), icon: 'block' },
    { label: 'divider', icon: '' },
    { label: t('friend.context.remove'), icon: 'delete' }
  ]
  return items
})

const handleContextMenu = (event: MouseEvent, friend: MatrixContact) => {
  event.preventDefault()
  selectedFriend.value = friend
  contextMenuRef.value?.show(event)
}

const handleContextMenuSelect = async (item: { label: string }) => {
  if (!selectedFriend.value) return

  const friend = selectedFriend.value

  switch (item.label) {
    case t('friend.context.send_message'):
      await contactStore.startDirectRoom(friend.userId, false)
      break
    case t('friend.context.encrypted_chat'):
      await contactStore.startDirectRoom(friend.userId, true)
      break
    case t('friend.context.secret_chat'):
      await handleSetSecretFriend(friend)
      break
    case t('friend.context.set_note'):
      await handleSetNote(friend)
      break
    case t('friend.context.set_display_name'):
      await handleSetDisplayName(friend)
      break
    case t('friend.context.set_favorite'):
      await contactStore.setFriendStatus(friend.userId, 'favorite')
      break
    case t('friend.context.set_normal'):
      await contactStore.setFriendStatus(friend.userId, 'accepted')
      break
    case t('friend.context.set_blocked'):
      await contactStore.setFriendStatus(friend.userId, 'blocked')
      break
    case t('friend.context.remove'):
      await contactStore.removeFromContacts(friend.userId)
      break
  }

  selectedFriend.value = null
}

const handleSetSecretFriend = async (friend: MatrixContact) => {
  try {
    await matrixSpecialFriendService.addSpecialFriend(friend.userId)
    window.$message?.success(t('friend.secret_chat.success'))
  } catch (e) {
    window.$message?.error(String(e))
  }
}

const handleSetNote = async (friend: MatrixContact) => {
  window.$dialog?.create({
    title: t('friend.context.set_note'),
    content: () =>
      h('div', { style: 'padding: 8px 0' }, [
        h('input', {
          id: 'friend-note-input',
          value: friend.note ?? friend.remark ?? '',
          placeholder: t('friend.detail.note_placeholder'),
          style:
            'width: 100%; padding: 8px 12px; border: 1px solid var(--hula-border-default); border-radius: 6px; font-size: 14px; outline: none; background: var(--hula-surface-panel); color: inherit;',
          maxlength: 1000
        })
      ]),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const input = document.querySelector('#friend-note-input') as HTMLInputElement
      const note = input?.value?.trim() ?? ''
      if (note) {
        await contactStore.setFriendNote(friend.userId, note)
      }
    }
  })
}

const handleSetDisplayName = async (friend: MatrixContact) => {
  window.$dialog?.create({
    title: t('friend.context.set_display_name'),
    content: () =>
      h('div', { style: 'padding: 8px 0' }, [
        h('input', {
          id: 'friend-displayname-input',
          value: friend.remark ?? friend.displayName ?? '',
          placeholder: t('friend.detail.display_name_placeholder'),
          style:
            'width: 100%; padding: 8px 12px; border: 1px solid var(--hula-border-default); border-radius: 6px; font-size: 14px; outline: none; background: var(--hula-surface-panel); color: inherit;',
          maxlength: 256
        })
      ]),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      const input = document.querySelector('#friend-displayname-input') as HTMLInputElement
      const name = input?.value?.trim() ?? ''
      await contactStore.setFriendDisplayName(friend.userId, name)
    }
  })
}

onMounted(async () => {
  await contactStore.initialize()
})
</script>

<style scoped lang="scss">
.friend-list-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.friend-items {
  padding: 8px;
}

.friend-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &:active {
    background: var(--hula-surface-session-active);
  }
}
</style>
