import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LabsSettings from '../LabsSettings.vue'

const messageSuccessMock = vi.fn()
const messageInfoMock = vi.fn()
const dialogWarningMock = vi.fn()

vi.mock('naive-ui', () => ({
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NTag: { name: 'NTag', template: '<span class="n-tag"><slot /></span>', props: ['type', 'size'] },
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['size', 'type'] },
  NAlert: { name: 'NAlert', template: '<div><slot /></div>', props: ['type'] },
  NSpin: { name: 'NSpin', template: '<div class="n-spin"><slot /></div>', props: ['show'] },
  useMessage: () => ({ success: messageSuccessMock, info: messageInfoMock }),
  useDialog: () => ({ warning: dialogWarningMock })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width'] }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() })
}))

describe('LabsSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders correctly', () => {
    const wrapper = mount(LabsSettings)
    expect(wrapper.find('.labs-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('实验功能')
  })

  it('shows core features', () => {
    const wrapper = mount(LabsSettings)
    expect(wrapper.text()).toContain('消息线程')
    expect(wrapper.text()).toContain('空间功能')
    expect(wrapper.text()).toContain('消息反应')
  })

  it('shows alpha features with warnings', () => {
    const wrapper = mount(LabsSettings)
    expect(wrapper.text()).toContain('语音视频通话')
  })

  it('has 8 lab features defined', () => {
    const wrapper = mount(LabsSettings)
    expect((wrapper.vm as any).labFeatures).toHaveLength(8)
  })

  it('some features enabled by default', () => {
    const wrapper = mount(LabsSettings)
    const customStatus = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'custom-status')
    const reactions = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'reactions')
    expect(customStatus.enabled).toBe(true)
    expect(reactions.enabled).toBe(true)
  })

  it('most features disabled by default', () => {
    const wrapper = mount(LabsSettings)
    const threads = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'threads')
    const voip = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'voip')
    expect(threads.enabled).toBe(false)
    expect(voip.enabled).toBe(false)
  })

  it('saves feature states to localStorage on toggle', () => {
    const wrapper = mount(LabsSettings)
    const threads = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'threads')
    threads.enabled = true
    const vm = wrapper.vm as any
    vm.handleToggleFeature(threads)
    const saved = localStorage.getItem('hula-lab-features')
    expect(saved).toBeTruthy()
    const parsed = JSON.parse(saved!)
    expect(parsed).toContain('threads')
  })

  it('loads feature states from localStorage', () => {
    localStorage.setItem('hula-lab-features', JSON.stringify(['threads', 'custom-status']))
    const wrapper = mount(LabsSettings)
    const customStatus = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'custom-status')
    const spaces = (wrapper.vm as any).labFeatures.find((f: any) => f.id === 'spaces')
    expect(customStatus.enabled).toBe(true)
    expect(spaces.enabled).toBe(false)
  })

  it('reset to defaults triggers dialog', () => {
    const wrapper = mount(LabsSettings)
    const vm = wrapper.vm as any
    vm.handleResetLabs()
    expect(dialogWarningMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '重置实验功能'
      })
    )
  })

  it('developer options are disabled by default', () => {
    const wrapper = mount(LabsSettings)
    expect((wrapper.vm as any).debugMode).toBe(false)
    expect((wrapper.vm as any).showPerformanceMetrics).toBe(false)
    expect((wrapper.vm as any).enableDevTools).toBe(false)
  })

  it('saves debug mode to localStorage', () => {
    const wrapper = mount(LabsSettings)
    const vm = wrapper.vm as any
    vm.handleDebugModeChange(true)
    expect(localStorage.getItem('hula-debug-mode')).toBe('true')
    expect(messageSuccessMock).toHaveBeenCalled()
  })
})
