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
        <MobileSessionHeader @click="toSimpleBio" />
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

    <MobileSessionList
      :filtered-session-list="filteredSessionList"
      v-model:search-text="searchText"
      v-model:loading="loading"
      :is-enable-pull-refresh="isEnablePullRefresh"
      :long-press-option="longPressOption"
      @refresh="onRefresh"
      @scroll="onScroll"
      @into-room="intoRoom"
      @swipe-open="handleSwipeOpen"
      @swipe-close="handleSwipeClose"
      @long-press="handleLongPress"
      @toggle-top="handleToggleTop"
      @toggle-read="(markAsRead, item) => handleToggleReadStatus(markAsRead, item)"
      @delete="handleDelete"
      @lock-scroll="lockScroll"
      @unlock-scroll="unlockScroll" />

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
            <path d="M0 0 L35 0 L17.5 13 Z" fill="var(--tjg-surface-subtle)" />
          </svg>
        </div>
      </div>
    </teleport>

    <MobileCreateDialogs
      v-model:show-new-chat-dialog="showNewChatDialog"
      v-model:new-chat-user-id="newChatUserId"
      v-model:show-create-group-dialog="showCreateGroupDialog"
      v-model:create-group-name="createGroupName"
      v-model:create-group-member-ids="createGroupMemberIds"
      :before-close-new-chat="beforeCloseNewChat"
      :before-close-create-group="beforeCloseCreateGroup" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import NavBar from '#/layout/navBar/index.vue'
import { useMessage } from '@/composables/chat/useMessage'
import MobileCreateDialogs from '@/mobile/components/message/MobileCreateDialogs.vue'
import MobileSessionHeader from '@/mobile/components/message/MobileSessionHeader.vue'
import MobileSessionList from '@/mobile/components/message/MobileSessionList.vue'
import { useMobileCreateDialogs } from '@/mobile/composables/useMobileCreateDialogs'
import { useMobileLongPress } from '@/mobile/composables/useMobileLongPress'
import { useMobileMessageActions } from '@/mobile/composables/useMobileMessageActions'
import { useMobileScrollRefresh } from '@/mobile/composables/useMobileScrollRefresh'
import { useMobileSessionList } from '@/mobile/composables/useMobileSessionList'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { useTimerManager } from '@/utils/TimerManager'

const timerManager = useTimerManager()
const { t } = useI18n()
const router = useRouter()
const { handleMsgClick } = useMessage()

// 滚动 & 下拉刷新控制
const { isEnablePullRefresh, enablePullRefresh, disablePullRefresh, onScroll, getScrollTop, lockScroll, unlockScroll } =
  useMobileScrollRefresh()

// 长按菜单 & 蒙板(依赖滚动控制)
const { showMask, currentLongPressItem, longPressState, longPressOption, maskHandler, handleLongPress } =
  useMobileLongPress({ disablePullRefresh, enablePullRefresh, getScrollTop })

// 会话列表数据派生
const { searchText, filteredSessionList, allUserMap } = useMobileSessionList()

// 会话操作 + matrix 同步事件订阅(依赖 maskHandler / currentLongPressItem)
const { loading, handleDelete, handleToggleTop, handleToggleReadStatus, onRefresh } = useMobileMessageActions({
  maskHandler,
  currentLongPressItem
})

// 新建聊天/创建群组对话框 + 添加菜单
const {
  showAddPopover,
  addActions,
  showNewChatDialog,
  newChatUserId,
  showCreateGroupDialog,
  createGroupName,
  createGroupMemberIds,
  onAddActionSelect,
  beforeCloseNewChat,
  beforeCloseCreateGroup
} = useMobileCreateDialogs({
  maskHandler,
  goToChatRoom: (roomId: string) => router.push(`/mobile/chatRoom/chatMain/${roomId}`),
  goToAddContact: () => router.push('/mobile/mobileFriends/addFriends')
})

let preventClick = false

const handleSwipeOpen = () => {
  preventClick = true
}

const handleSwipeClose = () => {
  preventClick = false
}

const intoRoom = (item: SessionItem) => {
  if (longPressState.value.longPressActive) return
  if (preventClick) return

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
</script>
