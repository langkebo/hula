<template>
  <main
    class="flex-shrink-0 flex flex-col transition-all duration-300 h-full"
    :class="[
      isGroup
        ? isCollapsed
          ? 'w-0 border-none'
          : 'w-240px border-l border-[--tjg-border-default] bg-[--tjg-surface-panel] shadow-sm'
        : 'w-0 border-none',
      'relative'
    ]">
    <!-- 收缩按钮：默认折叠，点击展开/收起 -->
    <div
      v-show="isGroup"
      role="button"
      :aria-label="isCollapsed ? t('home.chat_sidebar.toggle.expand') : t('home.chat_sidebar.toggle.collapse')"
      :aria-expanded="!isCollapsed"
      @click.stop="isCollapsed = !isCollapsed"
      class="absolute top-1/2 -left-14px -translate-y-1/2 cursor-pointer bg-[--tjg-surface-sidebar-selected] h-48px w-14px rounded-l-12px flex items-center justify-center opacity-100 hover:opacity-80 transition-opacity z-10 shadow-sm border border-r-0 border-[--tjg-border-default]">
      <svg
        :class="isCollapsed ? 'rotate-180' : 'rotate-0'"
        class="size-14px color-[--tjg-text-tertiary] transition-transform">
        <use href="#left-arrow"></use>
      </svg>
    </div>

    <div v-if="isGroup && !isCollapsed" class="flex flex-col h-full overflow-hidden">
      <!-- 公告面板 (MW-ANNOUNCEMENT-002: 替代独立窗口) -->
      <AnnouncementPanel v-if="showAnnouncementPanel" :room-id="currentRoomId" @close="showAnnouncementPanel = false" />

      <!-- 群公告预览 -->
      <n-flex
        v-if="!showAnnouncementPanel"
        vertical
        :size="10"
        class="p-12px border-b border-[--tjg-border-default] shrink-0 bg-[--tjg-surface-panel]">
        <n-flex
          align="center"
          justify="space-between"
          :size="8"
          class="cursor-pointer"
          @click="handleOpenAnnoun(announNum === 0 && isAddAnnoun)">
          <span class="text-[var(--text-sm)] font-medium color-[--tjg-text-primary] truncate flex-1 min-w-0">
            {{ t('home.chat_sidebar.announcement.title') }}
          </span>
          <svg
            class="size-14px color-[--tjg-text-secondary] shrink-0 transition-transform hover:color-[--tjg-text-primary]">
            <use v-if="announNum === 0 && isAddAnnoun" href="#plus"></use>
            <use v-else href="#right"></use>
          </svg>
        </n-flex>

        <!-- 公告加载失败提示 -->
        <n-flex v-if="announError" class="h-60px bg-[--tjg-surface-search] rounded-8px" align="center" justify="center">
          <div class="text-center">
            <p class="text-[var(--text-xs)] color-[--tjg-color-danger-500] mb-6px">
              {{ t('home.chat_sidebar.announcement.load_failed') }}
            </p>
            <n-button size="tiny" tertiary type="error" @click="announcementStore.loadGroupAnnouncements()">
              {{ t('home.chat_sidebar.actions.retry') }}
            </n-button>
          </div>
        </n-flex>

        <!-- 公告内容 -->
        <div v-else class="max-h-68px overflow-hidden relative">
          <p class="text-[var(--text-xs)] color-[--tjg-text-secondary] leading-relaxed line-clamp-3">
            <template v-if="announNum === 0">
              {{ t('home.chat_sidebar.announcement.default') }}
            </template>
            <template v-else-if="announcementSegments.length > 0">
              <template v-for="(segment, index) in announcementSegments" :key="index">
                <span
                  v-if="segment.isLink"
                  class="cursor-pointer hover:underline text-[--tjg-color-primary-500]"
                  @click.stop="openAnnouncementLink(segment.text)">
                  {{ segment.text }}
                </span>
                <template v-else>{{ segment.text }}</template>
              </template>
            </template>
            <template v-else>{{ announcementContent }}</template>
          </p>
        </div>
      </n-flex>

      <!-- Tab 选项卡机制 -->
      <n-tabs
        v-model:value="activeTab"
        type="line"
        size="small"
        class="chat-sidebar-tabs shrink-0"
        :tabs-padding="12"
        justify-content="space-evenly">
        <n-tab-pane name="members" :tab="t('home.chat_sidebar.tabs.members', '成员')">
          <!-- 成员列表与搜索被迁移至此处内部，但为保持代码结构，我们利用 v-show 切换内容区域 -->
        </n-tab-pane>
        <n-tab-pane name="files" :tab="t('home.chat_sidebar.tabs.files', '文件')"></n-tab-pane>
        <n-tab-pane name="pins" :tab="t('home.chat_sidebar.tabs.pins', '置顶')"></n-tab-pane>
      </n-tabs>

      <!-- 动态内容区域 -->
      <div v-show="activeTab === 'members'" class="flex flex-col flex-1 min-h-0">
        <!-- 成员搜索与统计 -->
        <n-flex
          align="center"
          justify="space-between"
          class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
          <span v-if="!isSearch" class="text-[var(--text-xs)] font-medium color-[--tjg-text-tertiary]">
            {{ t('home.chat_sidebar.online_members', { count: onlineCountDisplay }) }}
          </span>
          <n-input
            v-else
            :on-input="handleSearch"
            @blur="handleBlur"
            ref="inputInstRef"
            v-model:value="searchRef"
            clearable
            :placeholder="t('home.chat_sidebar.search.placeholder')"
            type="text"
            size="small"
            spellCheck="false"
            autoComplete="off"
            class="flex-1 bg-[--tjg-surface-search] border-none rounded-6px text-[var(--text-xs)]">
            <template #prefix>
              <svg class="size-12px color-[--tjg-text-tertiary]">
                <use href="#search"></use>
              </svg>
            </template>
          </n-input>
          <n-button v-if="!isSearch" size="tiny" quaternary circle @click="handleSelect">
            <template #icon>
              <svg class="size-14px color-[--tjg-text-secondary]">
                <use href="#search"></use>
              </svg>
            </template>
          </n-button>
        </n-flex>

        <!-- 成员列表（按 presence 分在线/离线两组） -->
        <div class="flex-1 min-h-0 relative">
          <div id="image-chat-sidebar" class="h-full overflow-y-auto px-6px py-4px" @scroll="handleScroll($event)">
            <template v-for="item in memberListItems" :key="item.key">
              <!-- 分组标题 -->
              <div
                v-if="item.kind === 'header'"
                :data-testid="`group-header-${item.group}`"
                :role="item.group === 'offline' ? 'button' : undefined"
                :aria-expanded="item.group === 'offline' ? !offlineCollapsed : undefined"
                class="flex items-center gap-4px h-32px px-8px select-none text-[var(--text-xs)] color-[--tjg-text-tertiary]"
                :class="
                  item.group === 'offline' ? 'cursor-pointer hover:color-[--tjg-text-secondary]' : 'cursor-default'
                "
                @click="item.group === 'offline' && toggleOffline()">
                <svg
                  v-if="item.group === 'offline'"
                  class="size-10px color-[--tjg-text-tertiary] transition-transform"
                  :class="offlineCollapsed ? 'rotate-0' : 'rotate-90'">
                  <use href="#right"></use>
                </svg>
                <span>
                  {{
                    item.group === 'online'
                      ? t('home.chat_sidebar.groups.online', '在线')
                      : t('home.chat_sidebar.groups.offline', '离线')
                  }}—{{ item.count }}
                </span>
              </div>
              <!-- 成员行 -->
              <n-popover
                v-else
                :ref="(el: any) => (infoPopoverRefs[item.user.uid] = el)"
                @update:show="handlePopoverUpdate(item.user.uid, $event)"
                trigger="click"
                placement="left"
                :show-arrow="false"
                style="padding: 0; background: var(--tjg-surface-panel)">
                <template #trigger>
                  <ContextMenu
                    :content="item.user"
                    @select="$event.click(item.user, 'Sidebar')"
                    :menu="optionsList"
                    :special-menu="report">
                    <n-flex
                      @click="onClickMember(item.user)"
                      :key="item.user.uid"
                      :size="10"
                      align="center"
                      justify="space-between"
                      class="item">
                      <n-flex align="center" :size="8" class="flex-1 truncate">
                        <div class="relative inline-flex items-center justify-center">
                          <n-avatar
                            round
                            class="grayscale"
                            :class="{ 'grayscale-0': item.user.activeStatus === OnlineEnum.ONLINE }"
                            :size="26"
                            :color="'var(--tjg-text-inverse)'"
                            :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                            :src="AvatarUtils.getAvatarUrl(item.user.avatar)"
                            @load="userLoadedMap[item.user.uid] = true"
                            @error="userLoadedMap[item.user.uid] = true" />
                        </div>
                        <n-flex vertical :size="2" class="flex-1 truncate">
                          <p
                            :title="item.user.name"
                            class="text-[var(--text-xs)] truncate flex-1 leading-tight color-[--tjg-text-primary]">
                            {{ item.user.myName ? item.user.myName : item.user.name }}
                          </p>
                          <n-flex
                            v-if="item.user.userStateId && getUserState(item.user.userStateId)"
                            align="center"
                            :size="4"
                            class="flex-1">
                            <img
                              class="size-12px"
                              :src="getUserState(item.user.userStateId)?.url"
                              :alt="translateStateTitle(getUserState(item.user.userStateId)?.title)" />
                            <span
                              class="text-[10px] text-[--tjg-text-tertiary] flex-1 min-w-0 truncate"
                              :title="translateStateTitle(getUserState(item.user.userStateId)?.title)">
                              {{ translateStateTitle(getUserState(item.user.userStateId)?.title) }}
                            </span>
                          </n-flex>
                        </n-flex>
                      </n-flex>

                      <div
                        v-if="item.user.roleId === RoleEnum.LORD"
                        class="flex px-4px bg-[--tjg-color-danger-500]30 py-3px rounded-4px size-fit select-none">
                        <p class="text-(10px [--tjg-color-danger-500])">{{ t('home.chat_sidebar.roles.owner') }}</p>
                      </div>
                      <div
                        v-if="item.user.roleId === RoleEnum.ADMIN"
                        class="flex px-4px bg-[--tjg-color-primary-100] py-3px rounded-4px size-fit select-none">
                        <p class="text-(10px [--tjg-color-primary-500])">{{ t('home.chat_sidebar.roles.admin') }}</p>
                      </div>
                    </n-flex>
                  </ContextMenu>
                </template>
                <!-- 用户个人信息框 -->
                <InfoPopover
                  v-if="selectKey === item.user.uid"
                  :uid="item.user.uid"
                  :activeStatus="item.user.activeStatus" />
              </n-popover>
            </template>
          </div>
        </div>
      </div>

      <!-- 文件 Tab 占位 -->
      <div v-show="activeTab === 'files'" class="flex-1 min-h-0 flex flex-col">
        <!-- 头部空间配额统计 -->
        <n-flex
          align="center"
          justify="space-between"
          class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
          <span class="text-[var(--text-xs)] font-medium color-[--tjg-text-tertiary]">
            {{ t('home.chat_sidebar.quota.title', '空间配额') }}
          </span>
          <span class="text-[var(--text-xs)] color-[--tjg-color-primary-500]">
            {{ '1.2 GB / 5.0 GB' }}
          </span>
        </n-flex>
        <!-- 进度条占位 -->
        <div class="px-12px py-8px shrink-0 border-b border-[--tjg-border-default]">
          <n-progress
            type="line"
            :percentage="24"
            :height="4"
            :show-indicator="false"
            color="var(--tjg-color-primary-500)" />
        </div>

        <div class="flex-1 flex items-center justify-center">
          <n-empty :description="t('home.chat_sidebar.empty.files', '暂无群文件')">
            <template #icon>
              <svg class="size-48px opacity-50 color-[--tjg-text-quaternary]">
                <use href="#folder"></use>
              </svg>
            </template>
          </n-empty>
        </div>
      </div>

      <!-- 置顶 Tab 占位 -->
      <div v-show="activeTab === 'pins'" class="flex-1 min-h-0 flex items-center justify-center">
        <n-empty :description="t('home.chat_sidebar.empty.pins', '暂无置顶消息')" />
      </div>
    </div>
  </main>
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useDebounceFn } from '@vueuse/core'
import type { InputInst } from 'naive-ui'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import AnnouncementPanel from '@/components/room/AnnouncementPanel.vue'
import { useChatMain } from '@/composables/chat/useChatMain'
import { useRoomType } from '@/composables/chat/useRoomType'
import { useLinkSegments } from '@/composables/common/useLinkSegments'
import { useMitt } from '@/composables/common/useMitt'
import { usePopover } from '@/composables/common/usePopover'
import { useWindow } from '@/composables/common/useWindow'
import { MittEnum, OnlineEnum, RoleEnum, RoomTypeEnum, ThemeEnum, WsResponseMessageType } from '@/enums'
import { matrixContactService } from '@/services/matrix/user/MatrixContactService'
import type { UserItem } from '@/services/types'
import { useAnnouncementStore } from '@/stores/domains/chat/announcement'
import { useGroupStore } from '@/stores/domains/chat/group'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { AvatarUtils } from '@/utils/AvatarUtils'

import { createLogger } from '@/utils/Logger'

const logger = createLogger('ChatSidebar')

const { t } = useI18n()
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const emit = defineEmits<(e: 'ready') => void>()
const { createWebviewWindow } = useWindow()
const groupStore = useGroupStore()
const globalStore = useGlobalStore()
const settingStore = useSettingStore()
const announcementStore = useAnnouncementStore()
const { clearAnnouncements } = announcementStore
const showAnnouncementPanel = ref(false)
const currentRoomId = computed(() => globalStore.currentSessionRoomId)
// 当前加载的群聊ID
// 如果成员列表未完全加载，使用当前列表的在线人数，避免与头像显示不一致
const onlineCountDisplay = computed(
  () =>
    groupStore.onlineCountMap[globalStore.currentSessionRoomId] ??
    groupStore.userList.filter((m) => m.activeStatus === OnlineEnum.ONLINE).length
)
const isGroup = useRoomType().isGroup
// 公告相关计算属性
const { announcementContent, announNum, announError, isAddAnnoun } = storeToRefs(announcementStore)
const { segments: announcementSegments, openLink: openAnnouncementLink } = useLinkSegments(announcementContent)

const activeTab = ref('members')
/** 是否是搜索模式 */
const isSearch = ref(false)
const searchRef = ref('')
const searchRequestId = ref(0)
/** List中的Popover组件实例 */
const infoPopoverRefs = ref<Record<string, { setShow: (show: boolean) => void } | null>>({})
const inputInstRef = ref<InputInst | null>(null)
const isCollapsed = ref(true)
const { optionsList, report, selectKey } = useChatMain()
const { handlePopoverUpdate, enableScroll } = usePopover(selectKey, 'image-chat-sidebar')
provide('popoverControls', { enableScroll })

// 用于稳定展示的用户列表
const displayedUserList = ref<UserItem[]>([])
/** 用户信息加载状态 */
const userLoadedMap = ref<Record<string, boolean>>({})

// ==== P0-1: 成员列表按 presence 分在线/离线两组 ====
interface MemberHeaderItem {
  key: string
  kind: 'header'
  group: 'online' | 'offline'
  count: number
}
interface MemberRowItem {
  key: string
  kind: 'member'
  user: UserItem
}
type MemberListItem = MemberHeaderItem | MemberRowItem

/** 离线组默认折叠 */
const offlineCollapsed = ref(true)
const toggleOffline = () => {
  offlineCollapsed.value = !offlineCollapsed.value
}

/** 按 presence 将成员分为在线/离线两组（在线 = activeStatus === ONLINE） */
const groupedMembers = computed(() => {
  const online = displayedUserList.value.filter((m) => m.activeStatus === OnlineEnum.ONLINE)
  const offline = displayedUserList.value.filter((m) => m.activeStatus !== OnlineEnum.ONLINE)
  return { online, offline, onlineCount: online.length, offlineCount: offline.length }
})

/** 列表渲染用的扁平项：分组标题 + 成员行（离线组折叠时不包含其成员） */
const memberListItems = computed<MemberListItem[]>(() => {
  const items: MemberListItem[] = []
  const { online, offline, onlineCount, offlineCount } = groupedMembers.value
  items.push({ key: 'header-online', kind: 'header', group: 'online', count: onlineCount })
  for (const m of online) items.push({ key: `member-online-${m.uid}`, kind: 'member', user: m })
  if (offlineCount > 0) {
    items.push({ key: 'header-offline', kind: 'header', group: 'offline', count: offlineCount })
    if (!offlineCollapsed.value) {
      for (const m of offline) items.push({ key: `member-offline-${m.uid}`, kind: 'member', user: m })
    }
  }
  return items
})

watch(
  () => [globalStore.currentSessionRoomId, isGroup.value] as const,
  async ([roomId, isGroupChat], prevValue) => {
    const [prevRoomId, prevIsGroup] = prevValue ?? [undefined, undefined]
    if (!roomId || !isGroupChat) {
      clearAnnouncements()
      return
    }

    if (roomId === prevRoomId && prevIsGroup === isGroupChat) {
      return
    }

    try {
      await announcementStore.loadGroupAnnouncements(roomId)
    } catch (error) {
      logger.error('刷新群公告失败:', error)
    }
  },
  { immediate: true }
)

const onClickMember = async (item: UserItem) => {
  logger.debug('点击用户', item)
  selectKey.value = item.uid

  // 获取用户的最新数据，并更新 pinia
  matrixContactService.getUserByIds([item.uid]).then((users) => {
    if (users && users.length > 0) {
      groupStore.updateUserItem(item.uid, users[0])
    }
  })
}

// 监听成员源列表变化
watch(
  () => groupStore.userList,
  (newList) => {
    if (searchRef.value.trim()) {
      return
    }

    displayedUserList.value = Array.isArray(newList) ? [...newList] : []
  },
  { immediate: true }
)

/**
 * 监听搜索输入过滤用户
 * @param value 输入值
 */
const handleSearch = useDebounceFn((value: string) => {
  searchRef.value = value
  const keyword = value.trim().toLowerCase()

  // 如果没有搜索关键字,显示全部成员
  if (!keyword) {
    displayedUserList.value = Array.isArray(groupStore.userList) ? [...groupStore.userList] : []
    return
  }

  // 前端本地过滤成员列表
  const filteredList = groupStore.userList.filter((member) => {
    const matchName = member.name?.toLowerCase().includes(keyword)
    const matchMyName = member.myName?.toLowerCase().includes(keyword)
    return matchName || matchMyName
  })

  displayedUserList.value = filteredList
}, 10)

const handleBlur = () => {
  if (searchRef.value) return
  isSearch.value = false
  searchRequestId.value++
  displayedUserList.value = Array.isArray(groupStore.userList) ? [...groupStore.userList] : []
}

/**
 * 处理滚动事件
 * @param event 滚动事件
 */
const handleScroll = (event: Event) => {
  if (searchRef.value.trim()) {
    return
  }

  const target = event.target as HTMLElement
  const isBottom = target.scrollHeight - target.scrollTop === target.clientHeight

  if (isBottom && !groupStore.userListOptions.loading) {
    groupStore.loadMoreGroupMembers()
  }
}

/**
 * 切换搜索模式并自动聚焦输入框
 */
const handleSelect = () => {
  isSearch.value = !isSearch.value

  if (isSearch.value) {
    nextTick(() => {
      inputInstRef.value?.select()
    })
  } else {
    searchRequestId.value++
    searchRef.value = ''
    displayedUserList.value = Array.isArray(groupStore.userList) ? [...groupStore.userList] : []
  }
}

/**
 * 打开群公告
 */
const handleOpenAnnoun = (_isAdd: boolean) => {
  showAnnouncementPanel.value = true
}

const userStatusStore = useUserStatusStore()
const { stateList } = storeToRefs(userStatusStore)

const getUserState = (stateId: string) => {
  return stateList.value.find((state: { id: string }) => state.id === stateId)
}

const translateStateTitle = (title?: string) => {
  if (!title) return ''
  const key = `auth.onlineStatus.states.${title}`
  const translated = t(key)
  return translated === key ? title : translated
}

appWindow?.listen<{ hasAnnouncements?: boolean }>('announcementUpdated', async (event) => {
  if (event.payload) {
    const { hasAnnouncements } = event.payload
    if (hasAnnouncements) {
      // 初始化群公告
      await announcementStore.loadGroupAnnouncements()
      await nextTick()
    }
  }
})

onMounted(async () => {
  // 通知父级：Sidebar 已挂载，可移除占位
  emit('ready')

  useMitt.on(`${MittEnum.INFO_POPOVER}-Sidebar`, (event: { uid: string }) => {
    selectKey.value = event.uid
    infoPopoverRefs.value[event.uid]?.setShow(true)
    handlePopoverUpdate(event.uid)
  })

  useMitt.on(MittEnum.OPEN_ANNOUNCEMENT_PANEL, () => {
    showAnnouncementPanel.value = true
  })

  appWindow?.listen('announcementClear', async () => {
    clearAnnouncements()
  })

  // 初始化时获取当前群组用户的信息
  if (groupStore.userList.length > 0) {
    // 初始展示当前列表
    displayedUserList.value = [...groupStore.userList]
    const currentRoom = globalStore.currentSessionRoomId
    if (currentRoom) {
      const matrixMembers = displayedUserList.value.map((u) => ({
        userId: u.uid,
        displayName: u.name ?? null,
        avatarUrl: u.avatar ?? null,
        membership: 'join' as const,
        powerLevel: 0,
        isModerator: false,
        isCreator: false,
        name: u.name,
        uid: u.uid,
        account: u.account,
        avatar: u.avatar,
        activeStatus: u.activeStatus,
        roleId: u.roleId ?? 0,
        lastOptTime: u.lastOptTime,
        myName: u.myName,
        userStateId: u.userStateId
      }))
      groupStore.updateMemberCache(currentRoom, matrixMembers)
    }
    const handleAnnounInitOnEvent = (shouldReload: boolean) => {
      return async (event: unknown) => {
        if (shouldReload || event) {
          await announcementStore.loadGroupAnnouncements()
        }
      }
    }
    // 监听群公告消息
    useMitt.on(WsResponseMessageType.ROOM_GROUP_NOTICE_MSG, handleAnnounInitOnEvent(true))
    useMitt.on(WsResponseMessageType.ROOM_EDIT_GROUP_NOTICE_MSG, handleAnnounInitOnEvent(true))
  }
})

onUnmounted(() => {
  groupStore.cleanupSession()
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/chat-sidebar';
</style>
