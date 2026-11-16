<template>
  <n-tab-pane name="serverInfo" :tab="t('admin.users.serverInfo')">
    <n-spin :show="adminCheckLoading || statsOverviewLoading">
      <n-descriptions bordered :column="1" label-placement="left">
        <n-descriptions-item :label="t('admin.users.adminCheck')">
          <n-tag size="small" :type="adminCheck === true ? 'success' : 'default'">
            {{
              adminCheck === null ? '-' : adminCheck ? t('admin.users.adminCheckYes') : t('admin.users.adminCheckNo')
            }}
          </n-tag>
        </n-descriptions-item>
        <n-descriptions-item v-for="entry in statsEntries" :key="entry.key" :label="entry.key">
          {{ entry.value }}
        </n-descriptions-item>
      </n-descriptions>
      <EmptyState v-if="isEmptyStatsEntries" compact :description="t('admin.users.statsOverviewEmpty')" />
    </n-spin>
  </n-tab-pane>
</template>

<script setup lang="ts">
import { NDescriptions, NDescriptionsItem, NSpin, NTabPane, NTag } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import type { UseAdminUsersResult } from '@/composables/admin'

const props = defineProps<{
  /** 父级持有的用户管理 composable 实例；本组件只读展示服务端补充信息。 */
  admin: UseAdminUsersResult
}>()

const { t } = useI18n()

const { adminCheck, adminCheckLoading, userStatsOverview, statsOverviewLoading } = props.admin

const statsEntries = computed(() =>
  Object.entries(userStatsOverview.value[0] ?? {})
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => ({ key, value: typeof value === 'object' ? JSON.stringify(value) : String(value) }))
)

/** 加载完成且无服务端统计项时才展示空态 */
const isEmptyStatsEntries = computed(() => !statsOverviewLoading.value && statsEntries.value.length === 0)
</script>
