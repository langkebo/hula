import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import KeyboardSettings from '../KeyboardSettings.vue'

const messageSuccessMock = vi.fn()
const setGlobalShortcutEnabledMock = vi.fn()
const setScreenshotShortcutMock = vi.fn()
const setOpenMainPanelShortcutMock = vi.fn()
const resetGlobalShortcutsMock = vi.fn()

const translationMap: Record<string, string> = {
  'setting.keyboard.global_title': '全局快捷键',
  'setting.keyboard.global_label': '启用全局快捷键',
  'setting.keyboard.global_desc': '在应用未激活时也能使用快捷键',
  'setting.keyboard.list_title': '快捷键列表',
  'setting.keyboard.custom_title': '自定义快捷键',
  'setting.keyboard.screenshot_label': '截图快捷键',
  'setting.keyboard.screenshot_desc': '设置截图功能的快捷键',
  'setting.keyboard.open_main_panel_label': '打开主面板',
  'setting.keyboard.open_main_panel_desc': '设置打开主面板的快捷键',
  'setting.keyboard.reset': '恢复默认快捷键',
  'setting.keyboard.edit_title': '编辑快捷键',
  'setting.keyboard.edit_hint': '请按下新的快捷键组合...',
  'setting.keyboard.enabled': '已启用全局快捷键',
  'setting.keyboard.disabled': '已禁用全局快捷键',
  'setting.keyboard.updated': '快捷键已更新',
  'setting.keyboard.reset_success': '快捷键已恢复默认设置',
  'setting.keyboard.actions.send_message': '发送消息',
  'setting.keyboard.actions.new_line': '换行',
  'setting.keyboard.actions.search': '搜索',
  'setting.keyboard.actions.new_session': '新建会话',
  'setting.keyboard.actions.close_session': '关闭会话',
  'setting.keyboard.actions.settings': '设置',
  'setting.keyboard.actions.quit_app': '退出应用',
  'setting.keyboard.actions.fullscreen': '全屏',
  'setting.keyboard.descriptions.send_message': '在聊天窗口发送消息',
  'setting.keyboard.descriptions.new_line': '在输入框中换行',
  'setting.keyboard.descriptions.search': '打开搜索面板',
  'setting.keyboard.descriptions.new_session': '创建新的会话或房间',
  'setting.keyboard.descriptions.close_session': '关闭当前会话标签',
  'setting.keyboard.descriptions.settings': '打开设置窗口',
  'setting.keyboard.descriptions.quit_app': '退出桌面应用',
  'setting.keyboard.descriptions.fullscreen': '切换全屏显示'
}

type KeyboardSettingsVm = ComponentPublicInstance & {
  globalEnabled: boolean
  shortcutsStore: { screenshot: string; openMainPanel: string }
  shortcuts: Array<{ action: string; description: string; keys: string[] }>
  editingShortcut: boolean
  currentEditingType: string
  currentEditingKeys: string[]
  handleGlobalShortcutChange: (value: boolean) => void
  handleEditShortcut: (type: string) => void
  resetShortcuts: () => void
}

type MockSettingStore = {
  screenshotShortcut: string
  openMainPanelShortcut: string
  globalShortcutEnabled: boolean
  setGlobalShortcutEnabled: (enabled: boolean) => void
  setScreenshotShortcut: (shortcut: string) => void
  setOpenMainPanelShortcut: (shortcut: string) => void
  resetGlobalShortcuts: () => void
}

let mockStore: MockSettingStore

vi.mock('naive-ui', () => ({
  NButton: { name: 'NButton', template: '<button><slot /></button>', props: ['loading'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NInput: { name: 'NInput', template: '<input />', props: ['value', 'readonly'] },
  NModal: { name: 'NModal', template: '<div class="n-modal"><slot /></div>', props: ['show', 'preset', 'title'] },
  useMessage: () => ({ success: messageSuccessMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => translationMap[key] ?? key
  })
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => mockStore
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMac: () => false
}))

describe('KeyboardSettings', () => {
  const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as KeyboardSettingsVm

  beforeEach(() => {
    vi.clearAllMocks()

    mockStore = {
      screenshotShortcut: 'Ctrl+Alt+H',
      openMainPanelShortcut: 'Ctrl+Alt+P',
      globalShortcutEnabled: false,
      setGlobalShortcutEnabled: (enabled: boolean) => {
        mockStore.globalShortcutEnabled = enabled
        setGlobalShortcutEnabledMock(enabled)
      },
      setScreenshotShortcut: (shortcut: string) => {
        mockStore.screenshotShortcut = shortcut
        setScreenshotShortcutMock(shortcut)
      },
      setOpenMainPanelShortcut: (shortcut: string) => {
        mockStore.openMainPanelShortcut = shortcut
        setOpenMainPanelShortcutMock(shortcut)
      },
      resetGlobalShortcuts: () => {
        mockStore.screenshotShortcut = 'Ctrl+Alt+H'
        mockStore.openMainPanelShortcut = 'Ctrl+Alt+P'
        resetGlobalShortcutsMock()
      }
    }
  })

  it('renders translated sections and shortcut list', () => {
    const wrapper = mount(KeyboardSettings)
    const vm = getVm(wrapper)

    expect(wrapper.find('.keyboard-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('全局快捷键')
    expect(wrapper.text()).toContain('快捷键列表')
    expect(wrapper.text()).toContain('自定义快捷键')
    expect(vm.shortcuts).toHaveLength(8)
    expect(vm.shortcuts[0].action).toBe('发送消息')
  })

  it('loads shortcut values from store', () => {
    mockStore.globalShortcutEnabled = true
    mockStore.screenshotShortcut = 'Ctrl+Shift+S'

    const wrapper = mount(KeyboardSettings)
    const vm = getVm(wrapper)

    expect(vm.globalEnabled).toBe(true)
    expect(vm.shortcutsStore.screenshot).toBe('Ctrl+Shift+S')
    expect(vm.shortcutsStore.openMainPanel).toBe('Ctrl+Alt+P')
  })

  it('updates global shortcut switch through store', () => {
    const wrapper = mount(KeyboardSettings)
    const vm = getVm(wrapper)

    vm.handleGlobalShortcutChange(true)

    expect(setGlobalShortcutEnabledMock).toHaveBeenCalledWith(true)
    expect(messageSuccessMock).toHaveBeenCalledWith('已启用全局快捷键')
  })

  it('opens shortcut editor and updates screenshot shortcut on keydown', async () => {
    const wrapper = mount(KeyboardSettings)
    const vm = getVm(wrapper)

    vm.handleEditShortcut('screenshot')
    expect(vm.editingShortcut).toBe(true)
    expect(vm.currentEditingType).toBe('screenshot')

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        shiftKey: true,
        bubbles: true
      })
    )

    expect(vm.shortcutsStore.screenshot).toBe('Ctrl+Shift+K')
    expect(setScreenshotShortcutMock).toHaveBeenCalledWith('Ctrl+Shift+K')
    expect(vm.editingShortcut).toBe(false)
    expect(messageSuccessMock).toHaveBeenCalledWith('快捷键已更新')
  })

  it('updates main panel shortcut on keydown', () => {
    const wrapper = mount(KeyboardSettings)
    const vm = getVm(wrapper)

    vm.handleEditShortcut('openMainPanel')

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'p',
        ctrlKey: true,
        altKey: true,
        bubbles: true
      })
    )

    expect(vm.shortcutsStore.openMainPanel).toBe('Ctrl+Alt+P')
    expect(setOpenMainPanelShortcutMock).toHaveBeenCalledWith('Ctrl+Alt+P')
    expect(messageSuccessMock).toHaveBeenCalledWith('快捷键已更新')
  })

  it('resets shortcuts to defaults', () => {
    const wrapper = mount(KeyboardSettings)
    const vm = getVm(wrapper)

    vm.shortcutsStore.screenshot = 'Ctrl+Shift+S'
    vm.shortcutsStore.openMainPanel = 'Ctrl+Shift+P'
    vm.resetShortcuts()

    expect(vm.shortcutsStore.screenshot).toBe('Ctrl+Alt+H')
    expect(vm.shortcutsStore.openMainPanel).toBe('Ctrl+Alt+P')
    expect(resetGlobalShortcutsMock).toHaveBeenCalled()
    expect(messageSuccessMock).toHaveBeenCalledWith('快捷键已恢复默认设置')
  })

  it('removes keydown listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
    const wrapper = mount(KeyboardSettings)

    wrapper.unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    removeEventListenerSpy.mockRestore()
  })
})
