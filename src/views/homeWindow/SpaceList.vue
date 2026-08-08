<template>
  <div class="space-list-page h-full flex flex-col" role="main" :aria-label="t('home.plugins.space_list')">
    <!-- 视图切换工具条：列表 / 层级树 -->
    <div v-if="!isLoading" class="space-list-page__view-bar" role="tablist" :aria-label="t('space.title')">
      <button
        type="button"
        role="tab"
        :aria-selected="viewMode === 'list'"
        :class="['space-list-page__view-tab', { 'space-list-page__view-tab--active': viewMode === 'list' }]"
        @click="viewMode = 'list'">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <circle cx="3.5" cy="6" r="1.5" />
          <circle cx="3.5" cy="12" r="1.5" />
          <circle cx="3.5" cy="18" r="1.5" />
        </svg>
        {{ t('space.filter_all') }}
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="viewMode === 'tree'"
        :class="['space-list-page__view-tab', { 'space-list-page__view-tab--active': viewMode === 'tree' }]"
        @click="viewMode = 'tree'">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="6" height="6" rx="1" />
          <rect x="15" y="3" width="6" height="6" rx="1" />
          <rect x="9" y="15" width="6" height="6" rx="1" />
          <path d="M6 9v3a2 2 0 0 0 2 2h2" />
          <path d="M18 9v3a2 2 0 0 1-2 2h-2" />
        </svg>
        {{ t('space.hierarchy') }}
      </button>
    </div>

    <div class="flex-1 min-h-0 flex">
      <!-- 中间栏：空间列表（右侧栏由 layout/right/index.vue 渲染 SpaceChildrenPane） -->
      <SkeletonSpaceTree v-if="isLoading" :rows="6" :aria-label="t('home.plugins.space_list')" aria-busy="true" />
      <!-- 层级树视图 -->
      <SpaceTree
        v-else-if="viewMode === 'tree'"
        class="flex-1 min-h-0 overflow-auto"
        :spaces="spaceTreeNodes"
        :selected-space-id="selectedSpaceId"
        :collapsed-ids="collapsedIds"
        @select="handleSelectSpace"
        @toggle="handleTreeToggle" />
      <!-- 列表视图 -->
      <SpaceListPane
        v-else
        :spaces="spaceItems"
        :selected-space-id="selectedSpaceId"
        :loading="spaceLoading"
        @select-space="handleSelectSpace"
        @pin-space="handlePinSpace"
        @space-settings="handleSelectSpace"
        @leave-space="handleLeaveSpace"
        @delete-space="handleDeleteSpace"
        @create-space="openCreateSpace" />
    </div>
  </div>
</template>

<script lang="ts" setup name="spaceList">
import { useI18n } from 'vue-i18n'
import SkeletonSpaceTree from '@/components/common/SkeletonSpaceTree.vue'
import type { SpaceTreeNode } from '@/components/space/SpaceTree.vue'
import SpaceTree from '@/components/space/SpaceTree.vue'
import type { SpaceListItem } from '@/components/workbench/SpaceListPane.vue'
import SpaceListPane from '@/components/workbench/SpaceListPane.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useSpaces } from '@/composables/space'
import { buildCreateSpaceRoute, buildSpaceRoute } from '@/router/spaceNavigation'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { useRoomStore } from '@/stores/domains/chat/room'

const props = defineProps<{ loading?: boolean }>()

const { t } = useI18n()
const { announce } = useAriaLive()
const { showFeedback } = useActionFeedback()
const router = useRouter()
const roomStore = useRoomStore()

// 空间列表数据
const { spaces, loading: spaceLoading, load: reloadSpaces } = useSpaces()

// loading prop 优先于内部 spaceLoading（用于外部强制显示骨架屏）
const isLoading = computed(() => props.loading || spaceLoading.value)

// 选中空间 ID：从路由参数派生（路由为单一真相源）
const route = useRoute()
const selectedSpaceId = computed(() => (route.params.spaceId as string) || '')

// 转换为 SpaceListItem 列表（带 isPublic 标记）
const spaceItems = computed<SpaceListItem[]>(() => {
  return spaces.value.map((space) => ({
    spaceId: space.spaceId,
    name: space.name,
    childCount: space.childCount,
    avatarUrl: space.avatarUrl,
    topic: space.topic,
    memberCount: space.memberCount,
    isPinned: roomStore.hasTag(space.spaceId, 'm.favourite'),
    isPublic: false // 默认为私有空间，后续可根据空间可见性扩展
  }))
})

// 视图模式：列表 / 层级树
const viewMode = ref<'list' | 'tree'>('list')
// 层级树折叠节点 ID（受控）
const collapsedIds = ref<string[]>([])

// 扁平空间列表转换为 SpaceTreeNode[]（顶层节点，暂无子空间层级）
const spaceTreeNodes = computed<SpaceTreeNode[]>(() =>
  spaces.value.map((space) => ({
    spaceId: space.spaceId,
    name: space.name,
    avatarUrl: space.avatarUrl,
    topic: space.topic,
    memberCount: space.memberCount,
    childCount: space.childCount
  }))
)

// 切换层级树节点展开/折叠
const handleTreeToggle = (spaceId: string) => {
  collapsedIds.value = collapsedIds.value.includes(spaceId)
    ? collapsedIds.value.filter((id) => id !== spaceId)
    : [...collapsedIds.value, spaceId]
}

// 选择空间：路由跳转（右侧栏由 layout/right/index.vue 渲染 SpaceChildrenPane）
const handleSelectSpace = (spaceId: string) => {
  if (!spaceId) return
  const spaceName = spaces.value.find((s) => s.spaceId === spaceId)?.name || spaceId
  announce(t('space.space_selected', { name: spaceName }), 'polite')
  void router.push(buildSpaceRoute(spaceId))
}

// 创建空间
const openCreateSpace = () => {
  void router.push(buildCreateSpaceRoute())
}

// 切换空间置顶状态（使用 m.favourite 房间标签）
const handlePinSpace = async (spaceId: string) => {
  if (!spaceId) return
  const isPinned = roomStore.hasTag(spaceId, 'm.favourite')
  try {
    if (isPinned) {
      await roomStore.removeRoomTag(spaceId, 'm.favourite')
      showFeedback(t('space.unpin_space'), 'success')
    } else {
      await roomStore.addRoomTag(spaceId, 'm.favourite')
      showFeedback(t('space.pin_space'), 'success')
    }
  } catch (err) {
    showFeedback(String(err), 'error')
  }
}

// 离开空间（带确认弹窗）
const handleLeaveSpace = (spaceId: string) => {
  if (!spaceId) return
  const spaceName = spaces.value.find((s) => s.spaceId === spaceId)?.name ?? spaceId
  window.$dialog?.create({
    title: t('space.leave_space'),
    content: t('space.leave_space_confirm', { name: spaceName }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixSpaceService.leaveSpace(spaceId)
        // 若离开的是当前选中的空间，返回空间列表
        if (selectedSpaceId.value === spaceId) {
          void router.push('/space')
        }
        await reloadSpaces()
        showFeedback(t('space.leave_space_success'), 'success')
      } catch (err) {
        showFeedback(String(err) || t('space.leave_space_failed'), 'error')
      }
    }
  })
}

// 删除空间（带确认弹窗，仅创建者可删除）
const handleDeleteSpace = (spaceId: string) => {
  if (!spaceId) return
  const spaceName = spaces.value.find((s) => s.spaceId === spaceId)?.name ?? spaceId
  window.$dialog?.create({
    title: t('space.delete_space'),
    content: t('space.delete_space_confirm', { name: spaceName }),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixSpaceService.deleteSpace(spaceId)
        if (selectedSpaceId.value === spaceId) {
          void router.push('/space')
        }
        await reloadSpaces()
        showFeedback(t('space.delete_space_success'), 'success')
      } catch (err) {
        showFeedback(String(err), 'error')
      }
    }
  })
}

// 初始化加载
onMounted(async () => {
  await reloadSpaces()
})
</script>

<style lang="scss" scoped>
.space-list-page {
  width: 100%;
  height: 100%;
  background: var(--tjg-surface-panel);
}

.space-list-page__view-bar {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--tjg-border-default);
  background: var(--tjg-surface-panel);
  flex-shrink: 0;
}

.space-list-page__view-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--tjg-radius-xs);
  background: transparent;
  color: var(--tjg-text-secondary);
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  cursor: pointer;
  transition:
    background-color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard),
    color var(--tjg-motion-duration-fast) var(--tjg-motion-ease-standard);

  &:hover {
    background: var(--tjg-surface-list-hover);
    color: var(--tjg-text-primary);
  }

  &--active {
    background: var(--tjg-color-primary-100);
    color: var(--tjg-color-primary-500);
  }

  &:focus-visible {
    outline: 2px solid var(--tjg-color-primary-500);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .space-list-page__view-tab {
    transition: none;
  }
}
</style>
