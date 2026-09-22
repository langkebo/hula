import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import LabsSettings from '../LabsSettings.vue'
import { MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH } from '../settingsRoutes'

const routerPushMock = vi.fn()

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPushMock })
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

const VanCellStub = defineComponent({
  name: 'VanCell',
  props: ['title', 'label', 'isLink'],
  emits: ['click'],
  template: `<div class="van-cell" @click="$emit('click')">
    <span class="van-cell__title">{{ title }}</span>
    <span v-if="label" class="van-cell__label">{{ label }}</span>
    <slot name="icon" />
    <slot name="value" />
    <slot name="right-icon" />
  </div>`
})

function mountComponent() {
  return mount(LabsSettings, {
    global: {
      stubs: {
        'van-cell-group': { template: '<div><slot /></div>' },
        'van-cell': VanCellStub,
        'van-tag': { template: '<span><slot /></span>', props: ['type', 'size'] }
      }
    }
  })
}

describe('LabsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders correctly', () => {
    const wrapper = mountComponent()
    expect(wrapper.html()).toBeTruthy()
  })

  it('不再渲染零消费方的实验特性/调试/性能开关', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).not.toContain('mobile_labs.features.threads')
    expect(wrapper.text()).not.toContain('mobile_labs.features.reactions')
    expect(wrapper.text()).not.toContain('mobile_labs.debug_mode')
    expect(wrapper.text()).not.toContain('mobile_labs.show_performance')
    expect(wrapper.text()).not.toContain('mobile_labs.reset')
    expect(wrapper.find('van-switch').exists()).toBe(false)
  })

  it('切换页面内所有控件后不写死 labs key', async () => {
    const wrapper = mountComponent()

    for (const cell of wrapper.findAll('.van-cell')) {
      await cell.trigger('click')
    }

    expect(localStorage.getItem('tjg-lab-features')).toBeNull()
    expect(localStorage.getItem('tjg-debug-mode')).toBeNull()
    expect(localStorage.getItem('tjg-show-performance')).toBeNull()
  })

  it('保留到 Integrations 的入口与路由跳转', async () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('mobile_setting.integrations')
    await wrapper.find('.van-cell').trigger('click')

    expect(routerPushMock).toHaveBeenCalledWith(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)
  })
})
