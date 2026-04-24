<template>
  <div class="room-virtual-list">
    <!-- 加载状态 -->
    <n-flex v-if="isLoading" justify="center" class="py-4">
      <n-spin size="medium" />
    </n-flex>

    <!-- 虚拟列表 -->
    <VirtualList
      v-else
      :items="roomListData"
      :estimated-item-height="72"
      :buffer="3"
      :is-loading-more="isLoadingMore"
      :is-last="!hasMore"
      :list-key="'roomId'"
      @scroll="handleScroll"
      @visible-items-change="handleVisibleItemsChange"
      @load-more="handleLoadMore">
      <template #default="{ item, index }">
        <RoomListItem
          :room="item"
          :is-selected="item.roomId === currentRoomId"
          @click="handleRoomClick(item)"
          @context-menu="handleContextMenu($event, item)" />
      </template>
    </VirtualList>

    <!-- 空状态 -->
    <n-empty v-if="!isLoading && roomListData.length === 0" description="暂无房间" class="mt-8" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VirtualList from '@/components/common/VirtualList.vue'
import RoomListItem from './RoomListItem.vue'
import { useRoomStore } from '@/stores/domains/chat/room'
import type { RoomInfo } from '@/services/types'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import matrixSlidingSyncService from '@/services/matrix/sync/MatrixSlidingSyncService'
import { info } from '@tauri-apps/plugin-log'
import { roomPerformanceMonitor } from '@/utils/RoomPerformance'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomVirtualList')

interface RoomListItemData extends RoomInfo {
  _index: number
}

const emit = defineEmits<{
  roomClick: [room: RoomInfo]
  roomContextMenu: [room: RoomInfo, event: MouseEvent]
}>()

const roomStore = useRoomStore()
const matrixStore = useMatrixStore()

const isLoadingMore = ref(false)
const hasMore = ref(true)
const visibleRoomIds = ref<string[]>([])

// 计算属性
const isLoading = computed(() => roomStore.isLoading)
const currentRoomId = computed(() => roomStore.currentRoomId)
const roomList = computed(() => roomStore.roomList)

// 转换为虚拟列表需要的数据格式
const roomListData = computed<RoomListItemData[]>(() => {
  return roomList.value.map((room, index) => ({
    ...room,
    _index: index
  }))
})

// 处理房间点击
const handleRoomClick = (room: RoomInfo) => {
  emit('roomClick', room)
}

// 处理右键菜单
const handleContextMenu = (event: MouseEvent, room: RoomInfo) => {
  emit('roomContextMenu', room, event)
}

// 处理滚动
const handleScroll = (_event: Event) => {
  // 可以用于滚动位置恢复
}

// 处理可见项变化
const handleVisibleItemsChange = (ids: string[]) => {
  visibleRoomIds.value = ids
}

// 处理加载更多
const handleLoadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) return

  isLoadingMore.value = true
  try {
    await roomStore.loadRooms()
    hasMore.value = false
  } catch (error) {
    logger.error('加载更多房间失败:', error)
  } finally {
    isLoadingMore.value = false
  }
}

// 初始化
onMounted(async () => {
  // 启动性能监控
  roomPerformanceMonitor.startFPSMonitor()

  // 开始计时
  roomPerformanceMonitor.startMark('load-rooms')

  // 加载房间列表
  await roomStore.loadRooms()

  // 结束计时
  roomPerformanceMonitor.endMark('load-rooms')

  // 更新缓存项数量
  roomPerformanceMonitor.updateCachedItems(roomStore.rooms.size)

  // 初始化 Sliding Sync 服务
  try {
    await matrixSlidingSyncService.initialize()
    info('[RoomVirtualList] SlidingSync initialized')
  } catch (err) {
    logger.error('Failed to initialize SlidingSync:', err)
  }
})

// 组件卸载时停止监控
onUnmounted(() => {
  roomPerformanceMonitor.stopFPSMonitor()
  roomPerformanceMonitor.report()
})
</script>

<style scoped>
.room-virtual-list {
  height: 100%;
  overflow: hidden;
}

/* 响应式设计 - 移动端 */
@media (max-width: 768px) {
  .room-virtual-list {
    /* 移动端全屏显示 */
  }
}

/* 平板端 */
@media (max-width: 1024px) {
  .room-virtual-list {
    /* 平板端样式 */
  }
}
</style>
