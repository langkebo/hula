<script setup lang="ts">
import { type DataTableColumns, NButton, NDataTable, NTag } from 'naive-ui'
import { computed, h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import { type UseAdminMedia, useAdminMedia } from '@/composables/admin'

type QuarantineChange = UseAdminMedia['quarantineChanges']['value'][number]

const { t } = useI18n()
const { quarantineChanges, quarantineLoading, loadQuarantineChanges, loadMoreQuarantineChanges } = useAdminMedia()

/** 加载完成且排除记录为空时才展示空态 */
const isEmptyQuarantineChanges = computed(() => !quarantineLoading.value && quarantineChanges.value.length === 0)

const columns: DataTableColumns<QuarantineChange> = [
  { title: t('admin.media.column.origin'), key: 'origin', width: 220, ellipsis: { tooltip: true } },
  { title: t('admin.media.column.mediaId'), key: 'media_id', width: 240, ellipsis: { tooltip: true } },
  {
    title: t('admin.media.column.quarantined'),
    key: 'quarantined',
    width: 120,
    render: (row) =>
      h(NTag, { size: 'small', type: row.quarantined ? 'warning' : 'default' }, () =>
        row.quarantined ? t('admin.media.column.quarantined') : '-'
      )
  }
]

onMounted(() => {
  void loadQuarantineChanges()
})
</script>

<template>
  <div class="media-quarantine-changes-panel">
    <n-data-table :columns="columns" :data="quarantineChanges" :loading="quarantineLoading" />
    <EmptyState v-if="isEmptyQuarantineChanges" :description="t('admin.media.empty.changes')" />

    <div v-if="quarantineChanges.length > 0" class="mt-12px flex justify-center">
      <n-button :loading="quarantineLoading" @click="loadMoreQuarantineChanges">
        {{ t('admin.media.action.loadMore') }}
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.media-quarantine-changes-panel {
  padding-top: 8px;
}
</style>
