import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentPublicInstance } from 'vue'
import SidebarSettings from '../SidebarSettings.vue'

const messageSuccessMock = vi.fn()
const translationMap: Record<string, string> = {
  'setting.sidebar.display_content': '显示内容',
  'setting.sidebar.sort_by': '排序方式',
  'setting.sidebar.list_item_size': '列表项大小',
  'setting.sidebar.show_spaces': '显示空间',
  'setting.sidebar.show_rooms': '显示房间',
  'setting.sidebar.show_direct_messages': '显示直接消息',
  'setting.sidebar.show_friends': '显示好友分组',
  'setting.sidebar.show_threads': '显示活跃线程',
  'setting.sidebar.sort_options.recent': '最近活动',
  'setting.sidebar.sort_options.alphabetical': '按字母顺序',
  'setting.sidebar.sort_options.manual': '手动排序',
  'setting.sidebar.size_small': '小',
  'setting.sidebar.size_medium': '中',
  'setting.sidebar.size_large': '大'
}

type SidebarSettingsVm = ComponentPublicInstance & {
  showSpaces: boolean
  showRooms: boolean
  showDirectMessages: boolean
  showFriends: boolean
  showThreads: boolean
  sortBy: string
  itemSize: string
  saveSettings: () => void
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as SidebarSettingsVm

vi.mock('naive-ui', () => ({
  NSwitch: { name: 'NSwitch', template: '<div class="n-switch" />', props: ['value'] },
  NDivider: { name: 'NDivider', template: '<hr />' },
  NSelect: { name: 'NSelect', template: '<div class="n-select" />', props: ['value', 'options'] },
  useMessage: () => ({ success: messageSuccessMock })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (!params) {
        return translationMap[key] ?? key
      }

      return Object.entries(params).reduce(
        (message, [name, value]) => message.replace(new RegExp(`\\{${name}\\}`, 'g'), value),
        translationMap[key] ?? key
      )
    }
  })
}))

describe('SidebarSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('renders correctly', () => {
    const wrapper = mount(SidebarSettings)
    expect(wrapper.find('.sidebar-settings').exists()).toBe(true)
    expect(wrapper.text()).toContain('显示内容')
    expect(wrapper.text()).toContain('排序方式')
    expect(wrapper.text()).toContain('列表项大小')
  })

  it('shows all display toggles', () => {
    const wrapper = mount(SidebarSettings)
    expect(wrapper.text()).toContain('显示空间')
    expect(wrapper.text()).toContain('显示房间')
    expect(wrapper.text()).toContain('显示直接消息')
    expect(wrapper.text()).toContain('显示好友分组')
    expect(wrapper.text()).toContain('显示活跃线程')
  })

  it('loads settings from localStorage', () => {
    localStorage.setItem(
      'tjg-sidebar-settings',
      JSON.stringify({
        showSpaces: true,
        showRooms: true,
        showDirectMessages: false,
        showFriends: true,
        showThreads: false,
        sortBy: 'alphabetical',
        itemSize: 'large'
      })
    )
    const wrapper = mount(SidebarSettings)
    const vm = getVm(wrapper)
    expect(vm.showDirectMessages).toBe(false)
    expect(vm.showThreads).toBe(false)
    expect(vm.sortBy).toBe('alphabetical')
    expect(vm.itemSize).toBe('large')
  })

  it('saves settings to localStorage on toggle', () => {
    const wrapper = mount(SidebarSettings)
    const vm = getVm(wrapper)
    vm.showSpaces = false
    vm.saveSettings()
    const saved = JSON.parse(localStorage.getItem('tjg-sidebar-settings')!)
    expect(saved.showSpaces).toBe(false)
  })

  it('defaults all display toggles to true', () => {
    const wrapper = mount(SidebarSettings)
    const vm = getVm(wrapper)
    expect(vm.showSpaces).toBe(true)
    expect(vm.showRooms).toBe(true)
    expect(vm.showDirectMessages).toBe(true)
    expect(vm.showFriends).toBe(true)
    expect(vm.showThreads).toBe(true)
  })

  it('defaults sortBy to activity', () => {
    const wrapper = mount(SidebarSettings)
    expect(getVm(wrapper).sortBy).toBe('activity')
  })

  it('defaults itemSize to medium', () => {
    const wrapper = mount(SidebarSettings)
    expect(getVm(wrapper).itemSize).toBe('medium')
  })
})
