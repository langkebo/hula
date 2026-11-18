<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('space.title')" />
    </template>

    <template #container>
      <div class="space-view">
        <!-- 创建按钮 -->
        <div class="create-button">
          <van-button type="primary" block @click="showCreateSheet = true">
            <template #icon>
              <van-icon name="plus" />
            </template>
            {{ t('space.create') }}
          </van-button>
        </div>

        <!-- 空间列表 -->
        <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
          <MobileAsyncState
            v-if="spacesState !== 'ready'"
            :state="spacesState"
            :error-text="spacesError ?? ''"
            :empty-text="t('space.empty')"
            test-id="space-list"
            min-height="240px"
            @retry="loadSpaces" />
          <div v-else class="space-grid">
            <SpaceCard v-for="space in spaces" :key="space.spaceId" :space="space" @select="handleSpaceClick" />
          </div>
        </van-pull-refresh>
      </div>

      <!-- 创建空间弹出层 -->
      <SpaceCreateSheet v-model:show="showCreateSheet" @created="loadSpaces" />

      <!-- 空间详情弹出层 -->
      <SpaceDetailSheet
        v-model:show="showDetailSheet"
        :space="selectedSpace"
        :ancestor-path="ancestorPath"
        :can-manage-space="canManageSpace"
        @switch-ancestor="switchToAncestor"
        @open-members="openMembers"
        @invite="openInvite"
        @add-room="openAddRoom"
        @settings="openSettings"
        @avatar-updated="handleAvatarUpdated" />

      <!-- 邀请 / 添加房间 / 空间设置 -->
      <SpaceInviteSheet v-model:show="showInviteSheet" :loading="memberMutating" @submit="handleInvite" />
      <SpaceAddRoomSheet v-model:show="showAddRoomSheet" :loading="roomMutating" @submit="handleAddRoom" />
      <SpaceSettingsSheet
        v-model:show="showSettingsSheet"
        :loading="detailMutating"
        :name="selectedSpace?.name"
        :topic="selectedSpace?.topic"
        @submit="handleSaveSettings" />

      <!-- 成员管理弹出层 -->
      <SpaceMembersPopup
        v-model:show="showMembersPopup"
        :space-id="selectedSpace?.spaceId ?? ''"
        :can-manage="canManageSpace" />
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSpace, useSpaceMembers, useSpaceRooms, useSpaces } from '@/composables/space'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import MobileAsyncState from '@/mobile/components/common/MobileAsyncState.vue'
import SpaceCard from '@/mobile/components/space/SpaceCard.vue'
import SpaceCreateSheet from '@/mobile/components/space/SpaceCreateSheet.vue'
import { matrixSpaceService, type SpaceInfo, type SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
import SpaceAddRoomSheet from './components/SpaceAddRoomSheet.vue'
import SpaceDetailSheet from './components/SpaceDetailSheet.vue'
import SpaceInviteSheet from './components/SpaceInviteSheet.vue'
import SpaceMembersPopup from './components/SpaceMembersPopup.vue'
import SpaceSettingsSheet from './components/SpaceSettingsSheet.vue'

/** 可管理成员的 power level 门槛（管理员 / 版主） */
const MANAGE_POWER_LEVEL = 50

const { t } = useI18n()

const selectedSpaceId = ref('')
const { spaces, loading, error: spacesError, load: loadSpaces } = useSpaces()

/** 四态：加载失败不能再被渲染成「暂无空间」 */
const spacesState = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
  if (loading.value) return 'loading'
  if (spacesError.value) return 'error'
  return spaces.value.length === 0 ? 'empty' : 'ready'
})
const { mutating: detailMutating, update: updateSpace, getTreePath } = useSpace(() => selectedSpaceId.value)
const { mutating: memberMutating, invite: inviteMember } = useSpaceMembers(() => selectedSpaceId.value)
const { mutating: roomMutating, addRoom } = useSpaceRooms(() => selectedSpaceId.value)

const refreshing = ref(false)
const showCreateSheet = ref(false)
const showDetailSheet = ref(false)
const showInviteSheet = ref(false)
const showAddRoomSheet = ref(false)
const showSettingsSheet = ref(false)
const showMembersPopup = ref(false)
const canManageSpace = ref(false)
const selectedSpace = ref<SpaceInfo | null>(null)
/** 当前空间的上层路径（不含自身），用于详情层面包屑 */
const ancestorPath = ref<Array<{ spaceId: string; name: string }>>([])

const onRefresh = async () => {
  refreshing.value = true
  await loadSpaces()
  refreshing.value = false
}

const handleSpaceClick = (space: SpaceInfo) => {
  selectedSpace.value = space
  selectedSpaceId.value = space.spaceId
  showDetailSheet.value = true
  void refreshManagePermission(space.spaceId)
  void loadBreadcrumb(space.spaceId)
}

/** 读取当前用户在空间的 PL，决定是否展示头像编辑与成员管理入口 */
const refreshManagePermission = async (spaceId: string) => {
  canManageSpace.value = false
  try {
    const powerLevel = await matrixSpaceService.getSpaceMemberPowerLevel(spaceId)
    canManageSpace.value = powerLevel >= MANAGE_POWER_LEVEL
  } catch {
    canManageSpace.value = false
  }
}

/** 面包屑只展示当前空间之上的层级；服务层失败时返回空路径，保留根节点 */
const loadBreadcrumb = async (spaceId: string) => {
  ancestorPath.value = []
  const path = await getTreePath()
  ancestorPath.value = path.filter((node) => node.spaceId !== spaceId)
}

/** 切到上层空间；不在当前列表时按 ID 拉取，保证面包屑始终可落地 */
const switchToAncestor = async (spaceId: string) => {
  const cached = spaces.value.find((item) => item.spaceId === spaceId)
  if (cached) {
    handleSpaceClick(cached)
    return
  }
  try {
    const info = await matrixSpaceService.getSpace(spaceId)
    if (!info) {
      showToast(t('space.load_failed'))
      return
    }
    handleSpaceClick(info)
  } catch {
    showToast(t('space.load_failed'))
  }
}

/** 详情层头像上传成功：写回 m.room.avatar 并刷新列表（P-4） */
const handleAvatarUpdated = async (mxcUrl: string) => {
  const ok = await updateSpace({ avatarUrl: mxcUrl })
  if (!ok) {
    showToast(t('space.settings_failed'))
    return
  }
  if (selectedSpace.value) {
    selectedSpace.value = { ...selectedSpace.value, avatarUrl: mxcUrl }
  }
  await loadSpaces()
}

const openInvite = () => {
  showDetailSheet.value = false
  showInviteSheet.value = true
}

/** 打开成员列表：先按当前用户在空间的 PL 判定管理权限 */
const openMembers = async () => {
  if (!selectedSpace.value) return
  const spaceId = selectedSpace.value.spaceId
  showDetailSheet.value = false
  showMembersPopup.value = true
  await refreshManagePermission(spaceId)
}

const handleInvite = async (userId: string) => {
  if (!userId) {
    showToast(t('space.invite_user_required'))
    return
  }
  const ok = await inviteMember(userId)
  if (ok) {
    showToast(t('space.invite_success'))
    showInviteSheet.value = false
  } else {
    showToast(t('space.invite_failed'))
  }
}

const openAddRoom = () => {
  showDetailSheet.value = false
  showAddRoomSheet.value = true
}

const handleAddRoom = async (payload: { roomId: string; suggested: boolean }) => {
  if (!payload.roomId) {
    showToast(t('space.add_room_required'))
    return
  }
  const ok = await addRoom(payload.roomId, { suggested: payload.suggested })
  if (ok) {
    showToast(t('space.add_room_success'))
    showAddRoomSheet.value = false
    if (selectedSpace.value) {
      selectedSpace.value = { ...selectedSpace.value, childCount: selectedSpace.value.childCount + 1 }
    }
  } else {
    showToast(t('space.add_room_failed'))
  }
}

const openSettings = () => {
  if (!selectedSpace.value) return
  showDetailSheet.value = false
  showSettingsSheet.value = true
}

const handleSaveSettings = async (payload: Partial<SpaceOptions>) => {
  if (!selectedSpace.value) return
  if (Object.keys(payload).length === 0) {
    showSettingsSheet.value = false
    return
  }
  const ok = await updateSpace(payload)
  if (ok) {
    showToast(t('space.settings_success'))
    showSettingsSheet.value = false
    if (selectedSpace.value) {
      selectedSpace.value = {
        ...selectedSpace.value,
        name: payload.name ?? selectedSpace.value.name,
        topic: payload.topic ?? selectedSpace.value.topic
      }
    }
    await loadSpaces()
  } else {
    showToast(t('space.settings_failed'))
  }
}

onMounted(() => {
  loadSpaces()
})
</script>

<style scoped lang="scss">
.space-view {
  height: 100%;
  min-height: 100%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  background: transparent;
  padding: 16px;
}

.create-button {
  margin-bottom: 16px;
}

.space-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
</style>
