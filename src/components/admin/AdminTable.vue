<template>
  <n-data-table
    :columns="columns"
    :data="data"
    :loading="loading"
    :pagination="pagination"
    :bordered="bordered"
    :striped="striped"
    :remote="remote"
    v-bind="rowKey ? { rowKey } : {}">
    <template v-if="isEmptyData" #empty>
      <slot name="empty">
        <EmptyState compact :description="t('admin.common.noData')" />
      </slot>
    </template>
  </n-data-table>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { type DataTableColumns, NDataTable } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'

const props = withDefaults(
  defineProps<{
    /** 表格列定义 */
    columns: DataTableColumns<T>
    /** 表格数据 */
    data: T[]
    /** 加载态 */
    loading?: boolean
    /** 分页配置；默认开启每页 20 条 */
    pagination?: false | object
    /** 是否显示边框，默认 false（沿用管理后台既有风格） */
    bordered?: boolean
    /** 是否斑马纹，默认 true */
    striped?: boolean
    /** 行 key 取值函数 */
    rowKey?: (row: T) => string | number
    /** 远程模式：排序/筛选/分页由外部控制 */
    remote?: boolean
  }>(),
  {
    loading: false,
    pagination: () => ({ pageSize: 20 }),
    bordered: false,
    striped: true,
    remote: false
  }
)

const { t } = useI18n()

const isEmptyData = computed(() => !props.loading && props.data.length === 0)
</script>
