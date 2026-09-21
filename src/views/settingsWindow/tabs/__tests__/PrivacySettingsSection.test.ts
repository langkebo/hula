import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import PrivacySettingsSection from '../sections/PrivacySettingsSection.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (k: string) => k }) }))

type PrivacySettingsVm = {
  showOnlineStatus: boolean
  showTypingStatus: boolean
  sendReadReceipts: boolean
  handleOnlineStatusChange: (value: boolean) => void
  handleTypingStatusChange: (value: boolean) => void
  handleReadReceiptsChange: (value: boolean) => void
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as PrivacySettingsVm

describe('PrivacySettingsSection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('关闭已读回执时写入 store 的偏好字段（而不是 localStorage 死 key）', async () => {
    const store = useSettingStore()
    const wrapper = mount(PrivacySettingsSection)
    await wrapper.vm.$nextTick()

    getVm(wrapper).handleReadReceiptsChange(false)

    expect(store.preferences.sendReadReceipts).toBe(false)
    expect(store.sendReadReceiptsEnabled).toBe(false)
    // 旧实现写的是 tjg-send-receipts，与 store 的 legacy key 不一致，且会被迁移逻辑主动清掉
    expect(localStorage.getItem('tjg-send-receipts')).toBeNull()
  })

  it('关闭输入中提示时写入 store 的偏好字段', async () => {
    const store = useSettingStore()
    const wrapper = mount(PrivacySettingsSection)
    await wrapper.vm.$nextTick()

    getVm(wrapper).handleTypingStatusChange(false)

    expect(store.preferences.sendTypingNotifications).toBe(false)
    expect(store.sendTypingNotificationsEnabled).toBe(false)
    expect(localStorage.getItem('tjg-show-typing')).toBeNull()
  })

  it('在线状态开关写入 store 并被持久化', async () => {
    const store = useSettingStore()
    const wrapper = mount(PrivacySettingsSection)
    await wrapper.vm.$nextTick()

    getVm(wrapper).handleOnlineStatusChange(false)

    expect(store.preferences.showOnlineStatus).toBe(false)
    expect(store.showOnlineStatusEnabled).toBe(false)
    expect(localStorage.getItem('tjg-show-online')).toBeNull()
  })

  it('默认值：三个隐私开关均为开启', async () => {
    const store = useSettingStore()
    const wrapper = mount(PrivacySettingsSection)
    await wrapper.vm.$nextTick()

    expect(getVm(wrapper).showOnlineStatus).toBe(true)
    expect(getVm(wrapper).showTypingStatus).toBe(true)
    expect(getVm(wrapper).sendReadReceipts).toBe(true)
    expect(store.showOnlineStatusEnabled).toBe(true)
    expect(store.sendTypingNotificationsEnabled).toBe(true)
    expect(store.sendReadReceiptsEnabled).toBe(true)
  })

  it('挂载时把遗留的 tjg-show-online 迁移进 store 并清掉旧 key', async () => {
    localStorage.setItem('tjg-show-online', 'false')

    const store = useSettingStore()
    const wrapper = mount(PrivacySettingsSection)
    await wrapper.vm.$nextTick()

    expect(store.preferences.showOnlineStatus).toBe(false)
    expect(getVm(wrapper).showOnlineStatus).toBe(false)
    expect(localStorage.getItem('tjg-show-online')).toBeNull()
  })

  it('组件不再直接读写 localStorage（隐私开关全部走 store）', async () => {
    const wrapper = mount(PrivacySettingsSection)
    await wrapper.vm.$nextTick()

    getVm(wrapper).handleOnlineStatusChange(false)
    getVm(wrapper).handleTypingStatusChange(false)
    getVm(wrapper).handleReadReceiptsChange(false)

    expect(localStorage.getItem('tjg-show-online')).toBeNull()
    expect(localStorage.getItem('tjg-show-typing')).toBeNull()
    expect(localStorage.getItem('tjg-send-receipts')).toBeNull()
  })
})
