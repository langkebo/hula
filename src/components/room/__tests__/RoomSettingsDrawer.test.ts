import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.mock 工厂会被提升到文件顶部，不能引用外部变量。
// 使用 vi.hoisted 创建 stub 工厂函数，确保在 mock 提升时可用。
// 模板字符串中的 testId 在工厂调用时插值，roomId 通过 Vue 绑定在渲染时求值。
const { tabStubFactory } = vi.hoisted(() => ({
  tabStubFactory: (testId: string) => ({
    name: testId,
    props: { roomId: { type: String, required: true } },
    emits: ['close'],
    template: `<div :data-testid="'${testId}'" :data-room-id="roomId" />`
  })
}))

vi.mock('@/components/room/settings-tabs/BasicTab.vue', () => ({
  default: tabStubFactory('basic-tab')
}))
vi.mock('@/components/room/settings-tabs/MembersTab.vue', () => ({
  default: tabStubFactory('members-tab')
}))
vi.mock('@/components/room/settings-tabs/PermissionsTab.vue', () => ({
  default: tabStubFactory('permissions-tab')
}))
vi.mock('@/components/room/settings-tabs/SecurityTab.vue', () => ({
  default: tabStubFactory('security-tab')
}))
vi.mock('@/components/room/settings-tabs/NotificationsTab.vue', () => ({
  default: tabStubFactory('notifications-tab')
}))
vi.mock('@/components/room/settings-tabs/AliasTab.vue', () => ({
  default: tabStubFactory('alias-tab')
}))
vi.mock('@/components/room/settings-tabs/HistoryTab.vue', () => ({
  default: tabStubFactory('history-tab')
}))
vi.mock('@/components/room/settings-tabs/RetentionTab.vue', () => ({
  default: tabStubFactory('retention-tab')
}))
vi.mock('@/components/room/settings-tabs/TagsTab.vue', () => ({
  default: tabStubFactory('tags-tab')
}))
vi.mock('@/components/room/settings-tabs/StickyTab.vue', () => ({
  default: tabStubFactory('sticky-tab')
}))
vi.mock('@/components/room/settings-tabs/AdvancedTab.vue', () => ({
  default: tabStubFactory('advanced-tab')
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

import RoomSettingsDrawer from '../RoomSettingsDrawer.vue'

const ROOM_ID = '!test:matrix.org'

const mountDrawer = (roomId: string | null = ROOM_ID) =>
  mount(RoomSettingsDrawer, {
    props: { roomId },
    global: {
      stubs: {
        Transition: { template: '<div><slot /></div>' },
        Teleport: { template: '<div><slot /></div>' }
      }
    }
  })

describe('RoomSettingsDrawer', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders nothing when roomId is null', () => {
    const wrapper = mountDrawer(null)
    expect(wrapper.find('[data-testid="room-settings-drawer"]').exists()).toBe(false)
  })

  it('renders drawer with title when roomId is provided', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.find('[data-testid="room-settings-drawer"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('room.settings_drawer.title')
  })

  it('renders all 11 tab buttons in the navigation', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    const tabs = wrapper.findAll('.rs-drawer__tab')
    expect(tabs).toHaveLength(11)
  })

  it('renders tab labels in correct order', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    const tabs = wrapper.findAll('.rs-drawer__tab')
    const labels = tabs.map((t) => t.text())
    expect(labels).toEqual([
      'room.settings_drawer.tab_basic',
      'room.settings_drawer.tab_members',
      'room.settings_drawer.tab_permissions',
      'room.settings_drawer.tab_security',
      'room.settings_drawer.tab_notifications',
      'room.settings_drawer.tab_alias',
      'room.settings_drawer.tab_history',
      'room.settings_drawer.tab_retention',
      'room.settings_drawer.tab_tags',
      'room.settings_drawer.tab_sticky',
      'room.settings_drawer.tab_advanced'
    ])
  })

  it('defaults to basic tab on mount', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    expect(wrapper.find('[data-testid="basic-tab"]').exists()).toBe(true)
  })

  it('marks the basic tab button as active by default', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    const tabs = wrapper.findAll('.rs-drawer__tab')
    expect(tabs[0].classes()).toContain('rs-drawer__tab--active')
    expect(tabs[1].classes()).not.toContain('rs-drawer__tab--active')
  })

  it('switches to permissions tab when clicking the permissions tab button', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    const tabs = wrapper.findAll('.rs-drawer__tab')
    await tabs[2].trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="permissions-tab"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="basic-tab"]').exists()).toBe(false)
    expect(tabs[2].classes()).toContain('rs-drawer__tab--active')
    expect(tabs[0].classes()).not.toContain('rs-drawer__tab--active')
  })

  it('switches to advanced tab when clicking the last tab button', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    const tabs = wrapper.findAll('.rs-drawer__tab')
    await tabs[10].trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="advanced-tab"]').exists()).toBe(true)
  })

  it('emits close when clicking the close button', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.find('.rs-drawer__close').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('close')).toBeTruthy()
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close when clicking the overlay background', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.find('[data-testid="room-settings-drawer-overlay"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('does not emit close when clicking inside the drawer panel', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    await wrapper.find('[data-testid="room-settings-drawer"]').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('close')).toBeFalsy()
  })

  it('passes roomId to the active tab component', async () => {
    const wrapper = mountDrawer('!custom-id:server')
    await flushPromises()

    const basicTab = wrapper.find('[data-testid="basic-tab"]')
    expect(basicTab.attributes('data-room-id')).toBe('!custom-id:server')
  })

  it('resets to basic tab when roomId changes from null to a new value', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    // Switch to permissions tab
    const tabs = wrapper.findAll('.rs-drawer__tab')
    await tabs[2].trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="permissions-tab"]').exists()).toBe(true)

    // Close drawer (roomId → null)
    await wrapper.setProps({ roomId: null })
    await flushPromises()

    // Reopen with new roomId
    await wrapper.setProps({ roomId: '!new-room:server' })
    await flushPromises()

    expect(wrapper.find('[data-testid="basic-tab"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="permissions-tab"]').exists()).toBe(false)
  })

  it('resets to basic tab when roomId changes to another non-null value', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    // Switch to members tab
    const tabs = wrapper.findAll('.rs-drawer__tab')
    await tabs[1].trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="members-tab"]').exists()).toBe(true)

    // Change roomId to another non-null value → watch resets activeTab to 'basic'
    await wrapper.setProps({ roomId: '!another:server' })
    await flushPromises()

    expect(wrapper.find('[data-testid="basic-tab"]').exists()).toBe(true)
  })

  it('sets aria-selected correctly on tab buttons', async () => {
    const wrapper = mountDrawer()
    await flushPromises()

    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs[0].attributes('aria-selected')).toBe('true')
    expect(tabs[1].attributes('aria-selected')).toBe('false')

    await tabs[3].trigger('click')
    await flushPromises()

    expect(tabs[0].attributes('aria-selected')).toBe('false')
    expect(tabs[3].attributes('aria-selected')).toBe('true')
  })

  it('captures and displays errors from tab components', async () => {
    // Override MembersTab mock to throw during render
    vi.doMock('@/components/room/settings-tabs/MembersTab.vue', () => ({
      default: {
        name: 'ErrorTab',
        props: { roomId: { type: String, required: true } },
        setup() {
          throw new Error('boom from members tab')
        },
        template: '<div />'
      }
    }))

    // Re-import to pick up the new mock
    vi.resetModules()
    const { default: DrawerWithErr } = await import('../RoomSettingsDrawer.vue')

    const wrapper = mount(DrawerWithErr, {
      props: { roomId: ROOM_ID },
      global: {
        stubs: {
          Transition: { template: '<div><slot /></div>' },
          Teleport: { template: '<div><slot /></div>' }
        }
      }
    })
    await flushPromises()

    // Switch to members tab (index 1) to trigger the error
    const tabs = wrapper.findAll('.rs-drawer__tab')
    await tabs[1].trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="tab-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('boom from members tab')
  })
})
