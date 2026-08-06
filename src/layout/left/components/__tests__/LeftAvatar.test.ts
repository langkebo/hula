import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock heavy dependencies so we can focus on the right-click → open menu wiring
vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

vi.mock('@/composables/common/useOnlineStatus', () => ({
  useOnlineStatus: () => ({
    statusIcon: '/mocked-status.png',
    statusTitle: '在线',
    statusBgColor: 'rgba(0,0,0,0.2)'
  })
}))

vi.mock('@/stores/domains/chat/group', () => ({
  useGroupStore: () => ({
    getUserInfo: vi.fn(() => null)
  })
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({
    userInfo: {
      name: 'Tester',
      account: '@tester:matrix.test',
      uid: '@tester:matrix.test',
      avatar: 'mocked'
    }
  })
}))

vi.mock('@/components/userMenu/UserMenuDropdown.vue', () => ({
  default: {
    name: 'UserMenuDropdownStub',
    template: '<div data-test="user-menu-dropdown"></div>',
    props: ['position', 'isContextMenu']
  }
}))

// Spy holder — vi.hoisted ensures it exists before any vi.mock factory runs
const { openMenuSpy, toggleMenuSpy } = vi.hoisted(() => ({
  openMenuSpy: vi.fn(),
  toggleMenuSpy: vi.fn()
}))

// Mock useUserMenu — spies let us assert the component calls openMenu on right-click
vi.mock('@/components/userMenu/useUserMenu', () => ({
  useUserMenu: () => ({
    isOpen: { value: false },
    position: { value: null },
    isContextMenu: { value: false },
    closeMenu: vi.fn(),
    handleMenuItemClick: vi.fn(),
    openMenu: openMenuSpy,
    toggleMenu: toggleMenuSpy
  })
}))

// Mock leftHook — return minimal shape needed by LeftAvatar
vi.mock('../hook', () => ({
  leftHook: () => ({
    shrinkStatus: false,
    infoShow: false,
    themeColor: 'rgba(0,0,0,0.2)',
    openContent: vi.fn(),
    handleEditing: vi.fn()
  })
}))

import { nextTick } from 'vue'
import LeftAvatar from '../LeftAvatar.vue'

describe('LeftAvatar — C-2 用户菜单可访问性', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    openMenuSpy.mockClear()
    toggleMenuSpy.mockClear()
  })

  it('右键点击头像应调用 openMenu(pos, "right") 打开用户菜单', async () => {
    const wrapper = mount(LeftAvatar, {
      global: {
        stubs: {
          NPopover: {
            name: 'Popover',
            template: '<div><slot name="trigger" /><slot /></div>'
          },
          TjgAvatar: { name: 'TjgAvatar', template: '<div class="tjg-avatar-stub"></div>' },
          NFlex: { name: 'Flex', template: '<div class="n-flex"><slot /></div>' },
          NButton: { name: 'Button', template: '<button><slot /></button>' },
          NImage: { name: 'Image', template: '<img />' },
          NImageGroup: { name: 'ImageGroup', template: '<div><slot /></div>' }
        }
      }
    })

    // 头像触发器：n-popover #trigger 内的 div.relative
    const avatarTrigger = wrapper.find('.relative.size-34px')
    expect(avatarTrigger.exists()).toBe(true)

    await avatarTrigger.trigger('contextmenu', { clientX: 100, clientY: 200 })
    await nextTick()

    expect(openMenuSpy).toHaveBeenCalledTimes(1)
    expect(openMenuSpy).toHaveBeenCalledWith({ x: 100, y: 200 }, 'right')
  })
})
