import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useSettingsTabDirty } from '@/composables/settings/useSettingsDirtyRegistry'
import { useSettingsDialogStore } from '@/stores/domains/settings/settingsDialog'
import SettingsDialog from '../SettingsDialog.vue'

const dialogWarningMock = vi.fn()
const translationMap: Record<string, string> = {
  'setting.dialog.title': '设置',
  'setting.dialog.current_tab': '当前设置',
  'setting.dialog.search_placeholder': '搜索设置项',
  'setting.dialog.search_aria_label': '搜索设置项',
  'setting.dialog.nav_empty': '未找到匹配的设置项',
  'setting.dialog.nav_aria_label': '设置导航',
  'setting.dialog.dirty_status': '有未保存的更改',
  'setting.dialog.close_title': '关闭设置',
  'setting.dialog.close_aria_label': '关闭设置窗口',
  'setting.dialog.content_aria_label': '设置内容',
  'setting.dialog.switch_title': '切换设置项',
  'setting.dialog.leave_confirm': '继续离开',
  'setting.dialog.leave_cancel': '继续编辑',
  'setting.dialog.tabs.account': '账户',
  'setting.dialog.tabs.sessions': '会话管理',
  'setting.dialog.tabs.appearance': '外观设置',
  'setting.dialog.tabs.notifications': '通知设置',
  'setting.dialog.tabs.preferences': '偏好设置',
  'setting.dialog.tabs.keyboard': '快捷键',
  'setting.dialog.tabs.sidebar': '侧边栏',
  'setting.dialog.tabs.voice_video': '语音视频',
  'setting.dialog.tabs.security_privacy': '安全与隐私',
  'setting.dialog.tabs.encryption': '加密',
  'setting.dialog.tabs.labs': 'Labs',
  'setting.dialog.tabs.mjolnir': '屏蔽管理',
  'setting.dialog.tabs.help_about': '帮助与关于',
  'setting.dialog.tabs.friends': '好友管理',
  'setting.dialog.tabs.burn_after_read': '阅后即焚'
}

function createTabStub(
  name: string,
  className: string,
  options: { dirty?: boolean; tabId?: 'account' | 'notifications' } = {}
) {
  return defineComponent({
    name,
    setup() {
      if (options.dirty && options.tabId) {
        const isDirty = ref(true)
        useSettingsTabDirty(options.tabId, isDirty)
      }

      return () => h('div', { class: className }, name)
    }
  })
}

vi.mock('naive-ui', () => ({
  NButton: {
    name: 'NButton',
    emits: ['click'],
    template: '<button class="n-button" type="button" @click="$emit(\'click\')"><slot name="icon" /><slot /></button>'
  },
  NIcon: {
    name: 'NIcon',
    template: '<i class="n-icon"><slot /></i>'
  },
  NInput: {
    name: 'NInput',
    props: ['value', 'clearable', 'placeholder', 'size'],
    emits: ['update:value'],
    template: '<input class="n-input" :value="value" @input="$emit(\'update:value\', $event.target.value)" />'
  },
  useDialog: () => ({
    warning: (...args: unknown[]) => dialogWarningMock(...args)
  })
}))

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    props: ['icon'],
    template: '<i class="icon" />'
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'setting.dialog.leave_content') {
        return `${params?.label || '当前设置'}存在未保存的更改，继续后这些内容将会丢失。`
      }
      return translationMap[key] ?? key
    }
  })
}))

vi.mock('@/composables/usePlatform', () => ({
  usePlatform: () => ({
    isDesktop: true,
    isMobile: false,
    platform: 'desktop',
    isTauri: true,
    isWeb: false
  })
}))

vi.mock('../SettingsTabNav.vue', () => ({
  default: defineComponent({
    name: 'SettingsTabNav',
    props: ['tabs', 'activeTab'],
    emits: ['change'],
    methods: {
      handleKeydown(event: KeyboardEvent, index: number) {
        if (event.key !== 'ArrowDown') return
        const nextTab = this.tabs[index + 1]
        if (nextTab) {
          this.$emit('change', nextTab.id)
        }
      }
    },
    template: `
      <div class="settings-tab-nav" aria-label="设置导航">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.id"
          :id="'settings-tab-' + tab.id"
          type="button"
          :data-tab-id="tab.id"
          @keydown="handleKeydown($event, index)"
          @click="$emit('change', tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
    `
  })
}))

vi.mock('../tabComponentLoaders', () => {
  const accountTabStub = createTabStub('AccountSettingsStub', 'account-tab-stub', { dirty: true, tabId: 'account' })
  const notificationTabStub = createTabStub('NotificationSettingsStub', 'notification-tab-stub')
  const plainTabStub = createTabStub('PlainSettingsStub', 'plain-tab-stub')

  return {
    SETTINGS_TAB_COMPONENT_LOADERS: {
      account: () => Promise.resolve(accountTabStub),
      sessions: () => Promise.resolve(plainTabStub),
      appearance: () => Promise.resolve(plainTabStub),
      notifications: () => Promise.resolve(notificationTabStub),
      voiceVideo: () => Promise.resolve(plainTabStub),
      preferences: () => Promise.resolve(plainTabStub),
      keyboard: () => Promise.resolve(plainTabStub),
      sidebar: () => Promise.resolve(plainTabStub),
      securityPrivacy: () => Promise.resolve(plainTabStub),
      encryption: () => Promise.resolve(plainTabStub),
      labs: () => Promise.resolve(plainTabStub),
      mjolnir: () => Promise.resolve(plainTabStub),
      friends: () => Promise.resolve(plainTabStub),
      burnAfterRead: () => Promise.resolve(plainTabStub),
      helpAbout: () => Promise.resolve(plainTabStub)
    }
  }
})

describe('SettingsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mountDialog() {
    const pinia = createPinia()
    setActivePinia(pinia)

    const store = useSettingsDialogStore()
    store.openDialog('account')

    const wrapper = mount(SettingsDialog, {
      global: {
        plugins: [pinia]
      }
    })

    return {
      wrapper,
      store
    }
  }

  it('shows the unsaved status when the active tab registers dirty state', async () => {
    const { wrapper } = mountDialog()

    await flushPromises()

    expect(wrapper.text()).toContain('有未保存的更改')
    expect(wrapper.find('.account-tab-stub').exists()).toBe(true)
  })

  it('exposes accessible labels for the shell and current panel', async () => {
    const { wrapper } = mountDialog()

    await flushPromises()

    const closeButton = wrapper.find('button[aria-label="关闭设置窗口"]')
    const panel = wrapper.find('#settings-tab-panel')
    const nav = wrapper.find('.settings-tab-nav')

    expect(closeButton.exists()).toBe(true)
    expect(nav.attributes('aria-label')).toBe('设置导航')
    expect(panel.attributes('role')).toBe('tabpanel')
    expect(panel.attributes('aria-labelledby')).toBe('settings-tab-account')
    expect(wrapper.find('.settings-title').text()).toBe('账户')
  })

  it('keeps the current tab when the user cancels the switch confirmation', async () => {
    const { wrapper, store } = mountDialog()

    await flushPromises()

    const clickPromise = wrapper.find('[data-tab-id="notifications"]').trigger('click')
    await flushPromises()

    expect(dialogWarningMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '切换设置项'
      })
    )

    dialogWarningMock.mock.calls[0][0].onNegativeClick()

    await clickPromise
    await flushPromises()

    expect(store.activeTab).toBe('account')
    expect(wrapper.find('.account-tab-stub').exists()).toBe(true)
  })

  it('supports keyboard navigation in the settings tab list', async () => {
    const { wrapper, store } = mountDialog()

    await flushPromises()

    const activeTabButton = wrapper.find('#settings-tab-account')
    await activeTabButton.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    dialogWarningMock.mock.calls[0][0].onPositiveClick()
    await flushPromises()

    expect(store.activeTab).toBe('sessions')
    expect(wrapper.find('.plain-tab-stub').exists()).toBe(true)
  })

  it('switches tabs after confirming the dirty-state dialog', async () => {
    const { wrapper, store } = mountDialog()

    await flushPromises()

    const clickPromise = wrapper.find('[data-tab-id="notifications"]').trigger('click')
    await flushPromises()

    dialogWarningMock.mock.calls[0][0].onPositiveClick()

    await clickPromise
    await flushPromises()

    expect(store.activeTab).toBe('notifications')
    expect(wrapper.find('.notification-tab-stub').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('有未保存的更改')
  })

  it('closes the dialog after confirming the close warning', async () => {
    const { wrapper, store } = mountDialog()

    await flushPromises()

    expect(store.isOpen).toBe(true)

    const closePromise = wrapper.find('.n-button').trigger('click')
    await flushPromises()

    expect(dialogWarningMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '关闭设置'
      })
    )

    dialogWarningMock.mock.calls[0][0].onPositiveClick()

    await closePromise
    await flushPromises()

    expect(store.isOpen).toBe(false)
  })

  it('keeps the dialog open when the user cancels the close confirmation', async () => {
    const { wrapper, store } = mountDialog()

    await flushPromises()

    const closePromise = wrapper.find('.n-button').trigger('click')
    await flushPromises()

    expect(dialogWarningMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '关闭设置'
      })
    )

    dialogWarningMock.mock.calls[0][0].onNegativeClick()

    await closePromise
    await flushPromises()

    expect(store.isOpen).toBe(true)
    expect(wrapper.text()).toContain('有未保存的更改')
    expect(wrapper.find('.account-tab-stub').exists()).toBe(true)
  })

  it('blocks browser unload while there are unsaved changes', async () => {
    const { wrapper } = mountDialog()

    await flushPromises()

    const beforeUnloadEvent = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent
    Object.defineProperty(beforeUnloadEvent, 'returnValue', {
      configurable: true,
      writable: true,
      value: undefined
    })

    window.dispatchEvent(beforeUnloadEvent)

    expect(beforeUnloadEvent.defaultPrevented).toBe(true)
    expect(beforeUnloadEvent.returnValue).toBe('')

    wrapper.unmount()
  })
})
