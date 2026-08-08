import { mount } from '@vue/test-utils'
import type { DataTableColumns } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'
import AdminTable from '../AdminTable.vue'

interface Row {
  id: number
  name: string
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', () => ({
  NDataTable: {
    name: 'NDataTable',
    props: {
      columns: { type: Array, default: () => [] },
      data: { type: Array, default: () => [] },
      loading: { type: Boolean, default: false },
      pagination: { type: [Boolean, Object], default: false },
      bordered: { type: Boolean, default: false },
      striped: { type: Boolean, default: false },
      rowKey: { type: Function, default: undefined }
    },
    template: `
      <div
        data-test="n-data-table"
        :data-loading="loading"
        :data-bordered="bordered"
        :data-striped="striped"
        :data-has-data="data && data.length > 0">
        <slot name="empty" v-if="!loading && (!data || data.length === 0)" />
        <slot />
      </div>
    `
  }
}))

describe('AdminTable', () => {
  const columns: DataTableColumns = [
    { title: 'ID', key: 'id', width: 80 },
    { title: '名称', key: 'name' }
  ]
  const data: Row[] = [
    { id: 1, name: 'alice' },
    { id: 2, name: 'bob' }
  ]

  const mountComponent = (props: Record<string, unknown> = {}) =>
    mount(AdminTable, {
      props: {
        columns,
        data,
        rowKey: (row: Record<string, any>) => row.id,
        ...props
      }
    })

  it('renders the wrapped n-data-table', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('[data-test="n-data-table"]').exists()).toBe(true)
  })

  it('forwards columns and data to n-data-table', () => {
    const wrapper = mountComponent()
    const table = wrapper.find('[data-test="n-data-table"]')
    expect(table.attributes('data-has-data')).toBe('true')
  })

  it('defaults to bordered=false and striped=true matching admin convention', () => {
    const wrapper = mountComponent()
    const table = wrapper.find('[data-test="n-data-table"]')
    expect(table.attributes('data-bordered')).toBe('false')
    expect(table.attributes('data-striped')).toBe('true')
  })

  it('forwards loading prop to n-data-table', () => {
    const wrapper = mountComponent({ loading: true })
    expect(wrapper.find('[data-test="n-data-table"]').attributes('data-loading')).toBe('true')
  })

  it('forwards pagination prop', () => {
    const wrapper = mountComponent({ pagination: { pageSize: 50 } })
    expect(wrapper.find('[data-test="n-data-table"]').exists()).toBe(true)
  })

  it('allows overriding bordered and striped', () => {
    const wrapper = mountComponent({ bordered: true, striped: false })
    const table = wrapper.find('[data-test="n-data-table"]')
    expect(table.attributes('data-bordered')).toBe('true')
    expect(table.attributes('data-striped')).toBe('false')
  })

  it('renders default empty state when data is empty and not loading', () => {
    const wrapper = mountComponent({
      data: [],
      loading: false
    })
    expect(wrapper.text()).toContain('admin.common.noData')
  })

  it('does not render empty state when loading', () => {
    const wrapper = mountComponent({
      data: [],
      loading: true
    })
    expect(wrapper.text()).not.toContain('admin.common.noData')
  })

  it('allows overriding empty state via slot', () => {
    const wrapper = mount(AdminTable, {
      props: {
        columns,
        data: [],
        rowKey: (row: Record<string, any>) => row.id
      },
      slots: {
        empty: '<div class="custom-empty">暂无记录</div>'
      }
    })
    expect(wrapper.find('.custom-empty').exists()).toBe(true)
    expect(wrapper.find('.custom-empty').text()).toBe('暂无记录')
  })
})
