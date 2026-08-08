import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AdminBulkActionBar from '../AdminBulkActionBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'admin.common.selectedCount' && params) return `已选择 ${params.count} 项`
      return key
    }
  })
}))

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    props: ['type', 'size', 'disabled', 'loading'],
    emits: ['click'],
    template: `<button data-test="n-button" :data-type="type" :disabled="disabled" :data-loading="loading" @click="$emit('click')"><slot name="icon" /><slot /></button>`
  }
}))

describe('AdminBulkActionBar', () => {
  const actions = [
    { key: 'deactivate', label: '批量停用', type: 'error' as const },
    { key: 'export', label: '导出', type: 'primary' as const }
  ]

  it('renders nothing when selectedCount is 0', () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: { selectedCount: 0, actions }
    })
    expect(wrapper.find('.admin-bulk-action-bar').exists()).toBe(false)
  })

  it('renders the bar with selected count text when selectedCount > 0', () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: { selectedCount: 3, actions }
    })
    expect(wrapper.find('.admin-bulk-action-bar').exists()).toBe(true)
    expect(wrapper.find('.admin-bulk-action-bar__count').text()).toContain('已选择 3 项')
  })

  it('renders one action button per action', () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: { selectedCount: 2, actions }
    })
    const buttons = wrapper.findAll('[data-test="n-button"]')
    expect(buttons).toHaveLength(2)
    expect(buttons[0].text()).toBe('批量停用')
    expect(buttons[1].text()).toBe('导出')
  })

  it('forwards action type to buttons', () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: { selectedCount: 2, actions }
    })
    const buttons = wrapper.findAll('[data-test="n-button"]')
    expect(buttons[0].attributes('data-type')).toBe('error')
    expect(buttons[1].attributes('data-type')).toBe('primary')
  })

  it('emits action event with action key when button clicked', async () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: { selectedCount: 2, actions }
    })
    const buttons = wrapper.findAll('[data-test="n-button"]')
    await buttons[0].trigger('click')
    expect(wrapper.emitted('action')).toEqual([['deactivate']])
  })

  it('emits action key for each respective button', async () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: { selectedCount: 2, actions }
    })
    const buttons = wrapper.findAll('[data-test="n-button"]')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('action')).toEqual([['export']])
  })

  it('disables action button when action.disabled is true', () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: {
        selectedCount: 2,
        actions: [{ key: 'deactivate', label: '批量停用', type: 'error' as const, disabled: true }]
      }
    })
    const button = wrapper.find('[data-test="n-button"]')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('renders action icon when provided', () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: {
        selectedCount: 1,
        actions: [{ key: 'export', label: '导出', type: 'primary' as const, icon: 'M12 4v16m8-8H4' }]
      }
    })
    expect(wrapper.find('.admin-bulk-action-bar__action-icon path').attributes('d')).toBe('M12 4v16m8-8H4')
  })

  it('uses 1.5px stroke width for action icon svg', () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: {
        selectedCount: 1,
        actions: [{ key: 'export', label: '导出', type: 'primary' as const, icon: 'M12 4v16m8-8H4' }]
      }
    })
    expect(wrapper.find('.admin-bulk-action-bar__action-icon svg').attributes('stroke-width')).toBe('1.5')
  })

  it('does not emit action when button is disabled and clicked', async () => {
    const wrapper = mount(AdminBulkActionBar, {
      props: {
        selectedCount: 1,
        actions: [{ key: 'deactivate', label: '批量停用', type: 'error' as const, disabled: true }]
      }
    })
    // disabled buttons won't fire native click; simulate by checking emits
    await wrapper.find('[data-test="n-button"]').trigger('click')
    // Native disabled buttons do not emit; ensure no action emitted
    expect(wrapper.emitted('action')).toBeUndefined()
  })
})
