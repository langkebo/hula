<template>
  <n-drawer :show="visible" :width="480" placement="right" @update:show="$emit('update:visible', $event)">
    <n-drawer-content :title="t('space.management.title')" closable>
      <div class="space-management">
        <div class="management-loading" v-if="loading">
          <n-spin size="medium" />
        </div>

        <template v-else-if="spaceInfo">
          <div class="space-header">
            <n-avatar round :size="56" :src="spaceInfo.avatarUrl || undefined">
              {{ spaceInfo.name?.charAt(0) || '?' }}
            </n-avatar>
            <div class="space-header-info">
              <h3 class="space-name">{{ spaceInfo.name }}</h3>
              <div class="space-meta">
                <n-tag size="small" round>{{ t('space.management.members', { count: spaceInfo.memberCount }) }}</n-tag>
                <n-tag size="small" round type="info">
                  {{ t('space.management.rooms', { count: spaceInfo.childCount }) }}
                </n-tag>
              </div>
            </div>
          </div>

          <n-tabs type="line" animated>
            <n-tab-pane :name="'info'" :tab="t('space.management.tab_info')">
              <div class="tab-content">
                <n-form label-placement="top" :show-feedback="false">
                  <n-form-item :label="t('space.name')">
                    <n-input v-model:value="editName" :placeholder="t('space.name_placeholder')" />
                  </n-form-item>
                  <n-form-item :label="t('space.topic')">
                    <n-input
                      v-model:value="editTopic"
                      type="textarea"
                      :autosize="{ minRows: 2, maxRows: 4 }"
                      :placeholder="t('space.topic_placeholder')" />
                  </n-form-item>
                  <n-button type="primary" :loading="mutating" :disabled="!hasInfoChanged" @click="handleUpdateInfo">
                    {{ t('common.save') }}
                  </n-button>
                </n-form>
              </div>
            </n-tab-pane>

            <n-tab-pane :name="'members'" :tab="t('space.management.tab_members')">
              <div class="tab-content">
                <div class="invite-row">
                  <n-input
                    v-model:value="inviteUserId"
                    :placeholder="t('space.invite_user_placeholder')"
                    @keydown.enter="handleInvite" />
                  <n-button type="primary" :loading="mutating" :disabled="!inviteUserId.trim()" @click="handleInvite">
                    {{ t('space.invite') }}
                  </n-button>
                </div>
                <n-list bordered>
                  <n-list-item v-for="member in members" :key="member.user_id">
                    <div class="member-item">
                      <n-avatar round :size="32">{{ member.user_id.charAt(1)?.toUpperCase() }}</n-avatar>
                      <span class="member-name">{{ member.user_id }}</span>
                      <n-tag v-if="member.membership" size="small" :type="membershipTagType(member.membership)" round>
                        {{ member.membership }}
                      </n-tag>
                    </div>
                  </n-list-item>
                </n-list>
                <n-empty v-if="members.length === 0" :description="t('space.management.no_members')" />
              </div>
            </n-tab-pane>

            <n-tab-pane :name="'rooms'" :tab="t('space.management.tab_rooms')">
              <div class="tab-content">
                <div class="add-room-row">
                  <n-input
                    v-model:value="addRoomId"
                    :placeholder="t('space.management.room_id_placeholder')"
                    @keydown.enter="handleAddRoom" />
                  <n-button type="primary" :loading="mutating" :disabled="!addRoomId.trim()" @click="handleAddRoom">
                    {{ t('common.add') }}
                  </n-button>
                </div>
                <n-list bordered>
                  <n-list-item v-for="child in children" :key="child.room_id">
                    <div class="child-item">
                      <div class="child-info">
                        <span class="child-name">{{ child.room_id }}</span>
                        <n-tag v-if="child.is_suggested" size="small" type="info" round>
                          {{ t('space.management.suggested') }}
                        </n-tag>
                      </div>
                      <n-button text type="error" @click="handleRemoveRoom(child.room_id)">
                        {{ t('common.remove') }}
                      </n-button>
                    </div>
                  </n-list-item>
                </n-list>
                <n-empty v-if="children.length === 0" :description="t('space.management.no_rooms')" />
              </div>
            </n-tab-pane>

            <n-tab-pane :name="'danger'" :tab="t('space.management.tab_danger')">
              <div class="tab-content">
                <div class="danger-zone">
                  <n-button block secondary type="warning" :loading="mutating" @click="handleLeave">
                    {{ t('space.management.leave') }}
                  </n-button>
                  <n-button block type="error" :loading="mutating" @click="handleDelete">
                    {{ t('space.management.delete') }}
                  </n-button>
                </div>
              </div>
            </n-tab-pane>
          </n-tabs>
        </template>

        <n-empty v-else :description="t('space.management.load_failed')" />
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useSpaceManagement } from '@/composables/space/useSpaceManagement'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SpaceManagement')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const props = defineProps<{
  visible: boolean
  spaceId: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  left: []
  deleted: []
}>()

const {
  spaceInfo,
  members,
  children,
  loading,
  mutating,
  loadSpace,
  updateSpaceInfo,
  inviteUser,
  addChildRoom,
  removeChildRoom,
  leaveSpace,
  deleteSpace
} = useSpaceManagement(() => props.spaceId)

const editName = ref('')
const editTopic = ref('')
const inviteUserId = ref('')
const addRoomId = ref('')

const hasInfoChanged = computed(() => {
  if (!spaceInfo.value) return false
  return editName.value !== (spaceInfo.value.name || '') || editTopic.value !== (spaceInfo.value.topic || '')
})

const membershipTagType = (membership: string): 'success' | 'warning' | 'default' => {
  if (membership === 'join') return 'success'
  if (membership === 'invite') return 'warning'
  return 'default'
}

const handleUpdateInfo = async () => {
  const data: Record<string, string> = {}
  if (editName.value !== (spaceInfo.value?.name || '')) data.name = editName.value
  if (editTopic.value !== (spaceInfo.value?.topic || '')) data.topic = editTopic.value
  const ok = await updateSpaceInfo(data)
  if (ok) {
    showFeedback(t('space.management.update_success'), 'success')
  } else {
    showFeedback(t('space.management.update_failed'), 'error')
  }
}

const handleInvite = async () => {
  const userId = inviteUserId.value.trim()
  if (!userId) return
  const ok = await inviteUser(userId)
  if (ok) {
    showFeedback(t('space.management.invite_success'), 'success')
    inviteUserId.value = ''
  } else {
    showFeedback(t('space.management.invite_failed'), 'error')
  }
}

const handleAddRoom = async () => {
  const roomId = addRoomId.value.trim()
  if (!roomId) return
  const ok = await addChildRoom(roomId)
  if (ok) {
    showFeedback(t('space.management.add_room_success'), 'success')
    addRoomId.value = ''
  } else {
    showFeedback(t('space.management.add_room_failed'), 'error')
  }
}

const handleRemoveRoom = async (roomId: string) => {
  const ok = await removeChildRoom(roomId)
  if (ok) {
    showFeedback(t('space.management.remove_room_success'), 'success')
  } else {
    showFeedback(t('space.management.remove_room_failed'), 'error')
  }
}

const handleLeave = async () => {
  const ok = await leaveSpace()
  if (ok) {
    showFeedback(t('space.management.leave_success'), 'success')
    emit('update:visible', false)
    emit('left')
  } else {
    showFeedback(t('space.management.leave_failed'), 'error')
  }
}

const handleDelete = async () => {
  const ok = await deleteSpace()
  if (ok) {
    showFeedback(t('space.management.delete_success'), 'success')
    emit('update:visible', false)
    emit('deleted')
  } else {
    showFeedback(t('space.management.delete_failed'), 'error')
  }
}

watch(
  () => [props.visible, props.spaceId] as const,
  ([visible, id]) => {
    if (visible && id) {
      loadSpace()
    }
  }
)

watch(spaceInfo, (info) => {
  if (info) {
    editName.value = info.name || ''
    editTopic.value = info.topic || ''
  }
})
</script>

<style scoped lang="scss">
.space-management {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.management-loading {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}

.space-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.space-header-info {
  flex: 1;
  min-width: 0;
}

.space-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--hula-text-primary);
  margin: 0 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-meta {
  display: flex;
  gap: 6px;
}

.tab-content {
  padding: 12px 0;
}

.invite-row,
.add-room-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--hula-text-primary);
}

.child-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.child-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.child-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--hula-text-primary);
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
