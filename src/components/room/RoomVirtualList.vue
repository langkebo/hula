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
      @load-more="handleLoadMore"
    >
      <template #default="{ item, index }">
        <RoomListItem
          :room="item"
          :is-selected="item.roomId === currentRoomId"
          @click="handleRoomClick(item)"
          @context-menu="handleContextMenu($event, item)"
        />
      </template>
    </VirtualList>

    <!-- 空状态 -->
    <n-empty
      v-if="!isLoading && roomListData.length === 0"
      description="暂无房间"
      class="mt-8"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import VirtualList from '@/components/common/VirtualList.vue'
import RoomListItem from './RoomListItem.vue'
import { useRoomStore, type RoomInfo } from '@/stores/room'
import { useMatrixStore } from '@/stores/matrix'
import matrixSlidingSyncService from '@/services/matrix/MatrixSlidingSyncService'
import { info } from '@tauri-apps/plugin-log'
import { roomPerformanceMonitor } from '@/utils/RoomPerformance'

interface RoomListItemData extends RoomInfo {
  _index: number
}

const emit = defineEmits<{
  roomClick: [room: RoomInfo]
  roomContextMenu: [room: RoomInfo, event: MouseEvent]
}>()

const roomStore = useRoomStore()
const matrixStore = useMatrixStore()

// 响应式状态
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

// 处理滚动事件
function handleScroll(event: Event) {
  // 可以添加滚动时的节流处理
}

// 处理可见项变化（核心：与 Sliding Sync 集成）
async function handleVisibleItemsChange(ids: string[]) {
  visibleRoomIds.value = ids
  
  // 获取可见房间 ID
  const visibleIds = ids.filter(id => id)
  
  if (visibleIds.length === 0) return

  info(`[RoomVirtualList] Visible rooms changed: ${visibleIds.length} rooms`)

  // 调用 Sliding Sync 更新可见范围
  const startIndex = roomListData.value.findIndex(r => r.roomId === visibleIds[0])
  const endIndex = roomListData.value.findIndex(r => r.roomId === visibleIds[visibleIds.length - 1])
  
  if (startIndex >= 0 && endIndex >= 0) {
    matrixSlidingSyncService.updateVisibleRange(startIndex, endIndex)
  }

  // 预加载可见房间的详情（按需加载优化）
  const roomIdsToPreload = visibleIds.filter(id => {
    const room = roomStore.rooms.get(id)
    return room && !room.detail
  })

  if (roomIdsToPreload.length > 0) {
    info(`[RoomVirtualList] Preloading ${roomIdsToPreload.length} room details`)
    await roomStore.loadRoomDetails(roomIdsToPreload)
  }
}

// 处理加载更多
async function handleLoadMore() {
  if (isLoadingMore.value || !hasMore.value) return

  isLoadingMore.value = true
  try {
    // 可以调用 Sliding Sync 获取更多房间
    // 目前先简单处理
    hasMore.value = false
  } finally {
    isLoadingMore.value = false
  }
}

// 处理房间点击
function handleRoomClick(room: RoomInfo) {
  roomStore.setCurrentRoom(room.roomId)
  emit('roomClick', room)
}

// 处理右键菜单
function handleContextMenu(event: MouseEvent, room: RoomInfo) {
  event.preventDefault()
  emit('roomContextMenu', room, event)
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
    console.error('[RoomVirtualList] Failed to initialize SlidingSync:', err)
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
@media (min-width: 769px) and (max-width: 1024px) {
  .room-virtual-list {
    /* 平板端适中宽度 */
  }
}
</style>
