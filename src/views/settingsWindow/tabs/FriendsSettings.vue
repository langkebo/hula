<template>
  <div class="friends-settings">
    <PartialStateBanner
      v-if="partialFailures > 0"
      class="mb-12px"
      :message="t('common.partial_load_failed', { count: partialFailures })"
      :retry-text="t('common.retry')"
      @retry="retryPartialLoads" />

    <FriendsRequestPolicySection
      :load-failed="settingsLoadFailed"
      :allow-friend-requests="allowFriendRequests"
      :auto-accept-friends="autoAcceptFriends"
      :require-friend-request-message="requireFriendRequestMessage"
      @update:allow-friend-requests="allowFriendRequests = $event"
      @update:auto-accept-friends="autoAcceptFriends = $event"
      @update:require-friend-request-message="requireFriendRequestMessage = $event"
      @toggle="handleToggle"
      @retry="loadSettings" />

    <n-divider />

    <FriendsGroupsSection
      :loading="loadingGroups"
      :groups="friendGroups"
      @create="showCreateGroup = true"
      @edit="handleEditGroup"
      @delete="handleDeleteGroup" />

    <n-divider />

    <FriendsPendingSection
      :loading="loadingRequests"
      :incoming="incomingRequests"
      :outgoing="outgoingRequests"
      @accept="handleAcceptRequest"
      @reject="handleRejectRequest"
      @cancel="handleCancelRequest" />

    <FriendsGroupDrawers
      :show-create="showCreateGroup"
      :show-edit="showEditGroup"
      :new-group-name="newGroupName"
      :edit-group-name="editGroupName"
      @update:show-create="showCreateGroup = $event"
      @update:show-edit="showEditGroup = $event"
      @update:new-group-name="newGroupName = $event"
      @update:edit-group-name="editGroupName = $event"
      @create="handleCreateGroup"
      @save="handleSaveGroup" />
  </div>
</template>

<script setup lang="ts">
import { NDivider } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import PartialStateBanner from '@/components/common/PartialStateBanner.vue'
import { useFriendsSettings } from '@/composables/settings/useFriendsSettings'
import FriendsGroupDrawers from './components/FriendsGroupDrawers.vue'
import FriendsGroupsSection from './components/FriendsGroupsSection.vue'
import FriendsPendingSection from './components/FriendsPendingSection.vue'
import FriendsRequestPolicySection from './components/FriendsRequestPolicySection.vue'

defineOptions({
  name: 'FriendsSettings'
})

const { t } = useI18n()
const {
  allowFriendRequests,
  autoAcceptFriends,
  requireFriendRequestMessage,
  settingsLoadFailed,
  loadingGroups,
  loadingRequests,
  friendGroups,
  incomingRequests,
  outgoingRequests,
  partialFailures,
  showCreateGroup,
  showEditGroup,
  newGroupName,
  editGroupName,
  loadSettings,
  retryPartialLoads,
  handleToggle,
  handleCreateGroup,
  handleEditGroup,
  handleSaveGroup,
  handleDeleteGroup,
  handleAcceptRequest,
  handleRejectRequest,
  handleCancelRequest
} = useFriendsSettings()
</script>

<style scoped>
.friends-settings {
  padding: 0 var(--tjg-space-2);
}
</style>
