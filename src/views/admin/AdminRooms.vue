<template>
  <div class="admin-rooms">
    <div class="admin-rooms-header">
      <n-input v-model:value="searchQuery" :placeholder="t('admin.rooms.search')" clearable style="width: 300px">
        <template #prefix>
          <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </template>
      </n-input>
    </div>

    <n-spin :show="loading">
      <n-data-table
        :columns="columns"
        :data="filteredRooms"
        :pagination="{ pageSize: 20 }"
        :bordered="false"
        striped
        :row-key="(row: RoomInfo) => row.roomId" />
    </n-spin>

    <n-modal v-model:show="showRoomDetail" :title="t('admin.rooms.roomDetail')" preset="dialog" style="width: 700px">
      <template v-if="selectedRoom">
        <n-descriptions bordered :column="2" label-placement="left" style="margin-bottom: 16px">
          <n-descriptions-item :label="t('admin.rooms.roomId')" :span="2">
            {{ selectedRoom.roomId }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.rooms.name')">{{ selectedRoom.name || '-' }}</n-descriptions-item>
          <n-descriptions-item :label="t('admin.rooms.creator')">{{ selectedRoom.creator || '-' }}</n-descriptions-item>
          <n-descriptions-item :label="t('admin.rooms.members')">{{ selectedRoom.joinedMembers }}</n-descriptions-item>
          <n-descriptions-item :label="t('admin.rooms.localMembers')">
            {{ selectedRoom.joinedLocalMembers }}
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.rooms.visibility')">
            <n-tag :type="selectedRoom.public ? 'info' : 'default'" size="small">
              {{ selectedRoom.public ? t('admin.rooms.public') : t('admin.rooms.private') }}
            </n-tag>
          </n-descriptions-item>
          <n-descriptions-item :label="t('admin.rooms.createdAt')">
            {{ selectedRoom.createTime ? new Date(selectedRoom.createTime).toLocaleString() : '-' }}
          </n-descriptions-item>
        </n-descriptions>

        <n-tabs type="line" animated>
          <n-tab-pane name="members" :tab="t('admin.rooms.members')">
            <n-spin :show="membersLoading">
              <n-data-table
                v-if="roomMembers.length > 0"
                :columns="memberColumns"
                :data="roomMembers"
                :bordered="false"
                size="small"
                :pagination="{ pageSize: 10 }" />
              <n-empty v-else :description="t('admin.rooms.noMembers')" style="padding: 24px 0" />
            </n-spin>
          </n-tab-pane>

          <n-tab-pane name="state" :tab="t('admin.rooms.state')">
            <n-spin :show="stateLoading">
              <n-data-table
                v-if="roomState.length > 0"
                :columns="stateColumns"
                :data="roomState"
                :bordered="false"
                size="small"
                :pagination="{ pageSize: 10 }" />
              <n-empty v-else :description="t('admin.rooms.noState')" style="padding: 24px 0" />
            </n-spin>
          </n-tab-pane>

          <n-tab-pane name="actions" :tab="t('admin.rooms.actions')">
            <n-space vertical>
              <n-button size="small" type="primary" @click="showForceJoinDialog = true">
                {{ t('admin.rooms.forceJoin') }}
              </n-button>
              <n-button size="small" type="warning" @click="showForceLeaveDialog = true">
                {{ t('admin.rooms.forceLeave') }}
              </n-button>
              <n-button size="small" :type="roomBlocked ? 'success' : 'error'" @click="handleToggleBlock">
                {{ roomBlocked ? t('admin.rooms.unblock') : t('admin.rooms.block') }}
              </n-button>
              <n-button size="small" type="error" @click="handleShutdownRoom">
                {{ t('admin.rooms.shutdown') }}
              </n-button>
              <n-button size="small" type="error" ghost @click="handleDeleteRoom">
                {{ t('admin.rooms.delete') }}
              </n-button>
            </n-space>
          </n-tab-pane>
        </n-tabs>
      </template>
      <template #action>
        <n-button @click="showRoomDetail = false">{{ t('admin.common.close') }}</n-button>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showForceJoinDialog"
      :title="t('admin.rooms.forceJoin')"
      preset="dialog"
      style="width: 400px">
      <n-form :model="forceJoinForm">
        <n-form-item :label="t('admin.rooms.targetUserId')">
          <n-input v-model:value="forceJoinForm.userId" placeholder="@user:example.com" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showForceJoinDialog = false">{{ t('admin.common.cancel') }}</n-button>
        <n-button type="primary" :loading="forceJoinLoading" @click="handleForceJoin">
          {{ t('admin.common.confirm') }}
        </n-button>
      </template>
    </n-modal>

    <n-modal
      v-model:show="showForceLeaveDialog"
      :title="t('admin.rooms.forceLeave')"
      preset="dialog"
      style="width: 400px">
      <n-form :model="forceLeaveForm">
        <n-form-item :label="t('admin.rooms.targetUserId')">
          <n-input v-model:value="forceLeaveForm.userId" placeholder="@user:example.com" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showForceLeaveDialog = false">{{ t('admin.common.cancel') }}</n-button>
        <n-button type="primary" :loading="forceLeaveLoading" @click="handleForceLeave">
          {{ t('admin.common.confirm') }}
        </n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import { adminService, type RoomInfo } from '@/services/matrix/MatrixAdminService'
import { useAdminRooms } from '@/composables/admin'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()
const adminStore = useAdminStore()
const { handleAdminError } = useAdminErrorHandler()

const admin = useAdminRooms()

// Alias composable refs so the template bindings keep working
const rooms = admin.rooms
const loading = admin.loading
const searchQuery = admin.searchQuery
const filteredRooms = admin.filteredRooms
const selectedRoom = admin.selectedRoom
const membersLoading = admin.membersLoading
const stateLoading = admin.stateLoading

// View-only local state
const showRoomDetail = ref(false)
const roomBlocked = ref(false)
const showForceJoinDialog = ref(false)
const forceJoinLoading = ref(false)
const forceJoinForm = ref({ userId: '' })
const showForceLeaveDialog = ref(false)
const forceLeaveLoading = ref(false)
const forceLeaveForm = ref({ userId: '' })

// Derive table-friendly members / state from composable source of truth
const roomMembers = computed(() => admin.roomMembers.value.map((memberId) => ({ memberId })))
const roomState = computed(() =>
  (admin.roomState.value?.state ?? []).map((s) => ({
    type: s.type,
    stateKey: s.stateKey,
    content: JSON.stringify(s.content)
  }))
)

const columns = computed(() => [
  {
    title: t('admin.rooms.roomId'),
    key: 'roomId',
    ellipsis: { tooltip: true },
    width: 280
  },
  {
    title: t('admin.rooms.name'),
    key: 'name',
    ellipsis: { tooltip: true },
    width: 150
  },
  {
    title: t('admin.rooms.members'),
    key: 'joinedMembers',
    width: 100
  },
  {
    title: t('admin.rooms.creator'),
    key: 'creator',
    ellipsis: { tooltip: true },
    width: 200
  },
  {
    title: t('admin.rooms.visibility'),
    key: 'public',
    width: 80,
    render(row: RoomInfo) {
      return h(NTag, { type: row.public ? 'info' : 'default', size: 'small' }, () =>
        row.public ? t('admin.rooms.public') : t('admin.rooms.private')
      )
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 120,
    render(row: RoomInfo) {
      return h(NButton, { size: 'small', type: 'primary', onClick: () => openRoomDetail(row) }, () =>
        t('admin.rooms.detail')
      )
    }
  }
])

const memberColumns = computed(() => [
  {
    title: t('admin.rooms.memberId'),
    key: 'member',
    ellipsis: { tooltip: true }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 200,
    render(memberId: string) {
      return h(NSpace, { size: 'small' }, () => [
        h(NButton, { size: 'small', type: 'warning', onClick: () => handleKickUser(memberId) }, () =>
          t('admin.rooms.kick')
        ),
        h(NButton, { size: 'small', type: 'error', onClick: () => handleBanUser(memberId) }, () => t('admin.rooms.ban'))
      ])
    }
  }
])

const stateColumns = computed(() => [
  { title: t('admin.rooms.stateType'), key: 'type', width: 200, ellipsis: { tooltip: true } },
  { title: t('admin.rooms.stateKey'), key: 'stateKey', width: 200, ellipsis: { tooltip: true } },
  { title: t('admin.rooms.stateContent'), key: 'content', ellipsis: { tooltip: true } }
])

async function loadRooms() {
  if (!adminStore.isAdmin) return
  await admin.loadRooms(200)
}

async function openRoomDetail(room: RoomInfo) {
  showRoomDetail.value = true
  roomBlocked.value = false
  await admin.selectRoom(room)
}

async function handleForceJoin() {
  if (!selectedRoom.value || !forceJoinForm.value.userId) return
  forceJoinLoading.value = true
  try {
    await admin.forceJoinRoom(selectedRoom.value.roomId, forceJoinForm.value.userId)
    message.success(t('admin.rooms.forceJoinSuccess'))
    showForceJoinDialog.value = false
    forceJoinForm.value.userId = ''
  } catch (err) {
    if (handleAdminError(err)) message.error(t('admin.rooms.forceJoinFailed'))
  } finally {
    forceJoinLoading.value = false
  }
}

async function handleForceLeave() {
  if (!selectedRoom.value || !forceLeaveForm.value.userId) return
  forceLeaveLoading.value = true
  try {
    await admin.forceLeaveRoom(selectedRoom.value.roomId, forceLeaveForm.value.userId)
    message.success(t('admin.rooms.forceLeaveSuccess'))
    showForceLeaveDialog.value = false
    forceLeaveForm.value.userId = ''
  } catch (err) {
    if (handleAdminError(err)) message.error(t('admin.rooms.forceLeaveFailed'))
  } finally {
    forceLeaveLoading.value = false
  }
}

async function handleToggleBlock() {
  if (!selectedRoom.value) return
  const newBlockState = !roomBlocked.value
  try {
    await admin.blockRoom(selectedRoom.value.roomId, newBlockState)
    roomBlocked.value = newBlockState
    message.success(newBlockState ? t('admin.rooms.blockSuccess') : t('admin.rooms.unblockSuccess'))
  } catch (err) {
    if (handleAdminError(err))
      message.error(newBlockState ? t('admin.rooms.blockFailed') : t('admin.rooms.unblockFailed'))
  }
}

async function handleShutdownRoom() {
  if (!selectedRoom.value) return
  const target = selectedRoom.value
  dialog.warning({
    title: t('admin.rooms.shutdown'),
    content: t('admin.rooms.shutdownConfirm', { name: target.name || target.roomId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await admin.shutdownRoom(target.roomId, t('admin.rooms.shutdownMessage'))
        message.success(t('admin.rooms.shutdownSuccess'))
        showRoomDetail.value = false
      } catch (err) {
        if (handleAdminError(err)) message.error(t('admin.rooms.shutdownFailed'))
      }
    }
  })
}

async function handleDeleteRoom() {
  if (!selectedRoom.value) return
  const target = selectedRoom.value
  dialog.error({
    title: t('admin.rooms.delete'),
    content: t('admin.rooms.deleteConfirm', { name: target.name || target.roomId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await admin.deleteRoom(target.roomId, { purge: true })
        message.success(t('admin.rooms.deleteSuccess'))
        showRoomDetail.value = false
      } catch (err) {
        if (handleAdminError(err)) message.error(t('admin.rooms.deleteFailed'))
      }
    }
  })
}

// Kick / ban still go through the raw admin service — SDK exposes these via
// client methods already used inside MatrixAdminService.
async function handleKickUser(userId: string) {
  if (!selectedRoom.value) return
  const target = selectedRoom.value
  dialog.warning({
    title: t('admin.rooms.kick'),
    content: t('admin.rooms.kickConfirm', { userId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await adminService.kickUser(target.roomId, userId)
        message.success(t('admin.rooms.kickSuccess'))
        await admin.loadMembers()
      } catch (err) {
        if (handleAdminError(err)) message.error(t('admin.rooms.kickFailed'))
      }
    }
  })
}

async function handleBanUser(userId: string) {
  if (!selectedRoom.value) return
  const target = selectedRoom.value
  dialog.error({
    title: t('admin.rooms.ban'),
    content: t('admin.rooms.banConfirm', { userId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      try {
        await adminService.banUser(target.roomId, userId)
        message.success(t('admin.rooms.banSuccess'))
        await admin.loadMembers()
      } catch (err) {
        if (handleAdminError(err)) message.error(t('admin.rooms.banFailed'))
      }
    }
  })
}

onMounted(loadRooms)
</script>

<style scoped lang="scss">
.admin-rooms {
  max-width: 1200px;
}

.admin-rooms-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 768px) {
  .admin-rooms-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
