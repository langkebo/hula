<template>
  <div class="mobile-space-detail">
    <van-nav-bar
      :title="spaceInfo?.name || t('space.loading')"
      left-arrow
      fixed
      placeholder
      @click-left="router.back()">
      <template #right>
        <van-icon name="setting-o" size="20" @click="showSettings = true" />
      </template>
    </van-nav-bar>

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <div class="space-content">
        <div class="space-header-info">
          <van-image
            v-if="spaceInfo?.avatarUrl"
            :src="spaceInfo.avatarUrl"
            width="64"
            height="64"
            round
            fit="cover"
            class="space-avatar" />
          <div v-else class="space-avatar-placeholder">
            <van-icon name="apps-o" size="32" />
          </div>
          <div class="space-meta">
            <div class="meta-item">
              <van-icon name="user-o" size="14" />
              {{ spaceInfo?.memberCount || 0 }} {{ t('space.members') }}
            </div>
            <div class="meta-item">
              <van-icon name="chat-o" size="14" />
              {{ childRooms.length }} {{ t('space.rooms') }}
            </div>
          </div>
        </div>

        <van-tabs v-model:active="activeTab" sticky offset-top="46">
          <van-tab :title="t('space.rooms')" name="rooms">
            <div class="tab-content">
              <van-button type="primary" size="small" block class="mb-12px" @click="showAddRoomDialog = true">
                <van-icon name="plus" />
                {{ t('space.add_room') }}
              </van-button>

              <van-loading v-if="loadingRooms" size="24px" class="loading-container" />

              <van-empty v-else-if="childRooms.length === 0" :description="t('space.no_rooms')" />

              <van-cell-group v-else inset>
                <van-cell
                  v-for="room in childRooms"
                  :key="room.room_id"
                  :title="room.name || room.room_id"
                  :label="`${room.member_count || 0} ${t('space.members')}`"
                  is-link
                  @click="handleRoomClick(room.room_id)">
                  <template #icon>
                    <van-avatar round size="40" class="mr-12px">
                      {{ (room.name || 'R').charAt(0).toUpperCase() }}
                    </van-avatar>
                  </template>
                  <template #right-icon>
                    <van-icon name="cross" class="remove-icon" @click.stop="handleRemoveRoom(room.room_id)" />
                  </template>
                </van-cell>
              </van-cell-group>
            </div>
          </van-tab>

          <van-tab :title="t('space.members')" name="members">
            <div class="tab-content">
              <van-button type="primary" size="small" block class="mb-12px" @click="showInviteDialog = true">
                <van-icon name="plus" />
                {{ t('space.invite_members') }}
              </van-button>

              <van-loading v-if="loadingMembers" size="24px" class="loading-container" />

              <van-empty v-else-if="members.length === 0" :description="t('space.no_members')" />

              <van-cell-group v-else inset>
                <van-cell
                  v-for="member in members"
                  :key="member.userId"
                  :title="member.name || member.userId"
                  :label="member.userId"
                  is-link
                  @click="handleMemberClick(member)">
                  <template #icon>
                    <van-avatar round size="40" class="mr-12px" :src="member.avatarUrl">
                      {{ (member.name || member.userId || 'U').charAt(0).toUpperCase() }}
                    </van-avatar>
                  </template>
                </van-cell>
              </van-cell-group>
            </div>
          </van-tab>
        </van-tabs>
      </div>
    </van-pull-refresh>

    <van-action-sheet v-model:show="showSettings" :actions="settingsActions" @select="onSettingsSelect" />

    <van-dialog
      v-model:show="showAddRoomDialog"
      :title="t('space.add_room')"
      show-cancel-button
      @confirm="handleAddRoom">
      <van-cell-group inset class="p-12px">
        <van-field
          v-model="newRoomName"
          :label="t('room.create.name')"
          :placeholder="t('room.create.name_placeholder')"
          required />
      </van-cell-group>
    </van-dialog>

    <van-dialog
      v-model:show="showInviteDialog"
      :title="t('space.invite_members')"
      show-cancel-button
      @confirm="handleInviteMember">
      <van-cell-group inset class="p-12px">
        <van-field
          v-model="inviteUserId"
          :label="t('space.user_id')"
          :placeholder="t('space.user_id_placeholder')"
          required />
      </van-cell-group>
    </van-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { showToast } from 'vant'
import { matrixSpaceService, matrixRoomService } from '@/services/matrix'
import { useSpaceStore, type Space } from '@/stores/space'

interface SpaceInfo {
  roomId: string
  name: string
  avatarUrl: string | null
  memberCount: number
}

interface ChildRoom {
  room_id: string
  name?: string
  member_count?: number
}

interface Member {
  userId: string
  name?: string
  avatarUrl?: string
}

const props = defineProps<{
  roomId: string
}>()

const router = useRouter()
const { t } = useI18n()
const spaceStore = useSpaceStore()

const activeTab = ref('rooms')
const loadingRooms = ref(false)
const loadingMembers = ref(false)
const refreshing = ref(false)
const showSettings = ref(false)
const showAddRoomDialog = ref(false)
const showInviteDialog = ref(false)
const newRoomName = ref('')
const inviteUserId = ref('')

const spaceInfo = computed<SpaceInfo | undefined>(() => spaceStore.spaces.find((s: Space) => s.roomId === props.roomId))
const childRooms = ref<ChildRoom[]>([])
const members = ref<Member[]>([])

const settingsActions = computed(() => [
  { name: t('space.edit_space'), value: 'edit' },
  { name: t('space.leave_space'), value: 'leave' }
])

const onRefresh = async (): Promise<void> => {
  await loadSpaceData()
  refreshing.value = false
}

const loadSpaceData = async (): Promise<void> => {
  try {
    const spaceData = await matrixSpaceService.getSpace(props.roomId)
    if (spaceData) {
      spaceStore.addSpace({
        roomId: props.roomId,
        name: spaceData.name || '',
        avatarUrl: spaceData.avatarUrl || null,
        memberCount: spaceData.memberCount || 0,
        isJoined: true,
        topic: spaceData.topic
      })
    }
    await loadChildRooms()
    await loadMembers()
  } catch (err) {
    console.error('[MobileSpaceDetail] loadSpaceData failed:', err)
  }
}

const loadChildRooms = async (): Promise<void> => {
  loadingRooms.value = true
  try {
    const rooms = await matrixSpaceService.getSpaceChildren(props.roomId)
    childRooms.value = rooms.map((r: any) => ({
      room_id: r.roomId || r.room_id,
      name: r.name,
      member_count: r.memberCount
    }))
  } catch (err) {
    console.error('[MobileSpaceDetail] loadChildRooms failed:', err)
  } finally {
    loadingRooms.value = false
  }
}

const loadMembers = async (): Promise<void> => {
  loadingMembers.value = true
  try {
    const membersResult = await matrixRoomService.getMembers(props.roomId)
    members.value = membersResult.map((m: any) => ({
      userId: m.userId,
      name: m.name,
      avatarUrl: m.avatarUrl
    }))
  } catch (err) {
    console.error('[MobileSpaceDetail] loadMembers failed:', err)
  } finally {
    loadingMembers.value = false
  }
}

const handleRoomClick = (roomId: string): void => {
  router.push(`/mobile/chatRoom/chatMain/${roomId}`)
}

const handleMemberClick = (member: Member): void => {
  router.push(`/mobile/friends/info/${member.userId}`)
}

const handleRemoveRoom = async (roomId: string): Promise<void> => {
  try {
    await matrixSpaceService.removeChildFromSpace(props.roomId, roomId)
    childRooms.value = childRooms.value.filter((r: ChildRoom) => r.room_id !== roomId)
    showToast(t('space.room_removed'))
  } catch (err) {
    console.error('[MobileSpaceDetail] handleRemoveRoom failed:', err)
    showToast(t('space.remove_failed'))
  }
}

const handleAddRoom = async (): Promise<void> => {
  if (!newRoomName.value.trim()) {
    showToast(t('room.create.name_required'))
    return
  }
  try {
    const result = await matrixRoomService.createRoom({ name: newRoomName.value.trim() })
    const roomId = result.room_id
    await matrixSpaceService.addChildToSpace(props.roomId, roomId)
    newRoomName.value = ''
    await loadChildRooms()
    showToast(t('space.room_added'))
  } catch (err) {
    console.error('[MobileSpaceDetail] handleAddRoom failed:', err)
    showToast(t('space.add_failed'))
  }
}

const handleInviteMember = async (): Promise<void> => {
  if (!inviteUserId.value.trim()) {
    showToast(t('space.user_id_required'))
    return
  }
  try {
    await matrixRoomService.inviteUser(props.roomId, inviteUserId.value.trim())
    inviteUserId.value = ''
    await loadMembers()
    showToast(t('space.member_invited'))
  } catch (err) {
    console.error('[MobileSpaceDetail] handleInviteMember failed:', err)
    showToast(t('space.invite_failed'))
  }
}

const onSettingsSelect = (action: { value: string }): void => {
  showSettings.value = false
  if (action.value === 'edit') {
    showToast(t('space.edit_space'))
  } else if (action.value === 'leave') {
    showToast(t('space.leave_space'))
  }
}

onMounted(() => {
  loadSpaceData()
})
</script>

<style scoped>
.mobile-space-detail {
  min-height: 100vh;
  background: #f7f8fa;
}

.space-content {
  padding: 12px;
}

.space-header-info {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  margin-bottom: 12px;
}

.space-avatar {
  flex-shrink: 0;
}

.space-avatar-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.space-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #666;
}

.tab-content {
  min-height: 200px;
}

.loading-container {
  display: flex;
  justify-content: center;
  padding: 24px;
}

.mb-12px {
  margin-bottom: 12px;
}

.mr-12px {
  margin-right: 12px;
}

.p-12px {
  padding: 12px;
}

.remove-icon {
  color: #ee0a24;
  padding: 4px;
}
</style>
