import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import EmptyState from '@/components/common/EmptyState.vue'

// EmptyState 内部 import { Icon } from '@iconify/vue'，这里 stub 掉以隔离外部依赖
vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    template: '<i class="iconify-icon" />'
  }
}))

describe('EmptyState no-spaces illustration', () => {
  it('renders no-spaces illustration', () => {
    const wrapper = mount(EmptyState, {
      props: { illustration: 'no-spaces', title: '暂无空间' }
    })
    expect(wrapper.find('[data-testid="illustration-no-spaces"]').exists()).toBe(true)
  })

  it('emits create when action clicked', async () => {
    const wrapper = mount(EmptyState, {
      props: { illustration: 'no-spaces', title: '暂无空间', actionText: '创建空间' }
    })
    await wrapper.find('[data-testid="empty-action"]').trigger('click')
    expect(wrapper.emitted('action')).toBeTruthy()
  })
})
