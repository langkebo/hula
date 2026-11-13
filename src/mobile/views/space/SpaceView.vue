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
          <div v-if="spaces.length === 0 && !loading" class="empty-state">
            <van-empty :description="t('space.empty')" />
          </div>
          <div v-else class="space-grid">
            <SpaceCard v-for="space in spaces" :key="space.spaceId" :space="space" @select="handleSpaceClick" />
          </div>
        </van-pull-refresh>
      </div>

      <!-- 创建空间弹出层 -->
      <SpaceCreateSheet v-model:show="showCreateSheet" @created="loadSpaces" />

      <!-- 空间详情弹出层 -->
      <van-action-sheet v-model:show="showDetailSheet" :title="selectedSpace?.name ?? ''">
        <div v-if="selectedSpace" class="space-detail">
          <!-- 层级面包屑：此前详情层看不出自己处在哪一层，也无法一键回到上层（P-3） -->
          <nav class="detail-breadcrumb" :aria-label="t('space.hierarchy_title')">
            <button v-clickable type="button" class="breadcrumb-item" @click="showDetailSheet = false">
              {{ t('space.title') }}
            </button>
            <template v-for="node in ancestorPath" :key="node.spaceId">
              <van-icon name="arrow" class="breadcrumb-sep" aria-hidden="true" />
              <button v-clickable type="button" class="breadcrumb-item" @click="switchToAncestor(node.spaceId)">
                {{ node.name || node.spaceId }}
              </button>
            </template>
            <van-icon name="arrow" class="breadcrumb-sep" aria-hidden="true" />
            <span class="breadcrumb-item breadcrumb-current" aria-current="page">{{ selectedSpace.name }}</span>
          </nav>

          <div class="detail-header">
            <div
              v-clickable
              class="detail-cover"
              :class="{ 'detail-cover-editable': canManageSpace }"
              data-testid="space-avatar"
              @click="handleAvatarClick">
              <img v-if="selectedSpace.avatarUrl" :src="selectedSpace.avatarUrl" :alt="selectedSpace.name" />
              <div v-else class="default-cover">
                <van-icon name="cluster-o" size="60" />
              </div>
              <span v-if="canManageSpace" class="cover-edit">
                <van-icon name="photograph" aria-hidden="true" />
              </span>
            </div>
            <div class="detail-info">
              <div class="detail-name">{{ selectedSpace.name }}</div>
              <div v-if="selectedSpace.topic" class="detail-topic">{{ selectedSpace.topic }}</div>
              <div class="detail-stats">
                <span v-clickable class="detail-members-entry" data-testid="space-members-entry" @click="openMembers">
                  <van-icon name="friends-o" />
                  {{ selectedSpace.memberCount }} {{ t('space.members') }}
                  <van-icon name="arrow" class="detail-members-arrow" />
                </span>
                <span>
                  <van-icon name="chat-o" />
                  {{ selectedSpace.childCount }} {{ t('space.rooms') }}
                </span>
              </div>
            </div>
          </div>

          <SpaceChildrenList :space-id="selectedSpace.spaceId" />

          <van-divider />

          <div class="detail-actions">
            <van-button block type="primary" @click="openInvite">
              <template #icon><van-icon name="add-o" /></template>
              {{ t('space.invite') }}
            </van-button>
            <van-button block @click="openAddRoom">
              <template #icon><van-icon name="plus" /></template>
              {{ t('space.add_room') }}
            </van-button>
            <van-button block @click="openSettings">
              <template #icon><van-icon name="setting-o" /></template>
              {{ t('space.settings') }}
            </van-button>
          </div>

          <!-- 头像编辑：浏览器环境走 input，Tauri 环境走系统文件选择器（P-4） -->
          <input
            :ref="bindFileInput"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleFileChange" />
          <AvatarCropper :ref="bindCropper" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
        </div>
      </van-action-sheet>

      <van-action-sheet v-model:show="showInviteSheet" :title="t('space.invite_title')">
        <div class="create-form">
          <van-form @submit="handleInvite">
            <van-cell-group inset>
              <van-field
                v-model="inviteForm.userId"
                :label="t('space.invite_title')"
                :placeholder="t('space.invite_user_placeholder')"
                :rules="[{ required: true, message: t('space.invite_user_required') }]" />
            </van-cell-group>
            <div class="form-actions">
              <van-button block type="primary" native-type="submit" :loading="memberMutating">
                {{ t('common.confirm') }}
              </van-button>
            </div>
          </van-form>
        </div>
      </van-action-sheet>

      <van-action-sheet v-model:show="showAddRoomSheet" :title="t('space.add_room_title')">
        <div class="create-form">
          <van-form @submit="handleAddRoom">
            <van-cell-group inset>
              <van-field
                v-model="addRoomForm.roomId"
                :label="t('space.add_room')"
                :placeholder="t('space.add_room_placeholder')"
                :rules="[{ required: true, message: t('space.add_room_required') }]" />
              <van-field :label="t('space.add_room_suggested')">
                <template #input>
                  <van-switch v-model="addRoomForm.suggested" />
                </template>
              </van-field>
            </van-cell-group>
            <div class="form-actions">
              <van-button block type="primary" native-type="submit" :loading="roomMutating">
                {{ t('common.confirm') }}
              </van-button>
            </div>
          </van-form>
        </div>
      </van-action-sheet>

      <van-action-sheet v-model:show="showSettingsSheet" :title="t('space.settings_title')">
        <div class="create-form">
          <van-form @submit="handleSaveSettings">
            <van-cell-group inset>
              <van-field
                v-model="settingsForm.name"
                :label="t('space.name')"
                :placeholder="t('space.name_placeholder')" />
              <van-field
                v-model="settingsForm.topic"
                :label="t('space.topic')"
                :placeholder="t('space.topic_placeholder')"
                type="textarea"
                rows="3" />
            </van-cell-group>
            <div class="form-actions">
              <van-button block type="primary" native-type="submit" :loading="detailMutating">
                {{ t('common.confirm') }}
              </van-button>
            </div>
          </van-form>
        </div>
      </van-action-sheet>

      <!-- 成员管理弹出层 -->
      <van-popup v-model:show="showMembersPopup" position="bottom" round>
        <div class="members-popup">
          <div class="members-popup-header">
            <span class="members-popup-title">{{ t('space.members_title') }}</span>
            <van-icon v-clickable name="cross" @click="showMembersPopup = false" />
          </div>
          <div class="members-popup-body">
            <SpaceMemberList v-if="selectedSpace" :space-id="selectedSpace.spaceId" :can-manage="canManageSpace" />
          </div>
        </div>
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSpace, useSpaceMembers, useSpaceRooms, useSpaces } from '@/composables/space'
import { useAvatarUpload } from '@/composables/user/useAvatarUpload'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import SpaceCard from '@/mobile/components/space/SpaceCard.vue'
import SpaceCreateSheet from '@/mobile/components/space/SpaceCreateSheet.vue'
import SpaceMemberList from '@/mobile/components/space/SpaceMemberList.vue'
import { matrixSpaceService, type SpaceInfo, type SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
import SpaceChildrenList from './components/SpaceChildrenList.vue'

/** 可管理成员的 power level 门槛（管理员 / 版主） */
const MANAGE_POWER_LEVEL = 50

const { t } = useI18n()

const selectedSpaceId = ref('')
const { spaces, loading, load: loadSpaces } = useSpaces()
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

/** 空间头像编辑：复用统一的头像上传 + 裁剪链路，成功后写回 m.room.avatar（P-4） */
const { localImageUrl, showCropper, cropperRef, fileInput, openAvatarCropper, handleFileChange, handleCrop } =
  useAvatarUpload({
    onSuccess: async (mxcUrl) => {
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
  })

/** 模板 ref 绑定：把 DOM / 组件实例写回 useAvatarUpload 内部的 ref */
const bindFileInput = (el: unknown) => {
  fileInput.value = (el as HTMLInputElement | null) ?? undefined
}
const bindCropper = (el: unknown) => {
  cropperRef.value = el
}

const inviteForm = reactive({ userId: '' })
const addRoomForm = reactive({ roomId: '', suggested: false })
const settingsForm = reactive({ name: '', topic: '' })

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

/** 头像区域点击：仅管理员可触发，避免普通成员误触后收到服务端拒绝 */
const handleAvatarClick = () => {
  if (!canManageSpace.value) return
  openAvatarCropper()
}

const openInvite = () => {
  inviteForm.userId = ''
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

const handleInvite = async () => {
  const userId = inviteForm.userId.trim()
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
  addRoomForm.roomId = ''
  addRoomForm.suggested = false
  showDetailSheet.value = false
  showAddRoomSheet.value = true
}

const handleAddRoom = async () => {
  const roomId = addRoomForm.roomId.trim()
  if (!roomId) {
    showToast(t('space.add_room_required'))
    return
  }
  const ok = await addRoom(roomId, { suggested: addRoomForm.suggested })
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
  settingsForm.name = selectedSpace.value.name
  settingsForm.topic = selectedSpace.value.topic ?? ''
  showDetailSheet.value = false
  showSettingsSheet.value = true
}

const handleSaveSettings = async () => {
  if (!selectedSpace.value) return
  const payload: Partial<SpaceOptions> = {}
  if (settingsForm.name && settingsForm.name !== selectedSpace.value.name) payload.name = settingsForm.name
  if (settingsForm.topic !== (selectedSpace.value.topic ?? '')) payload.topic = settingsForm.topic
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

.empty-state {
  padding: 60px 0;
}

.create-form {
  padding: 16px;

  .form-actions {
    margin-top: 16px;
  }
}

.space-detail {
  padding: 16px;

  .detail-breadcrumb {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--van-text-color-3);

    .breadcrumb-item {
      padding: 0;
      border: none;
      background: none;
      font: inherit;
      color: var(--van-text-color-3);
    }

    .breadcrumb-current {
      color: var(--van-text-color);
      font-weight: 500;
    }

    .breadcrumb-sep {
      font-size: 10px;
      color: var(--van-text-color-3);
    }
  }

  .detail-header {
    display: flex;
    gap: 16px;

    .detail-cover {
      position: relative;
      width: 100px;
      height: 100px;
      flex-shrink: 0;
      border-radius: 8px;
      overflow: hidden;
      background: var(--van-gray-2);
      display: flex;
      align-items: center;
      justify-content: center;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .default-cover {
        color: var(--van-gray-5);
      }

      .cover-edit {
        position: absolute;
        right: 4px;
        bottom: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        font-size: 12px;
        color: var(--tjg-text-inverse);
        background: var(--tjg-overlay-inverse-strong);
      }
    }

    .detail-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .detail-name {
        font-size: 16px;
        font-weight: 500;
      }

      .detail-topic {
        font-size: 14px;
        color: var(--van-text-color-2);
      }

      .detail-stats {
        display: flex;
        gap: 16px;
        font-size: 14px;
        color: var(--tjg-text-tertiary);

        span {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .detail-members-entry {
          color: var(--tjg-text-secondary);
        }

        .detail-members-arrow {
          font-size: var(--tjg-font-size-sm);
          color: var(--tjg-text-tertiary);
        }
      }
    }
  }

  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}

.members-popup {
  display: flex;
  flex-direction: column;
  height: 70vh;
  padding: 16px;
  background: var(--tjg-glass-row-bg);

  .members-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;

    .members-popup-title {
      font-size: var(--tjg-font-size-md);
      font-weight: 500;
      color: var(--tjg-text-primary);
    }
  }

  .members-popup-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
