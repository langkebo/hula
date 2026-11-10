<template>
  <div class="flex flex-col overflow-auto h-full relative">
    <img
      src="@/assets/mobile/chat-home/background.webp"
      alt=""
      class="fixed inset-0 w-full h-full z-0 object-cover dark:opacity-20" />

    <!-- 页面蒙板 -->
    <div
      v-if="showMask"
      @touchend="maskHandler.close"
      @mouseup="maskHandler.close"
      :class="[
        longPressState.longPressActive
          ? ''
          : 'bg-black/20 mobile-mask--blurred transition-[width,transform,opacity,color,background-color,border-color,box-shadow] duration-300 ease-in-out opacity-100'
      ]"
      class="mobile-mask--blur fixed inset-0 z-[999]"></div>

    <NavBar>
      <template #left>
        <MobileSessionHeader @click="toSimpleBio" />
      </template>

      <template #right>
        <div class="flex items-center gap-8px">
          <!-- 私密会话入口：私密房会被普通列表整体过滤，没有这个入口用户进不去 -->
          <van-button
            v-if="showHiddenSessionsEntry"
            round
            plain
            size="small"
            :aria-label="t('home.secret_chat.hidden_sessions')"
            @click="handleOpenHiddenSessions">
            <svg class="w-16px h-16px" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M12 3a9 9 0 0 0-9 9 9.75 9.75 0 0 0 5.5 8.38l-1.15 1.15a1 1 0 0 0 1.37 1.37l1.15-1.15A9.75 9.75 0 0 0 21 12a9 9 0 0 0-9-9zm-5 9a5 5 0 1 1 10 0 5 5 0 0 1-10 0z" />
            </svg>
          </van-button>
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
        </div>
      </template>
    </NavBar>

    <!-- 连接状态横幅：同步/重连/断线时提示（对齐原型「正在连接…」banner） -->
    <MobileConnectionBanner />

    <MobileSessionList
      :filtered-session-list="filteredSessionList"
      :load-error="loadError"
      :is-loading="isLoading"
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

    <teleport to=".app-shell-root">
      <div
        v-if="longPressState.showLongPressMenu"
        :ref="(el) => (longPressMenuRef = el as HTMLElement | null)"
        :style="{ top: longPressState.longPressMenuTop + 'px' }"
        class="fixed gap-10px z-999 left-1/2 transform -translate-x-1/2">
        <div class="long-press-menu flex justify-between p-18px text-16px gap-22px whitespace-nowrap">
          <div v-clickable class="long-press-menu__item" @click="handleDelete(currentLongPressItem)">
            {{ t('mobile_home.menu.delete') }}
          </div>
          <div v-clickable class="long-press-menu__item" @click="handleToggleTop(currentLongPressItem)">
            {{ currentLongPressItem?.top ? t('mobile_home.menu.unpin') : t('mobile_home.menu.pintop') }}
          </div>
          <div
            class="long-press-menu__item"
            @click="handleToggleReadStatus((currentLongPressItem?.unreadCount ?? 0) > 0)">
            {{
              (currentLongPressItem?.unreadCount ?? 0) > 0 ? t('mobile_home.menu.read') : t('mobile_home.menu.unread')
            }}
          </div>
          <div
            v-if="currentLongPressItem?.type === RoomTypeEnum.SINGLE"
            v-clickable
            class="long-press-menu__item"
            @click="handleTogglePrivate(currentLongPressItem)">
            {{
              currentLongPressItem && isRoomPrivate(currentLongPressItem.roomId)
                ? t('home.secret_chat.unmark_private')
                : t('home.secret_chat.mark_private')
            }}
          </div>
        </div>
        <div class="flex w-full justify-center h-15px">
          <svg width="34" height="13" viewBox="0 0 35 13">
            <path d="M0 0 L35 0 L17.5 13 Z" class="long-press-menu__arrow" />
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
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { openSecretChatUnlock } from '@/composables/secretChat/useSecretChatGate'
import { RoomTypeEnum } from '@/enums'
import MobileConnectionBanner from '@/mobile/components/common/MobileConnectionBanner.vue'
import MobileCreateDialogs from '@/mobile/components/message/MobileCreateDialogs.vue'
import MobileSessionHeader from '@/mobile/components/message/MobileSessionHeader.vue'
import MobileSessionList from '@/mobile/components/message/MobileSessionList.vue'
import { useMobileCreateDialogs } from '@/mobile/composables/useMobileCreateDialogs'
import { useMobileLongPress } from '@/mobile/composables/useMobileLongPress'
import { useMobileMessageActions } from '@/mobile/composables/useMobileMessageActions'
import { useMobileScrollRefresh } from '@/mobile/composables/useMobileScrollRefresh'
import { useMobileSessionList } from '@/mobile/composables/useMobileSessionList'
import { useSessionListScrollMemory } from '@/mobile/composables/useSessionListScrollMemory'
import type { SessionItem } from '@/stores/domains/chat/chat'
import { isSecretChatUnlocked } from '@/stores/domains/settings/secretChatSession'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useTimerManager } from '@/utils/TimerManager'

const timerManager = useTimerManager()
const { t } = useI18n()
const router = useRouter()
const settingStore = useSettingStore()

// 滚动 & 下拉刷新控制
const { isEnablePullRefresh, enablePullRefresh, disablePullRefresh, onScroll, getScrollTop, lockScroll, unlockScroll } =
  useMobileScrollRefresh()

// 长按菜单 & 蒙板(依赖滚动控制)
const {
  showMask,
  currentLongPressItem,
  longPressMenuRef,
  longPressState,
  longPressOption,
  maskHandler,
  handleLongPress
} = useMobileLongPress({ disablePullRefresh, enablePullRefresh, getScrollTop })

// 会话列表数据派生
const { searchText, filteredSessionList, hiddenSessionCount, loadError, isLoading } = useMobileSessionList()

/**
 * 私密会话入口是否可见。
 *
 * 光有私密房不够：密码被清除后登记表可能还留着旧数据，此时入口点进去只会落到
 * 一个「永远解不开」的页面。设置页清除密码后本入口必须随之消失。
 * `isSecretChatConfigured()` 内部读取 `secretChat.enabled/passwordHash`，
 * 在 computed 中调用即可被 Pinia 的响应式追踪。
 */
const showHiddenSessionsEntry = computed(() => hiddenSessionCount.value > 0 && settingStore.isSecretChatConfigured())

// 会话操作 + matrix 同步事件订阅(依赖 maskHandler / currentLongPressItem)
const {
  loading,
  handleDelete,
  handleToggleTop,
  handleToggleReadStatus,
  handleTogglePrivate,
  isRoomPrivate,
  onRefresh
} = useMobileMessageActions({
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
  goToChatRoom: (roomId: string) => router.push({ name: 'mobileChatMain', params: { roomId } }),
  goToAddContact: () => router.push('/mobile/mobileFriends/addFriends')
})

// 返回列表时恢复滚动位置（进入会话会让 tab 布局卸载，列表被重建）
const { remember: rememberScrollTop, restore: restoreScrollTop, getRemembered } = useSessionListScrollMemory()
let scrollRestored = false

onBeforeUnmount(() => {
  rememberScrollTop(getScrollTop())
})

/**
 * 恢复滚动位置。
 *
 * 关键：**不能只挂在 `watch(length)` 上** —— 返回列表时 store 里已有数据，length 没有
 * 0→N 的变化，watch 不会触发（实测返回后恒为 0）。所以挂载时也要试一次。
 * 另外虚拟列表的高度要等一两帧才建立，写早了会被 clamp 成 0 ⇒ 重试。
 */
const scheduleScrollRestore = () => {
  if (scrollRestored) return
  if (getRemembered() <= 0) {
    scrollRestored = true // 没离开过列表（或无记录），不必恢复
    return
  }
  scrollRestored = true
  let attempts = 0
  const tryRestore = () => {
    if (restoreScrollTop() || ++attempts >= 20) return
    window.setTimeout(tryRestore, 100)
  }
  void nextTick(tryRestore)
}

onMounted(scheduleScrollRestore)

watch(
  () => filteredSessionList.value.length,
  (length) => {
    if (!length) return
    scheduleScrollRestore()
  },
  { flush: 'post' }
)

let preventClick = false

const handleSwipeOpen = () => {
  preventClick = true
}

const handleSwipeClose = () => {
  preventClick = false
}

/**
 * 进入会话。
 *
 * 只把 roomId 交给路由 —— 会话的唯一标识是 roomId，群聊没有对端 uid。
 * 此前用 `allUserMap.get(item.detailId)` 判分支，群聊 / 非好友时 detailId 为空，
 * 会 push 一个**不带参数**的 `mobileChatMain`，聊天页只能靠内存里的
 * `currentSessionRoomId` 侥幸工作，刷新或进程重建后就是空白页。
 *
 * 会话切换（写当前会话 / 标已读 / 同步群成员）统一在 `MobileChatMain` 按路由参数做，
 * 避免「列表点一次 + 页面挂载再一次」的重复切换。
 */
const intoRoom = (item: SessionItem) => {
  if (longPressState.value.longPressActive) return
  if (preventClick) return

  timerManager.setTimeout(() => {
    router.push({ name: 'mobileChatMain', params: { roomId: item.roomId } })
  }, 0)
}

const toSimpleBio = () => {
  router.push('/mobile/mobileMy/simpleBio')
}

/**
 * 打开私密会话列表。
 *
 * 移动端没有桌面工具栏入口，私密房又被普通列表整体过滤，所以这里是唯一入口：
 * 未配置密码只提示（否则会进入一个永远解不开的页面）；未解锁先弹全局解锁框，
 * 解锁成功后回跳私密列表（见 SecretChatUnlockDialog 的 pendingPath）。
 */
const handleOpenHiddenSessions = () => {
  if (!settingStore.isSecretChatConfigured()) {
    useActionFeedback().showFeedback(t('home.secret_chat.no_password'), 'warning')
    return
  }
  if (!isSecretChatUnlocked()) {
    openSecretChatUnlock('/mobile/secretChat')
    return
  }
  void router.push('/mobile/secretChat')
}
</script>

<style scoped lang="scss">
@use '@/styles/scss/mixins/liquid-glass' as *;

/**
 * 遮罩模糊：显式双声明，不用 UnoCSS 的 `backdrop-blur-sm` ——
 * 仓库未接 autoprefixer，工具类只产不带前缀的 backdrop-filter，
 * 旧 iOS/Android WebView 直接丢掉，等于没有模糊。
 * 值与原先的 blur-sm 一致（4px）。
 */
.mobile-mask--blurred {
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
}

/* 低性能设备关闭遮罩模糊，保留正常态的 bg-black/20 */
.mobile-mask--blur {
  @include backdrop-blur-fallback;
}

/* 长按菜单：悬浮玻璃气泡，文字走主文本色以避免浅色玻璃上的白字不可读 */
.long-press-menu {
  background: var(--tjg-glass-sheet-bg);
  border: var(--tjg-glass-border-soft);
  border-radius: var(--tjg-radius-xl);
  box-shadow: var(--tjg-glass-inner-highlight), var(--tjg-glass-shadow-strong);
  -webkit-backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-soft));
  backdrop-filter: blur(var(--tjg-glass-blur-strong)) saturate(var(--tjg-glass-saturate-soft));
  color: var(--tjg-text-primary);
}

.long-press-menu__item {
  cursor: pointer;
  transition: opacity var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);
}

.long-press-menu__item:active {
  opacity: 0.6;
}

.long-press-menu__arrow {
  fill: var(--tjg-glass-sheet-bg);
}

@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .long-press-menu {
    background: var(--tjg-surface-panel);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }

  .long-press-menu__arrow {
    fill: var(--tjg-surface-panel);
  }
}

/* 低性能设备关闭实时模糊，保留不透明底色保证可读 */
html.low-perf .long-press-menu {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  background: var(--tjg-surface-panel);
}

html.low-perf .long-press-menu__arrow {
  fill: var(--tjg-surface-panel);
}

@media (prefers-reduced-motion: reduce) {
  .long-press-menu__item {
    transition: none;
  }
}
</style>
