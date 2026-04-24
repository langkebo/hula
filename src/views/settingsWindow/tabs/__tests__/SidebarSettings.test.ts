import { mount } from '@vue/test-utils'
import type { ComponentPublicInstance } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SidebarSettings from '../SidebarSettings.vue'

const messageSuccessMock = vi.fn()

type SidebarSettingsVm = ComponentPublicInstance & {
  showFavourites: boolean
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
    expect(wrapper.text()).toContain('显示收藏夹')
    expect(wrapper.text()).toContain('显示空间')
    expect(wrapper.text()).toContain('显示房间')
    expect(wrapper.text()).toContain('显示直接消息')
    expect(wrapper.text()).toContain('显示好友分组')
    expect(wrapper.text()).toContain('显示活跃线程')
  })

  it('loads settings from localStorage', () => {
    localStorage.setItem(
      'hula-sidebar-settings',
      JSON.stringify({
        showFavourites: false,
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
    expect(vm.showFavourites).toBe(false)
    expect(vm.showDirectMessages).toBe(false)
    expect(vm.showThreads).toBe(false)
    expect(vm.sortBy).toBe('alphabetical')
    expect(vm.itemSize).toBe('large')
  })

  it('saves settings to localStorage on toggle', () => {
    const wrapper = mount(SidebarSettings)
    const vm = getVm(wrapper)
    vm.showFavourites = false
    vm.saveSettings()
    const saved = JSON.parse(localStorage.getItem('hula-sidebar-settings')!)
    expect(saved.showFavourites).toBe(false)
  })

  it('defaults all display toggles to true', () => {
    const wrapper = mount(SidebarSettings)
    const vm = getVm(wrapper)
    expect(vm.showFavourites).toBe(true)
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
