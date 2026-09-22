import { mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
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

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}))

vi.mock('@/router', () => ({
  default: { push: vi.fn(), back: vi.fn() }
}))

// van-* 在测试环境里是未解析标签，直接挂载会丢掉具名插槽（开关不会被渲染）。
// 这里给出能渲染插槽、并真实触发 v-model/change 的最小替身，交互断言才有意义。
const VanCellStub = defineComponent({
  name: 'VanCell',
  props: ['title', 'label', 'isLink'],
  template: `<div class="van-cell">
    <span class="van-cell__title">{{ title }}</span>
    <span v-if="label" class="van-cell__label">{{ label }}</span>
    <slot name="icon" />
    <slot name="value" />
    <slot name="right-icon" />
  </div>`
})

const VanSwitchStub = defineComponent({
  name: 'VanSwitch',
  props: { modelValue: { type: Boolean, default: false }, disabled: Boolean },
  emits: ['update:modelValue', 'change'],
  template: `<button class="van-switch" :disabled="disabled" @click="$emit('update:modelValue', !modelValue); $emit('change', !modelValue)" />`
})

function mountComponent() {
  return mount(NotificationSettings, {
    global: {
      stubs: {
        'van-cell-group': { template: '<div><slot /></div>' },
        'van-cell': VanCellStub,
        'van-switch': VanSwitchStub,
        'van-field': {
          template: '<input class="van-field" />',
          props: ['modelValue', 'label', 'placeholder', 'disabled']
        },
        'van-radio-group': { template: '<div><slot /></div>', props: ['modelValue', 'direction'] },
        'van-radio': { template: '<label><slot /></label>', props: ['name'] },
        'van-button': { template: '<button><slot /></button>', props: ['type', 'block', 'loading'] },
        'van-popup': { template: '<div><slot /></div>', props: ['show', 'position', 'round'] },
        'van-picker': { template: '<div />', props: ['columns', 'modelValue'] }
      }
    }
  })
}

function cellWithTitle(wrapper: VueWrapper, titleKey: string) {
  return wrapper.findAll('.van-cell').find((c) => c.text().includes(titleKey))
}

function switchInCell(wrapper: VueWrapper, titleKey: string) {
  const cell = cellWithTitle(wrapper, titleKey)
  expect(cell, `cell ${titleKey} should exist`).toBeDefined()
  const toggle = cell!.findComponent({ name: 'VanSwitch' })
  expect(toggle.exists(), `switch in ${titleKey} should exist`).toBe(true)
  return toggle
}

describe('NotificationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getPushRulesMock.mockResolvedValue({ global: {} })
  })

  it('renders correctly', () => {
    const wrapper = mountComponent()
    expect(wrapper.html()).toBeTruthy()
  })

  it('has notifications enabled by default', () => {
    const wrapper = mountComponent()
    expect((wrapper.vm as any).notificationsEnabled).toBe(true)
  })

  it('has sound enabled by default', () => {
    const wrapper = mountComponent()
    expect((wrapper.vm as any).soundEnabled).toBe(true)
  })

  it('loads push rules on mount', async () => {
    const _wrapper = mountComponent()
    await vi.dynamicImportSettled()
    expect(getPushRulesMock).toHaveBeenCalled()
  })

  it('parses master rule for notifications enabled', async () => {
    getPushRulesMock.mockResolvedValue({
      global: {
        override: [{ rule_id: '.m.rule.master', enabled: false }]
      }
    })
    const wrapper = mountComponent()
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).notificationsEnabled).toBe(true)
  })

  it('parses DM rule for room notify mode', async () => {
    getPushRulesMock.mockResolvedValue({
      global: {
        room: [{ rule_id: '.m.rule.room_one_to_one', enabled: true }]
      }
    })
    const wrapper = mountComponent()
    await vi.dynamicImportSettled()
    expect((wrapper.vm as any).roomNotifyMode).toBe('all')
  })

  it('handles notifications toggle', async () => {
    const wrapper = mountComponent()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleNotificationsToggle(false)
    expect(setPushRuleEnabledMock).toHaveBeenCalled()
  })

  it('handles sound toggle', async () => {
    const wrapper = mountComponent()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleSoundToggle(false)
    expect(setPushRuleActionsMock).toHaveBeenCalled()
  })

  it('不再渲染三个零消费方的开关', () => {
    const wrapper = mountComponent()

    // 下列 key 已随 2026-09-22 孤儿文案清理删除（Task 7）；桩件对未命中 key 原样返回，
    // 断言对应 cell 不存在即断言这些开关没有被重新接回。
    for (const titleKey of [
      'mobile_notifications.push_notifications',
      'mobile_notifications.email_notifications',
      'mobile_notifications.encrypted_rooms'
    ]) {
      expect(cellWithTitle(wrapper, titleKey), `cell ${titleKey} should be gone`).toBeUndefined()
    }
  })

  it('切换页面内所有开关后不写入三个死 key', async () => {
    const wrapper = mountComponent()
    await vi.dynamicImportSettled()

    for (const control of wrapper.findAll('.van-switch')) {
      await control.trigger('click')
    }

    expect(localStorage.getItem('tjg-push-notifications')).toBeNull()
    expect(localStorage.getItem('tjg-email-notifications')).toBeNull()
    expect(localStorage.getItem('tjg-encrypted-room-notifications')).toBeNull()
  })

  it('保留总开关与 push 管理入口', () => {
    const wrapper = mountComponent()

    expect(cellWithTitle(wrapper, 'mobile_notifications.enable_notifications')).toBeDefined()
    expect(wrapper.find('[data-testid="notif-manage-push"]').exists()).toBe(true)
  })

  describe('notification display preferences', () => {
    it('exposes the three controls with defaults', () => {
      const wrapper = mountComponent()
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
      const wrapper = mountComponent()
      const vm = wrapper.vm as any
      expect(vm.contentSummary).toBe(false)
      expect(vm.keywordHighlight).toBe(false)
      expect(vm.priority).toBe('low')
      expect(vm.keywordsInput).toBe('deploy')
    })

    it('persists the content summary toggle through a real switch interaction', async () => {
      const wrapper = mountComponent()

      await switchInCell(wrapper, 'mobile_notifications.content_summary').trigger('click')

      const stored = JSON.parse(localStorage.getItem('tjg-notification-display-preferences') as string)
      expect(stored.contentSummary).toBe(false)
    })

    it('persists the keyword highlight toggle', () => {
      const wrapper = mountComponent()
      const vm = wrapper.vm as any
      vm.keywordHighlight = false
      vm.handleKeywordHighlightToggle()
      const stored = JSON.parse(localStorage.getItem('tjg-notification-display-preferences') as string)
      expect(stored.keywordHighlight).toBe(false)
    })

    it('keeps the desktop keyword notification switch untouched when this screen saves', () => {
      localStorage.setItem(
        'tjg-notification-display-preferences',
        JSON.stringify({
          contentSummary: true,
          keywordHighlight: true,
          keywordNotifications: true,
          keywords: [],
          priority: 'medium'
        })
      )
      const wrapper = mountComponent()
      const vm = wrapper.vm as any
      vm.contentSummary = false

      vm.handleContentSummaryToggle()

      const stored = JSON.parse(localStorage.getItem('tjg-notification-display-preferences') as string)
      expect(stored.contentSummary).toBe(false)
      expect(stored.keywordNotifications).toBe(true)
    })

    it('normalizes keywords on blur', () => {
      const wrapper = mountComponent()
      const vm = wrapper.vm as any
      vm.keywordsInput = ' deploy ,, DEPLOY ， 运维 '
      vm.handleKeywordsCommit()
      expect(vm.keywordsInput).toBe('deploy, 运维')
      const stored = JSON.parse(localStorage.getItem('tjg-notification-display-preferences') as string)
      expect(stored.keywords).toEqual(['deploy', '运维'])
    })

    it('persists a confirmed priority and closes the picker', () => {
      const wrapper = mountComponent()
      const vm = wrapper.vm as any
      vm.showPriorityPicker = true
      vm.handlePriorityConfirm({ selectedValues: ['high'] })
      expect(vm.priority).toBe('high')
      expect(vm.showPriorityPicker).toBe(false)
      const stored = JSON.parse(localStorage.getItem('tjg-notification-display-preferences') as string)
      expect(stored.priority).toBe('high')
    })

    it('ignores an unknown priority value', () => {
      const wrapper = mountComponent()
      const vm = wrapper.vm as any
      vm.handlePriorityConfirm({ selectedValues: ['urgent'] })
      expect(vm.priority).toBe('medium')
    })

    it('renders the priority labels from i18n keys', () => {
      const wrapper = mountComponent()
      const vm = wrapper.vm as any
      expect(vm.priorityColumns.map((c: any) => c.value)).toEqual(['low', 'medium', 'high'])
      expect(vm.priorityLabel).toBe('mobile_notifications.priority_medium')
    })

    it('renders the display section controls', () => {
      const wrapper = mountComponent()
      expect(wrapper.find('[data-testid="notif-content-summary"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="notif-keyword-highlight"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="notif-keywords"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="notif-priority"]').exists()).toBe(true)
    })
  })

  it('saves push rules on handleSave', async () => {
    const wrapper = mountComponent()
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
    const wrapper = mountComponent()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleSave()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('reverts notification toggle on failure', async () => {
    setPushRuleEnabledMock.mockRejectedValue(new Error('fail'))
    const wrapper = mountComponent()
    await vi.dynamicImportSettled()
    const vm = wrapper.vm as any
    await vm.handleNotificationsToggle(false)
    expect(vm.notificationsEnabled).toBe(true)
  })
})
