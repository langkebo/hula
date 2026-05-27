<template>
  <div class="admin-rooms">
    <div class="admin-rooms-header">
      <n-input
        v-model:value="searchQuery"
        :placeholder="t('admin.rooms.search')"
        clearable
        style="width: 300px"
        @keyup.enter="handleSearch">
        <template #prefix>
          <Icon icon="mdi:magnify" class="size-16px" />
        </template>
      </n-input>
      <n-button type="primary" size="small" :loading="searchLoading" @click="handleSearch">
        {{ t('admin.rooms.searchBtn') }}
      </n-button>
    </div>

    <n-spin :show="loading || searchLoading">
      <n-data-table
        :columns="columns"
        :data="isSearchMode ? searchResults : filteredRooms"
        :pagination="{ pageSize: 20 }"
        :bordered="false"
        striped
        :row-key="(row: RoomInfo) => row.roomId" />
    </n-spin>

    <n-modal v-model:show="showRoomDetail" :title="t('admin.rooms.roomDetail')" preset="dialog" style="width: 800px">
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
          <!-- Members Tab -->
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

          <!-- Messages Tab -->
          <n-tab-pane name="messages" :tab="t('admin.rooms.messages')">
            <n-spin :show="messagesLoading">
              <n-data-table
                v-if="roomMessages.length > 0"
                :columns="messageColumns"
                :data="roomMessages"
                :bordered="false"
                size="small"
                :pagination="{ pageSize: 10 }" />
              <n-empty v-else :description="t('admin.rooms.noMessages')" style="padding: 24px 0" />
              <div v-if="messagesPaginationToken" style="text-align: center; margin-top: 12px">
                <n-button size="small" :loading="messagesLoading" @click="loadMoreMessages">
                  {{ t('admin.rooms.loadMore') }}
                </n-button>
              </div>
            </n-spin>
          </n-tab-pane>

          <!-- State Tab -->
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

          <!-- Aliases Tab -->
          <n-tab-pane name="aliases" :tab="t('admin.rooms.aliases')">
            <n-spin :show="aliasesLoading">
              <div v-if="roomAliases.length > 0">
                <n-tag
                  v-for="alias in roomAliases"
                  :key="alias"
                  closable
                  style="margin: 4px"
                  @close="handleRemoveAlias(alias)">
                  {{ alias }}
                </n-tag>
              </div>
              <n-empty v-else :description="t('admin.rooms.noAliases')" style="padding: 24px 0" />
            </n-spin>
          </n-tab-pane>

          <!-- Statistics Tab -->
          <n-tab-pane name="statistics" :tab="t('admin.rooms.statistics')">
            <n-spin :show="statsLoading">
              <template v-if="roomStats">
                <n-grid :cols="3" :x-gap="12" :y-gap="12">
                  <n-gi>
                    <n-card size="small">
                      <n-statistic :label="t('admin.rooms.statsJoinedMembers')">
                        {{ roomStats.joined_members ?? roomStats.joinedMembers ?? '-' }}
                      </n-statistic>
                    </n-card>
                  </n-gi>
                  <n-gi>
                    <n-card size="small">
                      <n-statistic :label="t('admin.rooms.statsJoinedLocalMembers')">
                        {{ roomStats.joined_local_members ?? roomStats.joinedLocalMembers ?? '-' }}
                      </n-statistic>
                    </n-card>
                  </n-gi>
                  <n-gi>
                    <n-card size="small">
                      <n-statistic :label="t('admin.rooms.statsInvitedMembers')">
                        {{ roomStats.invited_members ?? roomStats.invitedMembers ?? '-' }}
                      </n-statistic>
                    </n-card>
                  </n-gi>
                </n-grid>
                <n-grid :cols="3" :x-gap="12" :y-gap="12" style="margin-top: 12px">
                  <n-gi>
                    <n-card size="small">
                      <n-statistic :label="t('admin.rooms.statsStateEvents')">
                        {{ roomStats.state_events ?? roomStats.stateEvents ?? '-' }}
                      </n-statistic>
                    </n-card>
                  </n-gi>
                  <n-gi>
                    <n-card size="small">
                      <n-statistic :label="t('admin.rooms.statsVersion')">
                        {{ roomStats.room_version ?? roomStats.roomVersion ?? '-' }}
                      </n-statistic>
                    </n-card>
                  </n-gi>
                  <n-gi>
                    <n-card size="small">
                      <n-statistic :label="t('admin.rooms.statsDepth')">
                        {{ roomStats.depth ?? '-' }}
                      </n-statistic>
                    </n-card>
                  </n-gi>
                </n-grid>
              </template>
              <n-empty v-else :description="t('admin.rooms.noStats')" style="padding: 24px 0" />
            </n-spin>
          </n-tab-pane>

          <!-- Actions Tab -->
          <n-tab-pane name="actions" :tab="t('admin.rooms.actions')">
            <n-space vertical>
              <!-- Make Room Admin -->
              <n-card size="small" :title="t('admin.rooms.makeAdmin')">
                <n-space align="center">
                  <n-input
                    v-model:value="makeAdminUserId"
                    :placeholder="t('admin.rooms.makeAdminPlaceholder')"
                    style="width: 300px" />
                  <n-button size="small" type="primary" :loading="makeAdminLoading" @click="handleMakeAdmin">
                    {{ t('admin.rooms.makeAdminBtn') }}
                  </n-button>
                </n-space>
              </n-card>

              <!-- Force Join / Leave -->
              <n-card size="small" :title="t('admin.rooms.forceActions')">
                <n-space>
                  <n-button size="small" type="primary" @click="showForceJoinDialog = true">
                    {{ t('admin.rooms.forceJoin') }}
                  </n-button>
                  <n-button size="small" type="warning" @click="showForceLeaveDialog = true">
                    {{ t('admin.rooms.forceLeave') }}
                  </n-button>
                </n-space>
              </n-card>

              <!-- Block / Unblock -->
              <n-card size="small" :title="t('admin.rooms.blockActions')">
                <n-button size="small" :type="roomBlocked ? 'success' : 'error'" @click="handleToggleBlock">
                  {{ roomBlocked ? t('admin.rooms.unblock') : t('admin.rooms.block') }}
                </n-button>
              </n-card>

              <!-- Danger Zone -->
              <n-card size="small" :title="t('admin.rooms.dangerZone')" style="border-color: var(--n-error-color)">
                <n-space vertical>
                  <n-popconfirm @positive-click="handlePurgeHistory">
                    <template #trigger>
                      <n-button size="small" type="error">
                        {{ t('admin.rooms.purgeHistory') }}
                      </n-button>
                    </template>
                    {{ t('admin.rooms.purgeHistoryConfirm') }}
                  </n-popconfirm>

                  <n-button size="small" type="error" @click="handleShutdownRoom">
                    {{ t('admin.rooms.shutdown') }}
                  </n-button>
                  <n-button size="small" type="error" ghost @click="handleDeleteRoom">
                    {{ t('admin.rooms.delete') }}
                  </n-button>
                </n-space>
              </n-card>
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
import { Icon } from '@iconify/vue'
import { NButton, NPopconfirm, NSpace, NStatistic, NTag, useDialog } from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { type RoomInfo, useAdminRooms } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
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
const roomMessages = admin.roomMessages
const messagesLoading = admin.messagesLoading
const messagesPaginationToken = admin.messagesPaginationToken
const roomAliases = admin.roomAliases
const aliasesLoading = admin.aliasesLoading
const roomStats = admin.roomStats
const statsLoading = admin.statsLoading
const searchResults = admin.searchResults
const searchLoading = admin.searchLoading

// View-only local state
const showRoomDetail = ref(false)
const roomBlocked = ref(false)
const showForceJoinDialog = ref(false)
const forceJoinLoading = ref(false)
const forceJoinForm = ref({ userId: '' })
const showForceLeaveDialog = ref(false)
const forceLeaveLoading = ref(false)
const forceLeaveForm = ref({ userId: '' })
const makeAdminUserId = ref('')
const makeAdminLoading = ref(false)
const isSearchMode = ref(false)

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

const messageColumns = computed(() => [
  {
    title: t('admin.rooms.msgSender'),
    key: 'sender',
    width: 180,
    ellipsis: { tooltip: true }
  },
  {
    title: t('admin.rooms.msgContent'),
    key: 'content',
    ellipsis: { tooltip: true }
  },
  {
    title: t('admin.rooms.msgType'),
    key: 'eventType',
    width: 160,
    ellipsis: { tooltip: true }
  },
  {
    title: t('admin.rooms.msgTime'),
    key: 'timestamp',
    width: 180,
    render(row: { timestamp: number }) {
      return row.timestamp ? new Date(row.timestamp).toLocaleString() : '-'
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
  makeAdminUserId.value = ''
  await admin.selectRoom(room)
}

async function handleSearch() {
  const query = searchQuery.value.trim()
  if (!query) {
    isSearchMode.value = false
    return
  }
  isSearchMode.value = true
  try {
    await admin.searchRooms(query)
  } catch (err) {
    if (handleAdminError(err)) {
      showFeedback(t('admin.rooms.searchFailed'), 'error')
    }
  }
}

function loadMoreMessages() {
  admin.loadMessages(50, messagesPaginationToken.value)
}

async function handleMakeAdmin() {
  if (!selectedRoom.value) return
  makeAdminLoading.value = true
  try {
    await admin.makeRoomAdmin(selectedRoom.value.roomId, makeAdminUserId.value || undefined)
    showFeedback(t('admin.rooms.makeAdminSuccess'), 'success')
    makeAdminUserId.value = ''
  } catch (err) {
    if (handleAdminError(err)) {
      showFeedback(t('admin.rooms.makeAdminFailed'), 'error')
    }
  } finally {
    makeAdminLoading.value = false
  }
}

async function handleForceJoin() {
  if (!selectedRoom.value || !forceJoinForm.value.userId) return
  forceJoinLoading.value = true
  try {
    await admin.forceJoinRoom(selectedRoom.value.roomId, forceJoinForm.value.userId)
    showFeedback(t('admin.rooms.forceJoinSuccess'), 'success')
    showForceJoinDialog.value = false
    forceJoinForm.value.userId = ''
    await admin.loadMembers()
  } catch (err) {
    if (handleAdminError(err)) {
      showFeedback(t('admin.rooms.forceJoinFailed'), 'error')
    }
  } finally {
    forceJoinLoading.value = false
  }
}

async function handleForceLeave() {
  if (!selectedRoom.value || !forceLeaveForm.value.userId) return
  forceLeaveLoading.value = true
  try {
    await admin.forceLeaveRoom(selectedRoom.value.roomId, forceLeaveForm.value.userId)
    showFeedback(t('admin.rooms.forceLeaveSuccess'), 'success')
    showForceLeaveDialog.value = false
    forceLeaveForm.value.userId = ''
  } catch (err) {
    if (handleAdminError(err)) {
      showFeedback(t('admin.rooms.forceLeaveFailed'), 'error')
    }
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
    showFeedback(newBlockState ? t('admin.rooms.blockSuccess') : t('admin.rooms.unblockSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) {
      showFeedback(newBlockState ? t('admin.rooms.blockFailed') : t('admin.rooms.unblockFailed'), 'error')
    }
  }
}

async function handlePurgeHistory() {
  if (!selectedRoom.value) return
  try {
    const result = await admin.purgeHistory(selectedRoom.value.roomId)
    showFeedback(t('admin.rooms.purgeHistorySuccess', { purgeId: result.purgeId }), 'success')
  } catch (err) {
    if (handleAdminError(err)) {
      showFeedback(t('admin.rooms.purgeHistoryFailed'), 'error')
    }
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
        showFeedback(t('admin.rooms.shutdownSuccess'), 'success')
        showRoomDetail.value = false
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.rooms.shutdownFailed'), 'error')
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
        showFeedback(t('admin.rooms.deleteSuccess'), 'success')
        showRoomDetail.value = false
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.rooms.deleteFailed'), 'error')
      }
    }
  })
}

function handleRemoveAlias(_alias: string) {
  // Alias removal requires server-side API not currently exposed;
  // show informational feedback
  showFeedback(t('admin.rooms.aliasRemoveNotSupported'), 'warning')
}

// Kick / ban still go through the raw admin service because the SDK exposes
// them via client methods already used by the admin facade.
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
        await admin.kickUser(target.roomId, userId)
        showFeedback(t('admin.rooms.kickSuccess'), 'success')
        await admin.loadMembers()
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.rooms.kickFailed'), 'error')
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
        await admin.banUser(target.roomId, userId)
        showFeedback(t('admin.rooms.banSuccess'), 'success')
        await admin.loadMembers()
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.rooms.banFailed'), 'error')
      }
    }
  })
}

onMounted(loadRooms)

// Reset search mode when the search query is cleared
watch(searchQuery, (val) => {
  if (!val.trim()) {
    isSearchMode.value = false
  }
})
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
