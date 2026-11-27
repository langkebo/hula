import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import LockScreen from '@/views/LockScreen.vue'

const verifyMock = vi.hoisted(() => vi.fn())

enableAutoUnmount(afterEach)

vi.mock('pinia', () => ({
  storeToRefs: (store: Record<string, unknown>) => ({ lockScreen: store.lockScreen })
}))

vi.mock('@/stores/domains/settings/setting', async () => {
  const { ref } = await import('vue')
  const lockScreen = ref({ enable: true, passwordHash: 'stored-hash' })
  return {
    useSettingStore: () => ({ lockScreen }),
    __lockScreen: lockScreen
  }
})

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { name: 'tester', avatar: '' } })
}))

vi.mock('@/shared/composables/useLoginFlow', () => ({
  useLoginFlow: () => ({ logout: vi.fn() })
}))

vi.mock('@/stores/domains/settings/lockScreenCredential', () => ({
  verifyLockScreenVerifier: verifyMock
}))

vi.mock('@/utils/TimerManager', () => ({
  useTimerManager: () => ({
    setTimeout: (fn: () => void) => {
      fn()
      return 1
    },
    setInterval: () => 1,
    clearAll: vi.fn()
  })
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getCurrent: () => ({ label: 'lockScreen' }),
    getAll: async () => [],
    getByLabel: async () => null
  }
}))

vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn() }))

vi.mock('@/components/windows/ActionBar.vue', () => ({
  default: {
    name: 'ActionBar',
    props: { escClose: { type: Boolean, default: true } },
    template: '<div data-test="action-bar" />'
  }
}))

vi.mock('naive-ui', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('naive-ui')
  return {
    ...actual,
    NInput: {
      name: 'NInput',
      props: ['value'],
      emits: ['update:value'],
      methods: { focus: vi.fn() },
      template: '<div class="n-input-stub"><slot name="suffix" /></div>'
    },
    NFlex: { name: 'NFlex', template: '<div><slot /></div>' },
    NAvatar: { name: 'NAvatar', template: '<div />' },
    NPopover: { name: 'NPopover', template: '<div><slot name="trigger" /><slot /></div>' }
  }
})

const mountLockScreen = () =>
  mount(LockScreen, {
    global: {
      directives: { clickable: {} }
    }
  })

const pressEnter = async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  await flushPromises()
  await nextTick()
}

const enterUnlockPage = async () => {
  const wrapper = mountLockScreen()
  await pressEnter()
  return wrapper
}

describe('LockScreen', () => {
  beforeEach(() => {
    verifyMock.mockReset()
    verifyMock.mockResolvedValue(false)
  })

  it('Enter 在解锁页触发密码校验', async () => {
    const wrapper = await enterUnlockPage()
    expect(wrapper.find('.lock-unlock-button').exists()).toBe(true)

    await wrapper.findComponent({ name: 'NInput' }).vm.$emit('update:value', 'wrong-password')
    await nextTick()
    await pressEnter()

    expect(verifyMock).toHaveBeenCalledWith('wrong-password', 'stored-hash')
    expect(wrapper.find('.lock-error').text()).toBe('message.lock_screen.wrong_password')
  })

  it('Esc 不会关闭锁屏', async () => {
    const wrapper = mountLockScreen()
    expect(wrapper.findComponent({ name: 'ActionBar' }).props('escClose')).toBe(false)

    const root = wrapper.find('.login-box')
    expect(root.exists()).toBe(true)
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    root.element.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.find('[data-test="action-bar"]').exists()).toBe(true)
  })

  it('空密码提交时给出提示且不校验', async () => {
    const wrapper = await enterUnlockPage()

    await wrapper.find('.lock-unlock-button').trigger('click')
    await flushPromises()
    await nextTick()

    expect(verifyMock).not.toHaveBeenCalled()
    expect(wrapper.find('.lock-error').text()).toBe('message.lock_screen.toast_empty_password')
  })
})
