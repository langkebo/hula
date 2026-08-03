<template>
  <div class="friends-settings">
    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.friends.requests.title') }}</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.friends.requests.allow_label') }}</span>
          <span class="setting-desc">{{ t('setting.friends.requests.allow_desc') }}</span>
        </div>
        <n-switch v-model:value="allowFriendRequests" @update:value="handleToggle('allowFriendRequests')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.friends.requests.auto_accept_label') }}</span>
          <span class="setting-desc">{{ t('setting.friends.requests.auto_accept_desc') }}</span>
        </div>
        <n-switch v-model:value="autoAcceptFriends" @update:value="handleToggle('autoAcceptFriends')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">{{ t('setting.friends.requests.message_required_label') }}</span>
          <span class="setting-desc">{{ t('setting.friends.requests.message_required_desc') }}</span>
        </div>
        <n-switch v-model:value="friendRequestMessage" @update:value="handleToggle('friendRequestMessage')" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.friends.groups.title') }}</h3>
      <n-spin :show="loadingGroups">
        <div v-if="friendGroups.length === 0" class="empty-list">
          <span class="empty-text">{{ t('setting.friends.groups.empty') }}</span>
        </div>
        <div v-else class="group-list">
          <div v-for="group in friendGroups" :key="group.group_id" class="group-item">
            <div class="group-info">
              <span class="group-name">{{ group.name }}</span>
              <span class="group-count">
                {{ t('setting.friends.groups.member_count', { count: String(group.member_count) }) }}
              </span>
            </div>
            <div class="group-actions">
              <n-button size="small" quaternary @click="handleEditGroup(group)">
                {{ t('setting.friends.common.edit') }}
              </n-button>
              <n-button size="small" type="error" quaternary @click="handleDeleteGroup(group)">
                {{ t('setting.friends.common.delete') }}
              </n-button>
            </div>
          </div>
        </div>
      </n-spin>
      <n-button size="small" style="margin-top: 8px" @click="showCreateGroup = true">
        {{ t('setting.friends.groups.create_action') }}
      </n-button>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">{{ t('setting.friends.pending.title') }}</h3>
      <n-spin :show="loadingRequests">
        <div class="request-section">
          <h4 class="subsection-title">
            {{ t('setting.friends.pending.incoming_title', { count: String(incomingRequests.length) }) }}
          </h4>
          <div v-if="incomingRequests.length === 0" class="empty-list">
            <span class="empty-text">{{ t('setting.friends.pending.incoming_empty') }}</span>
          </div>
          <div v-for="req in incomingRequests" :key="req.user_id" class="request-item">
            <div class="request-info">
              <span class="request-user">{{ req.user_id }}</span>
              <span v-if="req.message" class="request-message">"{{ req.message }}"</span>
            </div>
            <div class="request-actions">
              <n-button size="small" type="primary" @click="handleAcceptRequest(req)">
                {{ t('setting.friends.pending.accept') }}
              </n-button>
              <n-button size="small" @click="handleRejectRequest(req)">
                {{ t('setting.friends.pending.reject') }}
              </n-button>
            </div>
          </div>
        </div>

        <div class="request-section" style="margin-top: 16px">
          <h4 class="subsection-title">
            {{ t('setting.friends.pending.outgoing_title', { count: String(outgoingRequests.length) }) }}
          </h4>
          <div v-if="outgoingRequests.length === 0" class="empty-list">
            <span class="empty-text">{{ t('setting.friends.pending.outgoing_empty') }}</span>
          </div>
          <div v-for="req in outgoingRequests" :key="req.user_id" class="request-item">
            <div class="request-info">
              <span class="request-user">{{ req.user_id }}</span>
              <span class="request-status">{{ t('setting.friends.pending.waiting') }}</span>
            </div>
            <n-button size="small" @click="handleCancelRequest(req)">{{ t('setting.common.cancel') }}</n-button>
          </div>
        </div>
      </n-spin>
    </div>

    <n-modal
      v-model:show="showCreateGroup"
      preset="dialog"
      :title="t('setting.friends.groups.create_title')"
      :positive-text="t('setting.friends.groups.create_confirm')"
      :negative-text="t('setting.common.cancel')"
      @positive-click="handleCreateGroup">
      <n-form>
        <n-form-item :label="t('setting.friends.groups.name_label')">
          <n-input v-model:value="newGroupName" :placeholder="t('setting.friends.groups.name_placeholder')" />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-modal
      v-model:show="showEditGroup"
      preset="dialog"
      :title="t('setting.friends.groups.edit_title')"
      :positive-text="t('setting.common.save')"
      :negative-text="t('setting.common.cancel')"
      @positive-click="handleSaveGroup">
      <n-form>
        <n-form-item :label="t('setting.friends.groups.name_label')">
          <n-input v-model:value="editGroupName" :placeholder="t('setting.friends.groups.edit_placeholder')" />
        </n-form-item>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { NButton, NDivider, NForm, NFormItem, NInput, NModal, NSpin, NSwitch, useDialog } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixFriendService } from '@/services/matrix/friends/MatrixFriendService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('FriendsSettings')

defineOptions({
  name: 'FriendsSettings'
})

const { showFeedback } = useActionFeedback()
const dialog = useDialog()
const { t } = useI18n()

interface FriendGroup {
  group_id: string
  name: string
  member_count: number
}

interface FriendRequest {
  user_id: string
  message?: string
}

const allowFriendRequests = ref(true)
const autoAcceptFriends = ref(false)
const friendRequestMessage = ref(true)

const loadingGroups = ref(false)
const loadingRequests = ref(false)
const friendGroups = ref<FriendGroup[]>([])
const incomingRequests = ref<FriendRequest[]>([])
const outgoingRequests = ref<FriendRequest[]>([])

const showCreateGroup = ref(false)
const showEditGroup = ref(false)
const newGroupName = ref('')
const editGroupName = ref('')
const editingGroupId = ref('')

const STORAGE_KEY = 'hula-friend-settings'

onMounted(() => {
  loadSettings()
  loadFriendGroups()
  loadFriendRequests()
})

function loadSettings() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const data = JSON.parse(saved)
      if (data.allowFriendRequests !== undefined) allowFriendRequests.value = data.allowFriendRequests
      if (data.autoAcceptFriends !== undefined) autoAcceptFriends.value = data.autoAcceptFriends
      if (data.friendRequestMessage !== undefined) friendRequestMessage.value = data.friendRequestMessage
    } catch {
      // ignore
    }
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      allowFriendRequests: allowFriendRequests.value,
      autoAcceptFriends: autoAcceptFriends.value,
      friendRequestMessage: friendRequestMessage.value
    })
  )
}

async function loadFriendGroups() {
  loadingGroups.value = true
  try {
    const groups = await matrixFriendService.getFriendGroups()
    friendGroups.value = (groups || []).map((g) => ({
      group_id: g.group_id,
      name: g.name,
      member_count: g.member_count || 0
    }))
  } catch {
    logger.warn('Failed to load friend groups')
  } finally {
    loadingGroups.value = false
  }
}

async function loadFriendRequests() {
  loadingRequests.value = true
  try {
    const [incomingResult, outgoingResult] = await Promise.allSettled([
      matrixFriendService.getIncomingRequests(),
      matrixFriendService.getOutgoingRequests()
    ])

    const incoming = incomingResult.status === 'fulfilled' ? incomingResult.value : []
    const outgoing = outgoingResult.status === 'fulfilled' ? outgoingResult.value : []
    incomingRequests.value = (incoming || []).map((r) => ({
      user_id: r.user_id,
      message: r.message
    }))
    outgoingRequests.value = (outgoing || []).map((r) => ({
      user_id: r.user_id
    }))
  } catch {
    logger.error('Failed to load friend requests')
  } finally {
    loadingRequests.value = false
  }
}

function handleToggle(_key: string) {
  saveSettings()
  showFeedback(t('setting.friends.feedback.settings_updated'), 'success')
}

async function handleCreateGroup() {
  if (!newGroupName.value.trim()) {
    showFeedback(t('setting.friends.groups.name_required'), 'warning')
    return false
  }
  try {
    await matrixFriendService.createFriendGroup(newGroupName.value.trim())
    newGroupName.value = ''
    showFeedback(t('setting.friends.groups.create_success'), 'success')
    await loadFriendGroups()
  } catch {
    showFeedback(t('setting.friends.groups.create_failed'), 'error')
  }
}

function handleEditGroup(group: FriendGroup) {
  editingGroupId.value = group.group_id
  editGroupName.value = group.name
  showEditGroup.value = true
}

async function handleSaveGroup() {
  if (!editGroupName.value.trim()) {
    showFeedback(t('setting.friends.groups.name_required'), 'warning')
    return false
  }
  try {
    await matrixFriendService.renameFriendGroup(editingGroupId.value, editGroupName.value.trim())
    showFeedback(t('setting.friends.groups.rename_success'), 'success')
    showEditGroup.value = false
    await loadFriendGroups()
  } catch {
    showFeedback(t('setting.friends.groups.rename_failed'), 'error')
  }
}

function handleDeleteGroup(group: FriendGroup) {
  dialog.warning({
    title: t('setting.friends.groups.delete_title'),
    content: t('setting.friends.groups.delete_confirm', { name: group.name }),
    positiveText: t('setting.friends.groups.delete_confirm_action'),
    negativeText: t('setting.common.cancel'),
    onPositiveClick: async () => {
      try {
        await matrixFriendService.deleteFriendGroup(group.group_id)
        showFeedback(t('setting.friends.groups.delete_success'), 'success')
        await loadFriendGroups()
      } catch {
        showFeedback(t('setting.friends.groups.delete_failed'), 'error')
      }
    }
  })
}

async function handleAcceptRequest(req: FriendRequest) {
  try {
    await matrixFriendService.acceptFriendRequest(req.user_id)
    showFeedback(t('setting.friends.pending.accept_success'), 'success')
    await loadFriendRequests()
  } catch {
    showFeedback(t('setting.friends.pending.accept_failed'), 'error')
  }
}

async function handleRejectRequest(req: FriendRequest) {
  try {
    await matrixFriendService.rejectFriendRequest(req.user_id)
    showFeedback(t('setting.friends.pending.reject_success'), 'success')
    await loadFriendRequests()
  } catch {
    showFeedback(t('setting.friends.pending.reject_failed'), 'error')
  }
}

async function handleCancelRequest(req: FriendRequest) {
  try {
    await matrixFriendService.cancelFriendRequest(req.user_id)
    showFeedback(t('setting.friends.pending.cancel_success'), 'success')
    await loadFriendRequests()
  } catch {
    showFeedback(t('setting.friends.pending.cancel_failed'), 'error')
  }
}
</script>

<style scoped>
.friends-settings {
  padding: 0 var(--hula-space-2);
}

.settings-section {
  margin-bottom: var(--hula-space-6);
}

.section-title {
  font-size: var(--hula-font-size-lg);
  font-weight: var(--hula-font-weight-semibold);
  margin-bottom: var(--hula-space-3);
  color: var(--hula-text-primary);
}

.subsection-title {
  font-size: var(--hula-font-size-base);
  font-weight: var(--hula-font-weight-semibold);
  margin: 0 0 var(--hula-space-2) 0;
  color: var(--hula-text-primary);
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--hula-space-3) 0;
  border-bottom: 1px solid var(--hula-settings-divider);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
}

.setting-desc {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
  margin-top: var(--hula-space-1);
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: var(--hula-space-2);
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--hula-space-3);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
}

.group-info {
  display: flex;
  align-items: center;
  gap: var(--hula-space-2);
}

.group-name {
  font-size: var(--hula-font-size-base);
  font-weight: var(--hula-font-weight-medium);
  color: var(--hula-text-primary);
}

.group-count {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
}

.group-actions {
  display: flex;
  gap: var(--hula-space-1);
}

.request-section {
  margin-bottom: var(--hula-space-2);
}

.request-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--hula-space-3);
  background-color: var(--hula-settings-card-bg);
  border-radius: var(--hula-radius-sm);
  margin-bottom: 6px;
}

.request-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.request-user {
  font-size: var(--hula-font-size-base);
  color: var(--hula-text-primary);
  word-break: break-all;
}

.request-message {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-secondary);
  margin-top: var(--hula-space-1);
}

.request-status {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-color-warning-500);
  margin-top: var(--hula-space-1);
}

.request-actions {
  display: flex;
  gap: var(--hula-space-1);
  flex-shrink: 0;
  margin-left: var(--hula-space-3);
}

.empty-list {
  padding: var(--hula-space-4);
  text-align: center;
}

.empty-text {
  font-size: var(--hula-font-size-sm);
  color: var(--hula-text-quaternary);
}
</style>
