<template>
  <div class="room-list-container">
    <div class="list-header">
      <n-tabs v-model:value="activeTab" type="line" justify-content="space-evenly">
        <n-tab-pane name="rooms" :tab="t('room.tabs.rooms')">
          <template #tab>
            <div class="tab-label">
              <Icon icon="mdi:chat" :width="18" />
              <span>{{ t('room.tabs.rooms') }}</span>
              <n-badge v-if="roomCount > 0" :value="roomCount" :max="99" type="info" />
            </div>
          </template>
        </n-tab-pane>
        <n-tab-pane name="spaces" :tab="t('room.tabs.spaces')">
          <template #tab>
            <div class="tab-label">
              <Icon icon="mdi:folder-multiple" :width="18" />
              <span>{{ t('room.tabs.spaces') }}</span>
              <n-badge v-if="spaceCount > 0" :value="spaceCount" :max="99" type="info" />
            </div>
          </template>
        </n-tab-pane>
      </n-tabs>

      <div class="header-actions">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button text @click="handleAddClick">
              <template #icon>
                <Icon icon="mdi:plus" :width="20" />
              </template>
            </n-button>
          </template>
          {{ activeTab === 'rooms' ? t('room.add_room') : t('room.add_space') }}
        </n-tooltip>
      </div>
    </div>

    <div class="list-content">
      <n-spin :show="loading">
        <n-scrollbar style="max-height: calc(100vh - 200px)">
          <div v-if="activeTab === 'rooms'" class="room-items">
            <n-collapse v-if="groupedRooms.size > 0" :default-expanded-names="['recent', 'groups']">
              <n-collapse-item v-if="recentRooms.length > 0" name="recent" :title="t('room.groups.recent')">
                <RoomListItem
                  v-for="room in recentRooms"
                  :key="room.roomId"
                  :room="room"
                  @click="handleRoomClick(room)"
                  @context-menu="handleRoomContextMenu($event, room)" />
              </n-collapse-item>

              <n-collapse-item v-if="groupRooms.length > 0" name="groups" :title="t('room.groups.groups')">
                <RoomListItem
                  v-for="room in groupRooms"
                  :key="room.roomId"
                  :room="room"
                  @click="handleRoomClick(room)"
                  @context-menu="handleRoomContextMenu($event, room)" />
              </n-collapse-item>

              <n-collapse-item v-if="directRooms.length > 0" name="direct" :title="t('room.groups.direct')">
                <RoomListItem
                  v-for="room in directRooms"
                  :key="room.roomId"
                  :room="room"
                  @click="handleRoomClick(room)"
                  @context-menu="handleRoomContextMenu($event, room)" />
              </n-collapse-item>
            </n-collapse>

            <n-empty v-else :description="t('room.empty')" />
          </div>

          <div v-else class="space-items">
            <n-collapse v-if="spaces.length > 0" :default-expanded-names="['all']">
              <n-collapse-item name="all" :title="t('room.groups.all_spaces')">
                <SpaceItem
                  v-for="space in spaces"
                  :key="space.roomId"
                  :space="space"
                  @click="handleSpaceClick(space)"
                  @context-menu="handleSpaceContextMenu($event, space)" />
              </n-collapse-item>
            </n-collapse>

            <n-empty v-else :description="t('room.empty_spaces')" />
          </div>
        </n-scrollbar>
      </n-spin>
    </div>

    <n-dropdown
      placement="bottom-start"
      trigger="manual"
      :x="contextMenuX"
      :y="contextMenuY"
      :options="contextMenuOptions"
      :show="showContextMenu"
      @select="handleContextMenuSelect"
      @clickoutside="showContextMenu = false" />

    <CreateRoomDialog v-model:visible="showCreateRoomDialog" @created="handleRoomCreated" />
    <CreateSpaceDialog v-model:visible="showCreateSpaceDialog" @created="handleSpaceCreated" />
    <RoomInfoPanel v-model:visible="showRoomInfo" :room="selectedRoom" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import {
  NTabs,
  NTabPane,
  NButton,
  NTooltip,
  NCollapse,
  NCollapseItem,
  NSpin,
  NScrollbar,
  NEmpty,
  NBadge,
  NDropdown,
  NIcon,
  useMessage
} from 'naive-ui'
import { Icon } from '@iconify/vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useRoomStore } from '@/stores/room'
import { useSpaceStore, type Space } from '@/stores/space'
import { createLogger } from '@/utils/Logger'
import RoomListItem from '@/components/room/RoomListItem.vue'
import SpaceItem from '@/components/space/SpaceItem.vue'
import CreateRoomDialog from '@/components/room/CreateRoomDialog.vue'
import CreateSpaceDialog from '@/components/space/CreateSpaceDialog.vue'
import RoomInfoPanel from '@/components/room/RoomInfoPanel.vue'

const logger = createLogger('RoomList')
const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const roomStore = useRoomStore()
const spaceStore = useSpaceStore()

const activeTab = ref('rooms')
const loading = ref(false)
const showCreateRoomDialog = ref(false)
const showCreateSpaceDialog = ref(false)
const showRoomInfo = ref(false)
const selectedRoom = ref<any>(null)

const contextMenuX = ref(0)
const contextMenuY = ref(0)
const showContextMenu = ref(false)
const contextMenuTarget = ref<any>(null)

const rooms = computed(() => Array.from(roomStore.rooms.values()))
const spaces = computed(() => spaceStore.spaces)

const roomCount = computed(() => rooms.value.length)
const spaceCount = computed(() => spaces.value.length)

const recentRooms = computed(() => {
  return rooms.value
    .filter((r: any) => r.lastMessageTs)
    .sort((a: any, b: any) => (b.lastMessageTs || 0) - (a.lastMessageTs || 0))
    .slice(0, 10)
})

const groupRooms = computed(() => {
  return rooms.value.filter((r: any) => !r.isDirect && r.memberCount > 2)
})

const directRooms = computed(() => {
  return rooms.value.filter((r: any) => r.isDirect)
})

const groupedRooms = computed(() => {
  const groups = new Map<string, any[]>()
  rooms.value.forEach((room: any) => {
    const type = room.isDirect ? 'direct' : room.memberCount > 2 ? 'group' : 'recent'
    if (!groups.has(type)) {
      groups.set(type, [])
    }
    groups.get(type)!.push(room)
  })
  return groups
})

const contextMenuOptions = computed(() => {
  if (!contextMenuTarget.value) return []
  const isSpace = 'spaceId' in contextMenuTarget.value

  if (isSpace) {
    return [
      { label: t('room.context.open'), key: 'open' },
      { label: t('room.context.settings'), key: 'settings' },
      { type: 'divider', key: 'd1' },
      { label: t('room.context.leave'), key: 'leave' }
    ]
  }

  return [
    { label: t('room.context.open'), key: 'open' },
    { label: t('room.context.info'), key: 'info' },
    { type: 'divider', key: 'd1' },
    { label: t('room.context.mute'), key: 'mute' },
    { label: t('room.context.pin'), key: 'pin' },
    { type: 'divider', key: 'd2' },
    { label: t('room.context.leave'), key: 'leave' }
  ]
})

function handleAddClick() {
  if (activeTab.value === 'rooms') {
    showCreateRoomDialog.value = true
  } else {
    showCreateSpaceDialog.value = true
  }
}

function handleRoomClick(room: any) {
  router.push({ name: 'message', query: { roomId: room.roomId } })
}

function handleSpaceClick(space: Space) {
  router.push({ name: 'spaceDetail', params: { roomId: space.roomId } })
}

function handleRoomContextMenu(e: MouseEvent, room: any) {
  e.preventDefault()
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuTarget.value = room
  showContextMenu.value = true
}

function handleSpaceContextMenu(e: MouseEvent, space: Space) {
  e.preventDefault()
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuTarget.value = space
  showContextMenu.value = true
}

async function handleContextMenuSelect(key: string) {
  showContextMenu.value = false
  const target = contextMenuTarget.value
  if (!target) return

  switch (key) {
    case 'open':
      if ('spaceId' in target) {
        handleSpaceClick(target)
      } else {
        handleRoomClick(target)
      }
      break
    case 'info':
      selectedRoom.value = target
      showRoomInfo.value = true
      break
    case 'settings':
      router.push({ name: 'spaceDetail', params: { roomId: target.roomId }, query: { edit: 'true' } })
      break
    case 'mute':
      message.info(t('room.context.mute_success'))
      break
    case 'pin':
      message.info(t('room.context.pin_success'))
      break
    case 'leave':
      message.info(t('room.context.leave_success'))
      break
  }
}

function handleRoomCreated(_room: any) {
  showCreateRoomDialog.value = false
  message.success(t('room.create.success'))
}

function handleSpaceCreated(_space: any) {
  showCreateSpaceDialog.value = false
  message.success(t('space.create.success'))
}

onMounted(async () => {
  loading.value = true
  try {
    await roomStore.loadRooms()
    await spaceStore.setSpaces([])
  } catch (error) {
    logger.error('加载列表失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped lang="scss">
.room-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-color);
}

.list-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);

  :deep(.n-tabs) {
    .n-tabs-tab {
      padding: 8px 16px;
    }
  }
}

.tab-label {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.list-content {
  flex: 1;
  overflow: hidden;
}

.room-items,
.space-items {
  padding: 8px;
}

:deep(.n-collapse-item__header-main) {
  font-weight: 500;
  color: var(--text-color-2);
}

:deep(.n-collapse-item__content-wrapper) {
  padding: 4px 0;
}
</style>
