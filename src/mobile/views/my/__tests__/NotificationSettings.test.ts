import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationSettings from '../NotificationSettings.vue'

const { showToastMock, getPushRulesMock, setPushRuleEnabledMock, setPushRuleActionsMock } = vi.hoisted(() => {
  return {
    showToastMock: vi.fn(),
    getPushRulesMock: vi.fn().mockResolvedValue({ global: {} }),
    setPushRuleEnabledMock: vi.fn().mockResolvedValue(undefined),
    setPushRuleActionsMock: vi.fn().mockResolvedValue(undefined)
  }
})

vi.mock('vant', () => ({
  showToast: (...args: any[]) => showToastMock(...args)
}))

vi.mock('@iconify/vue', () => ({
  Icon: { name: 'Icon', template: '<i />', props: ['icon', 'width', 'color'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/notifications/MatrixPushService', () => ({
  matrixPushService: {
    getPushRules: () => getPushRulesMock(),
    setPushRuleEnabled: (...args: any[]) => setPushRuleEnabledMock(...args),
    setPushRuleActions: (...args: any[]) => setPushRuleActionsMock(...args),
    setMasterRuleEnabled: (...args: any[]) => setPushRuleEnabledMock(...args),
    setRoomSoundEnabled: (...args: any[]) => setPushRuleActionsMock(...args),
    setRoomRuleEnabled: (...args: any[]) => setPushRuleEnabledMock(...args),
    getOverrideRules: (rules: any) => rules?.global?.override ?? [],
    getRoomRules: (rules: any) => rules?.global?.room ?? []
  }
}))

vi.mock('@/mobile/components/chat-room/AutoFixHeightPage.vue', () => ({
  default: {
    name: 'AutoFixHeightPage',
    template: '<div><slot name="header" /><slot name="container" /></div>',
    props: ['showFooter']
  }
}))

vi.mock('@/mobile/components/chat-room/HeaderBar.vue', () => ({
  default: {
    name: 'HeaderBar',
    template: '<div />',
    props: ['border', 'isOfficial', 'hiddenRight', 'roomName']
  }
}))

vi.mock('@/router', () => ({
  default: { push: vi.fn(), back: vi.fn() }
}))

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getPushRulesMock.mockResolvedValue({ global: {} })
  })

  it('renders correctly', () => {
    const wrapper = mount(NotificationSettings)
    expect(wrapper.html()).toBeTruthy()
  })

  it('has notifications enabled by default', () => {
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).notificationsEnabled).toBe(true)
  })

  it('has sound enabled by default', () => {
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).soundEnabled).toBe(true)
  })

  it('has push notifications enabled by default', () => {
    const wrapper = mount(NotificationSettings)
    expect((wrapper.vm as any).pushNotifications).toBe(true)
  })

  it('loads push rules on mount', async () => {
    const _wrapper = mount(NotificationSettings)
    await vi.dynamicImportSettled()
    expect(getPushRulesMock).toHaveBeenCalled()
  })

  it('parses master rule for notifications enabled', async () => {
    getPushRulesMock.mockResolvedValue({
      global: {
        override: [{ rule_id: '.m.rule.master', enabled: false }]
      }
    })
    const wrapper = mount(NotificationSettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).notificationsEnabled).toBe(true)
  })

  it('parses DM rule for room notify mode', async () => {
    getPushRulesMock.mockResolvedValue({
      global: {
        room: [{ rule_id: '.m.rule.room_one_to_one', enabled: true }]
      }
    })
    const wrapper = mount(NotificationSettings)
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).roomNotifyMode).toBe('all')
  })

  it('handles notifications toggle', async () => {
    const wrapper = mount(NotificationSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleNotificationsToggle(false)
    expect(setPushRuleEnabledMock).toHaveBeenCalled()
  })

  it('handles sound toggle', async () => {
    const wrapper = mount(NotificationSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleSoundToggle(false)
    expect(setPushRuleActionsMock).toHaveBeenCalled()
  })

  it('saves push notifications to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handlePushToggle(true)
    expect(localStorage.getItem('hula-push-notifications')).toBe('true')
  })

  it('saves email notifications to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleEmailToggle(true)
    expect(localStorage.getItem('hula-email-notifications')).toBe('true')
  })

  it('saves encrypted room notifications to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleEncryptedRoomToggle(true)
    expect(localStorage.getItem('hula-encrypted-room-notifications')).toBe('true')
  })

  it('saves push rules on handleSave', async () => {
    const wrapper = mount(NotificationSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    vm.roomNotifyMode = 'none'
    vm.groupNotifyMode = 'mention'
    await vm.handleSave()
    expect(setPushRuleEnabledMock).toHaveBeenCalled()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }))
  })

  it('shows error on save failure', async () => {
    setPushRuleEnabledMock.mockRejectedValue(new Error('fail'))
    const wrapper = mount(NotificationSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleSave()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('reverts notification toggle on failure', async () => {
    setPushRuleEnabledMock.mockRejectedValue(new Error('fail'))
    const wrapper = mount(NotificationSettings)
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleNotificationsToggle(false)
    expect(vm.notificationsEnabled).toBe(true)
  })
})
