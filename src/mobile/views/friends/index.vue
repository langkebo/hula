<template>
  <div class="flex flex-col overflow-auto h-full relative">
    <img
      src="@/assets/mobile/chat-home/background.webp"
      class="absolute fixed top-0 left-0 w-full h-full z-0 dark:opacity-20" />
    <!-- 页面蒙板 -->
    <div
      v-if="showMask"
      @touchend="maskHandler.close"
      @click="maskHandler.close"
      class="mobile-mask--blur mobile-mask--blurred fixed inset-0 bg-black/20 z-[999] transition-all duration-3000 ease-in-out opacity-100"></div>

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
            <van-button round plain size="small" :aria-label="t('common.add')">
              <svg class="w-16px h-16px"><use href="#plus"></use></svg>
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
        class="rounded-6px w-full relative text-[length:var(--tjg-font-size-sm)]"
        maxlength="20"
        clearable
        autocomplete="off"
        :spellcheck="false"
        autocorrect="off"
        autocapitalize="off"
        :placeholder="t('mobile_contact.input.search')"
        @update:model-value="onUserSearch">
        <template #left-icon>
          <svg class="w-12px h-12px"><use href="#search"></use></svg>
        </template>
      </van-field>
    </div>

    <!-- 用户搜索结果 -->
    <div v-if="searchKeyword.trim()" class="px-16px mb-12px z-1">
      <div v-if="userSearchLoading" class="flex justify-center py-20px">
        <van-loading size="20px" />
      </div>
      <div v-else-if="userSearchResults.length > 0" class="flex flex-col gap-8px">
        <div
          v-for="result in userSearchResults"
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
            @click="handleAddFriendBySearch(result.userId)">
            {{ t('mobile_contact.button.add') }}
          </van-button>
        </div>
      </div>
      <div
        v-else-if="hasUserSearched"
        class="py-20px text-center text-[length:var(--tjg-font-size-md)] text-[--tjg-text-tertiary]">
        {{ t('mobile_contact.search_no_result') }}
      </div>
    </div>

    <div class="custom-rounded flex-1 bg-[--tjg-glass-row-bg]">
      <!-- 卡片头部 -->
      <div
        class="flex items-center justify-between py-15px px-16px text-[length:var(--tjg-font-size-base)] border-b border-[--tjg-border-default]">
        <span class="font-medium">{{ t('mobile_contact.my_chat') }}</span>
        <div class="flex items-center gap-8px" @click="toMessage">
          <span
            v-if="contactUnreadCount > 0"
            class="px-4px py-4px rounded-999px bg-[--tjg-color-danger-500] text-white text-[length:var(--tjg-font-size-sm)] font-600 min-w-20px text-center">
            {{ contactUnreadCount > 99 ? '99+' : contactUnreadCount }}
          </span>
          <img src="@/assets/mobile/friend/right-arrow.webp" class="block h-20px dark:invert" alt="" />
        </div>
      </div>

      <!-- 选项卡 -->
      <van-tabs v-model:active="activeTab" type="card" class="mt-4px p-[4px_10px_0px_8px]">
        <van-tab :title="t('mobile_contact.tab.contacts')">
          <div
            v-if="isMobileFriendStateLoading"
            class="flex items-center justify-center text-[--tjg-text-secondary] min-h-240px">
            <van-loading size="24px" />
          </div>
          <div
            v-else-if="mobileFriendViewState === 'capability'"
            class="flex items-center justify-center px-16px text-center min-h-240px">
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
          <div
            v-else-if="mobileFriendViewState === 'error'"
            class="flex items-center justify-center px-16px text-center min-h-240px">
            <van-empty :description="mobileFriendErrorMessage">
              <template #image>
                <svg class="size-40px color-[--tjg-text-tertiary]"><use href="#warning"></use></svg>
              </template>
              <template #bottom>
                <div class="mt-8px flex flex-col items-center gap-12px">
                  <div class="text-[length:var(--tjg-font-size-base)] font-600 text-[--tjg-text-primary]">
                    {{ t('common.error') }}
                  </div>
                  <van-button size="small" type="primary" plain @click="handleRetryMobileFriends">
                    {{ t('common.retry') }}
                  </van-button>
                </div>
              </template>
            </van-empty>
          </div>
          <div
            v-else-if="mobileFriendViewState === 'empty'"
            class="flex items-center justify-center px-16px text-center min-h-240px">
            <van-empty :description="t('friend.list.empty')" />
          </div>
          <van-collapse v-else v-model="activeCollapseNames">
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
                <div class="max-h-[calc(100dvh-340px-var(--safe-area-inset-top))] overflow-y-auto">
                  <div>
                    <div
                      v-for="item in specialContacts"
                      :key="item.userId"
                      @click="handleClick(item.userId, RoomTypeEnum.SINGLE)"
                      :class="[
                        { active: activeItem === item.userId },
                        'item-box w-full h-75px mb-5px flex items-center gap-10px'
                      ]">
                      <FriendContactRow
                        :user-id="item.userId"
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
                <div class="max-h-[calc(100dvh-340px-var(--safe-area-inset-top))] overflow-y-auto">
                  <div>
                    <van-swipe-cell v-for="item in normalContacts" :key="item.userId">
                      <div
                        @click="handleClick(item.userId, RoomTypeEnum.SINGLE)"
                        :class="[
                          { active: activeItem === item.userId },
                          'item-box w-full h-75px mb-5px flex items-center gap-10px'
                        ]">
                        <FriendContactRow
                          :user-id="item.userId"
                          :active-status="item.activeStatus"
                          :is-bot="isBotUser(item.userId)"
                          :state="getUserState(item.userId)" />
                      </div>
                      <template #right>
                        <van-button square type="danger" class="h-full" @click="handleDeleteContact(item.userId)">
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
                <div class="max-h-[calc(100dvh-340px-var(--safe-area-inset-top))] overflow-y-auto">
                  <div>
                    <div
                      v-for="item in blockedContacts"
                      :key="item.userId"
                      @click="handleClick(item.userId, RoomTypeEnum.SINGLE)"
                      :class="[
                        { active: activeItem === item.userId },
                        'item-box w-full h-75px mb-5px opacity-60 flex items-center gap-10px'
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
                        <div
                          class="text leading-tight text-[length:var(--tjg-font-size-sm)] text-[--tjg-text-tertiary]">
                          [{{ t('mobile_contact.status.blocked') }}]
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </van-collapse-item>
            </div>
          </van-collapse>
        </van-tab>
        <van-tab :title="t('mobile_contact.tab.group')">
          <van-collapse v-model="activeGroupCollapseNames">
            <van-collapse-item :title="t('mobile_contact.group.title')" name="1">
              <template #value>
                <span class="text-[length:var(--tjg-font-size-xs)] text-[--tjg-text-secondary]">
                  {{ groupChatList.length }}
                </span>
              </template>
              <div class="max-h-[calc(100dvh-340px-var(--safe-area-inset-top))] overflow-y-auto">
                <div
                  @click="handleClick(item.roomId, RoomTypeEnum.GROUP)"
                  :class="[{ active: activeItem === item.roomId }, 'item-box w-full h-75px mb-5px']"
                  v-for="item in groupChatList"
                  :key="item.roomId">
                  <div class="flex items-center gap-10px h-75px pl-6px pr-8px flex-1 truncate">
                    <img
                      class="size-44px rounded-full object-cover border-(1px solid var(--avatar-border-color))"
                      :src="AvatarUtils.getAvatarUrl(item.avatar, 96)"
                      :alt="t('mobile_contact.avatar.group')"
                      @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                    <span class="text-[length:var(--tjg-font-size-base)] leading-tight flex-1 truncate">
                      {{ item.remark || item.groupName }}
                    </span>
                  </div>
                </div>
              </div>
            </van-collapse-item>
          </van-collapse>
        </van-tab>
      </van-tabs>
    </div>
  </div>
</template>

<style scoped>
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
</style>

<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { showConfirmDialog, showFailToast, showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import NavBar from '#/layout/navBar/index.vue'
import { resolveFriendListViewState } from '@/components/friend/friendListViewState'
import { useMessage } from '@/composables/chat/useMessage'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { useFriends } from '@/composables/useFriends'
import { MittEnum, RoomTypeEnum } from '@/enums'
import FriendContactRow from '@/mobile/components/friend/FriendContactRow.vue'
import router from '@/router'
import { matrixFriendOperations, userDirectoryService } from '@/services/matrix'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

interface UserSearchResult {
  userId: string
  avatarUrl?: string | undefined
  displayName?: string | undefined
}

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const logger = createLogger('FriendsIndex')
const timerManager = useTimerManager()

const showAddPopover = ref(false)
const addActions = [
  { text: t('menu.start_group_chat'), value: '/mobile/mobileFriends/startGroupChat' },
  { text: t('menu.add_contact'), value: '/mobile/mobileFriends/addFriends' }
]

const onAddActionSelect = (action: { text: string; value: string }) => {
  router.push(action.value)
  maskHandler.close()
}

const activeTab = ref(0)
const activeCollapseNames = ref(['special', 'normal'])
const activeGroupCollapseNames = ref(['1'])

// User search state
const searchKeyword = ref('')
const userSearchResults = ref<UserSearchResult[]>([])
const userSearchLoading = ref(false)
const hasUserSearched = ref(false)
const addingFriend = ref<string | null>(null)

const detailsShow = ref(false)
const shrinkStatus = ref(false)
const groupStore = useGroupStore()
const contactStore = useContactStore()
const chatStore = useChatStore()
const {
  groupChatList,
  specialContacts,
  specialOnlineCount,
  blockedContacts,
  normalContacts,
  normalOnlineCount,
  contactUnreadCount,
  selectedItem: activeItem,
  isBotUser,
  getUserState,
  setSelectedItem,
  clearSelectedItem,
  loading: friendsLoading,
  initialLoading: friendsInitialLoading
} = useFriends()

const { isLoaded: capabilityLoaded, canUseFriendList } = useServerCapability()

const mobileFriendErrorMessage = ref('')

const isMobileFriendStateLoading = computed(() => friendsInitialLoading.value || friendsLoading.value)

const mobileFriendViewState = computed(() =>
  resolveFriendListViewState({
    isCapabilityReady: capabilityLoaded.value,
    canUseFriendList: canUseFriendList.value,
    hasError: Boolean(mobileFriendErrorMessage.value),
    hasFriends: specialContacts.value.length > 0 || normalContacts.value.length > 0
  })
)

const handleRetryMobileFriends = async () => {
  mobileFriendErrorMessage.value = ''
  try {
    await contactStore.getContactList(true)
  } catch (error) {
    mobileFriendErrorMessage.value = error instanceof Error ? error.message : t('common.error')
  }
}

const toMessage = async () => {
  try {
    await Promise.all([contactStore.getApplyPage('friend', true, true), contactStore.getApplyPage('group', true, true)])
    await contactStore.getApplyUnReadCount()
  } catch (error) {
    logger.error('Failed to refresh notifications and mark as read', error)
    showFeedback(t('mobile_contact.refresh_notification_failed'), 'error')
  } finally {
    router.push('/mobile/mobileMy/myMessages')
  }
}

const { preloadChatRoom } = useMessage()

const handleClick = async (id: string, type: number) => {
  detailsShow.value = true
  setSelectedItem(id)
  const data = {
    context: {
      type: type,
      uid: id
    },
    detailsShow: detailsShow.value
  }
  useMitt.emit(MittEnum.DETAILS_SHOW, data)

  if (type === 1) {
    try {
      // 好友列表给的是**对端 uid**，先查它对应的 DM 房间号；
      // 查不到（尚未建过会话）时退回按 uid 深链，由聊天页反查兜底。
      const dmRoomId = chatStore.sessionList.find((item) => item.detailId === id || item.account === id)?.roomId
      if (dmRoomId) {
        await preloadChatRoom(dmRoomId)
        router.push({ name: 'mobileChatMain', params: { roomId: dmRoomId } })
      } else {
        router.push({ name: 'mobileChatMain', params: { roomId: id } })
      }
    } catch (error) {
      logger.error(String(error))
    }
  } else {
    router.push(`/mobile/mobileFriends/friendInfo/${id}`)
  }
}

// Debounced user search
const onUserSearch = useDebounceFn(async (value: string) => {
  if (!value?.trim()) {
    userSearchResults.value = []
    hasUserSearched.value = false
    return
  }

  userSearchLoading.value = true
  hasUserSearched.value = true
  try {
    const results = await userDirectoryService.searchUsers(value.trim(), 20)
    userSearchResults.value = results
  } catch (e) {
    logger.error('User search failed:', e)
    showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_contact.search_failed'))
    userSearchResults.value = []
  } finally {
    userSearchLoading.value = false
  }
}, 400)

// Add friend from search results
async function handleAddFriendBySearch(userId: string) {
  addingFriend.value = userId
  try {
    await matrixFriendOperations.sendFriendRequest(userId)
    showToast({ type: 'success', message: t('mobile_contact.add_friend_success') })
  } catch (e) {
    logger.error('Send friend request failed:', e)
    showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_contact.add_friend_failed'))
  } finally {
    addingFriend.value = null
  }
}

// Delete contact with confirmation
async function handleDeleteContact(uid: string) {
  try {
    await showConfirmDialog({
      title: t('mobile_contact.delete_friend_title'),
      message: t('mobile_contact.delete_friend_confirm')
    })
    showToast({ type: 'loading', message: t('mobile_contact.deleting'), forbidClick: true })
    await matrixFriendOperations.removeFriend(uid)
    showToast({ type: 'success', message: t('mobile_contact.delete_friend_success') })
    await contactStore.getContactList(true)
  } catch (e) {
    if (String(e) !== 'cancel') {
      logger.error('Delete friend failed:', e)
      showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_contact.delete_friend_failed'))
    }
  }
}

onMounted(async () => {
  useMitt.on(MittEnum.SHRINK_WINDOW, async (event) => {
    shrinkStatus.value = event as boolean
  })
  try {
    await contactStore.getContactList(true)
    await contactStore.getApplyPage('friend', false)
  } catch (error) {
    logger.debug('Failed to request friend request list')
  }
})

onUnmounted(() => {
  detailsShow.value = false
  clearSelectedItem()
  useMitt.emit(MittEnum.DETAILS_SHOW, detailsShow.value)
})

const showMask = ref(false)
let scrollY = 0

const maskHandler = {
  open: () => {
    scrollY = window.scrollY
    showMask.value = true
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
  },
  close: () => {
    timerManager.setTimeout(() => {
      showMask.value = false
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }, 200)
  }
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

/* 遮罩模糊：显式双声明（UnoCSS 工具类不产 -webkit- 前缀，旧 WebView 会丢），值同 blur-sm = 4px */
.mobile-mask--blurred {
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

/* 低性能设备关闭遮罩模糊，保留正常态的 bg-black/20 */
.mobile-mask--blur {
  @include backdrop-blur-fallback;
}
</style>
