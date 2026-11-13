import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import IntegrationsSettings from '../IntegrationsSettings.vue'

const { showToastMock } = vi.hoisted(() => ({ showToastMock: vi.fn() }))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vant', () => ({
  showToast: (...args: any[]) => showToastMock(...args)
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

const VanCellStub = defineComponent({
  name: 'VanCell',
  props: ['title', 'label', 'isLink', 'clickable', 'disabled'],
  template: `<div class="van-cell" data-testid="integrations-unavailable" @click="$emit('click')">
    <span class="van-cell__title">{{ title }}</span>
    <span v-if="label" class="van-cell__label">{{ label }}</span>
    <slot name="icon" />
    <slot name="value" />
  </div>`
})

function mountPage() {
  return mount(IntegrationsSettings, {
    global: {
      stubs: {
        'van-cell-group': { template: '<div><slot /></div>' },
        'van-cell': VanCellStub,
        'van-tag': { template: '<span><slot /></span>', props: ['type', 'size'] }
      }
    }
  })
}

describe('IntegrationsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('渲染未上线状态而非伪集成开关', () => {
    const wrapper = mountPage()

    expect(wrapper.find('[data-testid="integrations-unavailable"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('mobile_integrations.unavailable_title')
    expect(wrapper.text()).toContain('mobile_integrations.unavailable_badge')
    expect(wrapper.find('van-switch').exists()).toBe(false)
  })

  it('不会执行假的保存流程，也不写本地存储', async () => {
    vi.useFakeTimers()
    const wrapper = mountPage()

    await wrapper.find('[data-testid="integrations-unavailable"]').trigger('click')
    vi.advanceTimersByTime(2000)

    expect(localStorage.length).toBe(0)
    expect(showToastMock).not.toHaveBeenCalled()
  })
})
