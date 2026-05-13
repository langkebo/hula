<template>
  <div class="flex flex-col overflow-auto h-full relative">
    <img
      src="@/assets/mobile/chat-home/background.webp"
      class="absolute fixed top-0 l-0 w-full h-full z-0 dark:opacity-20" />

    <!-- 页面蒙板 -->
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

    <NavBar>
      <template #left>
        <div @click="toSimpleBio" class="flex items-center gap-6px w-full">
          <img
            class="size-38px rounded-full object-cover"
            :src="AvatarUtils.getAvatarUrl(userStore.userInfo?.avatar ? userStore.userInfo.avatar : '/logoD.png')"
            @error="($event.target as HTMLImageElement).src = '/logo.png'" />

          <div class="flex flex-col justify-center gap-6px">
            <p
              style="
                font-weight: bold !important;
                font-family:
                  system-ui,
                  -apple-system,
                  sans-serif;
              "
              class="text-(16px [--hula-text-primary])">
              {{ userStore.userInfo?.name ? userStore.userInfo.name : t('mobile_home.noname') }}
            </p>
            <p class="text-(10px [--hula-text-primary])">
              {{ t('mobile_home.china') }}
            </p>
          </div>
        </div>
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

    <div class="px-16px mt-5px">
      <div class="py-5px shrink-0">
        <van-field
          id="search"
          class="rounded-6px w-full relative text-12px"
          maxlength="20"
          clearable
          autocomplete="off"
          :spellcheck="false"
          autocorrect="off"
          autocapitalize="off"
          :placeholder="t('mobile_home.input.search')"
          @focus="lockScroll"
          @blur="unlockScroll">
          <template #left-icon>
            <svg class="w-12px h-12px">
              <use href="#search"></use>
            </svg>
          </template>
        </van-field>
      </div>
      <div class="m-0 p-0 mt-10px border-b border-gray-200 dark:border-gray-700"></div>
    </div>

    <van-pull-refresh
      class="flex-1"
      :pull-distance="100"
      :disabled="!isEnablePullRefresh"
      v-model="loading"
      @refresh="onRefresh">
      <div class="flex flex-col h-full">
        <SmartVirtualList
          class="mobile-session-list flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          :items="sessionList"
          :item-height="82"
          :buffer="6"
          key-field="roomId"
          @scroll="onScroll">
          <template #default="{ item }">
            <van-swipe-cell
              @open="handleSwipeOpen"
              @close="handleSwipeClose"
              v-on-long-press="[(e: PointerEvent) => handleLongPress(e, item), longPressOption]"
              class="text-black"
              :class="item.top ? 'w-full bg-#64A29C18' : ''">
              <!-- 长按项 -->
              <div
                @click.stop="intoRoom(item)"
                class="grid grid-cols-[2.2rem_1fr_max-content] items-start px-4 py-3 gap-1">
                <div class="flex-shrink-0">
                  <van-badge
                    :offset="[-6, 6]"
                    :color="item.muteNotification === NotificationTypeEnum.NOT_DISTURB ? 'grey' : '#c14053'"
                    :content="item.unreadCount"
                    :max="99">
                    <img
                      class="size-52px rounded-full object-cover"
                      :src="AvatarUtils.getAvatarUrl(item.avatar)"
                      @error="($event.target as HTMLImageElement).src = '/logo.png'" />
                  </van-badge>
                </div>
                <!-- 中间：两行内容 -->
                <div class="truncate pl-7 flex pt-5px gap-10px leading-tight flex-col">
                  <span class="text-16px font-bold flex-1 truncate">{{ item.name }}</span>
                  <div class="text-13px text-gray-600 dark:text-gray-400 truncate">
                    {{ item.lastMsg }}
                  </div>
                </div>

                <!-- 时间：靠顶 -->
                <div class="text-12px pt-9px text-right flex flex-col gap-1 items-end justify-center">
                  <div class="flex items-center gap-1">
                    <span v-if="item.hotFlag === IsAllUserEnum.Yes">
                      <svg class="size-22px select-none outline-none cursor-pointer color-[--color-primary]">
                        <use href="#auth"></use>
                      </svg>
                    </span>
                    <span v-if="item.isFavorite">
                      <svg class="size-22px select-none outline-none cursor-pointer color-[--color-warning]">
                        <use href="#star"></use>
                      </svg>
                    </span>
                    <span class="text-gray-600 whitespace-nowrap">
                      {{ formatTimestamp(item?.activeTime) }}
                    </span>
                  </div>
                  <div v-if="item.muteNotification === NotificationTypeEnum.NOT_DISTURB">
                    <svg class="size-14px z-100 color-gray-500/90">
                      <use href="#close-remind"></use>
                    </svg>
                  </div>
                </div>
              </div>
              <template #right>
                <div class="flex w-auto flex-wrap h-full">
                  <div
                    class="h-full text-14px w-80px bg-[--color-primary] text-white flex items-center justify-center"
                    @click="handleToggleTop(item)">
                    {{ item.top ? t('mobile_home.chat.unpin') : t('mobile_home.chat.pintop') }}
                  </div>
                  <div
                    :class="(item?.unreadCount ?? 0) > 0 ? 'bg-[--hula-text-tertiary]' : 'bg-[--color-warning]'"
                    class="h-full text-14px w-80px text-white flex items-center justify-center"
                    @click="handleToggleReadStatus((item?.unreadCount ?? 0) > 0, item)">
                    {{
                      (item?.unreadCount ?? 0) > 0
                        ? t('mobile_home.chat.mark_as_read')
                        : t('mobile_home.chat.mark_as_unread')
                    }}
                  </div>
                  <div
                    class="h-full text-14px w-80px bg-[--color-danger] text-white flex items-center justify-center"
                    @click="handleDelete(item)">
                    {{ t('mobile_home.chat.delete') }}
                  </div>
                </div>
              </template>
            </van-swipe-cell>
          </template>
        </SmartVirtualList>
      </div>
    </van-pull-refresh>

    <teleport to="body">
      <div
        v-if="longPressState.showLongPressMenu"
        :style="{ top: longPressState.longPressMenuTop + 'px' }"
        class="fixed gap-10px z-999 left-1/2 transform -translate-x-1/2">
        <div class="flex justify-between p-18px text-16px gap-22px rounded-16px bg-#4e4e4e whitespace-nowrap">
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
            <path d="M0 0 L35 0 L17.5 13 Z" fill="#4e4e4e" />
          </svg>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { vOnLongPress } from '@vueuse/components'
import { useDebounceFn, useThrottleFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import NavBar from '#/layout/navBar/index.vue'
import { MsgEnum, NotificationTypeEnum, RoomTypeEnum } from '@/enums'
import { useMessage } from '@/hooks/useMessage.ts'
import { useReplaceMsg } from '@/hooks/useReplaceMsg'
import SmartVirtualList from '@/mobile/components/virtual-scroll/SmartVirtualList.vue'
import { roomListService } from '@/services/matrix/room/RoomListService'
import { syncService } from '@/services/matrix/sync/MatrixSyncService'
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
const loading = ref(false)
const count = ref(0)
const currentLongPressItem = ref<SessionItem | null>(null)
const groupStore = useGroupStore()
const chatStore = useChatStore()
const userStore = useUserStore()
const globalStore = useGlobalStore()
const contactStore = useContactStore()
const { checkRoomAtMe, getMessageSenderName, formatMessageContent } = useReplaceMsg()

const showAddPopover = ref(false)
const addActions = [
  { text: t('menu.start_group_chat'), value: '/mobile/mobileFriends/startGroupChat' },
  { text: t('menu.add_contact'), value: '/mobile/mobileFriends/addFriends' }
]

const onAddActionSelect = (action: { text: string; value: string }) => {
  router.push(action.value)
  maskHandler.close()
}

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
        lastMsgTime: formatTimestamp(item?.activeTime),
        isAtMe
      }
    })
    .sort((a, b) => {
      if (a.top && !b.top) return -1
      if (!a.top && b.top) return 1
      return b.activeTime - a.activeTime
    })
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

    await roomListService.setSessionTop(item.roomId, newTopState)

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
      await roomListService.markAsRead(item.roomId)
    }

    window.$message.success(successMsg)
  } catch (error) {
    chatStore.updateSession(item.roomId, {
      unreadCount: previousUnreadCount
    })
    globalStore.updateGlobalUnreadCount()

    const errorMsg = markAsRead ? t('mobile_home.mark_as_read_failed') : t('mobile_home.mark_as_unread_failed')
    window.$message.error(errorMsg)
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
  syncService.onSync('sync', handleSyncEvent as (...args: unknown[]) => void)
  syncService.onSync('timeline', handleTimelineEvent as (...args: unknown[]) => void)
})

onUnmounted(() => {
  syncService.offSync('sync')
  syncService.offSync('timeline')
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
const toSimpleBio = () => {
  router.push('/mobile/mobileMy/simpleBio')
}

const lockScroll = () => {
  logger.debug('锁定触发')
  const scrollEl = document.querySelector('.mobile-session-list') as HTMLElement
  if (scrollEl) {
    scrollEl.style.overflow = 'hidden'
  }
}

const unlockScroll = () => {
  logger.debug('锁定解除')
  const scrollEl = document.querySelector('.mobile-session-list') as HTMLElement
  if (scrollEl) {
    scrollEl.style.overflow = 'auto'
  }
}

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

    const currentTarget = target.closest('.grid')

    if (!currentTarget) {
      return
    }

    const rect = currentTarget.getBoundingClientRect()

    longPressState.value.longPressMenuTop = rect.top - rect.height / 3
  }

  setLongPressMenuTop()

  longPressState.value.showLongPressMenu = true
}
</script>

<style scoped lang="scss">
:deep(.van-cell.van-field) {
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.85);
}

:deep(.van-cell.van-field::after) {
  display: none;
}

::deep(#search) {
  position: relative;
  z-index: 1500;
}
</style>
