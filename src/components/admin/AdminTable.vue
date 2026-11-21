<template>
  <!--
    空态放在表格外面而不是 n-data-table 的 #empty 插槽里，原因有两个：
    1. 插槽方案在 jsdom 下不渲染（Naive UI 依赖真实渲染时机），空态的测试会静默失效；
    2. 空列表时连表头一起显示其实是噪音 —— 直接不画表格更干净。

    这也是各页面原本「表格 + 外部 EmptyState」的写法，迁移后视觉与之前一致。
  -->
  <n-data-table
    v-if="!showEmpty"
    :columns="columns"
    :data="data"
    :loading="loading"
    :pagination="pagination"
    :bordered="bordered"
    :striped="striped"
    :remote="remote"
    :size="size"
    v-bind="{ ...(rowKey ? { rowKey } : {}), ...$attrs }" />
  <slot v-else-if="!emptyHidden" name="empty">
    <EmptyState compact :description="t('admin.common.noData')" />
  </slot>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { type DataTableColumns, NDataTable } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'

// attrs 显式下发到 n-data-table（class / data-testid / ref 等），
// 否则它们会落在根节点上，跨页面迁移时行为不一致。
defineOptions({ inheritAttrs: false })

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
    /**
     * 行密度。管理后台默认用 `small`：一屏能多放几行，
     * 与 `--tjg-space-*` 的紧凑节奏一致。
     */
    size?: 'small' | 'medium' | 'large'
    /**
     * 空列表时是否**不显示**空态。
     *
     * 用于「错误提示已经在上面了，再叠一个空态是噪音」的场景 ——
     * 原页面用 `v-if="!error && empty"` 表达这个语义，迁移后由该开关接管。
     */
    emptyHidden?: boolean
  }>(),
  {
    loading: false,
    size: 'small',
    emptyHidden: false,
    pagination: () => ({ pageSize: 20 }),
    bordered: false,
    striped: true,
    remote: false
  }
)

const { t } = useI18n()

/** 空列表且非加载中：此时不渲染表格，直接给空态。 */
const showEmpty = computed(() => !props.loading && props.data.length === 0)
</script>
