<template>
  <div class="mobile-room-list">
    <van-nav-bar :title="t('room.tabs.rooms')" fixed placeholder>
      <template #right>
        <van-icon name="plus" size="20" @click="showCreateSheet = true" />
      </template>
    </van-nav-bar>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="list-content">
        <van-tabs v-model:active="activeTab" sticky offset-top="46px">
          <van-tab :title="t('room.tabs.rooms')">
            <div v-if="loading" class="loading-container">
              <van-loading size="24px" />
            </div>
            <template v-else>
              <van-collapse v-model="activeCollapse">
                <van-collapse-item v-if="recentRooms.length > 0" name="recent" :title="t('room.groups.recent')">
                  <MobileRoomItem
                    v-for="room in recentRooms"
                    :key="room.roomId"
                    :room="room"
                    @click="handleRoomClick(room)"
                    @long-press="handleRoomLongPress($event, room)" />
                </van-collapse-item>

                <van-collapse-item v-if="groupRooms.length > 0" name="groups" :title="t('room.groups.groups')">
                  <MobileRoomItem
                    v-for="room in groupRooms"
                    :key="room.roomId"
                    :room="room"
                    @click="handleRoomClick(room)"
                    @long-press="handleRoomLongPress($event, room)" />
                </van-collapse-item>

                <van-collapse-item v-if="directRooms.length > 0" name="direct" :title="t('room.groups.direct')">
                  <MobileRoomItem
                    v-for="room in directRooms"
                    :key="room.roomId"
                    :room="room"
                    @click="handleRoomClick(room)"
                    @long-press="handleRoomLongPress($event, room)" />
                </van-collapse-item>
              </van-collapse>

              <van-empty v-if="rooms.length === 0" :description="t('room.empty')" />
            </template>
          </van-tab>

          <van-tab :title="t('room.tabs.spaces')">
            <div v-if="loading" class="loading-container">
              <van-loading size="24px" />
            </div>
            <template v-else>
              <MobileSpaceItem
                v-for="space in spaces"
                :key="space.roomId"
                :space="space"
                @click="handleSpaceClick(space)"
                @long-press="handleSpaceLongPress($event, space)" />

              <van-empty v-if="spaces.length === 0" :description="t('room.empty_spaces')" />
            </template>
          </van-tab>
        </van-tabs>
      </div>
    </van-pull-refresh>

    <van-action-sheet v-model:show="showCreateSheet" :actions="createActions" @select="onCreateSelect" />

    <van-action-sheet v-model:show="showRoomActions" :actions="roomActions" @select="onRoomActionSelect" />

    <van-popup v-model:show="showCreateRoom" position="bottom" round :style="{ height: '60%' }">
      <div class="create-room-popup">
        <van-nav-bar :title="t('room.create.title')">
          <template #left>
            <van-icon name="cross" @click="showCreateRoom = false" />
          </template>
        </van-nav-bar>
        <van-cell-group inset>
          <van-field
            v-model="newRoom.name"
            :label="t('room.create.name')"
            :placeholder="t('room.create.name_placeholder')"
            required />
          <van-field
            v-model="newRoom.topic"
            :label="t('room.create.topic')"
            :placeholder="t('room.create.topic_placeholder')"
            type="textarea"
            rows="2"
            autosize />
          <van-cell :title="t('room.create.type')">
            <template #right-icon>
              <van-radio-group v-model="newRoom.isPublic" direction="horizontal">
                <van-radio :value="false">{{ t('room.create.private') }}</van-radio>
                <van-radio :value="true">{{ t('room.create.public') }}</van-radio>
              </van-radio-group>
            </template>
          </van-cell>
        </van-cell-group>
        <div class="create-actions">
          <van-button type="primary" block :loading="creating" @click="handleCreateRoom">
            {{ t('room.create.title') }}
          </van-button>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="showJoinRoom" position="bottom" round :style="{ height: '50%' }">
      <div class="join-room-popup">
        <van-nav-bar :title="t('room.join')">
          <template #left>
            <van-icon name="cross" @click="showJoinRoom = false" />
          </template>
        </van-nav-bar>
        <van-cell-group inset>
          <van-field
            v-model="joinRoomId"
            :label="t('room.name')"
            :placeholder="t('room.join_placeholder', '输入房间ID或邀请链接')" />
        </van-cell-group>
        <div class="join-actions">
          <van-button type="primary" block :loading="joining" @click="handleJoinRoom">
            {{ t('room.join') }}
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { showToast, showSuccessToast, showFailToast, showConfirmDialog } from 'vant'
import { useRoomStore } from '@/stores/room'
import { useSpaceStore, type Space } from '@/stores/space'
import { matrixRoomService } from '@/services/matrix/MatrixRoomService'
import { createLogger } from '@/utils/Logger'
import MobileRoomItem from './components/MobileRoomItem.vue'
import MobileSpaceItem from './components/MobileSpaceItem.vue'

const logger = createLogger('MobileRoomList')
const { t } = useI18n()
const router = useRouter()
const roomStore = useRoomStore()
const spaceStore = useSpaceStore()

const activeTab = ref(0)
const activeCollapse = ref(['recent', 'groups', 'direct'])
const loading = ref(false)
const refreshing = ref(false)

const showCreateSheet = ref(false)
const showCreateRoom = ref(false)
const showJoinRoom = ref(false)
const showRoomActions = ref(false)

const creating = ref(false)
const joining = ref(false)

const selectedRoom = ref<any>(null)
const joinRoomId = ref('')

const newRoom = ref({
  name: '',
  topic: '',
  isPublic: false
})

const createActions = [
  { name: t('room.create.title'), value: 'create' },
  { name: t('room.join'), value: 'join' }
]

const roomActions = computed(() => [
  { name: t('room.context.open'), value: 'open' },
  { name: t('room.context.info'), value: 'info' },
  { name: t('room.context.mute'), value: 'mute' },
  { name: t('room.context.pin'), value: 'pin' },
  { name: t('room.context.leave'), value: 'leave', color: '#ee0a24' }
])

const rooms = computed(() => Array.from(roomStore.rooms.values()))
const spaces = computed(() => spaceStore.spaces)

const recentRooms = computed(() => {
  return rooms.value
    .filter((room) => room.lastMessage || room.unreadCount > 0)
    .sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0))
    .slice(0, 10)
})

const groupRooms = computed(() => {
  return rooms.value.filter((room) => !room.isDirect && !recentRooms.value.includes(room))
})

const directRooms = computed(() => {
  return rooms.value.filter((room) => room.isDirect && !recentRooms.value.includes(room))
})

const onRefresh = async () => {
  try {
    await roomStore.loadRooms()
    showSuccessToast(t('common.success'))
  } catch (error) {
    logger.error('刷新失败:', error)
    showFailToast(t('common.error'))
  } finally {
    refreshing.value = false
  }
}

const onCreateSelect = (action: any) => {
  if (action.value === 'create') {
    showCreateRoom.value = true
  } else if (action.value === 'join') {
    showJoinRoom.value = true
  }
  showCreateSheet.value = false
}

const handleCreateRoom = async () => {
  if (!newRoom.value.name.trim()) {
    showFailToast(t('room.create.name_required'))
    return
  }

  creating.value = true
  try {
    await matrixRoomService.createRoom({
      name: newRoom.value.name,
      topic: newRoom.value.topic || undefined,
      visibility: newRoom.value.isPublic ? 'public' : 'private'
    })
    showSuccessToast(t('room.create.success'))
    showCreateRoom.value = false
    newRoom.value = { name: '', topic: '', isPublic: false }
    await roomStore.loadRooms()
  } catch (error) {
    logger.error('创建房间失败:', error)
    showFailToast(t('room.create.failed'))
  } finally {
    creating.value = false
  }
}

const handleJoinRoom = async () => {
  if (!joinRoomId.value.trim()) {
    showFailToast(t('room.name') + t('common.required', '必填'))
    return
  }

  joining.value = true
  try {
    let roomId = joinRoomId.value.trim()
    if (roomId.startsWith('https://') || roomId.startsWith('matrix:')) {
      const match = roomId.match(/room\/([^/]+)/) || roomId.match(/roomid\/([^/]+)/)
      if (match) {
        roomId = match[1]
      }
    }
    await matrixRoomService.joinRoom(roomId)
    showSuccessToast(t('room.join') + t('common.success'))
    showJoinRoom.value = false
    joinRoomId.value = ''
    await roomStore.loadRooms()
  } catch (error) {
    logger.error('加入房间失败:', error)
    showFailToast(t('room.join') + t('common.error'))
  } finally {
    joining.value = false
  }
}

const handleRoomClick = (room: any) => {
  router.push(`/mobile/chatRoom/chatMain?roomId=${room.roomId}`)
}

const handleRoomLongPress = (_event: Event, room: any) => {
  selectedRoom.value = room
  showRoomActions.value = true
}

const handleSpaceClick = (space: Space) => {
  router.push(`/mobile/chatRoom/spaceDetail/${space.roomId}`)
}

const handleSpaceLongPress = (_event: Event, space: Space) => {
  selectedRoom.value = space
  showRoomActions.value = true
}

const onRoomActionSelect = async (action: any) => {
  if (!selectedRoom.value) return

  const room = selectedRoom.value

  switch (action.value) {
    case 'open':
      router.push(`/mobile/chatRoom/chatMain?roomId=${room.roomId}`)
      break
    case 'info':
      showToast(t('room.context.info'))
      break
    case 'mute':
      showToast(t('room.context.mute_success'))
      break
    case 'pin':
      showToast(t('room.context.pin_success'))
      break
    case 'leave':
      try {
        await showConfirmDialog({
          title: t('room.context.leave'),
          message: t('room.leave_confirm', '确定要离开此房间吗？')
        })
        await matrixRoomService.leaveRoom(room.roomId)
        showSuccessToast(t('room.context.leave_success'))
        await roomStore.loadRooms()
      } catch (error) {
        if (error !== 'cancel') {
          logger.error('离开房间失败:', error)
          showFailToast(t('common.error'))
        }
      }
      break
  }

  showRoomActions.value = false
}

onMounted(async () => {
  loading.value = true
  try {
    await roomStore.loadRooms()
  } catch (error) {
    logger.error('加载房间列表失败:', error)
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
.mobile-room-list {
  height: 100%;
  background: var(--van-background);

  .list-content {
    height: calc(100vh - 46px);
    overflow-y: auto;
  }

  .loading-container {
    display: flex;
    justify-content: center;
    padding: 20px;
  }
}

.create-room-popup,
.join-room-popup {
  height: 100%;
  display: flex;
  flex-direction: column;

  .create-actions,
  .join-actions {
    padding: 16px;
    margin-top: auto;
  }
}
</style>
