<template>
  <div class="space-view h-full flex flex-col">
    <!-- 头部 -->
    <div class="space-header p-16px border-b border-[--line-color]">
      <n-flex justify="space-between" align="center">
        <n-flex align="center" :size="12">
          <svg class="size-20px"><use href="#space"></use></svg>
          <span class="text-16px font-500">{{ t('space.title') }}</span>
        </n-flex>
        <n-button type="primary" size="small" @click="showCreateModal = true">
          <template #icon>
            <svg class="size-14px"><use href="#add"></use></svg>
          </template>
          {{ t('space.create') }}
        </n-button>
      </n-flex>
    </div>

    <!-- 空间列表 -->
    <div class="space-list flex-1 overflow-hidden">
      <n-spin :show="loading">
        <n-scrollbar v-if="spaces.length > 0" class="h-full">
          <div class="p-16px">
            <n-grid :cols="3" :x-gap="16" :y-gap="16">
              <n-grid-item v-for="space in spaces" :key="space.spaceId">
                <n-card
                  :title="space.name"
                  hoverable
                  class="space-card cursor-pointer"
                  @click="handleSpaceClick(space)">
                  <template #cover>
                    <div class="space-avatar">
                      <img v-if="space.avatarUrl" :src="space.avatarUrl" alt="" />
                      <div v-else class="default-avatar">
                        <svg class="size-40px"><use href="#space"></use></svg>
                      </div>
                    </div>
                  </template>
                  <n-flex vertical :size="8">
                    <n-ellipsis v-if="space.topic" :line-clamp="2" class="text-12px text-[--color-text-tertiary]">
                      {{ space.topic }}
                    </n-ellipsis>
                    <n-flex :size="16">
                      <n-flex :size="4" align="center">
                        <svg class="size-14px"><use href="#user"></use></svg>
                        <span class="text-12px">{{ space.memberCount }}</span>
                      </n-flex>
                      <n-flex :size="4" align="center">
                        <svg class="size-14px"><use href="#room"></use></svg>
                        <span class="text-12px">{{ space.childCount }}</span>
                      </n-flex>
                    </n-flex>
                  </n-flex>
                </n-card>
              </n-grid-item>
            </n-grid>
          </div>
        </n-scrollbar>
        <n-empty v-else :description="t('space.empty')" class="mt-100px" />
      </n-spin>
    </div>

    <!-- 创建空间对话框 -->
    <n-modal v-model:show="showCreateModal" preset="card" :title="t('space.create')" style="width: 500px">
      <n-form ref="formRef" :model="formData" :rules="rules" label-placement="left" label-width="80">
        <n-form-item :label="t('space.name')" path="name">
          <n-input v-model:value="formData.name" :placeholder="t('space.name_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('space.topic')" path="topic">
          <n-input
            v-model:value="formData.topic"
            type="textarea"
            :placeholder="t('space.topic_placeholder')"
            :rows="3" />
        </n-form-item>
        <n-form-item :label="t('space.visibility')" path="visibility">
          <n-radio-group v-model:value="formData.visibility">
            <n-radio value="private">{{ t('space.private') }}</n-radio>
            <n-radio value="public">{{ t('space.public') }}</n-radio>
          </n-radio-group>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-flex justify="flex-end" :size="12">
          <n-button @click="showCreateModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="mutating" @click="handleCreate">
            {{ t('common.create') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>

    <!-- 空间详情对话框 -->
    <n-modal
      v-model:show="showDetailModal"
      preset="card"
      :title="selectedSpace?.name"
      style="width: 600px">
      <n-flex v-if="selectedSpace" vertical :size="16">
        <n-flex align="center" :size="16">
          <div class="space-detail-avatar">
            <img v-if="selectedSpace.avatarUrl" :src="selectedSpace.avatarUrl" alt="" />
            <div v-else class="default-avatar">
              <svg class="size-60px"><use href="#space"></use></svg>
            </div>
          </div>
          <n-flex vertical :size="4">
            <span class="text-18px font-500">{{ selectedSpace.name }}</span>
            <span v-if="selectedSpace.topic" class="text-14px text-[--color-text-tertiary]">{{ selectedSpace.topic }}</span>
            <n-flex :size="16">
              <n-flex :size="4" align="center">
                <svg class="size-16px"><use href="#user"></use></svg>
                <span class="text-14px">{{ selectedSpace.memberCount }} {{ t('space.members') }}</span>
              </n-flex>
              <n-flex :size="4" align="center">
                <svg class="size-16px"><use href="#room"></use></svg>
                <span class="text-14px">{{ selectedSpace.childCount }} {{ t('space.rooms') }}</span>
              </n-flex>
            </n-flex>
          </n-flex>
        </n-flex>

        <n-divider />

        <n-flex vertical :size="12">
          <span class="text-14px font-500">{{ t('space.actions') }}</span>
          <n-flex :size="12">
            <n-button size="small" @click="openInvite">
              <template #icon>
                <svg class="size-14px"><use href="#add-user"></use></svg>
              </template>
              {{ t('space.invite') }}
            </n-button>
            <n-button size="small" @click="openAddRoom">
              <template #icon>
                <svg class="size-14px"><use href="#add"></use></svg>
              </template>
              {{ t('space.add_room') }}
            </n-button>
            <n-button size="small" @click="openSettings">
              <template #icon>
                <svg class="size-14px"><use href="#setting"></use></svg>
              </template>
              {{ t('space.settings') }}
            </n-button>
          </n-flex>
        </n-flex>
      </n-flex>
    </n-modal>

    <!-- 邀请成员对话框 -->
    <n-modal v-model:show="showInviteModal" preset="card" :title="t('space.invite_title')" style="width: 480px">
      <n-form :model="inviteForm">
        <n-form-item :label="t('space.invite_title')">
          <n-input v-model:value="inviteForm.userId" :placeholder="t('space.invite_user_placeholder')" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-flex justify="flex-end" :size="12">
          <n-button @click="showInviteModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="memberMutating" @click="handleInvite">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>

    <!-- 添加房间对话框 -->
    <n-modal v-model:show="showAddRoomModal" preset="card" :title="t('space.add_room_title')" style="width: 480px">
      <n-form :model="addRoomForm">
        <n-form-item :label="t('space.add_room')">
          <n-input v-model:value="addRoomForm.roomId" :placeholder="t('space.add_room_placeholder')" />
        </n-form-item>
        <n-form-item>
          <n-checkbox v-model:checked="addRoomForm.suggested">{{ t('space.add_room_suggested') }}</n-checkbox>
        </n-form-item>
      </n-form>
      <template #footer>
        <n-flex justify="flex-end" :size="12">
          <n-button @click="showAddRoomModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="roomMutating" @click="handleAddRoom">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>

    <!-- 空间设置对话框 -->
    <n-modal v-model:show="showSettingsModal" preset="card" :title="t('space.settings_title')" style="width: 520px">
      <n-form :model="settingsForm" label-placement="left" label-width="80">
        <n-form-item :label="t('space.name')">
          <n-input v-model:value="settingsForm.name" :placeholder="t('space.name_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('space.topic')">
          <n-input
            v-model:value="settingsForm.topic"
            type="textarea"
            :placeholder="t('space.topic_placeholder')"
            :rows="3" />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-flex justify="flex-end" :size="12">
          <n-button @click="showSettingsModal = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="detailMutating" @click="handleSaveSettings">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'
import type { SpaceInfo, SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
import { useSpaces, useSpace, useSpaceMembers, useSpaceRooms } from '@/composables/space'

const { t } = useI18n()
const message = useMessage()

const selectedSpaceId = ref('')
const { spaces, loading, mutating, load: loadSpaces, create: createSpace } = useSpaces()
const { mutating: detailMutating, update: updateSpace } = useSpace(() => selectedSpaceId.value)
const { mutating: memberMutating, invite: inviteMember } = useSpaceMembers(() => selectedSpaceId.value)
const { mutating: roomMutating, addRoom } = useSpaceRooms(() => selectedSpaceId.value)

const showCreateModal = ref(false)
const showDetailModal = ref(false)
const showInviteModal = ref(false)
const showAddRoomModal = ref(false)
const showSettingsModal = ref(false)
const selectedSpace = ref<SpaceInfo | null>(null)

const formRef = ref()
const formData = reactive<SpaceOptions>({
  name: '',
  topic: '',
  visibility: 'private'
})

const inviteForm = reactive({ userId: '' })
const addRoomForm = reactive({ roomId: '', suggested: false })
const settingsForm = reactive({ name: '', topic: '' })

const rules = {
  name: {
    required: true,
    message: t('space.name_required'),
    trigger: 'blur'
  }
}

const handleCreate = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const result = await createSpace({ ...formData })
  if (result) {
    message.success(t('space.create_success'))
    showCreateModal.value = false
    formData.name = ''
    formData.topic = ''
    formData.visibility = 'private'
  } else {
    message.error(t('space.create_failed'))
  }
}

const handleSpaceClick = (space: SpaceInfo) => {
  selectedSpace.value = space
  selectedSpaceId.value = space.spaceId
  showDetailModal.value = true
}

const openInvite = () => {
  if (!selectedSpace.value) return
  inviteForm.userId = ''
  showInviteModal.value = true
}

const handleInvite = async () => {
  const userId = inviteForm.userId.trim()
  if (!userId) {
    message.warning(t('space.invite_user_required'))
    return
  }
  const ok = await inviteMember(userId)
  if (ok) {
    message.success(t('space.invite_success'))
    showInviteModal.value = false
  } else {
    message.error(t('space.invite_failed'))
  }
}

const openAddRoom = () => {
  if (!selectedSpace.value) return
  addRoomForm.roomId = ''
  addRoomForm.suggested = false
  showAddRoomModal.value = true
}

const handleAddRoom = async () => {
  const roomId = addRoomForm.roomId.trim()
  if (!roomId) {
    message.warning(t('space.add_room_required'))
    return
  }
  const ok = await addRoom(roomId, { suggested: addRoomForm.suggested })
  if (ok) {
    message.success(t('space.add_room_success'))
    showAddRoomModal.value = false
    if (selectedSpace.value) {
      selectedSpace.value = { ...selectedSpace.value, childCount: selectedSpace.value.childCount + 1 }
    }
  } else {
    message.error(t('space.add_room_failed'))
  }
}

const openSettings = () => {
  if (!selectedSpace.value) return
  settingsForm.name = selectedSpace.value.name
  settingsForm.topic = selectedSpace.value.topic ?? ''
  showSettingsModal.value = true
}

const handleSaveSettings = async () => {
  if (!selectedSpace.value) return
  const payload: Partial<SpaceOptions> = {}
  if (settingsForm.name && settingsForm.name !== selectedSpace.value.name) payload.name = settingsForm.name
  if (settingsForm.topic !== (selectedSpace.value.topic ?? '')) payload.topic = settingsForm.topic
  if (Object.keys(payload).length === 0) {
    showSettingsModal.value = false
    return
  }
  const ok = await updateSpace(payload)
  if (ok) {
    message.success(t('space.settings_success'))
    showSettingsModal.value = false
    if (selectedSpace.value) {
      selectedSpace.value = {
        ...selectedSpace.value,
        name: payload.name ?? selectedSpace.value.name,
        topic: payload.topic ?? selectedSpace.value.topic
      }
    }
    await loadSpaces()
  } else {
    message.error(t('space.settings_failed'))
  }
}

onMounted(() => {
  loadSpaces()
})
</script>

<style scoped lang="scss">
.space-view {
  background: var(--bg-main);
}

.space-card {
  :deep(.n-card__cover) {
    padding: 16px;
  }
}

.space-avatar,
.space-detail-avatar {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-popover);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .default-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-color-3);
  }
}

.space-detail-avatar {
  width: 120px;
  height: 120px;
  flex-shrink: 0;
}
</style>
