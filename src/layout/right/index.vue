<template>
  <!-- Step 2.3：视图驱动动态宽度 + 拖拽调整 + 响应式断点全屏 -->
  <main
    data-tauri-drag-region
    class="bg-[--right-bg-color] flex flex-col min-h-0 border-l border-[--hula-border-layout-divider] relative"
    :class="{
      'right-pane-animated': transitionEnabled,
      'flex-1 w-full': isRightPaneFullscreen
    }"
    :style="isRightPaneFullscreen ? undefined : { width: `${paneWidth}px`, flex: '0 0 auto' }">
    <!-- Step 2.3：左边缘拖拽分隔条（14px，hover 显示拖拽图标） -->
    <div
      v-if="!isRightPaneFullscreen"
      class="right-pane-drag-handle"
      data-test="right-pane-drag-handle"
      @pointerdown="startDrag">
      <div class="drag-icon" :class="{ 'drag-icon--active': isDragging }">
        <svg class="size-16px">
          <use href="#sliding"></use>
        </svg>
      </div>
    </div>

    <div
      :style="{ background: shouldShowChat ? 'var(--right-theme-bg-color)' : '' }"
      data-tauri-drag-region
      class="flex-1 flex flex-col min-h-0">
      <ActionBar :current-label="appWindow?.label" />

      <!-- 阶段 2/4：右侧栏视图状态机，路由为单一真相源 -->
      <div class="flex-1 min-h-0 flex flex-col">
        <ChatBox v-if="shouldShowChat" />

        <template v-else-if="needsActionBar">
          <!-- 阶段 2/4：视图 ActionBar（48px），非 empty/chat/search 视图显示返回按钮 + 标题 -->
          <header
            data-tauri-drag-region
            class="h-48px flex items-center gap-12px px-12px border-b border-[--hula-border-layout-divider] bg-[--hula-surface-panel]">
            <button
              type="button"
              class="flex-center size-28px rounded-6px hover:bg-[--hula-surface-list-hover] color-[--hula-text-secondary] cursor-pointer"
              :aria-label="t('common.back', '返回')"
              :title="t('common.back', '返回')"
              @click="handleBack">
              <svg class="size-16px"><use href="#left-bar"></use></svg>
            </button>
            <span class="text-14px font-medium color-[--hula-text-primary] truncate">{{ viewTitle }}</span>
          </header>

          <div class="flex-1 min-h-0 flex flex-col">
            <Details v-if="showDetails" :content="detailsContent" />
            <ApplyList v-else-if="rightView === 'applyList'" :type="applyListType" />
            <!-- 阶段 4：弹窗改造为右侧栏内嵌面板 -->
            <AddFriendPane v-else-if="rightView === 'addFriend'" />
            <CreateRoomPane v-else-if="rightView === 'createRoom'" />
            <JoinRoomPane v-else-if="rightView === 'joinRoom'" />
            <CreateSpacePane v-else-if="rightView === 'createSpace'" />
            <!-- Step 1.1：空间子房间视图（路由派生 spaceId，SpaceChildrenPane 自包含加载数据） -->
            <SpaceChildrenPane v-else-if="rightView === 'spaceChildren'" />
          </div>
        </template>

        <!-- 阶段 3：全局搜索视图（自带搜索输入区，无需顶部 ActionBar） -->
        <SearchPane v-else-if="rightView === 'search'" :initial-query="searchInitialQuery" :type="searchType" />

        <!-- 聊天界面背景图标 -->
        <div
          v-else
          class="flex-center size-full select-none flex-col gap-16px text-[var(--text-xs)] color-[--hula-text-tertiary] bg-[--hula-surface-panel]">
          <n-empty :description="t('home.chat_sidebar.empty.no_chat_selected', '未选择会话')" size="huge">
            <template #icon>
              <svg class="size-60px opacity-50 color-[--hula-text-quaternary]">
                <use href="#chat"></use>
              </svg>
            </template>
            <template #extra>
              <n-text depth="3" class="text-[var(--text-xs)] mt-8px inline-block">
                {{ t('home.chat_sidebar.empty.select_to_start', '选择一个会话或发起新聊天') }}
              </n-text>
            </template>
          </n-empty>
        </div>
      </div>
    </div>
  </main>
</template>
<script setup lang="ts">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AddFriendPane from '@/components/friend/AddFriendPane.vue'
import CreateRoomPane from '@/components/room/CreateRoomPane.vue'
import JoinRoomPane from '@/components/room/JoinRoomPane.vue'
import SearchPane from '@/components/search/SearchPane.vue'
import CreateSpacePane from '@/components/space/CreateSpacePane.vue'
import SpaceChildrenPane from '@/components/space/SpaceChildrenPane.vue'
import { useMitt } from '@/composables/common/useMitt'
import { useResponsiveBreakpoint } from '@/composables/layout/useResponsiveBreakpoint'
import { useRightPaneWidth } from '@/composables/layout/useRightPaneWidth'
import { MittEnum, RoomTypeEnum } from '@/enums'
import { useRightView } from '@/layout/right/useRightView'
import router from '@/router'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { hasTauriRuntime } from '@/utils/AppHarness'

const { t } = useI18n()
const route = useRoute()
const appWindow = hasTauriRuntime() ? WebviewWindow.getCurrent() : null
const globalStore = useGlobalStore()
const { currentSessionRoomId } = storeToRefs(globalStore)
const { rightView } = useRightView()

// Step 2.3：响应式断点（shrink 模式下右侧栏全屏）
const { isRightPaneFullscreen, isShrink } = useResponsiveBreakpoint()

// Step 2.3：视图驱动动态宽度 + 拖拽 + localStorage 持久化
const { width: paneWidth, isDragging, transitionEnabled, startDrag } = useRightPaneWidth({ rightView })

// 兼容旧代码：发射 SHRINK_WINDOW 事件通知左侧栏和消息列表
watchEffect(() => {
  useMitt.emit(MittEnum.SHRINK_WINDOW, isShrink.value)
})

// 只要路由在消息页且选中了会话（即便会话详情尚未同步），就展示 ChatBox
const shouldShowChat = computed(() => rightView.value === 'chat' && !!currentSessionRoomId.value)

// 详情视图：好友详情或房间详情（路由参数派生 content）
const showDetails = computed(() => rightView.value === 'details')
const detailsContent = computed<{ type: RoomTypeEnum; uid: string }>(() => {
  const userId = route.params.userId as string | undefined
  const roomId = route.params.roomId as string | undefined
  if (userId) return { type: RoomTypeEnum.SINGLE, uid: userId }
  if (roomId) return { type: RoomTypeEnum.GROUP, uid: roomId }
  return { type: RoomTypeEnum.SINGLE, uid: '' }
})

// 好友申请列表类型：默认 friend，支持 query?type=group
const applyListType = computed<'friend' | 'group'>(() => {
  return route.query.type === 'group' ? 'group' : 'friend'
})

// 阶段 4：需要顶部 ActionBar 的视图（详情/申请列表/各表单面板/空间子房间）
const needsActionBar = computed(() =>
  ['details', 'applyList', 'addFriend', 'createRoom', 'joinRoom', 'createSpace', 'spaceChildren'].includes(
    rightView.value
  )
)

// 阶段 3：全局搜索初始关键词，从路由 query.q 派生
const searchInitialQuery = computed(() => {
  const q = route.query.q
  return typeof q === 'string' ? q : ''
})

// Step 2.4：全局搜索类型，从路由 query.type 派生（'space' 仅空间，其他为全分类）
const searchType = computed<'all' | 'space'>(() => (route.query.type === 'space' ? 'space' : 'all'))

// 阶段 2/4：视图 ActionBar 标题（与 RightViewType 对应）
const viewTitle = computed(() => {
  switch (rightView.value) {
    case 'details':
      return route.params.userId ? t('friend.detail.title', '好友详情') : t('room.detail.title', '房间详情')
    case 'applyList':
      return applyListType.value === 'group'
        ? t('home.apply_list.group_notice', '群申请通知')
        : t('home.apply_list.friend_notice', '好友申请')
    case 'addFriend':
      return t('friend.add.title', '添加好友')
    case 'createRoom':
      return t('room.create.title', '创建房间')
    case 'joinRoom':
      return t('room.join.title', '加入房间')
    case 'createSpace':
      return t('space.create', '创建空间')
    case 'spaceChildren':
      return t('space.detail_title', '空间详情')
    case 'search':
      return t('search.title', '全局搜索')
    default:
      return ''
  }
})

// 阶段 2：返回按钮 - 路由驱动，使用 router.back() 返回上一视图
const handleBack = () => {
  if (window.history.length > 1) {
    void router.back()
  } else {
    // 无历史记录时回到默认空状态
    const fallback = route.path.startsWith('/room') ? '/room' : route.path.startsWith('/space') ? '/space' : '/friend'
    void router.push(fallback)
  }
}

// 兼容历史：移动端好友列表仍可能 emit DETAILS_SHOW 关闭事件，统一转为 router.back
useMitt.on(MittEnum.DETAILS_SHOW, () => {
  // 阶段 2：路由驱动后，关闭详情等价于返回上一视图
  if (window.history.length > 1) {
    void router.back()
  } else {
    // 无历史记录时回到默认空状态
    void router.push('/friend')
  }
})
</script>

<style scoped lang="scss">
/* Step 2.3：视图驱动动态宽度过渡动画 */
.right-pane-animated {
  transition:
    width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    flex 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Step 2.3：左边缘拖拽分隔条（14px，hover 显示拖拽图标） */
.right-pane-drag-handle {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 60px;
  z-index: 10;
  cursor: col-resize;
  touch-action: none;
  display: flex;
  align-items: center;
  justify-content: center;

  .drag-icon {
    width: 14px;
    height: 60px;
    background: var(--hula-surface-sidebar-selected);
    border-radius: 8px 0 0 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;

    svg {
      color: var(--hula-text-tertiary);
      position: relative;
      right: -2px;
    }
  }

  &:hover .drag-icon,
  .drag-icon--active {
    opacity: 1;
  }
}
</style>
