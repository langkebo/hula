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

                <n-collapse class="state-collapse">
                  <n-collapse-item :title="t('space.management.state_events')" name="state">
                    <template #header-extra>
                      <n-button text size="small" @click.stop="handleLoadState">
                        <Icon icon="mdi:refresh" :class="{ 'spin-icon': stateLoading }" />
                      </n-button>
                    </template>
                    <n-spin :show="stateLoading" size="small">
                      <n-empty v-if="spaceState.length === 0" :description="t('space.management.no_state_events')" />
                      <n-list v-else bordered size="small">
                        <n-list-item v-for="(evt, idx) in spaceState" :key="idx">
                          <div class="state-event-item">
                            <div class="state-event-header">
                              <n-tag size="small" round>{{ evt.type }}</n-tag>
                              <span v-if="evt.stateKey" class="state-key">{{ evt.stateKey }}</span>
                            </div>
                            <div class="state-event-content">
                              {{ formatContent(evt.content) }}
                            </div>
                          </div>
                        </n-list-item>
                      </n-list>
                    </n-spin>
                  </n-collapse-item>
                </n-collapse>
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

            <n-tab-pane :name="'hierarchy'" :tab="t('space.management.tab_hierarchy')">
              <div class="tab-content">
                <div class="action-row">
                  <n-button size="small" :loading="hierarchyLoading" @click="handleLoadHierarchy">
                    <Icon icon="mdi:refresh" style="margin-right: 4px" />
                    {{ t('space.management.refresh') }}
                  </n-button>
                </div>
                <n-spin :show="hierarchyLoading" size="small">
                  <n-empty v-if="hierarchyTreeData.length === 0" :description="t('space.management.no_hierarchy')" />
                  <n-tree
                    v-else
                    :data="hierarchyTreeData"
                    :block-line="true"
                    key-field="key"
                    label-field="label"
                    children-field="children"
                    default-expand-all />
                </n-spin>
              </div>
            </n-tab-pane>

            <n-tab-pane :name="'summary'" :tab="t('space.management.tab_summary')">
              <div class="tab-content">
                <div class="action-row">
                  <n-button size="small" :loading="summaryLoading" @click="handleLoadSummary">
                    <Icon icon="mdi:refresh" style="margin-right: 4px" />
                    {{ t('space.management.refresh') }}
                  </n-button>
                </div>
                <n-spin :show="summaryLoading" size="small">
                  <template v-if="spaceSummary">
                    <n-descriptions bordered :column="1" label-placement="left" size="small">
                      <n-descriptions-item :label="t('space.name')">
                        {{ spaceSummary.space.name || '-' }}
                      </n-descriptions-item>
                      <n-descriptions-item :label="t('space.topic')">
                        {{ spaceSummary.space.topic || '-' }}
                      </n-descriptions-item>
                      <n-descriptions-item :label="t('space.management.member_count_label')">
                        {{ spaceSummary.space.memberCount }}
                      </n-descriptions-item>
                      <n-descriptions-item :label="t('space.management.room_count_label')">
                        {{ spaceSummary.space.childCount }}
                      </n-descriptions-item>
                    </n-descriptions>

                    <div class="section-title">
                      {{ t('space.management.summary_children') }}
                    </div>
                    <n-list bordered size="small">
                      <n-list-item v-for="child in spaceSummary.children" :key="child.roomId">
                        <div class="summary-child-item">
                          <div class="summary-child-info">
                            <span class="summary-child-name">{{ child.name || child.roomId }}</span>
                            <n-tag size="small" round>
                              {{ child.memberCount }} {{ t('space.management.member_count_label') }}
                            </n-tag>
                            <n-tag v-if="child.joinRule" size="small" type="info" round>{{ child.joinRule }}</n-tag>
                          </div>
                        </div>
                      </n-list-item>
                    </n-list>
                    <n-empty
                      v-if="spaceSummary.children.length === 0"
                      :description="t('space.management.no_summary_children')" />
                  </template>
                  <n-empty v-else :description="t('space.management.no_summary')" />
                </n-spin>

                <n-collapse class="summary-collapse">
                  <n-collapse-item :title="t('space.management.summary_with_children')" name="summaryWithChildren">
                    <template #header-extra>
                      <n-button text size="small" @click.stop="handleLoadSummaryWithChildren">
                        <Icon icon="mdi:refresh" :class="{ 'spin-icon': summaryWithChildrenLoading }" />
                      </n-button>
                    </template>
                    <n-spin :show="summaryWithChildrenLoading" size="small">
                      <template v-if="spaceSummaryWithChildren">
                        <n-descriptions bordered :column="1" label-placement="left" size="small">
                          <n-descriptions-item :label="t('space.name')">
                            {{ spaceSummaryWithChildren.space.name || '-' }}
                          </n-descriptions-item>
                          <n-descriptions-item :label="t('space.topic')">
                            {{ spaceSummaryWithChildren.space.topic || '-' }}
                          </n-descriptions-item>
                          <n-descriptions-item :label="t('space.management.member_count_label')">
                            {{ spaceSummaryWithChildren.space.memberCount }}
                          </n-descriptions-item>
                          <n-descriptions-item :label="t('space.management.room_count_label')">
                            {{ spaceSummaryWithChildren.space.childCount }}
                          </n-descriptions-item>
                        </n-descriptions>
                        <n-list bordered size="small" style="margin-top: 8px">
                          <n-list-item v-for="(child, idx) in spaceSummaryWithChildren.children" :key="idx">
                            <div class="summary-child-item">
                              <div class="summary-child-info">
                                <span class="summary-child-name">
                                  {{ (child.name as string) || (child.room_id as string) || '-' }}
                                </span>
                                <n-tag v-if="child.room_type" size="small" round>{{ child.room_type as string }}</n-tag>
                              </div>
                            </div>
                          </n-list-item>
                        </n-list>
                        <n-empty
                          v-if="spaceSummaryWithChildren.children.length === 0"
                          :description="t('space.management.no_summary_children')" />
                      </template>
                      <n-empty v-else :description="t('space.management.no_summary')" />
                    </n-spin>
                  </n-collapse-item>
                </n-collapse>
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
import { Icon } from '@iconify/vue'
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
  spaceState,
  spaceHierarchy,
  spaceSummary,
  spaceSummaryWithChildren,
  loadSpace,
  updateSpaceInfo,
  inviteUser,
  addChildRoom,
  removeChildRoom,
  leaveSpace,
  deleteSpace,
  loadSpaceState,
  loadSpaceHierarchy,
  loadSpaceSummary,
  loadSpaceSummaryWithChildren
} = useSpaceManagement(() => props.spaceId)

const editName = ref('')
const editTopic = ref('')
const inviteUserId = ref('')
const addRoomId = ref('')
const stateLoading = ref(false)
const hierarchyLoading = ref(false)
const summaryLoading = ref(false)
const summaryWithChildrenLoading = ref(false)

const hasInfoChanged = computed(() => {
  if (!spaceInfo.value) return false
  return editName.value !== (spaceInfo.value.name || '') || editTopic.value !== (spaceInfo.value.topic || '')
})

const membershipTagType = (membership: string): 'success' | 'warning' | 'default' => {
  if (membership === 'join') return 'success'
  if (membership === 'invite') return 'warning'
  return 'default'
}

const formatContent = (content: unknown): string => {
  if (!content) return ''
  try {
    const str = JSON.stringify(content)
    return str.length > 120 ? str.slice(0, 120) + '...' : str
  } catch {
    return String(content)
  }
}

const hierarchyTreeData = computed(() => {
  const rooms = spaceHierarchy.value
  if (!rooms.length) return []

  const roomIdToChildren = new Map<string, Array<Record<string, unknown>>>()
  const allRoomIds = new Set(rooms.map((r) => r.room_id as string))

  for (const room of rooms) {
    const childIds = (room.children_state as Array<Record<string, unknown>>) ?? []
    for (const child of childIds) {
      const childRoomId = child.state_key as string
      if (!childRoomId) continue
      if (!roomIdToChildren.has(room.room_id as string)) {
        roomIdToChildren.set(room.room_id as string, [])
      }
      roomIdToChildren.get(room.room_id as string)!.push({ room_id: childRoomId })
    }
  }

  const buildNode = (roomId: string, visited: Set<string>): Record<string, unknown> | null => {
    if (visited.has(roomId)) return null
    visited.add(roomId)

    const room = rooms.find((r) => r.room_id === roomId)
    const childEntries = roomIdToChildren.get(roomId) ?? []
    const childNodes: Array<Record<string, unknown>> = []

    for (const child of childEntries) {
      const childId = child.room_id as string
      if (allRoomIds.has(childId)) {
        const node = buildNode(childId, visited)
        if (node) childNodes.push(node)
      } else {
        childNodes.push({
          key: childId,
          label: childId,
          prefix: () => '📦'
        })
      }
    }

    return {
      key: roomId,
      label: (room?.name as string) || roomId,
      prefix: () => ((room?.room_type as string) === 'm.space' ? '📁' : '📦'),
      children: childNodes.length > 0 ? childNodes : undefined
    }
  }

  const rootRoom = rooms[0]
  if (!rootRoom) return []

  const visited = new Set<string>()
  const rootNode = buildNode(rootRoom.room_id as string, visited)
  return rootNode ? [rootNode] : []
})

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

const handleLoadState = async () => {
  stateLoading.value = true
  try {
    await loadSpaceState()
  } finally {
    stateLoading.value = false
  }
}

const handleLoadHierarchy = async () => {
  hierarchyLoading.value = true
  try {
    await loadSpaceHierarchy()
  } finally {
    hierarchyLoading.value = false
  }
}

const handleLoadSummary = async () => {
  summaryLoading.value = true
  try {
    await loadSpaceSummary()
  } finally {
    summaryLoading.value = false
  }
}

const handleLoadSummaryWithChildren = async () => {
  summaryWithChildrenLoading.value = true
  try {
    await loadSpaceSummaryWithChildren()
  } finally {
    summaryWithChildrenLoading.value = false
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
.add-room-row,
.action-row {
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

.state-collapse {
  margin-top: 16px;
}

.state-event-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.state-event-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.state-key {
  font-size: 12px;
  color: var(--hula-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-event-content {
  font-size: 12px;
  color: var(--hula-text-secondary);
  word-break: break-all;
  max-height: 60px;
  overflow: hidden;
}

.summary-collapse {
  margin-top: 16px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--hula-text-primary);
  margin: 12px 0 8px;
}

.summary-child-item {
  display: flex;
  align-items: center;
  width: 100%;
}

.summary-child-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.summary-child-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--hula-text-primary);
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
