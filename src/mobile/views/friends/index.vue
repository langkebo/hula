<template>
  <div class="friends-page flex flex-col overflow-auto h-full relative">
    <img
      src="@/assets/mobile/chat-home/background.webp"
      alt=""
      class="fixed inset-0 w-full h-full z-0 object-cover dark:opacity-20" />
    <!-- 页面蒙板 -->
    <div
      v-if="showMask"
      @touchend="maskHandler.close"
      @click="maskHandler.close"
      class="mobile-mask--blur mobile-mask--blurred fixed inset-0 bg-black/20 z-[999] transition-[width,transform,opacity,color,background-color,border-color,box-shadow] duration-300 ease-in-out opacity-100"></div>

    <!-- 导航条 -->
    <NavBar>
      <template #center>
        <span>{{ t('mobile_contact.title') }}</span>
      </template>
      <template #right>
        <van-popover
          v-model:show="showAddPopover"
          :actions="addActions"
          @select="onAddActionSelect"
          placement="bottom-end">
          <template #reference>
            <van-button
              round
              plain
              size="small"
              class="relative after:absolute after:-inset-6px after:content-['']"
              :aria-label="t('common.add')">
              <svg class="w-16px h-16px" aria-hidden="true"><use href="#plus"></use></svg>
            </van-button>
          </template>
        </van-popover>
      </template>
    </NavBar>

    <!-- 输入框 -->
    <div class="px-16px mt-2 mb-12px z-1">
      <van-field
        v-model="searchKeyword"
        id="search"
        class="rounded-[var(--tjg-radius-md)] w-full relative text-[length:var(--tjg-font-size-sm)]"
        maxlength="20"
        clearable
        autocomplete="off"
        :spellcheck="false"
        autocorrect="off"
        autocapitalize="off"
        :placeholder="t('mobile_contact.input.search')"
        @update:model-value="onUserSearch">
        <template #left-icon>
          <svg class="w-12px h-12px" aria-hidden="true"><use href="#search"></use></svg>
        </template>
      </van-field>
    </div>

    <!-- 用户搜索结果 -->
    <FriendUserSearchResults
      v-if="searchKeyword.trim()"
      :results="userSearchResults"
      :loading="userSearchLoading"
      :has-searched="hasUserSearched"
      :adding-friend="addingFriend"
      @add="handleAddFriendBySearch" />

    <div class="custom-rounded flex-1 bg-[--tjg-glass-row-bg]">
      <!-- 卡片头部 -->
      <div
        class="flex items-center justify-between py-15px px-16px text-[length:var(--tjg-font-size-base)] border-b border-[--tjg-border-default]">
        <span class="font-medium">{{ t('mobile_contact.my_chat') }}</span>
        <div v-clickable class="flex items-center gap-8px" @click="toMessage">
          <span
            v-if="contactUnreadCount > 0"
            class="px-4px py-4px rounded-999px bg-[--tjg-danger-solid-bg] text-white text-[length:var(--tjg-font-size-sm)] font-600 min-w-20px text-center">
            {{ contactUnreadCount > 99 ? '99+' : contactUnreadCount }}
          </span>
          <img src="@/assets/mobile/friend/right-arrow.webp" class="block h-20px dark:invert" alt="" />
        </div>
      </div>

      <!-- 选项卡 -->
      <van-tabs v-model:active="activeTab" type="card" class="mt-4px p-[4px_10px_0px_8px]">
        <van-tab :title="t('mobile_contact.tab.contacts')">
          <FriendContactsTab
            v-model:keyword="localKeyword"
            v-model:refreshing="refreshing"
            v-model:active-collapse-names="activeCollapseNames"
            :is-initial-loading="isMobileFriendStateLoading"
            :view-state="mobileFriendViewState"
            :error-message="mobileFriendErrorMessage"
            :is-local-search-empty="isLocalSearchEmpty"
            :special-contacts="filteredSpecialContacts"
            :normal-contacts="filteredNormalContacts"
            :blocked-contacts="filteredBlockedContacts"
            :special-online-count="filteredSpecialOnlineCount"
            :normal-online-count="filteredNormalOnlineCount"
            :active-id="activeItem"
            :is-bot-user="isBotUser"
            :get-user-state="getUserState"
            @refresh="handlePullRefresh"
            @retry="handleRetryMobileFriends"
            @add-friend="router.push('/mobile/mobileFriends/addFriends')"
            @select="onSelectContact"
            @delete-contact="handleDeleteContact" />
        </van-tab>
        <van-tab :title="t('mobile_contact.tab.group')">
          <FriendGroupChatTab
            v-model:active-collapse-names="activeGroupCollapseNames"
            :group-chat-list="groupChatList"
            :active-id="activeItem"
            @select="onSelectGroup" />
        </van-tab>
      </van-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useFriendListLoadState } from '#/composables/friends/useFriendListLoadState'
import { useFriendMask } from '#/composables/friends/useFriendMask'
import { useFriendNavigation } from '#/composables/friends/useFriendNavigation'
import { useFriendsLocalSearch } from '#/composables/friends/useFriendsLocalSearch'
import { useFriendUserSearch } from '#/composables/friends/useFriendUserSearch'
import NavBar from '#/layout/navBar/index.vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, RoomTypeEnum } from '@/enums'
import FriendContactsTab from '@/mobile/components/friends/FriendContactsTab.vue'
import FriendGroupChatTab from '@/mobile/components/friends/FriendGroupChatTab.vue'
import FriendUserSearchResults from '@/mobile/components/friends/FriendUserSearchResults.vue'
import router from '@/router'

const { t } = useI18n()

const showAddPopover = ref(false)
const addActions = [
  { text: t('menu.start_group_chat'), value: '/mobile/mobileFriends/startGroupChat' },
  { text: t('menu.add_contact'), value: '/mobile/mobileFriends/addFriends' }
]

const { showMask, maskHandler } = useFriendMask()

const onAddActionSelect = (action: { text: string; value: string }) => {
  router.push(action.value)
  maskHandler.close()
}

const activeTab = ref(0)
const activeCollapseNames = ref(['special', 'normal'])
const activeGroupCollapseNames = ref(['1'])

const {
  groupChatList,
  specialContacts,
  normalContacts,
  blockedContacts,
  contactUnreadCount,
  activeItem,
  isBotUser,
  getUserState,
  setSelectedItem,
  clearSelectedItem,
  refreshing,
  mobileFriendErrorMessage,
  isMobileFriendStateLoading,
  mobileFriendViewState,
  handlePullRefresh,
  handleRetryMobileFriends,
  initializePage
} = useFriendListLoadState()

const {
  localKeyword,
  filteredSpecialContacts,
  filteredNormalContacts,
  filteredBlockedContacts,
  filteredSpecialOnlineCount,
  filteredNormalOnlineCount,
  isLocalSearchEmpty
} = useFriendsLocalSearch({ specialContacts, normalContacts, blockedContacts })

const {
  searchKeyword,
  userSearchResults,
  userSearchLoading,
  hasUserSearched,
  addingFriend,
  onUserSearch,
  handleAddFriendBySearch
} = useFriendUserSearch()

const { detailsShow, toMessage, handleClick, handleDeleteContact } = useFriendNavigation({ setSelectedItem })

const onSelectContact = (userId: string) => handleClick(userId, RoomTypeEnum.SINGLE)
const onSelectGroup = (roomId: string) => handleClick(roomId, RoomTypeEnum.GROUP)

const shrinkStatus = ref(false)

onMounted(() => {
  useMitt.on(MittEnum.SHRINK_WINDOW, async (event) => {
    shrinkStatus.value = event as boolean
  })
  void initializePage()
})

onUnmounted(() => {
  detailsShow.value = false
  clearSelectedItem()
  useMitt.emit(MittEnum.DETAILS_SHOW, detailsShow.value)
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

.custom-rounded {
  border-top-left-radius: var(--tjg-radius-2xl);
  border-top-right-radius: var(--tjg-radius-2xl);
  overflow: hidden;
}

:deep(.van-cell.van-field) {
  padding: 8px 12px;
  border-radius: var(--tjg-radius-md);
  background: var(--tjg-glass-input-bg);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

:deep(.van-collapse-item__content) {
  padding: 0;
}

:deep(.van-tabs__nav--card) {
  border-radius: 8px;
  overflow: hidden;
}

.friends-page {
  --friends-list-max-height: calc(100dvh - 340px - var(--safe-area-inset-top));
  --friends-item-height: 75px;
}

/* 遮罩模糊：走统一 mixin 输出双声明（UnoCSS 工具类不产 -webkit- 前缀，旧 WebView 会丢），值同 blur-sm = 4px */
.mobile-mask--blurred {
  @include backdrop-filter-pair('blur(4px)');
}

/* 低性能设备关闭遮罩模糊，保留正常态的 bg-black/20 */
.mobile-mask--blur {
  @include backdrop-blur-fallback;
}
</style>
