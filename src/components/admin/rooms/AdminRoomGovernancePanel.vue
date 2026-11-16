<template>
  <n-space vertical :size="12">
    <!-- 封禁状态 -->
    <n-card size="small" :title="t('admin.rooms.blockActions')">
      <n-space align="center">
        <n-tag size="small" :type="rooms.roomBlockStatus.value ? 'error' : 'success'">
          {{ rooms.roomBlockStatus.value ? t('admin.rooms.blocked') : t('admin.rooms.notBlocked') }}
        </n-tag>
        <n-button
          size="small"
          :type="rooms.roomBlockStatus.value ? 'success' : 'error'"
          :loading="rooms.blockStatusLoading.value"
          @click="handleToggleBlock">
          {{ rooms.roomBlockStatus.value ? t('admin.rooms.unblock') : t('admin.rooms.block') }}
        </n-button>
      </n-space>
    </n-card>

    <!-- 服务端房间统计 -->
    <n-card size="small" :title="t('admin.rooms.serverStats')">
      <n-spin :show="rooms.serverStatsLoading.value">
        <n-descriptions v-if="rooms.serverRoomStats.value" bordered :column="3" size="small">
          <n-descriptions-item v-for="entry in serverStatsEntries" :key="entry.key" :label="entry.key">
            {{ entry.value }}
          </n-descriptions-item>
        </n-descriptions>
        <n-empty v-else :description="t('admin.rooms.serverStatsEmpty')" class="py-16px" />
      </n-spin>
    </n-card>

    <!-- 公开目录 -->
    <n-card size="small" :title="t('admin.rooms.listings')">
      <template #header-extra>
        <n-button size="small" type="primary" :loading="publishing" @click="handlePublishListing">
          {{ t('admin.rooms.publishListing') }}
        </n-button>
      </template>
      <n-spin :show="rooms.listingsLoading.value">
        <n-descriptions v-if="rooms.roomListings.value" bordered :column="1" label-placement="left" size="small">
          <n-descriptions-item v-for="entry in listingEntries" :key="entry.key" :label="entry.key">
            {{ entry.value }}
          </n-descriptions-item>
        </n-descriptions>
        <n-empty v-else :description="t('admin.rooms.listingsEmpty')" class="py-16px" />
      </n-spin>
    </n-card>

    <!-- 事件上下文 -->
    <n-card size="small" :title="t('admin.rooms.eventContext')">
      <n-space>
        <n-input
          v-model:value="eventId"
          :placeholder="t('admin.rooms.eventContextPlaceholder')"
          class="flex-1"
          @keyup.enter="handleLoadEventContext" />
        <n-button size="small" :loading="rooms.eventContextLoading.value" @click="handleLoadEventContext">
          {{ t('admin.common.query') }}
        </n-button>
      </n-space>
      <n-spin :show="rooms.eventContextLoading.value">
        <pre v-if="rooms.roomEventContext.value" class="governance-json">{{
          JSON.stringify(rooms.roomEventContext.value, null, 2)
        }}</pre>
        <n-empty v-else :description="t('admin.rooms.eventContextEmpty')" class="py-16px" />
      </n-spin>
    </n-card>

    <!-- 房间内搜索 -->
    <n-card size="small" :title="t('admin.rooms.searchInRoom')">
      <n-space>
        <n-input
          v-model:value="searchTerm"
          :placeholder="t('admin.rooms.searchInRoomPlaceholder')"
          class="flex-1"
          @keyup.enter="handleSearchInRoom" />
        <n-button size="small" :loading="rooms.roomSearchLoading.value" @click="handleSearchInRoom">
          {{ t('admin.rooms.searchBtn') }}
        </n-button>
      </n-space>
      <n-spin :show="rooms.roomSearchLoading.value">
        <n-data-table
          v-if="rooms.roomSearchResults.value.length > 0"
          :columns="searchColumns"
          :data="rooms.roomSearchResults.value"
          :bordered="false"
          size="small"
          :pagination="{ pageSize: 10 }"
          class="mt-12px" />
        <n-empty v-else :description="t('admin.rooms.searchInRoomEmpty')" class="py-16px" />
      </n-spin>
    </n-card>

    <!-- 前向极值 -->
    <n-card size="small" :title="t('admin.rooms.forwardExtremities')">
      <n-spin :show="rooms.forwardExtremitiesLoading.value">
        <n-data-table
          v-if="rooms.forwardExtremities.value.length > 0"
          :columns="extremityColumns"
          :data="rooms.forwardExtremities.value"
          :bordered="false"
          size="small"
          :pagination="{ pageSize: 5 }" />
        <n-empty v-else :description="t('admin.rooms.forwardExtremitiesEmpty')" class="py-16px" />
      </n-spin>
      <template #action>
        <n-button size="small" :loading="rooms.forwardExtremitiesLoading.value" @click="reloadExtremities">
          {{ t('admin.common.refresh') }}
        </n-button>
      </template>
    </n-card>
  </n-space>
</template>

<script setup lang="ts">
import {
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NInput,
  NSpace,
  NSpin,
  NTag,
  useDialog
} from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UseAdminRoomsResult } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminErrorHandler } from '@/views/admin/useAdminError'

const props = defineProps<{
  /** 父页面持有的房间管理 composable 实例；本组件不自行创建，避免状态分叉。 */
  rooms: UseAdminRoomsResult
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { handleAdminError } = useAdminErrorHandler()
const dialog = useDialog()

const eventId = ref('')
const searchTerm = ref('')
const publishing = ref(false)

const listingEntries = computed(() =>
  Object.entries(props.rooms.roomListings.value ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => ({ key, value: typeof value === 'object' ? JSON.stringify(value) : String(value) }))
)

const serverStatsEntries = computed(() =>
  Object.entries(props.rooms.serverRoomStats.value ?? {})
    .filter(([, value]) => typeof value !== 'object' || value === null)
    .map(([key, value]) => ({ key, value: value === null || value === undefined ? '-' : String(value) }))
)

const searchColumns = computed(() => [
  { title: t('admin.rooms.msgSender'), key: 'sender', width: 180, ellipsis: { tooltip: true } },
  { title: t('admin.rooms.msgType'), key: 'type', width: 140, ellipsis: { tooltip: true } },
  { title: t('admin.rooms.msgContent'), key: 'content', ellipsis: { tooltip: true } }
])

const extremityColumns = [{ title: t('admin.rooms.eventId'), key: 'event_id', ellipsis: { tooltip: true } }]

async function handleToggleBlock() {
  const room = props.rooms.selectedRoom.value
  if (!room) return
  const target = !props.rooms.roomBlockStatus.value
  try {
    if (target) await props.rooms.blockRoom(room.roomId, true)
    else await props.rooms.unblockRoom(room.roomId)
    showFeedback(target ? t('admin.rooms.blockSuccess') : t('admin.rooms.unblockSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) {
      showFeedback(target ? t('admin.rooms.blockFailed') : t('admin.rooms.unblockFailed'), 'error')
    }
  }
}

function handlePublishListing() {
  const room = props.rooms.selectedRoom.value
  if (!room) return
  dialog.warning({
    title: t('admin.rooms.publishListing'),
    content: t('admin.rooms.publishListingConfirm', { name: room.name || room.roomId }),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      publishing.value = true
      try {
        await props.rooms.setRoomPublicListing(room.roomId)
        showFeedback(t('admin.rooms.publishListingSuccess'), 'success')
      } catch (err) {
        if (handleAdminError(err)) showFeedback(t('admin.rooms.publishListingFailed'), 'error')
      } finally {
        publishing.value = false
      }
    }
  })
}

async function handleLoadEventContext() {
  if (!eventId.value.trim()) {
    showFeedback(t('admin.rooms.eventContextRequired'), 'warning')
    return
  }
  try {
    await props.rooms.loadRoomEventContext(eventId.value)
    if (!props.rooms.roomEventContext.value) {
      showFeedback(t('admin.rooms.eventContextFailed'), 'error')
    }
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.rooms.eventContextFailed'), 'error')
  }
}

async function handleSearchInRoom() {
  if (!searchTerm.value.trim()) {
    showFeedback(t('admin.rooms.searchInRoomRequired'), 'warning')
    return
  }
  try {
    await props.rooms.searchInRoom(searchTerm.value)
    if (props.rooms.roomSearchResults.value.length === 0) {
      showFeedback(t('admin.rooms.searchInRoomEmpty'), 'info')
    }
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.rooms.searchInRoomFailed'), 'error')
  }
}

async function reloadExtremities() {
  try {
    await props.rooms.loadForwardExtremities()
    showFeedback(t('admin.rooms.forwardExtremitiesLoaded'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.rooms.forwardExtremitiesFailed'), 'error')
  }
}
</script>

<style scoped lang="scss">
.governance-json {
  margin-top: 12px;
  padding: 12px;
  border-radius: 6px;
  background: var(--tjg-surface-list);
  color: var(--tjg-text-primary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 240px;
  overflow: auto;
}
</style>
