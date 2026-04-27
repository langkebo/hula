import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LabsSettings from '../LabsSettings.vue'
import { MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH } from '../settingsRoutes'

const showToastMock = vi.fn()
const showConfirmDialogMock = vi.fn().mockResolvedValue(undefined)
const routerPushMock = vi.fn()

vi.mock('vant', () => ({
  showToast: (...args: any[]) => showToastMock(...args),
  showConfirmDialog: (...args: any[]) => showConfirmDialogMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
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

const VanCellStub = {
  name: 'VanCell',
  props: ['title', 'label', 'isLink'],
  template: `
    <div class="van-cell" @click="$emit('click')">
      <span class="van-cell__title">{{ title }}</span>
      <span v-if="label" class="van-cell__label">{{ label }}</span>
      <slot name="icon" />
      <slot name="value" />
      <slot name="right-icon" />
    </div>
  `
}

function mountComponent() {
  return mount(LabsSettings, {
    global: {
      stubs: {
        'van-cell-group': { template: '<div><slot /></div>' },
        'van-cell': VanCellStub,
        'van-tag': { template: '<span><slot /></span>', props: ['type', 'size'] },
        'van-switch': { template: '<button />', props: ['modelValue', 'size'] },
        'van-button': { template: '<button><slot /></button>', props: ['type', 'block', 'plain'] }
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

  it('has 8 lab features by default', () => {
    const wrapper = mountComponent()
    expect((wrapper.vm as any).labFeatures).toHaveLength(8)
  })

  it('custom-status and reactions are enabled by default', () => {
    const wrapper = mountComponent()
    const customStatus = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'custom-status')
    const reactions = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'reactions')
    expect(customStatus.enabled).toBe(true)
    expect(reactions.enabled).toBe(true)
  })

  it('saves feature toggle to localStorage', () => {
    const wrapper = mountComponent()
    const feature = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'threads')
    feature.enabled = true
    ;(wrapper.vm as any).handleToggleFeature(feature)
    const saved = JSON.parse(localStorage.getItem('hula-lab-features')!)
    expect(saved).toContain('threads')
  })

  it('loads feature states from localStorage', () => {
    localStorage.setItem('hula-lab-features', JSON.stringify(['threads', 'voip']))
    const wrapper = mountComponent()
    const threads = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'threads')
    const voip = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'voip')
    const spaces = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'spaces')
    expect(threads.enabled).toBe(true)
    expect(voip.enabled).toBe(true)
    expect(spaces.enabled).toBe(false)
  })

  it('debug mode is disabled by default', () => {
    const wrapper = mountComponent()
    expect((wrapper.vm as any).debugMode).toBe(false)
  })

  it('saves debug mode to localStorage', () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as any).handleDebugModeChange(true)
    expect(localStorage.getItem('hula-debug-mode')).toBe('true')
  })

  it('resets all features triggers dialog', () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as any).handleResetLabs()
    expect(showConfirmDialogMock).toHaveBeenCalled()
  })

  it('loads debug mode from localStorage', () => {
    localStorage.setItem('hula-debug-mode', 'true')
    const wrapper = mountComponent()
    expect((wrapper.vm as any).debugMode).toBe(true)
  })

  it('loads performance metrics from localStorage', () => {
    localStorage.setItem('hula-show-performance', 'true')
    const wrapper = mountComponent()
    expect((wrapper.vm as any).showPerformanceMetrics).toBe(true)
  })

  it('saves performance metrics to localStorage', () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as any).handlePerformanceChange(true)
    expect(localStorage.getItem('hula-show-performance')).toBe('true')
  })

  it('opens integrations from labs', () => {
    const wrapper = mountComponent()
    ;(wrapper.vm as any).openIntegrationsSettings()
    expect(routerPushMock).toHaveBeenCalledWith(MOBILE_SETTINGS_LABS_INTEGRATIONS_PATH)
  })
})
