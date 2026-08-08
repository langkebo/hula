<template>
  <n-data-table
    :columns="columns"
    :data="data"
    :loading="loading"
    :pagination="pagination"
    :bordered="bordered"
    :striped="striped"
    :row-key="rowKey"
    :remote="remote">
    <template v-if="!loading && data.length === 0" #empty>
      <slot name="empty">
        <div class="admin-table__empty">{{ t('admin.common.noData') }}</div>
      </slot>
    </template>
  </n-data-table>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { type DataTableColumns, NDataTable } from 'naive-ui'
import { useI18n } from 'vue-i18n'

withDefaults(
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
    rowKey: undefined,
    remote: false
  }
)

const { t } = useI18n()
</script>

<style scoped lang="scss">
.admin-table__empty {
  padding: var(--tjg-space-6) 0;
  text-align: center;
  color: var(--tjg-text-quaternary);
  font-size: var(--tjg-font-size-sm);
}
</style>
