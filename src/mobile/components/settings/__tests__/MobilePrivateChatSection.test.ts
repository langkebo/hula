import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const state = {
  configured: true,
  enabled: ref(true),
  autoLock: ref(false),
  lockTimeout: ref(5)
}
const setSecretChatPassword = vi.fn(async () => undefined)
const setSecretChatEnabled = vi.fn()
const setSecretChatAutoLock = vi.fn()
const setSecretChatLockTimeout = vi.fn()
const clearSecretChatPassword = vi.fn()
const verifySecretChatPassword = vi.fn(async () => true)

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    secretChatEnabled: state.enabled.value,
    secretChatAutoLock: state.autoLock.value,
    secretChatLockTimeout: state.lockTimeout.value,
    isSecretChatConfigured: () => state.configured,
    setSecretChatPassword,
    setSecretChatEnabled,
    setSecretChatAutoLock,
    setSecretChatLockTimeout,
    verifySecretChatPassword,
    clearSecretChatPassword
  })
}))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('vant', () => ({
  showToast: vi.fn(),
  showConfirmDialog: vi.fn(async () => undefined)
}))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn() })
}))

import MobilePrivateChatSection from '../MobilePrivateChatSection.vue'

const stubs = {
  'van-cell-group': { template: '<div><slot /></div>' },
  'van-cell': {
    props: ['title', 'value', 'label'],
    template: '<div>{{ title }}{{ value }}{{ label }}<slot name="right-icon" /></div>'
  },
  'van-switch': { props: ['modelValue'], template: '<input type="checkbox" />' },
  'van-field': { props: ['modelValue'], template: '<input />' },
  'van-popup': { template: '<div><slot /></div>' },
  'van-picker': { template: '<div />' },
  'van-dialog': { template: '<div><slot /></div>' },
  Icon: { template: '<i />' }
}
const global = { stubs }

type SectionVm = { handleEnabledChange: (value: boolean) => void }

describe('MobilePrivateChatSection', () => {
  beforeEach(() => {
    state.configured = true
    state.enabled.value = true
    state.autoLock.value = false
    state.lockTimeout.value = 5
    vi.clearAllMocks()
  })

  it('已配置时展示「修改密码」', () => {
    const wrapper = mount(MobilePrivateChatSection, { global })
    expect(wrapper.text()).toContain('mobile_security.secret_chat.change_password')
    expect(wrapper.text()).not.toContain('mobile_security.secret_chat.set_password')
  })

  it('未配置时展示「设置密码」', () => {
    state.configured = false
    const wrapper = mount(MobilePrivateChatSection, { global })
    expect(wrapper.text()).toContain('mobile_security.secret_chat.set_password')
    expect(wrapper.text()).not.toContain('mobile_security.secret_chat.change_password')
  })

  it('关闭启用开关时调用 setSecretChatEnabled(false)', () => {
    const wrapper = mount(MobilePrivateChatSection, { global })
    const vm = wrapper.vm as unknown as SectionVm
    vm.handleEnabledChange(false)
    expect(setSecretChatEnabled).toHaveBeenCalledWith(false)
  })

  it('未配置时开启开关不直接调用 setSecretChatEnabled', () => {
    state.configured = false
    const wrapper = mount(MobilePrivateChatSection, { global })
    const vm = wrapper.vm as unknown as SectionVm
    vm.handleEnabledChange(true)
    expect(setSecretChatEnabled).not.toHaveBeenCalled()
  })
})
