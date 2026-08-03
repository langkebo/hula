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
      class="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999] transition-all duration-3000 ease-in-out opacity-100"></div>

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
            <van-button round plain size="small">
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
        class="rounded-6px w-full relative text-12px"
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
          class="flex items-center gap-10px p-10px rounded-10px bg-[--hula-surface-panel]">
          <img
            class="size-40px rounded-full object-cover"
            :src="AvatarUtils.getAvatarUrl(result.avatarUrl || '')"
            alt="头像"
            @error="($event.target as HTMLImageElement).src = '/logo.png'" />
          <div class="flex-1 min-w-0">
            <div class="text-14px font-medium truncate text-[--hula-text-primary]">
              {{ result.displayName || result.userId }}
            </div>
            <div class="text-12px text-[--hula-text-tertiary] truncate">
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
      <div v-else-if="hasUserSearched" class="py-20px text-center text-13px text-[--hula-text-tertiary]">
        {{ t('mobile_contact.search_no_result') }}
      </div>
    </div>

    <div class="custom-rounded flex-1 bg-[--hula-surface-panel]">
      <!-- 卡片头部 -->
      <div class="flex items-center justify-between py-15px px-16px text-14px border-b border-[--hula-border-default]">
        <span class="font-medium">{{ t('mobile_contact.my_chat') }}</span>
        <div class="flex items-center gap-8px" @click="toMessage">
          <span
            v-if="contactUnreadCount > 0"
            class="px-4px py-4px rounded-999px bg-[--color-danger] text-white text-12px font-600 min-w-20px text-center">
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
            class="flex items-center justify-center text-[--hula-text-secondary]"
            style="min-height: 240px">
            <van-loading size="24px" />
          </div>
          <div
            v-else-if="mobileFriendViewState === 'capability'"
            class="flex items-center justify-center px-16px text-center"
            style="min-height: 240px">
            <van-empty :description="t('friend.list.capability_unavailable_description')">
              <template #image>
                <svg class="size-40px color-[--hula-text-tertiary]"><use href="#friends"></use></svg>
              </template>
              <template #bottom>
                <div class="mt-8px text-14px font-600 text-[--hula-text-primary]">
                  {{ t('friend.list.capability_unavailable_title') }}
                </div>
              </template>
            </van-empty>
          </div>
          <div
            v-else-if="mobileFriendViewState === 'error'"
            class="flex items-center justify-center px-16px text-center"
            style="min-height: 240px">
            <van-empty :description="mobileFriendErrorMessage">
              <template #image>
                <svg class="size-40px color-[--hula-text-tertiary]"><use href="#warning"></use></svg>
              </template>
              <template #bottom>
                <div class="mt-8px flex flex-col items-center gap-12px">
                  <div class="text-14px font-600 text-[--hula-text-primary]">
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
            class="flex items-center justify-center px-16px text-center"
            style="min-height: 240px">
            <van-empty :description="t('friend.list.empty')" />
          </div>
          <van-collapse v-else v-model="activeCollapseNames">
            <ContextMenu @contextmenu="showMenu($event)" @select="handleSelect($event.label)" :menu="menuList">
              <!-- 特殊关心分组 -->
              <van-collapse-item v-if="specialContacts.length > 0" name="special">
                <template #title>
                  <div class="flex items-center gap-8px">
                    <svg class="size-14px color-[--color-warning]"><use href="#star-fill"></use></svg>
                    <span>{{ t('mobile_contact.group.special') || '特别关心' }}</span>
                  </div>
                </template>
                <template #value>
                  <span class="text-(10px [--hula-text-secondary])">
                    {{ specialOnlineCount }}/{{ specialContacts.length }}
                  </span>
                </template>
                <div style="max-height: calc(100vh - (340px + var(--safe-area-inset-top))); overflow-y: auto">
                  <div @contextmenu.stop="$event.preventDefault()">
                    <div
                      v-for="item in specialContacts"
                      :key="item.uid"
                      @click="handleClick(item.uid, RoomTypeEnum.SINGLE)"
                      :class="{ active: activeItem === item.uid }"
                      class="item-box w-full h-75px mb-5px flex items-center gap-10px">
                      <img
                        class="size-44px rounded-full object-cover grayscale"
                        :class="{ 'grayscale-0': item.activeStatus === OnlineEnum.ONLINE || isBotUser(item.uid) }"
                        style="border: 1px solid var(--avatar-border-color)"
                        :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)?.avatar!)"
                        alt="用户头像"
                        @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                      <div class="flex flex-col justify-between h-fit flex-1 truncate">
                        <span class="text-14px leading-tight flex-1 truncate">
                          {{ groupStore.getUserInfo(item.uid)?.name }}
                        </span>
                        <div class="text leading-tight text-12px flex-y-center gap-4px flex-1 truncate">
                          [
                          <template v-if="isBotUser(item.uid)">{{ t('mobile_contact.bot_tag') || '助手' }}</template>
                          <template v-else-if="getUserState(item.uid)">
                            <img
                              class="size-12px rounded-50%"
                              :src="getUserState(item.uid)?.url"
                              :alt="translateStateTitle(getUserState(item.uid)?.title)" />
                            {{ translateStateTitle(getUserState(item.uid)?.title) }}
                          </template>
                          <template v-else>
                            <span
                              class="inline-block size-8px rounded-full"
                              :style="{
                                backgroundColor:
                                  item.activeStatus === OnlineEnum.ONLINE
                                    ? 'var(--color-online)'
                                    : 'var(--color-offline)'
                              }"></span>
                            {{
                              item.activeStatus === OnlineEnum.ONLINE
                                ? t('mobile_contact.status.online') || '在线'
                                : t('mobile_contact.status.offline') || '离线'
                            }}
                          </template>
                          ]
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </van-collapse-item>

              <!-- 普通好友分组 -->
              <van-collapse-item name="normal">
                <template #title>
                  <div class="flex items-center gap-8px">
                    <svg class="size-14px color-[--hula-text-secondary]"><use href="#friends"></use></svg>
                    <span>{{ t('mobile_contact.group.normal') || '我的好友' }}</span>
                  </div>
                </template>
                <template #value>
                  <span class="text-(10px [--hula-text-secondary])">
                    {{ normalOnlineCount }}/{{ normalContacts.length }}
                  </span>
                </template>
                <div style="max-height: calc(100vh - (340px + var(--safe-area-inset-top))); overflow-y: auto">
                  <div @contextmenu.stop="$event.preventDefault()">
                    <van-swipe-cell v-for="item in normalContacts" :key="item.uid">
                      <div
                        @click="handleClick(item.uid, RoomTypeEnum.SINGLE)"
                        :class="{ active: activeItem === item.uid }"
                        class="item-box w-full h-75px mb-5px flex items-center gap-10px">
                        <img
                          class="size-44px rounded-full object-cover grayscale"
                          :class="{ 'grayscale-0': item.activeStatus === OnlineEnum.ONLINE || isBotUser(item.uid) }"
                          style="border: 1px solid var(--avatar-border-color)"
                          :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)?.avatar!)"
                          alt="用户头像"
                          @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                        <div class="flex flex-col justify-between h-fit flex-1 truncate">
                          <span class="text-14px leading-tight flex-1 truncate">
                            {{ groupStore.getUserInfo(item.uid)?.name }}
                          </span>
                          <div class="text leading-tight text-12px flex-y-center gap-4px flex-1 truncate">
                            [
                            <template v-if="isBotUser(item.uid)">{{ t('mobile_contact.bot_tag') || '助手' }}</template>
                            <template v-else-if="getUserState(item.uid)">
                              <img
                                class="size-12px rounded-50%"
                                :src="getUserState(item.uid)?.url"
                                :alt="translateStateTitle(getUserState(item.uid)?.title)" />
                              {{ translateStateTitle(getUserState(item.uid)?.title) }}
                            </template>
                            <template v-else>
                              <span
                                class="inline-block size-8px rounded-full"
                                :style="{
                                  backgroundColor:
                                    item.activeStatus === OnlineEnum.ONLINE
                                      ? 'var(--color-online)'
                                      : 'var(--color-offline)'
                                }"></span>
                              {{
                                item.activeStatus === OnlineEnum.ONLINE
                                  ? t('mobile_contact.status.online') || '在线'
                                  : t('mobile_contact.status.offline') || '离线'
                              }}
                            </template>
                            ]
                          </div>
                        </div>
                      </div>
                      <template #right>
                        <van-button square type="danger" class="h-full" @click="handleDeleteContact(item.uid)">
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
                    <svg class="size-14px color-[--color-text-quaternary]"><use href="#forbidden"></use></svg>
                    <span>{{ t('mobile_contact.group.blocked') || '已屏蔽' }}</span>
                  </div>
                </template>
                <template #value>
                  <span class="text-(10px [--hula-text-secondary])">{{ blockedContacts.length }}</span>
                </template>
                <div style="max-height: calc(100vh - (340px + var(--safe-area-inset-top))); overflow-y: auto">
                  <div @contextmenu.stop="$event.preventDefault()">
                    <div
                      v-for="item in blockedContacts"
                      :key="item.uid"
                      @click="handleClick(item.uid, RoomTypeEnum.SINGLE)"
                      :class="{ active: activeItem === item.uid }"
                      class="item-box w-full h-75px mb-5px opacity-60 flex items-center gap-10px">
                      <img
                        class="size-44px rounded-full object-cover grayscale"
                        style="border: 1px solid var(--avatar-border-color)"
                        :src="AvatarUtils.getAvatarUrl(groupStore.getUserInfo(item.uid)?.avatar!)"
                        alt="用户头像"
                        @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                      <div class="flex flex-col justify-between h-fit flex-1 truncate">
                        <span class="text-14px leading-tight flex-1 truncate">
                          {{ groupStore.getUserInfo(item.uid)?.name }}
                        </span>
                        <div class="text leading-tight text-12px text-[--hula-text-tertiary]">
                          [{{ t('mobile_contact.status.blocked') || '已屏蔽' }}]
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </van-collapse-item>
            </ContextMenu>
          </van-collapse>
        </van-tab>
        <van-tab :title="t('mobile_contact.tab.group')">
          <van-collapse v-model="activeGroupCollapseNames">
            <van-collapse-item :title="t('mobile_contact.group.title')" name="1">
              <template #value>
                <span class="text-(10px [--hula-text-secondary])">{{ groupChatList.length }}</span>
              </template>
              <div style="max-height: calc(100vh - (340px + var(--safe-area-inset-top))); overflow-y: auto">
                <div
                  @click="handleClick(item.roomId, RoomTypeEnum.GROUP)"
                  :class="{ active: activeItem === item.roomId }"
                  class="item-box w-full h-75px mb-5px"
                  v-for="item in groupChatList"
                  :key="item.roomId">
                  <div class="flex items-center gap-10px h-75px pl-6px pr-8px flex-1 truncate">
                    <img
                      class="size-44px rounded-full object-cover"
                      style="border: 1px solid var(--avatar-border-color)"
                      :src="AvatarUtils.getAvatarUrl(item.avatar)"
                      alt="群头像"
                      @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                    <span class="text-14px leading-tight flex-1 truncate">{{ item.remark || item.groupName }}</span>
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
  border-top-left-radius: var(--hula-radius-2xl);
  border-top-right-radius: var(--hula-radius-2xl);
  overflow: hidden;
}

:deep(.van-cell.van-field) {
  padding: 8px 12px;
  border-radius: var(--hula-radius-sm);
  background: var(--hula-surface-search-dark);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

:deep(.van-collapse-item__content) {
  padding: 0;
}

:deep(.van-tabs__nav--card) {
  border-radius: var(--hula-radius-sm);
  overflow: hidden;
  background: var(--hula-surface-search-dark);
  border: 1px solid var(--hula-border-contrast);
}\n
:deep(.van-tab--active) {
  background: var(--hula-accent-soft);
  color: var(--hula-color-primary-500);
}

/* TJG Mobile Friend Item Styles */
.item-box {
  padding: 9px 16px;
  border-radius: var(--hula-radius-sm);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.item-box:active {
  background: var(--hula-surface-dark-hover);
}

.item-box.active {
  background: var(--hula-accent-active);
}

/* Avatar with online indicator */
.friend-avatar-wrapper {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.friend-avatar-wrapper.is-online::after {
  content: '';
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--hula-status-online);
  border: 1.5px solid var(--hula-surface-deepest);
}

/* Status dot for inline indicators */
.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.online {
  background: var(--hula-status-online);
}

.status-dot.offline {
  background: var(--hula-status-offline);
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
import { MittEnum, OnlineEnum, RoomTypeEnum } from '@/enums'
import router from '@/router'
import { matrixFriendService, userDirectoryService } from '@/services/matrix'
import { useServerCapability } from '@/services/matrix/MatrixCapabilityService'
import { useContactStore } from '@/stores/domains/chat/contacts'
import { useGroupStore } from '@/stores/domains/chat/group'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

interface UserSearchResult {
  userId: string
  avatarUrl?: string
  displayName?: string
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

const menuList = ref([
  { label: t('mobile_contact.menu.add_group'), icon: 'plus' },
  { label: t('mobile_contact.menu.rename_group'), icon: 'edit' },
  { label: t('mobile_contact.menu.delete_group'), icon: 'delete' }
])

const detailsShow = ref(false)
const shrinkStatus = ref(false)
const groupStore = useGroupStore()
const contactStore = useContactStore()
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
    logger.error('刷新通知并标记已读失败', error)
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
      await preloadChatRoom(id)
      router.push(`/mobile/chatRoom/chatMain`)
    } catch (error) {
      logger.error(String(error))
    }
  } else {
    router.push(`/mobile/mobileFriends/friendInfo/${id}`)
  }
}

const showMenu = (_event: MouseEvent) => {}

const handleSelect = (_event: MouseEvent) => {}

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
    await matrixFriendService.sendFriendRequest(userId)
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
    await matrixFriendService.removeFriend(uid)
    showToast({ type: 'success', message: t('mobile_contact.delete_friend_success') })
    await contactStore.getContactList(true)
  } catch (e) {
    if (String(e) !== 'cancel') {
      logger.error('Delete friend failed:', e)
      showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_contact.delete_friend_failed'))
    }
  }
}

const translateStateTitle = (title?: string) => {
  if (!title) return ''
  const key = `auth.onlineStatus.states.${title}`
  const translated = t(key)
  return translated === key ? title : translated
}

onMounted(async () => {
  useMitt.on(MittEnum.SHRINK_WINDOW, async (event) => {
    shrinkStatus.value = event as boolean
  })
  try {
    await contactStore.getContactList(true)
    await contactStore.getApplyPage('friend', false)
  } catch (error) {
    logger.debug('请求好友申请列表失败')
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
