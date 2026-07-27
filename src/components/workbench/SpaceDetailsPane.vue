<template>
  <aside class="space-details-pane" :class="{ 'space-details-pane--compact': compact }">
    <div class="space-details-pane__body">
      <!-- 空状态 -->
      <div v-if="!activeSpace" class="space-details-pane__empty">
        <n-empty :description="t('space.details_empty_description')" size="large">
          <template #icon>
            <svg class="size-56px opacity-40 color-[--hula-text-quaternary]">
              <use href="#grid" />
            </svg>
          </template>
        </n-empty>
      </div>

      <!-- 子面板：成员完整列表 -->
      <SpaceMembersPane
        v-else-if="currentSubView === 'members'"
        :space-id="activeSpace.spaceId"
        :can-manage="canManage"
        @back="emit('update:subView', 'overview')"
        @member-click="emit('memberClick', $event)" />

      <!-- 子面板：子房间完整列表 -->
      <SpaceRoomsPane
        v-else-if="currentSubView === 'rooms'"
        :space-id="activeSpace.spaceId"
        :can-manage="canManage"
        @back="emit('update:subView', 'overview')"
        @enter-room="emit('enterRoom', $event)" />

      <!-- 子面板：层级树视图 -->
      <SpaceHierarchyTree
        v-else-if="currentSubView === 'hierarchy'"
        :space-id="activeSpace.spaceId"
        @back="emit('update:subView', 'overview')"
        @select="emit('selectSpace', $event)" />

      <template v-else>
        <!-- 空间概览区 -->
        <section class="space-details-pane__overview" data-test="space-overview">
          <div class="space-details-pane__avatar-area">
            <n-avatar
              v-if="activeSpace.avatarUrl"
              :size="96"
              :src="activeSpace.avatarUrl"
              round
              class="space-details-pane__avatar" />
            <div v-else class="space-details-pane__avatar-fallback" :style="{ background: avatarColor }">
              {{ initials }}
            </div>
          </div>

          <!-- 空间名称：内联编辑（canManage 时可编辑） -->
          <InlineEdit
            v-if="canManage"
            class="space-details-pane__name-edit"
            :label="t('space.name_label')"
            :value="activeSpace.name || ''"
            :placeholder="t('space.name_placeholder')"
            :loading="savingSpaceName"
            :edit-aria-label="t('space.edit_name')"
            :maxlength="100"
            @submit="emit('saveSpaceName', $event)" />
          <h2 v-else class="space-details-pane__name">{{ activeSpace.name }}</h2>

          <!-- 空间简介：内联编辑（canManage 时可编辑） -->
          <InlineEdit
            v-if="canManage"
            class="space-details-pane__topic-edit"
            :label="t('space.topic_label')"
            :value="activeSpace.topic || ''"
            :placeholder="t('space.topic_placeholder')"
            :loading="savingSpaceTopic"
            :edit-aria-label="t('space.edit_topic')"
            :maxlength="500"
            multiline
            :rows="3"
            @submit="emit('saveSpaceTopic', $event)" />
          <template v-else>
            <p v-if="activeSpace.topic" class="space-details-pane__topic">{{ activeSpace.topic }}</p>
            <p v-else class="space-details-pane__topic space-details-pane__topic--empty">
              {{ t('space.detail_space_topic_empty') }}
            </p>
          </template>

          <div class="space-details-pane__stats">
            <span class="space-details-pane__stat">
              <svg class="size-14px"><use href="#user" /></svg>
              <span>{{ t('space.member_count_value', { count: activeSpace.memberCount ?? 0 }) }}</span>
            </span>
            <span class="space-details-pane__stat">
              <svg class="size-14px"><use href="#grid" /></svg>
              <span>{{ t('space.room_count_value', { count: activeSpace.childCount ?? 0 }) }}</span>
            </span>
          </div>
        </section>

        <!-- 操作按钮区 -->
        <section class="space-details-pane__actions-grid" data-test="space-actions">
          <!-- 非成员：显示加入空间按钮 -->
          <button
            v-if="isMember === false"
            type="button"
            class="space-details-pane__action space-details-pane__action--primary"
            data-test="join-space-action"
            :loading="joiningSpace"
            @click="emit('joinSpace')">
            <svg class="size-16px"><use href="#user-add" /></svg>
            <span>{{ t('space.join_space') }}</span>
          </button>
          <!-- 成员：显示进入空间按钮 -->
          <button
            v-else
            type="button"
            class="space-details-pane__action space-details-pane__action--primary"
            :loading="enteringChat"
            @click="emit('enterSpace')">
            <svg class="size-16px"><use href="#message" /></svg>
            <span>{{ t('space.enter_space') }}</span>
          </button>
          <button v-if="canManage" type="button" class="space-details-pane__action" @click="emit('inviteMember')">
            <svg class="size-16px"><use href="#user-add" /></svg>
            <span>{{ t('space.invite') }}</span>
          </button>
          <button v-if="canManage" type="button" class="space-details-pane__action" @click="emit('addRoom')">
            <svg class="size-16px"><use href="#add" /></svg>
            <span>{{ t('space.add_room') }}</span>
          </button>
        </section>

        <!-- 管理表单（内嵌，仅 invite / add-room） -->
        <section v-if="manageMode" class="space-details-pane__manage" data-test="space-manage-pane">
          <div class="space-details-pane__manage-title">{{ manageTitle }}</div>
          <n-form label-placement="top" :show-feedback="false" class="space-details-pane__manage-form">
            <n-form-item v-if="manageMode === 'invite'" :label="t('space.invite')">
              <n-input
                :value="inviteUserId"
                :placeholder="t('space.invite_user_placeholder')"
                @update:value="emit('update:inviteUserId', $event)" />
            </n-form-item>

            <template v-else-if="manageMode === 'add-room'">
              <n-form-item :label="t('space.add_room')">
                <n-input
                  :value="addRoomId"
                  :placeholder="t('space.add_room_placeholder')"
                  @update:value="emit('update:addRoomId', $event)" />
              </n-form-item>
              <n-checkbox :checked="addRoomSuggested" @update:checked="emit('update:addRoomSuggested', $event)">
                {{ t('space.add_room_suggested') }}
              </n-checkbox>
            </template>
          </n-form>
          <n-flex justify="flex-end" :size="8" class="space-details-pane__manage-actions">
            <n-button size="small" @click="emit('closeManagePane')">{{ t('common.cancel') }}</n-button>
            <n-button size="small" type="primary" :loading="manageSubmitting" @click="emit('submitManagePane')">
              {{ t('common.confirm') }}
            </n-button>
          </n-flex>
        </section>

        <!-- 成员预览区 -->
        <section class="space-details-pane__section" data-test="space-members-preview">
          <div class="space-details-pane__section-header">
            <span class="space-details-pane__section-title">{{ t('space.detail_members_preview') }}</span>
            <button
              v-if="members.length"
              type="button"
              class="space-details-pane__link-btn"
              data-test="view-all-members"
              @click="emit('update:subView', 'members')">
              {{ t('space.view_all_members') }}
            </button>
          </div>
          <div v-if="membersLoading" class="space-details-pane__loading">
            <n-spin size="small" />
          </div>
          <div v-else-if="members.length" class="space-details-pane__members-grid">
            <div v-for="member in membersPreview" :key="member.user_id" class="space-details-pane__member">
              <div class="space-details-pane__member-fallback">
                {{ getInitials(member.user_id) }}
              </div>
              <span class="space-details-pane__member-name">
                {{ member.user_id }}
              </span>
            </div>
          </div>
          <p v-else class="space-details-pane__hint">{{ t('space.detail_members_empty') }}</p>
        </section>

        <!-- 子房间预览区 -->
        <section class="space-details-pane__section" data-test="space-rooms-preview">
          <div class="space-details-pane__section-header">
            <span class="space-details-pane__section-title">{{ t('space.child_rooms') }}</span>
            <button
              v-if="rooms.length"
              type="button"
              class="space-details-pane__link-btn"
              data-test="view-all-rooms"
              @click="emit('update:subView', 'rooms')">
              {{ t('space.view_all_rooms') }}
            </button>
          </div>
          <div v-if="roomsLoading" class="space-details-pane__loading">
            <n-spin size="small" />
          </div>
          <div v-else-if="rooms.length" class="space-details-pane__rooms-list">
            <div
              v-for="room in roomsPreview"
              :key="room.roomId"
              class="space-details-pane__room"
              @click="emit('enterRoom', room.roomId)">
              <n-avatar v-if="room.avatarUrl" :size="32" :src="room.avatarUrl" round />
              <div v-else class="space-details-pane__room-fallback">
                <svg class="size-14px"><use href="#grid" /></svg>
              </div>
              <span class="space-details-pane__room-name">{{ room.name || room.roomId }}</span>
              <button
                v-if="canManage"
                type="button"
                class="space-details-pane__room-remove"
                :aria-label="t('space.remove_room')"
                :title="t('space.remove_room')"
                @click.stop="emit('removeRoom', room.roomId)">
                <svg class="size-12px"><use href="#close" /></svg>
              </button>
              <svg v-else class="size-12px space-details-pane__room-arrow"><use href="#arrow-right" /></svg>
            </div>
          </div>
          <p v-else class="space-details-pane__hint">{{ t('space.detail_space_rooms_empty') }}</p>
        </section>

        <!-- 层级树入口 -->
        <section class="space-details-pane__section" data-test="space-hierarchy-entry">
          <div class="space-details-pane__section-header">
            <span class="space-details-pane__section-title">{{ t('space.hierarchy_title') }}</span>
            <button
              type="button"
              class="space-details-pane__link-btn"
              data-test="view-hierarchy"
              @click="emit('update:subView', 'hierarchy')">
              {{ t('space.view_hierarchy') }}
            </button>
          </div>
          <p class="space-details-pane__hint">{{ t('space.hierarchy_hint') }}</p>
        </section>

        <!-- 危险操作区 -->
        <section v-if="activeSpace" class="space-details-pane__danger-zone" data-test="space-danger-zone">
          <div class="space-details-pane__section-title">{{ t('space.danger_zone') }}</div>
          <n-flex vertical :size="8">
            <n-button block secondary @click="emit('leaveSpace')">
              {{ t('space.leave_space') }}
            </n-button>
            <n-button v-if="canManage" block secondary type="error" @click="emit('deleteSpace')">
              {{ t('space.delete_space') }}
            </n-button>
          </n-flex>
        </section>
      </template>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import InlineEdit from '@/components/atomic/InlineEdit.vue'
import type { SpaceChildRoom } from '@/composables/space/useSpaceRooms'
import type { SpaceInfo, SpaceMember } from '@/services/matrix/room/MatrixSpaceService'
import SpaceHierarchyTree from './SpaceHierarchyTree.vue'
import type { SpaceListItem } from './SpaceListPane.vue'
import SpaceMembersPane from './SpaceMembersPane.vue'
import SpaceRoomsPane from './SpaceRoomsPane.vue'

type SpaceManageMode = 'invite' | 'add-room'
type SpaceSubView = 'overview' | 'members' | 'rooms' | 'hierarchy'

const props = withDefaults(
  defineProps<{
    activeSpace: SpaceListItem | null
    members: SpaceMember[]
    rooms: SpaceChildRoom[]
    membersLoading?: boolean
    roomsLoading?: boolean
    canManage?: boolean
    isMember?: boolean
    subView?: SpaceSubView
    joiningSpace?: boolean
    manageMode?: SpaceManageMode | null
    manageSubmitting?: boolean
    inviteUserId?: string
    addRoomId?: string
    addRoomSuggested?: boolean
    savingSpaceName?: boolean
    savingSpaceTopic?: boolean
    enteringChat?: boolean
    compact?: boolean
  }>(),
  {
    isMember: true,
    subView: 'overview'
  }
)

const emit = defineEmits<{
  enterSpace: []
  enterRoom: [roomId: string]
  inviteMember: []
  addRoom: []
  joinSpace: []
  saveSpaceName: [value: string]
  saveSpaceTopic: [value: string]
  removeRoom: [roomId: string]
  leaveSpace: []
  deleteSpace: []
  closeManagePane: []
  submitManagePane: []
  'update:subView': [view: SpaceSubView]
  'update:inviteUserId': [value: string]
  'update:addRoomId': [value: string]
  'update:addRoomSuggested': [value: boolean]
  memberClick: [userId: string]
  selectSpace: [space: SpaceInfo]
}>()

const currentSubView = computed<SpaceSubView>(() => props.subView)

const { t } = useI18n()

const MEMBERS_PREVIEW_LIMIT = 8
const ROOMS_PREVIEW_LIMIT = 5

const membersPreview = computed(() => props.members.slice(0, MEMBERS_PREVIEW_LIMIT))
const roomsPreview = computed(() => props.rooms.slice(0, ROOMS_PREVIEW_LIMIT))

const manageTitle = computed(() => {
  switch (props.manageMode) {
    case 'invite':
      return t('space.invite_title')
    case 'add-room':
      return t('space.add_room_title')
    default:
      return ''
  }
})

const initials = computed(() => {
  const name = props.activeSpace?.name || ''
  return name.slice(0, 2).toUpperCase() || '?'
})

const avatarColor = computed(() => {
  const id = props.activeSpace?.spaceId || ''
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 45%, 55%)`
})

const getInitials = (text: string) => {
  // 提取用户 ID 的本地部分（@user:server → user）
  const localPart = text.startsWith('@') ? text.slice(1).split(':')[0] : text
  return localPart.slice(0, 2).toUpperCase() || '?'
}
</script>

<style scoped lang="scss">
.space-details-pane {
  flex: 1;
  min-width: 0;
  height: 100%;
  background: var(--hula-surface-panel);
  display: flex;
  flex-direction: column;
}

.space-details-pane--compact {
  min-width: 400px;
}

/* 主体内容区 */
.space-details-pane__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 空状态 */
.space-details-pane__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 空间概览 */
.space-details-pane__overview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 16px 0 8px;
}

.space-details-pane__avatar-area {
  display: flex;
  justify-content: center;
}

.space-details-pane__avatar {
  display: block;
}

.space-details-pane__avatar-fallback {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: 600;
  color: var(--hula-text-inverse);
}

.space-details-pane__name {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--hula-text-primary);
  text-align: center;
}

.space-details-pane__topic {
  margin: 0;
  font-size: 13px;
  color: var(--hula-text-secondary);
  text-align: center;
  max-width: 480px;
  line-height: 1.5;

  &--empty {
    color: var(--hula-text-quaternary);
    font-style: italic;
  }
}

.space-details-pane__stats {
  display: flex;
  gap: 20px;
  padding: 8px 0;
}

.space-details-pane__stat {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--hula-text-tertiary);

  svg {
    color: var(--hula-text-quaternary);
  }
}

/* 操作按钮区 */
.space-details-pane__actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.space-details-pane__action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 72px;
  padding: 8px;
  border: 1px solid var(--hula-border-default);
  border-radius: 10px;
  background: var(--hula-surface-panel);
  color: var(--hula-text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--hula-color-primary-300);
    background: var(--hula-color-primary-50, color-mix(in srgb, var(--hula-color-primary-500) 6%, transparent));
    color: var(--hula-color-primary-500);
  }

  &:active {
    transform: scale(0.98);
  }

  &--primary {
    background: var(--hula-color-primary-500);
    border-color: var(--hula-color-primary-500);
    color: var(--hula-text-inverse);

    &:hover {
      background: var(--hula-color-primary-600);
      border-color: var(--hula-color-primary-600);
      color: var(--hula-text-inverse);
    }
  }
}

/* 管理表单 */
.space-details-pane__manage {
  padding: 16px;
  border: 1px solid var(--hula-border-default);
  border-radius: 10px;
  background: var(--hula-surface-search);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.space-details-pane__manage-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--hula-text-primary);
}

.space-details-pane__manage-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.space-details-pane__manage-actions {
  display: flex;
  justify-content: flex-end;
}

/* 通用 section */
.space-details-pane__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.space-details-pane__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.space-details-pane__section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--hula-text-secondary);
}

.space-details-pane__link-btn {
  border: 0;
  background: transparent;
  color: var(--hula-color-primary-500);
  font-size: 12px;
  cursor: pointer;
  padding: 0;

  &:hover {
    text-decoration: underline;
  }
}

.space-details-pane__loading {
  display: flex;
  justify-content: center;
  padding: 16px;
}

.space-details-pane__hint {
  margin: 0;
  font-size: 12px;
  color: var(--hula-text-quaternary);
  padding: 8px 0;
}

/* 成员预览 */
.space-details-pane__members-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 12px;
}

.space-details-pane__member {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;

  &:hover .space-details-pane__member-name {
    color: var(--hula-color-primary-500);
  }
}

.space-details-pane__member-fallback {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--hula-surface-search);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--hula-text-secondary);
}

.space-details-pane__member-name {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  text-align: center;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.15s ease;
}

/* 子房间列表 */
.space-details-pane__rooms-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.space-details-pane__room {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.space-details-pane__room-fallback {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--hula-surface-search);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--hula-text-quaternary);
}

.space-details-pane__room-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.space-details-pane__room-arrow {
  color: var(--hula-text-quaternary);
  flex-shrink: 0;
}

.space-details-pane__room-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--hula-text-quaternary);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s ease;

  &:hover {
    background: var(--hula-color-danger-100, color-mix(in srgb, var(--hula-color-danger-500) 12%, transparent));
    color: var(--hula-color-danger-500);
  }
}

/* 危险操作区 */
.space-details-pane__danger-zone {
  padding: 16px;
  border: 1px solid var(--hula-color-danger-200, color-mix(in srgb, var(--hula-color-danger-500) 20%, transparent));
  border-radius: 10px;
  background: color-mix(in srgb, var(--hula-color-danger-500) 4%, transparent);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
