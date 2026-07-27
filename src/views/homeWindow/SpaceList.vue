<template>
  <div class="space-list-page h-full flex">
    <!-- 中间栏：空间列表（右侧栏由 layout/right/index.vue 渲染 SpaceChildrenPane） -->
    <SpaceListPane
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
</template>

<script lang="ts" setup name="spaceList">
import { useI18n } from 'vue-i18n'
import type { SpaceListItem } from '@/components/workbench/SpaceListPane.vue'
import SpaceListPane from '@/components/workbench/SpaceListPane.vue'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAriaLive } from '@/composables/common/useAriaLive'
import { useSpaces } from '@/composables/space'
import { buildCreateSpaceRoute, buildSpaceRoute } from '@/router/spaceNavigation'
import { matrixSpaceService } from '@/services/matrix/room/MatrixSpaceService'
import { useRoomStore } from '@/stores/domains/chat/room'

const { t } = useI18n()
const { announce } = useAriaLive()
const { showFeedback } = useActionFeedback()
const router = useRouter()
const roomStore = useRoomStore()

// 空间列表数据
const { spaces, loading: spaceLoading, load: reloadSpaces } = useSpaces()

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
  background: var(--hula-surface-panel);
}
</style>
