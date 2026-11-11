<template>
  <aside class="space-details-pane" :class="{ 'space-details-pane--compact': compact }">
    <div class="space-details-pane__body">
      <!-- 空状态 -->
      <div v-if="!activeSpace" class="space-details-pane__empty">
        <n-empty :description="t('space.details_empty_description')" size="large">
          <template #icon>
            <svg class="size-56px opacity-40 color-[--tjg-text-quaternary]">
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
        <SpaceOverviewHeader
          :space="activeSpace"
          :can-manage="canManage"
          :saving-space-name="savingSpaceName"
          :saving-space-topic="savingSpaceTopic"
          @save-space-name="emit('saveSpaceName', $event)"
          @save-space-topic="emit('saveSpaceTopic', $event)" />

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
                v-bind="inviteUserId !== undefined ? { value: inviteUserId } : {}"
                :placeholder="t('space.invite_user_placeholder')"
                @update:value="emit('update:inviteUserId', $event)" />
            </n-form-item>

            <template v-else-if="manageMode === 'add-room'">
              <n-form-item :label="t('space.add_room')">
                <n-input
                  v-bind="addRoomId !== undefined ? { value: addRoomId } : {}"
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

        <!-- 成员 / 子房间预览 + 层级树入口 -->
        <SpacePreviewSections
          :members="members"
          :rooms="rooms"
          :members-loading="membersLoading"
          :rooms-loading="roomsLoading"
          :can-manage="canManage"
          @update:sub-view="emit('update:subView', $event)"
          @enter-room="emit('enterRoom', $event)"
          @remove-room="emit('removeRoom', $event)" />

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
import type { SpaceChildRoom } from '@/composables/space/useSpaceRooms'
import type { SpaceInfo, SpaceMember } from '@/services/matrix/room/MatrixSpaceService'
import SpaceHierarchyTree from './SpaceHierarchyTree.vue'
import type { SpaceListItem } from './SpaceListPane.vue'
import SpaceMembersPane from './SpaceMembersPane.vue'
import SpaceOverviewHeader from './SpaceOverviewHeader.vue'
import SpacePreviewSections from './SpacePreviewSections.vue'
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
</script>

<style scoped lang="scss">
.space-details-pane {
  flex: 1;
  min-width: 0;
  height: 100%;
  background: var(--tjg-surface-panel);
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
  border: 1px solid var(--tjg-border-default);
  border-radius: 10px;
  background: var(--tjg-surface-panel);
  color: var(--tjg-text-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color var(--tjg-motion-duration-normal) ease,
    background-color var(--tjg-motion-duration-normal) ease,
    border-color var(--tjg-motion-duration-normal) ease,
    box-shadow var(--tjg-motion-duration-normal) ease,
    opacity var(--tjg-motion-duration-normal) ease,
    transform var(--tjg-motion-duration-normal) ease;

  &:hover {
    border-color: var(--tjg-color-primary-300);
    background: var(--tjg-color-primary-50, color-mix(in srgb, var(--tjg-color-primary-500) 6%, transparent));
    color: var(--tjg-color-primary-500);
  }

  &:active {
    transform: scale(0.98);
  }

  &--primary {
    background: var(--tjg-color-primary-500);
    border-color: var(--tjg-color-primary-500);
    color: var(--tjg-text-inverse);

    &:hover {
      background: var(--tjg-color-primary-600);
      border-color: var(--tjg-color-primary-600);
      color: var(--tjg-text-inverse);
    }
  }
}

/* 管理表单 */
.space-details-pane__manage {
  padding: 16px;
  border: 1px solid var(--tjg-border-default);
  border-radius: 10px;
  background: var(--tjg-surface-search);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.space-details-pane__manage-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--tjg-text-primary);
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

/* 通用 section 标题（危险操作区复用） */
.space-details-pane__section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--tjg-text-secondary);
}

/* 危险操作区 */
.space-details-pane__danger-zone {
  padding: 16px;
  border: 1px solid var(--tjg-color-danger-200, color-mix(in srgb, var(--tjg-color-danger-500) 20%, transparent));
  border-radius: 10px;
  background: color-mix(in srgb, var(--tjg-color-danger-500) 4%, transparent);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
