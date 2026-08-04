import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LabsSettings from '../LabsSettings.vue'

const messageSuccessMock = vi.fn()
const messageInfoMock = vi.fn()
const dialogWarningMock = vi.fn()
const translationMap: Record<string, string> = {
  'setting.labs.experimental_section': '实验功能',
  'setting.labs.experimental_desc': '这些功能正在开发中，可能不稳定。启用后请谨慎使用，如有问题请反馈。',
  'setting.labs.status_beta': 'Beta',
  'setting.labs.status_alpha': 'Alpha',
  'setting.labs.status_experimental': '实验中',
  'setting.labs.developer_options': '开发者选项',
  'setting.labs.debug_mode': '调试模式',
  'setting.labs.debug_mode_desc': '启用详细的调试日志和开发者工具',
  'setting.labs.show_performance': '显示性能指标',
  'setting.labs.show_performance_desc': '在界面上显示性能统计信息',
  'setting.labs.enable_devtools': '启用 React DevTools',
  'setting.labs.enable_devtools_desc': '允许使用 React 开发者工具检查组件',
  'setting.labs.reset_section': '重置实验功能',
  'setting.labs.reset_all': '重置所有实验功能为默认状态',
  'setting.labs.features.threads.name': '消息线程',
  'setting.labs.features.threads.description': '支持在消息中创建线程讨论，便于组织对话',
  'setting.labs.features.spaces.name': '空间功能',
  'setting.labs.features.spaces.description': '将相关房间组织到空间中，便于管理社区和项目',
  'setting.labs.features.voip.name': '语音视频通话',
  'setting.labs.features.voip.description': '支持一对一和群组语音视频通话',
  'setting.labs.features.voip.warning': '此功能仍在早期开发阶段，可能存在稳定性问题',
  'setting.labs.features.widget.name': '小部件支持',
  'setting.labs.features.widget.description': '在房间中嵌入第三方应用和工具',
  'setting.labs.features.custom-status.name': '自定义状态消息',
  'setting.labs.features.custom-status.description': '设置自定义状态消息和过期时间',
  'setting.labs.features.message-editing.name': '消息编辑历史',
  'setting.labs.features.message-editing.description': '查看和恢复消息的编辑历史',
  'setting.labs.features.reactions.name': '消息反应',
  'setting.labs.features.reactions.description': '对消息添加表情反应',
  'setting.labs.features.read-receipts.name': '已读回执详情',
  'setting.labs.features.read-receipts.description': '查看谁已阅读消息的详细信息',
  'setting.labs.reset_dialog.title': '重置实验功能',
  'setting.labs.reset_dialog.content': '确定要将所有实验功能重置为默认状态吗？',
  'setting.labs.reset_dialog.confirm': '确定重置',
  'setting.labs.feedback.feature_enabled': '已启用 {name}',
  'setting.labs.feedback.feature_disabled': '已禁用 {name}',
  'setting.labs.feedback.debug_mode_enabled': '调试模式已启用',
  'setting.labs.feedback.debug_mode_disabled': '调试模式已禁用',
  'setting.labs.feedback.performance_metrics_shown': '性能指标已显示',
  'setting.labs.feedback.performance_metrics_hidden': '性能指标已隐藏',
  'setting.labs.feedback.devtools_enabled': 'DevTools 已启用',
  'setting.labs.feedback.devtools_disabled': 'DevTools 已禁用',
  'setting.labs.feedback.reset_success': '所有实验功能已重置',
  'common.cancel': '取消'
}

vi.mock('naive-ui', () => ({
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NModal: {
    name: 'NModal',
    template: '<div class="n-modal"><slot /></div>',
    props: ['show', 'title', 'positiveText', 'negativeText', 'maskClosable'],
    emits: ['update:show', 'positiveClick', 'negativeClick']
  },
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

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const template = translationMap[key] ?? key
      if (!params) return template
      return Object.entries(params).reduce(
        (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value)),
        template
      )
    }
  })
}))

describe('LabsSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window as any).$message = { success: messageSuccessMock, info: messageInfoMock }
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
    const vm = wrapper.vm as any
    vm.handleToggleFeature('threads', true)
    const saved = localStorage.getItem('tjg-lab-features')
    expect(saved).toBeTruthy()
    const parsed = JSON.parse(saved!)
    expect(parsed).toContain('threads')
    expect(messageSuccessMock).toHaveBeenCalledWith('已启用 消息线程')
  })

  it('loads feature states from localStorage', () => {
    localStorage.setItem('tjg-lab-features', JSON.stringify(['threads', 'custom-status']))
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
    expect(localStorage.getItem('tjg-debug-mode')).toBe('true')
    expect(messageSuccessMock).toHaveBeenCalledWith('调试模式已启用')
  })
})
