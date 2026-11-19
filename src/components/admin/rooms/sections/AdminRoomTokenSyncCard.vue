<script setup lang="ts">
/**
 * 房间治理 · token 同步卡片。
 *
 * 从 `AdminRoomGovernancePanel.vue` 抽出（该文件触及 400 行上限）。
 * 展示后端 `GET /rooms/{room_id}/token_sync` 的 **summary 四项 + 已加载/总数**，
 * 原始响应折叠保留 —— 字段对不上后端日志时那是唯一取证入口。
 */
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NSpin,
  NText
} from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UseAdminRoomsResult } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminErrorHandler } from '@/views/admin/useAdminError'

defineOptions({ name: 'AdminRoomTokenSyncCard' })

const props = defineProps<{
  /** 父页面持有的房间管理 composable 实例；本组件不自行创建，避免状态分叉。 */
  rooms: UseAdminRoomsResult
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { handleAdminError } = useAdminErrorHandler()

/**
 * 汇总四项。label 直接用 wire 字段名：这是 admin 排障视图，
 * 字段名本身比译名更能对上后端日志与工单。
 */
const summaryEntries = computed(() => {
  const s = props.rooms.roomTokenSync.value?.summary
  if (!s) return []
  return [
    { key: 'active_token_count', value: String(s.active_token_count) },
    { key: 'expired_token_count', value: String(s.expired_token_count) },
    { key: 'distinct_users', value: String(s.distinct_users) },
    { key: 'distinct_devices', value: String(s.distinct_devices) }
  ]
})

/** 已加载条数 / 后端 total；两者不等说明后端分页了（`next_batch` 非空）。 */
const counts = computed(() => {
  const r = props.rooms.roomTokenSync.value
  if (!r) return null
  return { loaded: r.results.length, total: r.total, hasMore: Boolean(r.next_batch) }
})

async function reload() {
  try {
    await props.rooms.loadRoomTokenSync()
    if (!props.rooms.roomTokenSync.value) {
      showFeedback(t('admin.rooms.tokenSyncFailed'), 'error')
    }
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.rooms.tokenSyncFailed'), 'error')
  }
}
</script>

<template>
  <n-card size="small" :title="t('admin.rooms.tokenSync')">
    <template #header-extra>
      <n-button size="small" :loading="props.rooms.tokenSyncLoading.value" @click="reload">
        {{ t('admin.common.refresh') }}
      </n-button>
    </template>
    <n-spin :show="props.rooms.tokenSyncLoading.value">
      <template v-if="props.rooms.roomTokenSync.value">
        <n-descriptions bordered :column="4" size="small" label-placement="top">
          <n-descriptions-item v-for="entry in summaryEntries" :key="entry.key" :label="entry.key">
            {{ entry.value }}
          </n-descriptions-item>
        </n-descriptions>
        <n-text v-if="counts" depth="3" class="mt-8px block text-12px">
          loaded {{ counts.loaded }} / total {{ counts.total }}
          <template v-if="counts.hasMore">· more batches available</template>
        </n-text>
        <n-collapse class="mt-8px">
          <n-collapse-item title="raw json" name="raw">
            <pre class="governance-json">{{ JSON.stringify(props.rooms.roomTokenSync.value, null, 2) }}</pre>
          </n-collapse-item>
        </n-collapse>
      </template>
      <n-empty v-else :description="t('admin.rooms.tokenSyncEmpty')" class="py-16px" />
    </n-spin>
  </n-card>
</template>

<style scoped lang="scss">
.governance-json {
  margin-top: 4px;
  padding: 12px;
  border-radius: 6px;
  background: var(--tjg-surface-list);
  color: var(--tjg-text-primary);
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 320px;
}
</style>
