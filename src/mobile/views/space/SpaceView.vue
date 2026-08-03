<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('space.title')" />
    </template>

    <template #container>
      <div class="space-view">
        <!-- 搜索栏（TJG 风格） -->
        <div class="m-search" @click="focusSearch">
          <svg class="w-16px h-16px"><use href="#i-search" /></svg>
          <span>{{ t('space.search_placeholder') }}</span>
        </div>

        <!-- 创建按钮（TJG 风格） -->
        <div class="create-button">
          <van-button type="primary" block round class="tjg-create-btn" @click="showCreateSheet = true">
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
          <div v-else class="space-list">
            <div v-for="space in spaces" :key="space.spaceId" class="space-item" @click="handleSpaceClick(space)">
              <div class="space-avatar">
                <img v-if="space.avatarUrl" :src="space.avatarUrl" :alt="space.name + '的头像'" />
                <span v-else>{{ space.name?.charAt(0) || '?' }}</span>
                <!-- 公开/私有标识 -->
                <div v-if="space.isPublic" class="space-badge public">
                  <van-icon name="eye-o" />
                </div>
              </div>
              <div class="space-info">
                <div class="space-top">
                  <div class="space-name">
                    {{ space.name }}
                    <span v-if="space.isPublic" class="public-tag">{{ t('space.public') }}</span>
                    <span v-else class="private-tag">{{ t('space.private') }}</span>
                  </div>
                  <div class="space-count">{{ space.memberCount || 0 }} {{ t('space.members') }}</div>
                </div>
                <div class="space-bottom">
                  <div v-if="space.topic" class="space-topic">{{ space.topic }}</div>
                  <div v-else class="space-topic placeholder">{{ t('space.detail_space_topic_empty') }}</div>
                  <div class="space-stats">
                    <span>
                      <van-icon name="chat-o" />
                      {{ space.childCount || 0 }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </van-pull-refresh>
      </div>

      <!-- 创建空间弹出层 -->
      <van-action-sheet v-model:show="showCreateSheet" :title="t('space.create')">
        <div class="create-form">
          <van-form @submit="handleCreate">
            <van-cell-group inset>
              <van-field
                v-model="formData.name"
                :label="t('space.name')"
                :placeholder="t('space.name_placeholder')"
                :rules="[{ required: true, message: t('space.name_required') }]" />
              <van-field
                v-model="formData.topic"
                :label="t('space.topic')"
                :placeholder="t('space.topic_placeholder')"
                type="textarea"
                rows="3" />
              <van-field :label="t('space.visibility')">
                <template #input>
                  <van-radio-group v-model="formData.visibility" direction="horizontal">
                    <van-radio name="private">{{ t('space.private') }}</van-radio>
                    <van-radio name="public">{{ t('space.public') }}</van-radio>
                  </van-radio-group>
                </template>
              </van-field>
            </van-cell-group>
            <div class="form-actions">
              <van-button block type="primary" native-type="submit" :loading="mutating">
                {{ t('common.create') }}
              </van-button>
            </div>
          </van-form>
        </div>
      </van-action-sheet>

      <!-- 空间详情弹出层 -->
      <van-action-sheet v-model:show="showDetailSheet" :title="selectedSpace?.name">
        <div v-if="selectedSpace" class="space-detail">
          <div class="detail-header">
            <div class="detail-cover">
              <img v-if="selectedSpace.avatarUrl" :src="selectedSpace.avatarUrl" :alt="selectedSpace.name + '的头像'" />
              <div v-else class="default-cover">
                <van-icon name="cluster-o" size="60" />
              </div>
            </div>
            <div class="detail-info">
              <div class="detail-name">{{ selectedSpace.name }}</div>
              <div class="detail-tags">
                <span v-if="selectedSpace.isPublic" class="tag public">{{ t('space.public') }}</span>
                <span v-else class="tag private">{{ t('space.private') }}</span>
              </div>
              <div v-if="selectedSpace.topic" class="detail-topic">{{ selectedSpace.topic }}</div>
              <div class="detail-stats">
                <span>
                  <van-icon name="friends-o" />
                  {{ selectedSpace.memberCount }} {{ t('space.members') }}
                </span>
                <span>
                  <van-icon name="chat-o" />
                  {{ selectedSpace.childCount }} {{ t('space.rooms') }}
                </span>
              </div>
            </div>
          </div>

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
        </div>
      </van-action-sheet>

      <!-- 邀请成员 -->
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

      <!-- 添加房间 -->
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

      <!-- 空间设置 -->
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
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSpace, useSpaceMembers, useSpaceRooms, useSpaces } from '@/composables/space'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import type { SpaceInfo, SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
import { Visibility } from '@/services/matrix/sdk'

const { t } = useI18n()

const selectedSpaceId = ref('')
const { spaces, loading, mutating, load: loadSpaces, create: createSpace } = useSpaces()
const { mutating: detailMutating, update: updateSpace } = useSpace(() => selectedSpaceId.value)
const { mutating: memberMutating, invite: inviteMember } = useSpaceMembers(() => selectedSpaceId.value)
const { mutating: roomMutating, addRoom } = useSpaceRooms(() => selectedSpaceId.value)

const refreshing = ref(false)
const showCreateSheet = ref(false)
const showDetailSheet = ref(false)
const showInviteSheet = ref(false)
const showAddRoomSheet = ref(false)
const showSettingsSheet = ref(false)
const selectedSpace = ref<SpaceInfo | null>(null)

const formData = reactive<SpaceOptions>({
  name: '',
  topic: '',
  visibility: Visibility.Private
})

const inviteForm = reactive({ userId: '' })
const addRoomForm = reactive({ roomId: '', suggested: false })
const settingsForm = reactive({ name: '', topic: '' })

const onRefresh = async () => {
  refreshing.value = true
  await loadSpaces()
  refreshing.value = false
}

const handleCreate = async () => {
  const result = await createSpace({ ...formData })
  if (result) {
    showToast(t('space.create_success'))
    showCreateSheet.value = false
    formData.name = ''
    formData.topic = ''
    formData.visibility = Visibility.Private
  } else {
    showToast(t('space.create_failed'))
  }
}

const handleSpaceClick = (space: SpaceInfo) => {
  selectedSpace.value = space
  selectedSpaceId.value = space.spaceId
  showDetailSheet.value = true
}

const openInvite = () => {
  inviteForm.userId = ''
  showDetailSheet.value = false
  showInviteSheet.value = true
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

const focusSearch = () => {
  // Implement search focus functionality
}

onMounted(() => {
  loadSpaces()
})
</script>

<style scoped lang="scss">
.space-view {
  min-height: 100vh;
  background: var(--hula-surface-deepest);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* TJG: 搜索栏（对齐 mobile message 风格） */
.m-search {
  background: var(--hula-surface-search);
  border-radius: var(--hula-radius-sm);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--hula-text-tertiary);
  cursor: pointer;
  transition: background 0.15s;
}

.m-search:hover {
  background: var(--hula-surface-subtle);
}

/* TJG: 创建按钮 */
.create-button {
  margin-bottom: 4px;
}

.tjg-create-btn {
  border-radius: var(--hula-radius-sm);
}

/* TJG: 空间列表（对齐 mobile message list 风格） */
.space-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.space-item {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
  overflow: hidden;
  background: transparent;
  border-radius: var(--hula-radius-sm);
}

.space-item:active {
  background: var(--hula-surface-list-hover);
}

.space-avatar {
  width: 48px;
  height: 48px;
  border-radius: var(--hula-radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  position: relative;
  background: var(--hula-surface-subtle);
  overflow: hidden;
  color: var(--hula-text-secondary);
}

.space-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* TJG: 公开/私有角标 */
.space-badge {
  position: absolute;
  bottom: -2px;
  right: -2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  border: 2px solid var(--hula-surface-deepest);
}

.space-badge.public {
  background: var(--hula-color-success-100);
  color: var(--hula-color-success-500);
}

.space-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.space-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.space-name {
  font-size: 15px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--hula-text-primary);
}

/* TJG: 公开/私有标签 */
.public-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--hula-color-primary-100);
  color: var(--hula-color-primary-500);
  flex-shrink: 0;
}

.private-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--hula-surface-search);
  color: var(--hula-text-tertiary);
  flex-shrink: 0;
}

.space-count {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  flex-shrink: 0;
}

.space-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.space-topic {
  font-size: 13px;
  color: var(--hula-text-secondary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.space-topic.placeholder {
  color: var(--hula-text-tertiary);
}

.space-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--hula-text-tertiary);
  flex-shrink: 0;
  margin-left: 8px;
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

/* TJG: 详情面板样式 */
.space-detail {
  padding: 16px;

  .detail-header {
    display: flex;
    gap: 16px;

    .detail-cover {
      width: 80px;
      height: 80px;
      flex-shrink: 0;
      border-radius: var(--hula-radius-sm);
      overflow: hidden;
      background: var(--hula-surface-subtle);
      display: flex;
      align-items: center;
      justify-content: center;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .default-cover {
        color: var(--hula-text-tertiary);
      }
    }

    .detail-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 6px;

      .detail-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--hula-text-primary);
      }

      .detail-tags {
        display: flex;
        gap: 6px;
      }

      .tag {
        font-size: 11px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .tag.public {
        background: var(--hula-color-primary-100);
        color: var(--hula-color-primary-500);
      }

      .tag.private {
        background: var(--hula-surface-search);
        color: var(--hula-text-tertiary);
      }

      .detail-topic {
        font-size: 13px;
        color: var(--hula-text-secondary);
      }

      .detail-stats {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: var(--hula-text-tertiary);

        span {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      }
    }
  }

  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}

:deep(.van-pull-refresh) {
  flex: 1;
  overflow: hidden;
}

:deep(.van-pull-refresh__track) {
  height: 100%;
}
</style>
