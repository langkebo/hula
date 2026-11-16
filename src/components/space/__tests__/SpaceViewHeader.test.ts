import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SpaceViewHeader from '../SpaceViewHeader.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

const mountHeader = () =>
  mount(SpaceViewHeader, {
    props: {
      spaces: [],
      currentSpaceId: '',
      showSwitcher: false
    }
  })

describe('SpaceViewHeader', () => {
  it('渲染发现公开空间入口并触发 discover 事件', async () => {
    const wrapper = mountHeader()
    const button = wrapper.get('[data-testid="space-discover-btn"]')

    expect(button.attributes('aria-label')).toBe('space.discover.title')
    expect(button.find('svg').exists()).toBe(true)

    await button.trigger('click')
    expect(wrapper.emitted('discover')).toHaveLength(1)
  })
})
