<template>
  <div class="mjolnir-settings">
    <div class="settings-section">
      <n-alert type="info" :show-icon="true" style="margin-bottom: 16px">
        Mjolnir 是一个管理屏蔽列表的工具，支持房间、用户和服务器的屏蔽管理。
      </n-alert>
    </div>

    <div class="settings-section">
      <h3 class="section-title">房间屏蔽列表</h3>
      <n-spin :show="loadingRooms">
        <div v-if="roomBanList.length === 0" class="empty-list">
          <span class="empty-text">暂无房间屏蔽规则</span>
        </div>
        <div v-else class="ban-list">
          <div v-for="item in roomBanList" :key="item.entity" class="ban-item">
            <div class="ban-info">
              <span class="ban-entity">{{ item.entity }}</span>
              <span v-if="item.reason" class="ban-reason">原因: {{ item.reason }}</span>
            </div>
            <n-button size="small" type="error" quaternary @click="handleRemoveRoomBan(item)">移除</n-button>
          </div>
        </div>
      </n-spin>
      <n-button size="small" style="margin-top: 8px" @click="showAddRoomBan = true">+ 添加房间</n-button>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">用户屏蔽列表</h3>
      <n-spin :show="loadingUsers">
        <div v-if="userBanList.length === 0" class="empty-list">
          <span class="empty-text">暂无用户屏蔽规则</span>
        </div>
        <div v-else class="ban-list">
          <div v-for="item in userBanList" :key="item.entity" class="ban-item">
            <div class="ban-info">
              <span class="ban-entity">{{ item.entity }}</span>
              <span v-if="item.reason" class="ban-reason">原因: {{ item.reason }}</span>
            </div>
            <n-button size="small" type="error" quaternary @click="handleRemoveUserBan(item)">移除</n-button>
          </div>
        </div>
      </n-spin>
      <n-button size="small" style="margin-top: 8px" @click="showAddUserBan = true">+ 添加用户</n-button>
    </div>

    <n-divider />

    <div class="settings-section">
      <h3 class="section-title">服务器屏蔽列表</h3>
      <n-spin :show="loadingServers">
        <div v-if="serverBanList.length === 0" class="empty-list">
          <span class="empty-text">暂无服务器屏蔽规则</span>
        </div>
        <div v-else class="ban-list">
          <div v-for="item in serverBanList" :key="item.entity" class="ban-item">
            <div class="ban-info">
              <span class="ban-entity">{{ item.entity }}</span>
              <span v-if="item.reason" class="ban-reason">原因: {{ item.reason }}</span>
            </div>
            <n-button size="small" type="error" quaternary @click="handleRemoveServerBan(item)">移除</n-button>
          </div>
        </div>
      </n-spin>
      <n-button size="small" style="margin-top: 8px" @click="showAddServerBan = true">+ 添加服务器</n-button>
    </div>

    <n-modal v-model:show="showAddRoomBan" preset="dialog" title="添加房间屏蔽规则" positive-text="添加" negative-text="取消" @positive-click="handleAddRoomBan">
      <n-form ref="roomBanFormRef">
        <n-form-item label="房间 ID">
          <n-input v-model:value="newRoomBan.entity" placeholder="#room:example.com" />
        </n-form-item>
        <n-form-item label="原因">
          <n-input v-model:value="newRoomBan.reason" placeholder="屏蔽原因（可选）" />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-modal v-model:show="showAddUserBan" preset="dialog" title="添加用户屏蔽规则" positive-text="添加" negative-text="取消" @positive-click="handleAddUserBan">
      <n-form ref="userBanFormRef">
        <n-form-item label="用户 ID">
          <n-input v-model:value="newUserBan.entity" placeholder="@user:example.com" />
        </n-form-item>
        <n-form-item label="原因">
          <n-input v-model:value="newUserBan.reason" placeholder="屏蔽原因（可选）" />
        </n-form-item>
      </n-form>
    </n-modal>

    <n-modal v-model:show="showAddServerBan" preset="dialog" title="添加服务器屏蔽规则" positive-text="添加" negative-text="取消" @positive-click="handleAddServerBan">
      <n-form ref="serverBanFormRef">
        <n-form-item label="服务器名称">
          <n-input v-model:value="newServerBan.entity" placeholder="example.com" />
        </n-form-item>
        <n-form-item label="原因">
          <n-input v-model:value="newServerBan.reason" placeholder="屏蔽原因（可选）" />
        </n-form-item>
      </n-form>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { NButton, NDivider, NSpin, NModal, NForm, NFormItem, NInput, NAlert, useMessage, useDialog } from 'naive-ui'
import { matrixAccountService } from '@/services/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MjolnirSettings')

defineOptions({
  name: 'MjolnirSettings'
})

const message = useMessage()
const dialog = useDialog()

interface BanItem {
  entity: string
  reason: string
  type: 'room_id' | 'user_id' | 'server_name'
}

const loadingRooms = ref(false)
const loadingUsers = ref(false)
const loadingServers = ref(false)

const roomBanList = ref<BanItem[]>([])
const userBanList = ref<BanItem[]>([])
const serverBanList = ref<BanItem[]>([])

const showAddRoomBan = ref(false)
const showAddUserBan = ref(false)
const showAddServerBan = ref(false)

const newRoomBan = reactive({ entity: '', reason: '' })
const newUserBan = reactive({ entity: '', reason: '' })
const newServerBan = reactive({ entity: '', reason: '' })

const STORAGE_KEY = 'hula-mjolnir-ban-lists'

onMounted(() => {
  loadBanLists()
})

function loadBanLists() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const data = JSON.parse(saved)
      roomBanList.value = data.rooms || []
      userBanList.value = data.users || []
      serverBanList.value = data.servers || []
    } catch {
      // ignore
    }
  }
}

function saveBanLists() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      rooms: roomBanList.value,
      users: userBanList.value,
      servers: serverBanList.value
    })
  )
}

function handleAddRoomBan() {
  if (!newRoomBan.entity.trim()) {
    message.warning('请输入房间 ID')
    return false
  }
  roomBanList.value.push({ entity: newRoomBan.entity.trim(), reason: newRoomBan.reason.trim(), type: 'room_id' })
  newRoomBan.entity = ''
  newRoomBan.reason = ''
  saveBanLists()
  message.success('已添加房间屏蔽规则')
}

function handleAddUserBan() {
  if (!newUserBan.entity.trim()) {
    message.warning('请输入用户 ID')
    return false
  }
  userBanList.value.push({ entity: newUserBan.entity.trim(), reason: newUserBan.reason.trim(), type: 'user_id' })
  newUserBan.entity = ''
  newUserBan.reason = ''
  saveBanLists()
  message.success('已添加用户屏蔽规则')
}

function handleAddServerBan() {
  if (!newServerBan.entity.trim()) {
    message.warning('请输入服务器名称')
    return false
  }
  serverBanList.value.push({
    entity: newServerBan.entity.trim(),
    reason: newServerBan.reason.trim(),
    type: 'server_name'
  })
  newServerBan.entity = ''
  newServerBan.reason = ''
  saveBanLists()
  message.success('已添加服务器屏蔽规则')
}

function handleRemoveRoomBan(item: BanItem) {
  dialog.warning({
    title: '移除屏蔽规则',
    content: `确定要移除对 ${item.entity} 的屏蔽吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      roomBanList.value = roomBanList.value.filter((b) => b.entity !== item.entity)
      saveBanLists()
      message.success('已移除房间屏蔽规则')
    }
  })
}

function handleRemoveUserBan(item: BanItem) {
  dialog.warning({
    title: '移除屏蔽规则',
    content: `确定要移除对 ${item.entity} 的屏蔽吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      userBanList.value = userBanList.value.filter((b) => b.entity !== item.entity)
      saveBanLists()
      message.success('已移除用户屏蔽规则')
    }
  })
}

function handleRemoveServerBan(item: BanItem) {
  dialog.warning({
    title: '移除屏蔽规则',
    content: `确定要移除对 ${item.entity} 的屏蔽吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: () => {
      serverBanList.value = serverBanList.value.filter((b) => b.entity !== item.entity)
      saveBanLists()
      message.success('已移除服务器屏蔽规则')
    }
  })
}
</script>

<style scoped>
.mjolnir-settings {
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

.ban-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ban-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
}

:deep(.dark) .ban-item {
  background-color: rgba(255, 255, 255, 0.05);
}

.ban-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.ban-entity {
  font-size: 14px;
  word-break: break-all;
}

.ban-reason {
  font-size: 12px;
  color: var(--color-text-quaternary);
  margin-top: 4px;
}

.empty-list {
  padding: 20px;
  text-align: center;
}

.empty-text {
  font-size: 13px;
  color: var(--color-text-quaternary);
}
</style>
