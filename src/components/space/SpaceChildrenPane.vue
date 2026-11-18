<template>
  <div class="space-children-pane flex-1 min-h-0 flex flex-col">
    <!-- 空间横幅头部 -->
    <SpaceHeader
      v-if="activeSpaceItem"
      :space="activeSpaceItem"
      :can-manage="canManageSelectedSpace"
      @settings="handleSpaceSettings" />

    <!-- 变更已生效但子房间列表刷新失败：局部提示，不把整页判为失败 -->
    <div v-if="refreshError" class="px-12px pt-8px" data-test="space-children-refresh-error">
      <PartialStateBanner
        compact
        :message="t('space.rooms_refresh_failed')"
        :detail="refreshError"
        :retry-text="t('common.retry')"
        @retry="retryRooms" />
    </div>

    <!-- 子房间网格（快速概览） -->
    <section v-if="activeSpaceItem" class="space-children-pane__rooms" :aria-label="t('space.rooms')">
      <SpaceRoomGrid
        :rooms="spaceRooms"
        :loading="roomsLoading"
        :can-manage="canManageSelectedSpace"
        @enter-room="handleEnterRoom"
        @preview-room="handleEnterRoom"
        @toggle-suggested="handleToggleSuggested" />
    </section>

    <!-- 完整详情面板（保留既有全部能力） -->
    <SpaceDetailsPane
      class="flex-1 min-h-0"
      :active-space="activeSpaceItem"
      :members="spaceMembers"
      :rooms="spaceRooms"
      :members-loading="membersLoading"
      :rooms-loading="roomsLoading"
      :can-manage="canManageSelectedSpace"
      :is-member="isMember"
      :join-rule="selectedSpaceDetail?.joinRule"
      :sub-view="subView"
      :manage-mode="manageMode"
      :manage-submitting="manageSubmitting"
      :invite-user-id="inviteForm.userId"
      :add-room-id="addRoomForm.roomId"
      :add-room-suggested="addRoomForm.suggested"
      :saving-space-name="savingSpaceName"
      :saving-space-topic="savingSpaceTopic"
      :entering-chat="enteringChat"
      @enter-space="handleEnterChat"
      @enter-room="handleEnterRoom"
      @invite-member="openInviteSpaceMember"
      @add-room="openAddSpaceRoom"
      @join-space="handleJoinSpace"
      @save-space-name="handleSaveSpaceName"
      @save-space-topic="handleSaveSpaceTopic"
      @remove-room="handleRemoveSpaceRoom"
      @leave-space="handleLeaveSpace"
      @delete-space="handleDeleteSpace"
      @close-manage-pane="closeManagePane"
      @submit-manage-pane="submitManagePane"
      @select-space="handleSelectSpace"
      @member-click="handleMemberClick"
      @update:sub-view="subView = $event"
      @update:invite-user-id="inviteForm.userId = $event"
      @update:add-room-id="addRoomForm.roomId = $event"
      @update:add-room-suggested="addRoomForm.suggested = $event" />
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import SpaceHeader from '@/components/space/SpaceHeader.vue'
import SpaceRoomGrid from '@/components/space/SpaceRoomGrid.vue'
import SpaceDetailsPane from '@/components/workbench/SpaceDetailsPane.vue'
import { useSpaceChildrenActions } from '@/composables/space/useSpaceChildrenActions'
import { useSpaceChildrenState } from '@/composables/space/useSpaceChildrenState'

defineOptions({ name: 'SpaceChildrenPane' })

const { t } = useI18n()

// 视图模型（数据源 + 派生状态）与操作逻辑分层，组件只保留装配与模板渲染
const state = useSpaceChildrenState()
const {
  activeSpaceItem,
  spaceMembers,
  spaceRooms,
  membersLoading,
  roomsLoading,
  canManageSelectedSpace,
  isMember,
  selectedSpaceDetail,
  subView,
  manageMode,
  manageSubmitting,
  inviteForm,
  addRoomForm,
  savingSpaceName,
  savingSpaceTopic,
  enteringChat,
  refreshError,
  retryRooms,
  closeManagePane
} = state

const {
  handleEnterChat,
  handleEnterRoom,
  handleSelectSpace,
  handleMemberClick,
  handleToggleSuggested,
  handleSpaceSettings,
  handleLeaveSpace,
  handleDeleteSpace,
  openInviteSpaceMember,
  openAddSpaceRoom,
  handleSaveSpaceName,
  handleSaveSpaceTopic,
  handleRemoveSpaceRoom,
  submitManagePane,
  handleJoinSpace
} = useSpaceChildrenActions(state)
</script>

<style scoped lang="scss">
.space-children-pane__rooms {
  flex-shrink: 0;
  padding: var(--tjg-space-3) var(--tjg-space-4);
  border-bottom: 1px solid var(--tjg-border-default);
  background: var(--tjg-surface-panel);
  max-height: 280px;
  overflow: auto;
}
</style>
