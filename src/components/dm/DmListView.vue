<template>
  <div class="dm-list-view">
    <n-flex vertical :size="12" class="p-12px">
      <n-flex align="center" justify="space-between">
        <span class="text-16px font-semibold">{{ t('dm.list.title') }}</span>
        <n-button quaternary circle size="small" @click="showCreateDm = true">
          <template #icon>
            <n-icon>
              <svg><use href="#plus" /></svg>
            </n-icon>
          </template>
        </n-button>
      </n-flex>

      <n-input v-model:value="searchValue" :placeholder="t('dm.list.search')" size="small" clearable>
        <template #prefix>
          <n-icon size="16">
            <svg><use href="#search" /></svg>
          </n-icon>
        </template>
      </n-input>
    </n-flex>

    <n-divider style="margin: 0" />

    <n-spin :show="loading">
      <n-scrollbar style="height: calc(100vh - 200px)">
        <n-empty v-if="filteredDmRooms.length === 0" :description="t('dm.list.empty')" class="mt-40px" />
        <div v-else class="dm-items">
          <div
            v-for="dmRoom in filteredDmRooms"
            :key="dmRoom.roomId"
            class="dm-item"
            :class="{ active: activeRoomId === dmRoom.roomId }"
            @click="handleSelectRoom(dmRoom)"
            @contextmenu="handleContextMenu($event, dmRoom)">
            <n-flex align="center" :size="12">
              <n-badge :dot="false" color="#f0a020" :offset="[-4, 4]">
                <n-avatar
                  :size="44"
                  :src="AvatarUtils.getAvatarUrl(dmRoom.avatarUrl)"
                  :fallback-src="settingStore.themeContent === ThemeEnum.DARK ? '/logoL.png' : '/logoD.png'"
                  round />
              </n-badge>
              <n-flex vertical :size="4" class="flex-1 truncate">
                <n-flex align="center" justify="space-between">
                  <span class="text-14px truncate">
                    {{ dmRoom.name || dmRoom.roomId }}
                  </span>
                  <span class="text-12px text-gray-500">
                    {{ formatTime(dmRoom.lastMessage?.timestamp) }}
                  </span>
                </n-flex>
                <n-flex align="center" justify="space-between">
                  <span class="text-12px text-gray-400 truncate flex-1">
                    {{ dmRoom.lastMessage?.content || t('dm.list.no_message') }}
                  </span>
                  <n-flex align="center" :size="4">
                    <n-badge v-if="(dmRoom.unreadCount || 0) > 0" :value="dmRoom.unreadCount" :max="99" type="info" />
                  </n-flex>
                </n-flex>
              </n-flex>
            </n-flex>
          </div>
        </div>
      </n-scrollbar>
    </n-spin>

    <ContextMenu ref="contextMenuRef" :menu="contextMenuItems" @select="handleContextMenuSelect" />

    <CreateDmDialog v-model:show="showCreateDm" @created="handleDmCreated" />
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ThemeEnum } from '@/enums'
import { matrixDirectMessageService, type DmRoomInfo } from '@/services/matrix/room/MatrixDirectMessageService'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { AvatarUtils } from '@/utils/AvatarUtils'
import dayjs from 'dayjs'
import ContextMenu from '@/components/common/ContextMenu.vue'
import CreateDmDialog from './CreateDmDialog.vue'

const { t } = useI18n()
const settingStore = useSettingStore()
const chatStore = useChatStore()
const globalStore = useGlobalStore()

const searchValue = ref('')
const loading = ref(false)
const showCreateDm = ref(false)
const activeRoomId = ref('')
const contextMenuRef = ref()
const selectedRoom = ref<DmRoomInfo | null>(null)
const dmRooms = ref<DmRoomInfo[]>([])
const pinnedRooms = ref<Set<string>>(new Set())

const filteredDmRooms = computed(() => {
  let rooms = dmRooms.value

  if (searchValue.value.trim()) {
    const query = searchValue.value.toLowerCase()
    rooms = rooms.filter((r) => r.roomId.toLowerCase().includes(query) || r.name?.toLowerCase().includes(query))
  }

  return rooms.sort((a, b) => {
    if (pinnedRooms.value.has(a.roomId) && !pinnedRooms.value.has(b.roomId)) return -1
    if (!pinnedRooms.value.has(a.roomId) && pinnedRooms.value.has(b.roomId)) return 1
    return (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0)
  })
})

const formatTime = (timestamp?: number) => {
  if (!timestamp) return ''
  return dayjs(timestamp).format('HH:mm')
}

const loadDmRooms = async () => {
  loading.value = true
  try {
    const rooms = await matrixDirectMessageService.getDmRoomInfos(false)
    dmRooms.value = rooms
  } finally {
    loading.value = false
  }
}

const handleSelectRoom = (room: DmRoomInfo) => {
  activeRoomId.value = room.roomId
  globalStore.updateCurrentSessionRoomId(room.roomId)
}

const contextMenuItems = computed(() => [
  { label: t('dm.context.pin'), icon: 'pin' },
  { label: t('dm.context.unpin'), icon: 'unpin' },
  { label: 'divider', icon: '' },
  { label: t('dm.context.mark_read'), icon: 'check' },
  { label: t('dm.context.delete'), icon: 'delete' }
])

const handleContextMenu = (event: MouseEvent, room: DmRoomInfo) => {
  event.preventDefault()
  selectedRoom.value = room
  contextMenuRef.value?.show(event)
}

const handleContextMenuSelect = async (item: { label: string }) => {
  if (!selectedRoom.value) return

  const room = selectedRoom.value

  switch (item.label) {
    case t('dm.context.pin'):
      pinnedRooms.value.add(room.roomId)
      break
    case t('dm.context.unpin'):
      pinnedRooms.value.delete(room.roomId)
      break
    case t('dm.context.mark_read'):
      chatStore.markSessionRead(room.roomId)
      break
    case t('dm.context.delete'): {
      const partnerId = room.invitees[0] || room.inviter || ''
      await matrixDirectMessageService.removeDmRoom(room.roomId, partnerId)
      await loadDmRooms()
      break
    }
  }

  selectedRoom.value = null
}

const handleDmCreated = async (roomId: string) => {
  await loadDmRooms()
  const room = dmRooms.value.find((r) => r.roomId === roomId)
  if (room) {
    handleSelectRoom(room)
  }
}

onMounted(async () => {
  await matrixDirectMessageService.initialize()
  await loadDmRooms()
})
</script>

<style scoped lang="scss">
.dm-list-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dm-items {
  padding: 8px;
}

.dm-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: var(--list-hover-color);
  }

  &.active {
    background: var(--msg-active-color);
    color: var(--msg-active-text-color, #fff);
  }

  &.pinned {
    background: var(--bg-color);
  }
}
</style>
