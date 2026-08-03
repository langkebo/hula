<template>
  <div class="mobile">
    <!-- iOS Status Bar -->
    <div class="ios-statusbar">
      <span>9:41</span>
      <div class="dynamic-island"></div>
      <div class="statusbar-right">
        <span>5G</span>
        <span>100%</span>
      </div>
    </div>

    <!-- Mobile Header -->
    <div class="m-header">
      <div class="m-header-row">
        <h1 class="m-title">消息</h1>
        <div class="m-header-actions">
          <div class="icon-btn" @click="handleNewChat">
            <svg class="w-20px h-20px"><use href="#i-plus" /></svg>
          </div>
        </div>
      </div>
      <div class="m-search" @click="focusSearch">
        <svg class="w-16px h-16px"><use href="#i-search" /></svg>
        <span>{{ t('mobile_home.input.search') }}</span>
      </div>
    </div>

    <!-- Mobile Content -->
    <div class="m-content">
      <van-pull-refresh :pull-distance="100" :disabled="!isEnablePullRefresh" v-model="loading" @refresh="onRefresh">
        <SmartVirtualList
          class="mobile-session-list"
          :items="filteredSessionList"
          :item-height="72"
          :buffer="6"
          key-field="roomId"
          @scroll="onScroll">
          <template #default="{ item }">
            <van-swipe-cell
              @open="handleSwipeOpen"
              @close="handleSwipeClose"
              v-on-long-press="[(e: PointerEvent) => handleLongPress(e, item), longPressOption]">
              <div class="m-room-item" :class="{ swiped: swipedRoom === item.roomId }" @click="intoRoom(item)">
                <div class="m-room-avatar">
                  <img
                    v-if="item.avatar"
                    :src="AvatarUtils.getAvatarUrl(item.avatar)"
                    @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                  <span v-else>{{ item.name?.charAt(0) || '?' }}</span>
                  <div v-if="item.isAtMe" class="at-badge">@</div>
                </div>
                <div class="m-room-info">
                  <div class="m-room-top">
                    <div class="m-room-name">
                      {{ item.name }}
                      <span v-if="item.hotFlag === IsAllUserEnum.Yes" class="encrypted-tag">
                        <svg class="w-12px h-12px"><use href="#i-auth" /></svg>
                      </span>
                    </div>
                    <div class="m-room-time">{{ formatTimestamp(item.activeTime) }}</div>
                  </div>
                  <div class="m-room-bottom">
                    <div class="m-room-preview">{{ item.lastMsg }}</div>
                    <div v-if="item.unreadCount > 0" class="m-room-badge">
                      {{ item.unreadCount > 99 ? '99+' : item.unreadCount }}
                    </div>
                  </div>
                </div>
              </div>
              <template #right>
                <div class="m-room-actions">
                  <div class="m-action-btn pin" @click="handleToggleTop(item)">
                    {{ item.top ? t('mobile_home.chat.unpin') : t('mobile_home.chat.pintop') }}
                  </div>
                  <div class="m-action-btn delete" @click="handleDelete(item)">
                    {{ t('mobile_home.chat.delete') }}
                  </div>
                </div>
              </template>
            </van-swipe-cell>
          </template>
        </SmartVirtualList>
      </van-pull-refresh>
    </div>

    <!-- Mobile Tab Bar -->
    <div class="m-tabbar">
      <div
        v-for="tab in tabs"
        :key="tab.key"
        class="m-tab"
        :class="{ active: activeTab === tab.key }"
        @click="onTabClick(tab)">
        <div class="m-tab-icon">
          <svg class="w-24px h-24px"><use :href="tab.icon" /></svg>
          <span v-if="tab.badge" class="m-tab-badge">{{ tab.badge }}</span>
        </div>
        <span>{{ tab.label }}</span>
      </div>
    </div>

    <!-- Home Indicator -->
    <div class="home-indicator"></div>

    <!-- Page Mask -->
    <div
      v-if="showMask"
      @touchend="maskHandler.close"
      @mouseup="maskHandler.close"
      :class="[
        longPressState.longPressActive
          ? ''
          : 'bg-black/20 backdrop-blur-sm transition-all duration-3000 ease-in-out opacity-100'
      ]"
      class="fixed inset-0 z-[999]"></div>

    <!-- Long Press Menu -->
    <teleport to="body">
      <div
        v-if="longPressState.showLongPressMenu"
        :style="{ top: longPressState.longPressMenuTop + 'px' }"
        class="fixed gap-10px z-999 left-1/2 transform -translate-x-1/2">
        <div
          class="flex justify-between p-18px text-16px gap-22px rounded-16px bg-[--bg-long-press-menu] whitespace-nowrap">
          <div class="text-white" @click="handleDelete(currentLongPressItem)">{{ t('mobile_home.menu.delete') }}</div>
          <div class="text-white" @click="handleToggleTop(currentLongPressItem)">
            {{ currentLongPressItem?.top ? t('mobile_home.menu.unpin') : t('mobile_home.menu.pintop') }}
          </div>
          <div class="text-white" @click="handleToggleReadStatus((currentLongPressItem?.unreadCount ?? 0) > 0)">
            {{
              (currentLongPressItem?.unreadCount ?? 0) > 0 ? t('mobile_home.menu.read') : t('mobile_home.menu.unread')
            }}
          </div>
        </div>
        <div class="flex w-full justify-center h-15px">
          <svg width="34" height="13" viewBox="0 0 35 13">
            <path d="M0 0 L35 0 L17.5 13 Z" fill="var(--bg-long-press-menu)" />
          </svg>
        </div>
      </div>
    </teleport>

    <!-- New Chat Dialog -->
    <van-dialog
      v-model:show="showNewChatDialog"
      :title="t('mobile_home.new_chat_title')"
      show-cancel-button
      :confirm-button-text="t('common.confirm')"
      :cancel-button-text="t('common.cancel')"
      :before-close="beforeCloseNewChat">
      <van-field
        v-model="newChatUserId"
        :placeholder="t('mobile_home.user_id_placeholder')"
        class="mx-16px my-12px rounded-8px" />
    </van-dialog>

    <!-- Create Group Chat Dialog -->
    <van-dialog
      v-model:show="showCreateGroupDialog"
      :title="t('mobile_home.create_group_title')"
      show-cancel-button
      :confirm-button-text="t('common.confirm')"
      :cancel-button-text="t('common.cancel')"
      :before-close="beforeCloseCreateGroup">
      <van-field
        v-model="createGroupName"
        :placeholder="t('mobile_home.group_name_placeholder')"
        class="mx-16px mt-12px rounded-8px" />
      <van-field
        v-model="createGroupMemberIds"
        :placeholder="t('mobile_home.group_members_placeholder')"
        class="mx-16px mt-8px mb-12px rounded-8px" />
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { vOnLongPress } from '@vueuse/components'
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import { showFailToast, showToast } from 'vant'
import { useI18n } from 'vue-i18n'
import { useMessage } from '@/composables/chat/useMessage'
import { useReplaceMsg } from '@/composables/chat/useReplaceMsg'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { MsgEnum, NotificationTypeEnum, RoomTypeEnum } from '@/enums'
import SmartVirtualList from '@/mobile/components/virtual-scroll/SmartVirtualList.vue'
import { matrixDirectMessageService, matrixRoomCreationService } from '@/services/matrix'
import { matrixSessionService } from '@/services/matrix/auth/MatrixSessionService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixReceiptService } from '@/services/matrix/messaging/MatrixReceiptService'
import { IsAllUserEnum } from '@/services/types.ts'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import type { MatrixRoomMember } from '@/stores/domains/chat/group'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useUserStore } from '@/stores/domains/user/user'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { createLogger } from '@/utils/Logger'
import { useTimerManager } from '@/utils/TimerManager'

const logger = createLogger('MobileMessage')
const timerManager = useTimerManager()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const loading = ref(false)
const count = ref(0)
const currentLongPressItem = ref<SessionItem | null>(null)
const groupStore = useGroupStore()
const chatStore = useChatStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const contactStore = useContactStore()
const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()

const searchText = ref('')

const activeTab = ref('message')
const tabs = [
  { key: 'message', label: '消息', icon: '#i-message', badge: 0 },
  { key: 'contacts', label: '联系人', icon: '#i-contacts', badge: 0 },
  { key: 'space', label: '空间', icon: '#i-space', badge: 0 },
  { key: 'widgets', label: '工具', icon: '#i-widgets', badge: 0 },
  { key: 'profile', label: '我的', icon: '#i-profile', badge: 0 }
]

type SessionMsgCacheItem = { msg: string; isAtMe: boolean; time: number; senderName: string }

const sessionMsgCache = reactive<Record<string, SessionMsgCacheItem>>({})

const isEnablePullRefresh = ref(true)

let scrollTop = 0

const enablePullRefresh = useDebounceFn((top: number) => {
  isEnablePullRefresh.value = top === 0
}, 100)

const disablePullRefresh = useThrottleFn(() => {
  isEnablePullRefresh.value = false
}, 80)

const onScroll = (e: Event) => {
  scrollTop = (e.target as HTMLElement).scrollTop
  if (scrollTop < 200) {
    enablePullRefresh(scrollTop)
  } else {
    disablePullRefresh()
  }
}

const longPressState = ref({
  showLongPressMenu: false,
  longPressMenuTop: 0,
  longPressActive: false,
  enable: () => {
    longPressState.value.longPressActive = true
    disablePullRefresh()
  },
  disable: () => {
    longPressState.value.showLongPressMenu = false
    longPressState.value.longPressMenuTop = 0
    longPressState.value.longPressActive = false
    isEnablePullRefresh.value = true
    enablePullRefresh(scrollTop)
  }
})

const allUserMap = computed(() => {
  const map = new Map<string, MatrixRoomMember>()
  groupStore.allUserInfo.forEach((user) => {
    map.set(user.uid, user as MatrixRoomMember)
  })
  return map
})

const sessionList = computed(() => {
  return chatStore.sessionList
    .map((item) => {
      let latestAvatar = item.avatar
      if (item.type === RoomTypeEnum.SINGLE && item.id) {
        latestAvatar = groupStore.getUserInfo(item.id)?.avatar || item.avatar
      }

      let displayName = item.name
      if (item.type === RoomTypeEnum.GROUP && item.remark) {
        displayName = item.remark
      }

      const messages = chatStore.chatMessageListByRoomId(item.roomId)

      let displayMsg = ''
      let isAtMe = false

      const lastMsg = messages[messages.length - 1]
      const cacheKey = item.roomId
      const cached = sessionMsgCache[cacheKey]
      const sendTime = lastMsg?.message?.sendTime || 0

      if (lastMsg) {
        const senderName = getMessageSenderName(lastMsg, '', item.roomId, item.type)
        const shouldRefreshCache = !cached || cached.time < sendTime || cached.senderName !== senderName

        if (shouldRefreshCache) {
          isAtMe = checkRoomAtMe(item.roomId, item.type, globalStore.currentSessionRoomId!, messages, item.unreadCount)
          displayMsg = formatMessageContent(lastMsg, item.type, senderName, item.roomId)

          if (item.type === RoomTypeEnum.GROUP && lastMsg.message?.type === MsgEnum.SYSTEM && displayMsg) {
            const separatorIndex = displayMsg.indexOf(':')
            if (separatorIndex > -1) {
              displayMsg = displayMsg.slice(separatorIndex + 1)
            }
          }

          sessionMsgCache[cacheKey] = {
            msg: displayMsg,
            isAtMe,
            time: sendTime,
            senderName
          }
        } else {
          displayMsg = cached.msg
          isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
        }
      } else if (cached) {
        displayMsg = cached.msg
        isAtMe = item.unreadCount > 0 ? cached.isAtMe : false
      }

      return {
        ...item,
        avatar: latestAvatar,
        name: displayName,
        lastMsg: displayMsg || t('message.message_list.default_last_msg'),
        isAtMe
      }
    })
    .sort((a, b) => {
      if (a.top && !b.top) return -1
      if (!a.top && b.top) return 1
      return b.activeTime - a.activeTime
    })
})

const filteredSessionList = computed(() => {
  if (!searchText.value.trim()) {
    return sessionList.value
  }
  const query = searchText.value.trim().toLowerCase()
  return sessionList.value.filter((item) => item.name?.toLowerCase().includes(query))
})

watch(
  () => chatStore.sessionList.map((item) => item.roomId),
  (roomIds) => {
    const activeRoomIds = new Set(roomIds)
    for (const roomId of Object.keys(sessionMsgCache)) {
      if (!activeRoomIds.has(roomId)) {
        Reflect.deleteProperty(sessionMsgCache, roomId)
      }
    }
  },
  { immediate: true }
)

const handleDelete = async (item: SessionItem | null) => {
  if (!item) return

  try {
    await handleMsgDelete(item.roomId)
  } catch (error) {
    logger.error('删除会话失败:', error)
  } finally {
    maskHandler.close()
  }
}

const handleToggleTop = async (item: SessionItem | null) => {
  if (!item) return

  try {
    const newTopState = !item.top

    await matrixSessionService.setSessionTop(item.roomId, newTopState)

    chatStore.updateSession(item.roomId, { top: newTopState })
  } catch (error) {
    logger.error('置顶操作失败:', error)
  } finally {
    maskHandler.close()
  }
}

const handleToggleReadStatus = async (markAsRead: boolean, sessionItem?: SessionItem | null) => {
  const targetItem = sessionItem || currentLongPressItem.value
  if (!targetItem) return

  const item = targetItem
  const previousUnreadCount = item.unreadCount

  try {
    const unreadCount = markAsRead ? 0 : 1

    const successMsg = markAsRead ? t('mobile_home.marked_as_read') : t('mobile_home.marked_as_unread')

    chatStore.updateSession(item.roomId, {
      unreadCount
    })
    globalStore.updateGlobalUnreadCount()

    if (markAsRead) {
      await matrixReceiptService.markRoomAsRead(item.roomId)
    }

    showFeedback(successMsg, 'success')
  } catch (error) {
    chatStore.updateSession(item.roomId, {
      unreadCount: previousUnreadCount
    })
    globalStore.updateGlobalUnreadCount()

    const errorMsg = markAsRead ? t('mobile_home.mark_as_read_failed') : t('mobile_home.mark_as_unread_failed')
    showFeedback(errorMsg, 'error')
    logger.error(errorMsg, error)
  } finally {
    maskHandler.close()
  }
}

const onRefresh = () => {
  loading.value = true
  count.value++

  const apiPromise = chatStore.getSessionList(true)
  const delayPromise = new Promise((resolve) => setTimeout(resolve, 500))

  Promise.all([apiPromise, delayPromise])
    .then(([res]) => {
      loading.value = false
      logger.debug('刷新完成', res)
    })
    .catch((error) => {
      loading.value = false
      logger.error('刷新会话列表失败：', error)
    })
}

const handleSyncEvent = (payload: { state?: string }) => {
  if (payload?.state === 'PREPARED') {
    contactStore.getContactList(true)
  }
}

const handleTimelineEvent = () => {
  contactStore.getContactList(false)
}

onMounted(async () => {
  await contactStore.getContactList(true)
  matrixClientService.on('sync', handleSyncEvent as (...args: unknown[]) => void)
  matrixClientService.on('timeline', handleTimelineEvent as (...args: unknown[]) => void)
})

onUnmounted(() => {
  matrixClientService.off('sync', handleSyncEvent as (...args: unknown[]) => void)
  matrixClientService.off('timeline', handleTimelineEvent as (...args: unknown[]) => void)
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
    const closeModal = () => {
      showMask.value = false
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollY)
    }

    timerManager.setTimeout(closeModal, 60)

    longPressState.value.disable()
  }
}

const router = useRouter()
const { handleMsgClick, handleMsgDelete } = useMessage()

let preventClick = false

const handleSwipeOpen = () => {
  preventClick = true
}

const handleSwipeClose = () => {
  preventClick = false
}

const intoRoom = (item: SessionItem) => {
  if (longPressState.value.longPressActive) {
    return
  }

  if (preventClick) {
    return
  }

  handleMsgClick(item)
  const foundedUser = allUserMap.value.get(item.detailId || '')

  timerManager.setTimeout(() => {
    if (foundedUser && foundedUser.uid !== '1') {
      router.push({
        name: 'mobileChatMain',
        params: {
          uid: item.detailId
        }
      })
    } else {
      router.push({
        name: 'mobileChatMain'
      })
    }
  }, 0)
}

const focusSearch = () => {
  // Implement search focus functionality
  logger.debug('Search focused')
}

const onTabClick = (tab: { key: string; label: string; icon: string }) => {
  activeTab.value = tab.key
  switch (tab.key) {
    case 'message':
      // Already on message page
      break
    case 'contacts':
      router.push('/mobile/mobileFriends')
      break
    case 'space':
      router.push('/mobile/space')
      break
    case 'widgets':
      router.push('/mobile/widgets')
      break
    case 'profile':
      router.push('/mobile/mobileMy')
      break
  }
}

const swipedRoom = ref('')

const longPressOption = ref({
  delay: 200,
  modifiers: {
    prevent: true,
    stop: true
  },
  reset: true,
  windowResize: true,
  windowScroll: true,
  immediate: true,
  updateTiming: 'sync'
})

const handleLongPress = (e: PointerEvent, item: SessionItem) => {
  const latestItem = chatStore.sessionList.find((session) => session.roomId === item.roomId)
  if (!latestItem) return

  currentLongPressItem.value = latestItem

  e.stopPropagation()

  maskHandler.open()

  longPressState.value.enable()

  const setLongPressMenuTop = () => {
    const target = e.target as HTMLElement

    if (!target) {
      return
    }

    const currentTarget = target.closest('.m-room-item')

    if (!currentTarget) {
      return
    }

    const rect = currentTarget.getBoundingClientRect()

    longPressState.value.longPressMenuTop = rect.top - rect.height / 3
  }

  setLongPressMenuTop()

  longPressState.value.showLongPressMenu = true
}

const showNewChatDialog = ref(false)
const newChatUserId = ref('')
const showCreateGroupDialog = ref(false)
const createGroupName = ref('')
const createGroupMemberIds = ref('')

function handleNewChat() {
  newChatUserId.value = ''
  showNewChatDialog.value = true
}

async function beforeCloseNewChat(action: string): Promise<boolean> {
  if (action === 'cancel') {
    showNewChatDialog.value = false
    return true
  }

  const userId = newChatUserId.value.trim()
  if (!userId) {
    showFailToast(t('mobile_home.user_id_required'))
    return false
  }

  try {
    showToast({ type: 'loading', message: t('mobile_home.new_chat_creating'), forbidClick: true })
    const roomId = await matrixDirectMessageService.createDm(userId)
    showToast({ type: 'success', message: t('mobile_home.new_chat_success') })
    showNewChatDialog.value = false
    await chatStore.getSessionList(true)
    router.push(`/mobile/chatRoom/chatMain/${roomId}`)
    return true
  } catch (e) {
    logger.error('Create DM failed:', e)
    showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_home.new_chat_failed'))
    return false
  }
}

function handleCreateGroupChat() {
  createGroupName.value = ''
  createGroupMemberIds.value = ''
  showCreateGroupDialog.value = true
}

async function beforeCloseCreateGroup(action: string): Promise<boolean> {
  if (action === 'cancel') {
    showCreateGroupDialog.value = false
    return true
  }

  const name = createGroupName.value.trim()
  if (!name) {
    showFailToast(t('mobile_home.group_name_required'))
    return false
  }

  const memberIds = createGroupMemberIds.value
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0)

  try {
    showToast({ type: 'loading', message: t('mobile_home.create_group_creating'), forbidClick: true })
    const room = await matrixRoomCreationService.createGroupRoom({
      name,
      invite: memberIds
    })

    if (room?.roomId) {
      showToast({ type: 'success', message: t('mobile_home.create_group_success') })
      showCreateGroupDialog.value = false
      await chatStore.getSessionList(true)
      router.push(`/mobile/chatRoom/chatMain/${room.roomId}`)
    }
    return true
  } catch (e) {
    logger.error('Create group chat failed:', e)
    showFailToast(e instanceof Error ? e.message : String(e) || t('mobile_home.create_group_failed'))
    return false
  }
}
</script>

<style scoped lang="scss">
.mobile {
  width: 100%;
  height: 100%;
  background: var(--hula-surface-deepest);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  @media (min-width: 376px) {
    width: 375px;
    height: 812px;
    border-radius: 42px;
    box-shadow:
      var(--hula-shadow-panel),
      0 0 0 11px #1a1a1a,
      0 0 0 12px #2a2a2a;
    margin: 0 auto;
  }
}

.ios-statusbar {
  height: 44px;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  background: var(--hula-surface-dark-mid);
  color: var(--hula-text-primary);
  position: relative;
}

.dynamic-island {
  position: absolute;
  top: 11px;
  left: 50%;
  transform: translateX(-50%);
  width: 120px;
  height: 32px;
  background: #000;
  border-radius: 18px;
  z-index: 100;
}

.m-header {
  padding: 8px 16px 10px;
  background: var(--hula-surface-dark-mid);
  border-bottom: 1px solid var(--hula-border-default);
  flex-shrink: 0;
}

.m-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.m-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--hula-text-primary);
}

.icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--hula-radius-sm);
  color: var(--hula-text-primary);
  transition: background 0.15s;
}

.icon-btn:hover {
  background: var(--hula-surface-list-hover);
}

.m-search {
  margin-top: 10px;
  background: var(--hula-surface-search);
  border-radius: var(--hula-radius-sm);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--hula-text-tertiary);
  cursor: pointer;
  transition: background 0.15s;
}

.m-search:hover {
  background: var(--hula-surface-subtle);
}

.m-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mobile-session-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.m-room-item {
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  transition:
    transform 0.2s,
    background 0.15s;
  position: relative;
  overflow: hidden;
  background: transparent;
}

.m-room-item:active {
  background: var(--hula-surface-list-hover);
}

.m-room-item.swiped {
  transform: translateX(-120px);
}

.m-room-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--hula-radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  position: relative;
  background: var(--hula-surface-subtle);
  overflow: hidden;
}

.m-room-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.m-room-avatar.is-online::after {
  content: '';
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 8px;
  height: 8px;
  background: var(--hula-status-online);
  border-radius: 50%;
  border: 2px solid var(--hula-surface-panel);
}

.at-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--hula-color-danger-500);
  color: var(--hula-text-inverse);
  font-size: 10px;
  font-weight: 600;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.m-room-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.m-room-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.m-room-name {
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--hula-text-primary);
}

.encrypted-tag {
  display: flex;
  align-items: center;
  color: var(--hula-color-primary-500);
}

.m-room-time {
  font-size: 11px;
  color: var(--hula-text-tertiary);
}

.m-room-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.m-room-preview {
  font-size: 13px;
  color: var(--hula-text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.m-room-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  background: var(--hula-color-danger-500);
  color: var(--hula-text-inverse);
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
}

.m-room-actions {
  height: 100%;
  display: flex;
  align-items: center;
}

.m-action-btn {
  width: 60px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: #fff;
  cursor: pointer;
}

.m-action-btn.pin {
  background: var(--hula-color-warning-500);
}

.m-action-btn.delete {
  background: var(--hula-color-danger-500);
}

.m-tabbar {
  height: 62px;
  background: var(--hula-surface-dark-mid);
  border-top: 1px solid var(--hula-border-default);
  display: flex;
  flex-shrink: 0;
  padding-bottom: 10px;
}

.m-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  color: var(--hula-text-tertiary);
  font-size: 10px;
  position: relative;
  transition: color 0.15s;
}

.m-tab.active {
  color: var(--hula-brand);
}

.m-tab-icon {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.m-tab-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  background: var(--hula-color-danger-500);
  color: var(--hula-text-inverse);
  font-size: 9px;
  font-weight: 600;
  min-width: 15px;
  height: 15px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.home-indicator {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 130px;
  height: 4px;
  background: #fff;
  border-radius: 2px;
  opacity: 0.4;
  z-index: 50;
}

:deep(.van-cell.van-field) {
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--hula-surface-search);
  border: 1px solid transparent;
  transition: border-color 0.15s ease;
}

:deep(.van-cell.van-field:focus-within) {
  border-color: var(--hula-color-primary-500);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

:deep(.van-pull-refresh) {
  flex: 1;
  overflow: hidden;
}

:deep(.van-pull-refresh__track) {
  height: 100%;
}

:deep(.van-swipe-cell__wrapper) {
  display: flex;
}

:deep(.van-swipe-cell__right) {
  display: flex;
}
</style>
