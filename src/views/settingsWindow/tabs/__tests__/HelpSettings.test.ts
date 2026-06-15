import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import HelpSettings from '../HelpSettings.vue'

const messageSuccessMock = vi.fn()
const messageErrorMock = vi.fn()
const messageInfoMock = vi.fn()
const getVersionMock = vi.fn()
const getTauriVersionMock = vi.fn()
const openShellMock = vi.fn()
const appDataDirMock = vi.fn()

let isDesktopPlatformMock = false

const translationMap: Record<string, string> = {
  'setting.help_about.about': '关于',
  'setting.help_about.version': '版本',
  'setting.help_about.matrix_sdk_version': 'Matrix SDK 版本',
  'setting.help_about.check_update': '检查更新',
  'setting.help_about.current_version': '当前版本',
  'setting.help_about.checking': '检查中',
  'setting.help_about.new_version_found': '发现新版本 {version}',
  'setting.help_about.update_now': '立即更新',
  'setting.help_about.up_to_date': '当前已是最新版本',
  'setting.help_about.links': '相关链接',
  'setting.help_about.matrix_website': 'Matrix 官网',
  'setting.help_about.matrix_spec': 'Matrix 规范',
  'setting.help_about.project_home': '项目主页',
  'setting.help_about.synapse_docs': 'Synapse 文档',
  'setting.help_about.support': '支持与反馈',
  'setting.help_about.submit_feedback': '提交反馈',
  'setting.help_about.feedback_desc': '反馈问题或提出建议',
  'setting.help_about.feedback_action': '去反馈',
  'setting.help_about.view_logs': '查看日志',
  'setting.help_about.view_logs_desc': '打开应用日志目录',
  'setting.help_about.open': '打开',
  'setting.help_about.technical_info': '技术信息',
  'setting.help_about.runtime_platform': '运行平台',
  'setting.help_about.tauri_version': 'Tauri 版本',
  'setting.help_about.vue_version': 'Vue 版本',
  'setting.help_about.platform_desktop': '桌面端',
  'setting.help_about.platform_web': 'Web',
  'setting.help_about.check_update_failed': '检查更新失败',
  'setting.help_about.open_logs_failed': '打开日志目录失败',
  'setting.help_about.open_logs_unsupported': '当前平台不支持打开日志目录'
}

type HelpSettingsVm = ComponentPublicInstance & {
  appVersion: string
  sdkVersion: string
  vueVersion: string
  tauriVersion: string
  platform: string
  checkingUpdate: boolean
  updateInfo: { hasUpdate: boolean; latestVersion: string } | null
  handleCheckUpdate: () => Promise<void>
  handleDownloadUpdate: () => void
  openLink: (url: string) => void
  handleFeedback: () => void
  handleOpenLogs: () => Promise<void>
}

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    template: '<button><slot /><slot name="icon" /></button>',
    props: ['size', 'type', 'loading']
  },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NModal: {
    name: 'NModal',
    template: '<div class="n-modal"><slot /></div>',
    props: ['show', 'title', 'positiveText', 'negativeText', 'maskClosable'],
    emits: ['update:show', 'positiveClick', 'negativeClick']
  },
  useMessage: () => ({ success: messageSuccessMock, error: messageErrorMock, info: messageInfoMock })
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'class'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const template = translationMap[key] ?? key
      if (!params) return template
      return Object.entries(params).reduce(
        (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), value),
        template
      )
    }
  })
}))

vi.mock('@/composables/usePlatform', () => ({
  usePlatform: () => ({ isDesktop: isDesktopPlatformMock })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() })
}))

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: (...args: unknown[]) => getVersionMock(...args),
  getTauriVersion: (...args: unknown[]) => getTauriVersionMock(...args)
}))

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (...args: unknown[]) => openShellMock(...args)
}))

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: (...args: unknown[]) => appDataDirMock(...args)
}))

describe('HelpSettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as HelpSettingsVm
  const fetchMock = vi.fn()
  const openWindowMock = vi.fn()

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    ;(window as any).$message = { success: messageSuccessMock, error: messageErrorMock, info: messageInfoMock }
    isDesktopPlatformMock = false

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        version: '2.3.4',
        dependencies: {
          'matrix-js-sdk': '^39.1.0',
          vue: '^3.5.13'
        }
      })
    })
    globalThis.fetch = fetchMock as typeof fetch

    getVersionMock.mockResolvedValue('9.9.9')
    getTauriVersionMock.mockResolvedValue('2.1.0')
    appDataDirMock.mockResolvedValue('/tmp/hula')
    openShellMock.mockResolvedValue(undefined)

    vi.stubGlobal('open', openWindowMock)
  })

  it('loads package and platform info for web mode', async () => {
    const wrapper = mount(HelpSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    expect(wrapper.find('.help-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('关于')
    expect(wrapper.text()).toContain('相关链接')
    expect(vm.platform).toBe('Web')
    expect(vm.appVersion).toBe('2.3.4')
    expect(vm.sdkVersion).toBe('39.1.0')
    expect(vm.vueVersion).toBe('3.5.13')
    expect(vm.tauriVersion).toBe('-')
  })

  it('loads desktop platform branch when running on desktop', async () => {
    isDesktopPlatformMock = true

    const wrapper = mount(HelpSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    expect(vm.platform).toBe('桌面端')
  })

  it('checks update and reports latest status', async () => {
    vi.useFakeTimers()
    const wrapper = mount(HelpSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    const promise = vm.handleCheckUpdate()
    expect(vm.checkingUpdate).toBe(true)

    await vi.advanceTimersByTimeAsync(1500)
    await promise

    expect(vm.checkingUpdate).toBe(false)
    expect(vm.updateInfo).toEqual({ hasUpdate: false, latestVersion: '2.3.4' })
    expect(messageSuccessMock).toHaveBeenCalledWith('当前已是最新版本')
    vi.useRealTimers()
  })

  it('opens project-related links in a new window', async () => {
    const wrapper = mount(HelpSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    vm.openLink('https://matrix.org')
    vm.handleDownloadUpdate()
    vm.handleFeedback()

    expect(openShellMock).toHaveBeenNthCalledWith(1, 'https://matrix.org')
    expect(openShellMock).toHaveBeenNthCalledWith(2, 'https://github.com/nichuanfang/nichuanfang.github.io/releases')
    expect(openShellMock).toHaveBeenNthCalledWith(3, 'https://github.com/nichuanfang/nichuanfang.github.io/issues')
    expect(openWindowMock).not.toHaveBeenCalled()
  })

  it('shows info when opening logs is unsupported on web', async () => {
    const wrapper = mount(HelpSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    await vm.handleOpenLogs()

    expect(messageInfoMock).toHaveBeenCalledWith('当前平台不支持打开日志目录')
  })

  it('opens app data directory on desktop', async () => {
    isDesktopPlatformMock = true
    const wrapper = mount(HelpSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    await vm.handleOpenLogs()

    expect(appDataDirMock).toHaveBeenCalledTimes(1)
    expect(openShellMock).toHaveBeenCalledWith('/tmp/hula')
  })

  it('shows error when opening logs fails on desktop', async () => {
    isDesktopPlatformMock = true
    openShellMock.mockRejectedValueOnce(new Error('boom'))

    const wrapper = mount(HelpSettings)
    await flushPromises()

    const vm = getVm(wrapper)
    await vm.handleOpenLogs()

    expect(messageErrorMock).toHaveBeenCalledWith('打开日志目录失败')
  })
})
