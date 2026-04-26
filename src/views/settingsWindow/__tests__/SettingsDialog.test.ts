import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsTabDirty } from '@/composables/settings/useSettingsDirtyRegistry'
import { useSettingsDialogStore } from '@/stores/domains/settings/settingsDialog'
import SettingsDialog from '../SettingsDialog.vue'

const dialogWarningMock = vi.fn()

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
    warning: (...args: any[]) => dialogWarningMock(...args)
  })
}))

vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    props: ['icon'],
    template: '<i class="icon" />'
  }
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
    template: `
      <div class="settings-tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :data-tab-id="tab.id"
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
