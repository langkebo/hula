<script setup lang="ts">
import { type DataTableColumns, NButton, NDataTable, NEmpty, NTag } from 'naive-ui'
import { h, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { type UseAdminMedia, useAdminMedia } from '@/composables/admin'

type QuarantineChange = UseAdminMedia['quarantineChanges']['value'][number]

const { t } = useI18n()
const { quarantineChanges, quarantineLoading, loadQuarantineChanges, loadMoreQuarantineChanges } = useAdminMedia()

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
    <n-empty
      v-if="!quarantineLoading && quarantineChanges.length === 0"
      class="py-24px"
      :description="t('admin.media.empty.changes')" />

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
