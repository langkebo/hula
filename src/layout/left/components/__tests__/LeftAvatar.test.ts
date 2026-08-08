import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

// 渲染 NPopover / NFlex 的 trigger + default 插槽，便于断言气泡主体内容
const { passthrough, openMenuSpy, toggleMenuSpy, logoutSpy } = vi.hoisted(() => {
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup:
        (_, { slots }) =>
        () =>
          h('div', { 'data-test': name }, [...(slots.trigger?.() ?? []), ...(slots.default?.() ?? [])])
    })
  return {
    passthrough,
    openMenuSpy: vi.fn(),
    toggleMenuSpy: vi.fn(),
    logoutSpy: vi.fn()
  }
})

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
    statusBgColor: 'rgba(0,0,0,0.2)',
    isOnline: true
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

// Stub the heavy profile card so this focused test only exercises the
// right-click → open menu wiring (it renders inside the stubbed NPopover slot).
vi.mock('@/components/common/InfoPopover.vue', () => ({
  default: {
    name: 'InfoPopoverStub',
    template: '<div data-test="info-popover"></div>',
    props: ['uid', 'activeStatus']
  }
}))

// Mock the self-account action dependencies so setup stays deterministic.
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
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

vi.mock('@/composables/user/useLoginFlow', () => ({
  useLoginFlow: () => ({ logout: logoutSpy })
}))

// naive 组件经自动导入在编译期绑定，需 mock 模块本身才能替换 NPopover / NFlex
vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return {
    ...actual,
    NPopover: passthrough('NPopover'),
    NFlex: passthrough('NFlex')
  }
})

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

import LeftAvatar from '../LeftAvatar.vue'

describe('LeftAvatar — C-2 用户菜单可访问性', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    openMenuSpy.mockClear()
    toggleMenuSpy.mockClear()
    logoutSpy.mockClear()
  })

  it('右键点击头像应调用 openMenu(pos, "right") 打开用户菜单', async () => {
    const wrapper = mount(LeftAvatar)

    // 头像触发器：n-popover #trigger 内的 div.relative
    const avatarTrigger = wrapper.find('.relative.size-34px')
    expect(avatarTrigger.exists()).toBe(true)

    await avatarTrigger.trigger('contextmenu', { clientX: 100, clientY: 200 })
    await nextTick()

    expect(openMenuSpy).toHaveBeenCalledTimes(1)
    expect(openMenuSpy).toHaveBeenCalledWith({ x: 100, y: 200 }, 'right')
  })

  it('弹出层内仅保留「退出登录」一个账号操作按钮（设置/锁屏/关于/管理后台已移除）', async () => {
    const wrapper = mount(LeftAvatar)

    // 仅有一个账号操作按钮（退出登录）
    const buttons = wrapper.findAll('button')
    expect(buttons).toHaveLength(1)

    // 该按钮为退出登录（power 图标），已无设置/锁屏/关于/管理后台图标
    expect(wrapper.find('use[href="#power"]').exists()).toBe(true)
    for (const removed of ['#settings', '#lock', '#info', '#hammer-and-wrench']) {
      expect(wrapper.find(`use[href="${removed}"]`).exists()).toBe(false)
    }

    // 点击应触发出退出登录流程
    await buttons[0].trigger('click')
    expect(logoutSpy).toHaveBeenCalledTimes(1)
  })
})
