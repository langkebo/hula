<template>
  <div class="friends-settings">
    <div class="settings-section">
      <h3 class="section-title">好友请求</h3>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">允许接收好友请求</span>
          <span class="setting-desc">其他用户可以向你发送好友请求</span>
        </div>
        <n-switch v-model:value="allowFriendRequests" @update:value="handleToggle('allowFriendRequests')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">自动接受好友请求</span>
          <span class="setting-desc">收到好友请求时自动接受</span>
        </div>
        <n-switch v-model:value="autoAcceptFriends" @update:value="handleToggle('autoAcceptFriends')" />
      </div>
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">好友请求需要附言</span>
          <span class="setting-desc">发送好友请求时必须附带留言</span>
        </div>
        <n-switch v-model:value="friendRequestMessage" @update:value="handleToggle('friendRequestMessage')" />
      </div>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">好友分组</h3>
      <n-spin :show="loadingGroups">
        <div v-if="friendGroups.length === 0" class="empty-list">
          <span class="empty-text">暂无好友分组</span>
        </div>
        <div v-else class="group-list">
          <div v-for="group in friendGroups" :key="group.group_id" class="group-item">
            <div class="group-info">
              <span class="group-name">{{ group.name }}</span>
              <span class="group-count">{{ group.member_count }}人</span>
            </div>
            <div class="group-actions">
              <n-button size="small" quaternary @click="handleEditGroup(group)">编辑</n-button>
              <n-button size="small" type="error" quaternary @click="handleDeleteGroup(group)">删除</n-button>
            </div>
          </div>
        </div>
      </n-spin>
      <n-button size="small" style="margin-top: 8px" @click="showCreateGroup = true">+ 创建新分组</n-button>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">待处理请求</h3>
      <n-spin :show="loadingRequests">
        <div class="request-section">
          <h4 class="subsection-title">📥 收到的请求 ({{ incomingRequests.length }})</h4>
          <div v-if="incomingRequests.length === 0" class="empty-list">
            <span class="empty-text">暂无收到的好友请求</span>
          </div>
          <div v-for="req in incomingRequests" :key="req.user_id" class="request-item">
            <div class="request-info">
              <span class="request-user">{{ req.user_id }}</span>
              <span v-if="req.message" class="request-message">"{{ req.message }}"</span>
            </div>
            <div class="request-actions">
              <n-button size="small" type="primary" @click="handleAcceptRequest(req)">接受</n-button>
              <n-button size="small" @click="handleRejectRequest(req)">拒绝</n-button>
            </div>
          </div>
        </div>

        <div class="request-section" style="margin-top: 16px">
          <h4 class="subsection-title">📤 发出的请求 ({{ outgoingRequests.length }})</h4>
          <div v-if="outgoingRequests.length === 0" class="empty-list">
            <span class="empty-text">暂无发出的好友请求</span>
          </div>
          <div v-for="req in outgoingRequests" :key="req.user_id" class="request-item">
            <div class="request-info">
              <span class="request-user">{{ req.user_id }}</span>
              <span class="request-status">等待中</span>
            </div>
            <n-button size="small" @click="handleCancelRequest(req)">取消</n-button>
          </div>
        </div>
      </n-spin>
    </div>

    <n-modal
      v-model:show="showCreateGroup"
      preset="dialog"
      title="创建好友分组"
      positive-text="创建"
      negative-text="取消"
      @positive-click="handleCreateGroup">
      <n-form>
        <n-form-item label="分组名称">
          <n-input v-model:value="newGroupName" placeholder="输入分组名称" />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-modal
      v-model:show="showEditGroup"
      preset="dialog"
      title="编辑分组名称"
      positive-text="保存"
      negative-text="取消"
      @positive-click="handleSaveGroup">
      <n-form>
        <n-form-item label="分组名称">
          <n-input v-model:value="editGroupName" placeholder="输入新的分组名称" />
        </n-form-item>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NSwitch, NDivider, NButton, NSpin, NModal, NForm, NFormItem, NInput, useMessage, useDialog } from 'naive-ui'
import { matrixFriendService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('FriendsSettings')

defineOptions({
  name: 'FriendsSettings'
})

const message = useMessage()
const dialog = useDialog()

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
    logger.error('Failed to load friend groups')
  } finally {
    loadingGroups.value = false
  }
}

async function loadFriendRequests() {
  loadingRequests.value = true
  try {
    const [incoming, outgoing] = await Promise.all([
      matrixFriendService.getIncomingRequests(),
      matrixFriendService.getOutgoingRequests()
    ])
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
  message.success('设置已更新')
}

async function handleCreateGroup() {
  if (!newGroupName.value.trim()) {
    message.warning('请输入分组名称')
    return false
  }
  try {
    await matrixFriendService.createFriendGroup(newGroupName.value.trim())
    newGroupName.value = ''
    message.success('分组创建成功')
    await loadFriendGroups()
  } catch {
    message.error('创建分组失败')
  }
}

function handleEditGroup(group: FriendGroup) {
  editingGroupId.value = group.group_id
  editGroupName.value = group.name
  showEditGroup.value = true
}

async function handleSaveGroup() {
  if (!editGroupName.value.trim()) {
    message.warning('请输入分组名称')
    return false
  }
  try {
    await matrixFriendService.renameFriendGroup(editingGroupId.value, editGroupName.value.trim())
    message.success('分组名称已更新')
    showEditGroup.value = false
    await loadFriendGroups()
  } catch {
    message.error('更新分组名称失败')
  }
}

function handleDeleteGroup(group: FriendGroup) {
  dialog.warning({
    title: '删除分组',
    content: `确定要删除分组"${group.name}"吗？分组内的好友不会被删除。`,
    positiveText: '确定删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await matrixFriendService.deleteFriendGroup(group.group_id)
        message.success('分组已删除')
        await loadFriendGroups()
      } catch {
        message.error('删除分组失败')
      }
    }
  })
}

async function handleAcceptRequest(req: FriendRequest) {
  try {
    await matrixFriendService.acceptFriendRequest(req.user_id)
    message.success('已接受好友请求')
    await loadFriendRequests()
  } catch {
    message.error('接受好友请求失败')
  }
}

async function handleRejectRequest(req: FriendRequest) {
  try {
    await matrixFriendService.rejectFriendRequest(req.user_id)
    message.success('已拒绝好友请求')
    await loadFriendRequests()
  } catch {
    message.error('拒绝好友请求失败')
  }
}

async function handleCancelRequest(req: FriendRequest) {
  try {
    await matrixFriendService.cancelFriendRequest(req.user_id)
    message.success('已取消好友请求')
    await loadFriendRequests()
  } catch {
    message.error('取消好友请求失败')
  }
}
</script>

<style scoped>
.friends-settings {
  padding: 0 8px;
}

.settings-section {
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 12px;
}

.subsection-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0 0 8px 0;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

:deep(.dark) .setting-item {
  border-bottom-color: rgba(255, 255, 255, 0.05);
}

.setting-info {
  display: flex;
  flex-direction: column;
}

.setting-label {
  font-size: 14px;
}

.setting-desc {
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 4px;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
}

:deep(.dark) .group-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.group-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-name {
  font-size: 14px;
  font-weight: 500;
}

.group-count {
  font-size: 12px;
  color: var(--color-text-quaternary);
}

.group-actions {
  display: flex;
  gap: 4px;
}

.request-section {
  margin-bottom: 8px;
}

.request-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
  margin-bottom: 6px;
}

:deep(.dark) .request-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.request-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.request-user {
  font-size: 14px;
  word-break: break-all;
}

.request-message {
  font-size: 12px;
  color: var(--color-text-secondary);
  margin-top: 4px;
}

:deep(.dark) .request-message {
  color: #aaa;
}

.request-status {
  font-size: 12px;
  color: var(--color-warning);
  margin-top: 4px;
}

.request-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 12px;
}

.empty-list {
  padding: 16px;
  text-align: center;
}

.empty-text {
  font-size: 13px;
  color: var(--color-text-quaternary);
}
</style>
