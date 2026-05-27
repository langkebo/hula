<template>
  <div class="admin-spaces">
    <n-tabs v-model:value="activeTab" type="line" animated>
      <n-tab-pane name="list" :tab="t('admin.spaces.list')">
        <div class="tab-header">
          <n-input
            v-model:value="searchQuery"
            :placeholder="t('admin.spaces.searchSpaces')"
            clearable
            style="width: 300px">
            <template #prefix>
              <svg class="size-16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </template>
          </n-input>
          <n-button @click="loadSpacesData">
            {{ t('admin.common.refresh') }}
          </n-button>
        </div>

        <n-spin :show="spacesLoading">
          <n-data-table
            :columns="spaceColumns"
            :data="filteredSpaces"
            :pagination="{ pageSize: 20 }"
            :bordered="false"
            striped
            :row-key="(row: SpaceInfo) => row.spaceId" />
        </n-spin>
      </n-tab-pane>

      <n-tab-pane v-if="selectedSpaceId" name="detail" :tab="t('admin.spaces.detail')">
        <n-spin :show="detailLoading">
          <template v-if="selectedSpace">
            <n-descriptions bordered :column="2" label-placement="left" style="margin-bottom: 16px">
              <n-descriptions-item :label="t('admin.spaces.name')">
                {{ selectedSpace.name || '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.spaces.creator')">
                {{ selectedSpace.creator || '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.spaces.visibility')">
                {{ selectedSpace.visibility || '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.spaces.joinRule')">
                {{ selectedSpace.joinRule || '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.spaces.memberCount')">
                {{ selectedSpace.memberCount ?? '-' }}
              </n-descriptions-item>
              <n-descriptions-item :label="t('admin.spaces.topic')" :span="2">
                {{ selectedSpace.topic || '-' }}
              </n-descriptions-item>
            </n-descriptions>

            <n-tabs type="segment" style="margin-top: 16px">
              <n-tab-pane name="members" :tab="t('admin.spaces.members')">
                <n-data-table
                  :columns="memberColumns"
                  :data="spaceUsers"
                  :pagination="{ pageSize: 10 }"
                  :bordered="false"
                  size="small" />
              </n-tab-pane>
              <n-tab-pane name="rooms" :tab="t('admin.spaces.rooms')">
                <n-data-table
                  :columns="roomColumns"
                  :data="spaceRooms"
                  :pagination="{ pageSize: 10 }"
                  :bordered="false"
                  size="small" />
              </n-tab-pane>
              <n-tab-pane name="statistics" :tab="t('admin.spaces.statistics')">
                <n-space v-if="spaceStats" :size="24" style="margin-top: 12px">
                  <n-statistic :label="t('admin.spaces.statsJoinedMembers')" :value="spaceStats.joinedMembers ?? 0" />
                  <n-statistic
                    :label="t('admin.spaces.statsJoinedLocalMembers')"
                    :value="spaceStats.joinedLocalMembers ?? 0" />
                  <n-statistic :label="t('admin.spaces.statsRooms')" :value="spaceStats.rooms ?? 0" />
                </n-space>
                <n-empty v-else :description="t('admin.spaces.noStats')" />
              </n-tab-pane>
            </n-tabs>
          </template>
        </n-spin>
      </n-tab-pane>
    </n-tabs>
  </div>
</template>

<script setup lang="ts">
import { NButton, NPopconfirm, NSpace, NTag } from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type SpaceInfo, type SpaceStats, useAdminSpaces } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminStore } from '@/stores/domains/admin/admin'
import { useAdminErrorHandler } from './useAdminError'

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const adminStore = useAdminStore()
const { handleAdminError } = useAdminErrorHandler()

const spaces = useAdminSpaces()
const {
  spaces: spaceList,
  spacesLoading,
  selectedSpace,
  selectedSpaceId,
  spaceUsers,
  spaceRooms,
  spaceStats,
  detailLoading,
  loadSpaces,
  selectSpace,
  deleteSpace
} = spaces

const activeTab = ref('list')
const searchQuery = ref('')

const filteredSpaces = computed(() => {
  if (!searchQuery.value) return spaceList.value
  const q = searchQuery.value.toLowerCase()
  return spaceList.value.filter(
    (s) =>
      s.spaceId.toLowerCase().includes(q) || s.name?.toLowerCase().includes(q) || s.creator?.toLowerCase().includes(q)
  )
})

const spaceColumns = computed(() => [
  {
    title: t('admin.spaces.spaceId'),
    key: 'spaceId',
    ellipsis: { tooltip: true },
    width: 220
  },
  {
    title: t('admin.spaces.name'),
    key: 'name',
    ellipsis: { tooltip: true },
    width: 180
  },
  {
    title: t('admin.spaces.creator'),
    key: 'creator',
    ellipsis: { tooltip: true },
    width: 200
  },
  {
    title: t('admin.spaces.memberCount'),
    key: 'memberCount',
    width: 100,
    render(row: SpaceInfo) {
      return row.memberCount ?? '-'
    }
  },
  {
    title: t('admin.spaces.roomCount'),
    key: 'roomCount',
    width: 100,
    render(row: SpaceInfo) {
      return row.roomCount ?? '-'
    }
  },
  {
    title: t('admin.spaces.createdAt'),
    key: 'createdAt',
    width: 180,
    render(row: SpaceInfo) {
      return row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.common.actions'),
    key: 'actions',
    width: 160,
    render(row: SpaceInfo) {
      return h(NSpace, { size: 'small' }, () => [
        h(NButton, { size: 'small', type: 'primary', onClick: () => openSpaceDetail(row) }, () =>
          t('admin.spaces.detail')
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => handleDeleteSpace(row.spaceId) },
          {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, () => t('admin.spaces.delete')),
            default: () => t('admin.spaces.deleteConfirm')
          }
        )
      ])
    }
  }
])

const memberColumns = computed(() => [
  {
    title: t('admin.spaces.userId'),
    key: 'user_id',
    ellipsis: { tooltip: true }
  },
  {
    title: t('admin.spaces.displayName'),
    key: 'displayname',
    width: 180,
    render(row: Record<string, unknown>) {
      return (row.displayname as string) || '-'
    }
  }
])

const roomColumns = computed(() => [
  {
    title: t('admin.spaces.roomId'),
    key: 'room_id',
    ellipsis: { tooltip: true }
  },
  {
    title: t('admin.spaces.name'),
    key: 'name',
    width: 180,
    render(row: Record<string, unknown>) {
      return (row.name as string) || '-'
    }
  }
])

async function loadSpacesData() {
  if (!adminStore.isAdmin) return
  await loadSpaces()
}

async function openSpaceDetail(row: SpaceInfo) {
  await selectSpace(row.spaceId)
  activeTab.value = 'detail'
}

async function handleDeleteSpace(spaceId: string) {
  try {
    await deleteSpace(spaceId)
    showFeedback(t('admin.spaces.deleteSuccess'), 'success')
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.spaces.deleteFailed'), 'error')
  }
}

onMounted(() => {
  loadSpacesData()
})
</script>

<style scoped lang="scss">
.admin-spaces {
  max-width: 1200px;
}

.tab-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 768px) {
  .tab-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
