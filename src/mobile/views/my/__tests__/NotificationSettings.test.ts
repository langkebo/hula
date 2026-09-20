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

vi.mock('vant', async () => {
  const { defineComponent } = await import('vue')
  // 同时导出 PascalCase 与 kebab-case：模板里写的是小写标签，
  // 只导出 PascalCase 时 Vue 解析不到，组件会被当成未解析标签整体丢弃（槽位一起消失）。
  const passthrough = (name: string, tag = 'div') =>
    defineComponent({
      name,
      inheritAttrs: false,
      template: `<${tag} v-bind="$attrs"><slot name="icon" /><slot name="title" /><slot /><slot name="value" /><slot name="right-icon" /></${tag}>`
    })
  return {
    showToast: (...args: any[]) => showToastMock(...args),
    VanCellGroup: passthrough('VanCellGroup'),
    'van-cell-group': passthrough('VanCellGroup'),
    VanCell: passthrough('VanCell'),
    'van-cell': passthrough('VanCell'),
    VanField: passthrough('VanField'),
    'van-field': passthrough('VanField'),
    VanSwitch: passthrough('VanSwitch'),
    'van-switch': passthrough('VanSwitch'),
    VanRadioGroup: passthrough('VanRadioGroup'),
    'van-radio-group': passthrough('VanRadioGroup'),
    VanRadio: passthrough('VanRadio'),
    'van-radio': passthrough('VanRadio'),
    VanButton: passthrough('VanButton', 'button'),
    'van-button': passthrough('VanButton', 'button'),
    VanPopup: passthrough('VanPopup'),
    'van-popup': passthrough('VanPopup'),
    VanPicker: passthrough('VanPicker'),
    'van-picker': passthrough('VanPicker'),
    VanLoading: passthrough('VanLoading'),
    'van-loading': passthrough('VanLoading')
  }
})

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
    expect(localStorage.getItem('tjg-push-notifications')).toBe('true')
  })

  it('saves email notifications to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleEmailToggle(true)
    expect(localStorage.getItem('tjg-email-notifications')).toBe('true')
  })

  it('saves encrypted room notifications to localStorage', () => {
    const wrapper = mount(NotificationSettings)
    const vm = wrapper.vm as any
    vm.handleEncryptedRoomToggle(true)
    expect(localStorage.getItem('tjg-encrypted-room-notifications')).toBe('true')
  })

  describe('notification display preferences', () => {
    it('exposes the three controls with defaults', () => {
      const wrapper = mount(NotificationSettings)
      const vm = wrapper.vm as any
      expect(vm.contentSummary).toBe(true)
      expect(vm.keywordHighlight).toBe(true)
      expect(vm.priority).toBe('medium')
      expect(vm.keywordsInput).toBe('')
    })

    it('restores saved preferences on mount', () => {
      localStorage.setItem(
        'tjg-notification-display-preferences',
        JSON.stringify({ contentSummary: false, keywordHighlight: false, keywords: ['deploy'], priority: 'low' })
      )
      const wrapper = mount(NotificationSettings)
      const vm = wrapper.vm as any
      expect(vm.contentSummary).toBe(false)
      expect(vm.keywordHighlight).toBe(false)
      expect(vm.priority).toBe('low')
      expect(vm.keywordsInput).toBe('deploy')
    })

    it('persists the content summary toggle', () => {
      const wrapper = mount(NotificationSettings)
      const vm = wrapper.vm as any
      vm.contentSummary = false
      vm.handleContentSummaryToggle()
      const stored = JSON.parse(localStorage.getItem('tjg-notification-display-preferences') as string)
      expect(stored.contentSummary).toBe(false)
    })

    it('persists the keyword highlight toggle', () => {
      const wrapper = mount(NotificationSettings)
      const vm = wrapper.vm as any
      vm.keywordHighlight = false
      vm.handleKeywordHighlightToggle()
      const stored = JSON.parse(localStorage.getItem('tjg-notification-display-preferences') as string)
      expect(stored.keywordHighlight).toBe(false)
    })

    it('normalizes keywords on blur', () => {
      const wrapper = mount(NotificationSettings)
      const vm = wrapper.vm as any
      vm.keywordsInput = ' deploy ,, DEPLOY ， 运维 '
      vm.handleKeywordsCommit()
      expect(vm.keywordsInput).toBe('deploy, 运维')
      const stored = JSON.parse(localStorage.getItem('tjg-notification-display-preferences') as string)
      expect(stored.keywords).toEqual(['deploy', '运维'])
    })

    it('persists a confirmed priority and closes the picker', () => {
      const wrapper = mount(NotificationSettings)
      const vm = wrapper.vm as any
      vm.showPriorityPicker = true
      vm.handlePriorityConfirm({ selectedValues: ['high'] })
      expect(vm.priority).toBe('high')
      expect(vm.showPriorityPicker).toBe(false)
      const stored = JSON.parse(localStorage.getItem('tjg-notification-display-preferences') as string)
      expect(stored.priority).toBe('high')
    })

    it('ignores an unknown priority value', () => {
      const wrapper = mount(NotificationSettings)
      const vm = wrapper.vm as any
      vm.handlePriorityConfirm({ selectedValues: ['urgent'] })
      expect(vm.priority).toBe('medium')
    })

    it('renders the priority labels from i18n keys', () => {
      const wrapper = mount(NotificationSettings)
      const vm = wrapper.vm as any
      expect(vm.priorityColumns.map((c: any) => c.value)).toEqual(['low', 'medium', 'high'])
      expect(vm.priorityLabel).toBe('mobile_notifications.priority_medium')
    })

    it('renders the display section controls', () => {
      const wrapper = mount(NotificationSettings)
      expect(wrapper.find('[data-testid="notif-content-summary"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="notif-keyword-highlight"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="notif-keywords"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="notif-priority"]').exists()).toBe(true)
    })
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
