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
            <div v-for="space in spaces" :key="space.spaceId" class="space-card" @click="handleSpaceClick(space)">
              <div class="space-cover">
                <img v-if="space.avatarUrl" :src="space.avatarUrl" :alt="space.name + '的头像'" />
                <div v-else class="default-cover">
                  <van-icon name="cluster-o" size="40" />
                </div>
              </div>
              <div class="space-info">
                <div class="space-name">{{ space.name }}</div>
                <div v-if="space.topic" class="space-topic">{{ space.topic }}</div>
                <div class="space-stats">
                  <span>
                    <van-icon name="friends-o" />
                    {{ space.memberCount }}
                  </span>
                  <span>
                    <van-icon name="chat-o" />
                    {{ space.childCount }}
                  </span>
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
  visibility: 'private'
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
    formData.visibility = 'private'
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

onMounted(() => {
  loadSpaces()
})
</script>

<style scoped lang="scss">
.space-view {
  min-height: 100vh;
  background: var(--van-background-2);
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

.space-card {
  background: var(--van-background);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--hula-shadow-card);

  .space-cover {
    width: 100%;
    aspect-ratio: 16/9;
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
  }

  .space-info {
    padding: 12px;

    .space-name {
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .space-topic {
      font-size: 12px;
      color: var(--van-text-color-2);
      margin-bottom: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .space-stats {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: var(--van-text-color-3);

      span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
    }
  }
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

  .detail-header {
    display: flex;
    gap: 16px;

    .detail-cover {
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
        color: var(--van-text-color-3);

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
    gap: 12px;
  }
}
</style>
