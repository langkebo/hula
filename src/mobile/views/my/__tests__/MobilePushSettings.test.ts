import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MobilePushSettings from '../MobilePushSettings.vue'

/**
 * 移动端推送设置（方案 5.2）。
 *
 * 缺口背景：移动端此前**没有推送设置页**，推送规则与已注册的推送设备完全不可见
 * （桌面 PushSettings.vue 已有）。本页补齐三项：推送总开关、按 kind 的规则开关、
 * 推送设备列表（pushkey 掩码 + 启用状态）。
 */

const { showToastMock, getPushersMock, getPushRulesMock, setMasterRuleEnabledMock, setPushRuleEnabledMock } =
  vi.hoisted(() => ({
    showToastMock: vi.fn(),
    getPushersMock: vi.fn(),
    getPushRulesMock: vi.fn(),
    setMasterRuleEnabledMock: vi.fn(),
    setPushRuleEnabledMock: vi.fn()
  }))

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

vi.mock('@/services/matrix/notifications/MatrixPushService', () => ({
  matrixPushService: {
    getPushers: () => getPushersMock(),
    getPushRules: () => getPushRulesMock(),
    setMasterRuleEnabled: (...args: any[]) => setMasterRuleEnabledMock(...args),
    setPushRuleEnabled: (...args: any[]) => setPushRuleEnabledMock(...args)
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
  default: { name: 'HeaderBar', template: '<div />', props: ['border', 'isOfficial', 'hiddenRight', 'roomName'] }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

/**
 * Vant 组件在测试环境里必须显式 stub：
 * 模板写的是 kebab-case，`vi.mock('vant')` 拦不住编译期解析出的真实模块，
 * 未解析的标签会被当成原生元素渲染，**具名插槽内容（#value/#right-icon）会被整体丢弃**，
 * 于是断言会以「元素不存在」的形式失败，而不是报组件未注册。
 * stub 需要显式渲染具名插槽，否则同样看不到内容。
 */
const vantStubs = (() => {
  const names = [
    'VanCellGroup',
    'VanCell',
    'VanField',
    'VanSwitch',
    'VanRadioGroup',
    'VanRadio',
    'VanButton',
    'VanPopup',
    'VanPicker',
    'VanLoading'
  ]
  const stubs: Record<string, { name: string; template: string }> = {}
  for (const name of names) {
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
    stubs[name] = {
      name,
      template:
        '<div v-bind="$attrs"><slot name="icon" /><slot name="title" /><slot name="label" /><slot /><slot name="value" /><slot name="right-icon" /></div>'
    }
    stubs[kebab] = stubs[name]
  }
  return stubs
})()

function mountPage() {
  return mount(MobilePushSettings, { global: { stubs: vantStubs } })
}

describe('MobilePushSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getPushersMock.mockResolvedValue([])
    getPushRulesMock.mockResolvedValue({ global: {} })
    setMasterRuleEnabledMock.mockResolvedValue(undefined)
    setPushRuleEnabledMock.mockResolvedValue(undefined)
  })

  it('renders correctly', () => {
    expect(mountPage().html()).toBeTruthy()
  })

  it('loads pushers and rules on mount', async () => {
    mountPage()
    await flushPromises()
    expect(getPushersMock).toHaveBeenCalled()
    expect(getPushRulesMock).toHaveBeenCalled()
  })

  it('shows the empty state when there are no devices', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).pushers).toEqual([])
    expect(wrapper.find('[data-testid="push-empty"]').exists()).toBe(true)
  })

  it('masks the push key instead of rendering it verbatim', async () => {
    getPushersMock.mockResolvedValue([
      {
        app_id: 'im.tjg.app',
        pushkey: 'APUSHKEYTHATISVERYLONG',
        device_display_name: 'Pixel',
        app_display_name: 'TJG',
        kind: 'http'
      }
    ])
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.text()).not.toContain('APUSHKEYTHATISVERYLONG')
    expect(wrapper.find('[data-testid="push-device-key"]').text()).toBe('APUSHK...RYLONG')
  })

  it('drops pushers without a pushkey', async () => {
    getPushersMock.mockResolvedValue([{ app_id: 'x', pushkey: '', device_display_name: 'Ghost' }])
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).pushers).toHaveLength(0)
  })

  it('renders a device row per pusher', async () => {
    getPushersMock.mockResolvedValue([
      { app_id: 'a', pushkey: 'k'.repeat(20), device_display_name: 'A', kind: 'http' },
      { app_id: 'b', pushkey: 'j'.repeat(20), device_display_name: 'B', kind: 'http' }
    ])
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="push-device"]')).toHaveLength(2)
  })

  it('marks a disabled pusher as disabled', async () => {
    getPushersMock.mockResolvedValue([
      { app_id: 'a', pushkey: 'k'.repeat(20), device_display_name: 'A', kind: 'http', enabled: false }
    ])
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.find('[data-testid="push-device-state"]').text()).toBe('mobile_push.device_disabled')
  })

  it('groups rules by kind and only renders non-empty kinds', async () => {
    getPushRulesMock.mockResolvedValue({
      global: {
        override: [{ rule_id: '.m.rule.master', enabled: true }],
        content: [{ rule_id: 'keywords', enabled: true }]
      }
    })
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    expect(vm.groupedRules.override.map((r: any) => r.rule_id)).toEqual(['.m.rule.master'])
    expect(vm.visibleKinds).toEqual(['override', 'content'])
    expect(wrapper.findAll('[data-testid="push-rule"]')).toHaveLength(2)
  })

  it('derives the master switch from the master rule', async () => {
    getPushRulesMock.mockResolvedValue({ global: { override: [{ rule_id: '.m.rule.master', enabled: false }] } })
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).masterEnabled).toBe(false)
  })

  it('defaults the master switch to on when the rule is absent', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).masterEnabled).toBe(true)
  })

  it('toggles the master rule', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await (wrapper.vm as any).handleMasterToggle(false)
    expect(setMasterRuleEnabledMock).toHaveBeenCalledWith(false)
  })

  it('reverts the master switch when the toggle fails', async () => {
    setMasterRuleEnabledMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    await vm.handleMasterToggle(false)
    expect(vm.masterEnabled).toBe(true)
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('toggles a single rule with the correct kind and id', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    const rule = { rule_id: 'keywords', enabled: true }
    await vm.handleRuleToggle('content', rule, false)
    expect(setPushRuleEnabledMock).toHaveBeenCalledWith('global', 'content', 'keywords', false)
  })

  it('keeps the rule state unchanged when a rule toggle fails', async () => {
    setPushRuleEnabledMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    const vm = wrapper.vm as any
    const rule = { rule_id: 'keywords', enabled: true }
    await vm.handleRuleToggle('content', rule, false)
    expect(rule.enabled).toBe(true)
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('surfaces a toast when loading pushers fails', async () => {
    getPushersMock.mockRejectedValue(new Error('boom'))
    mountPage()
    await flushPromises()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('surfaces a toast when loading rules fails', async () => {
    getPushRulesMock.mockRejectedValue(new Error('boom'))
    mountPage()
    await flushPromises()
    expect(showToastMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'fail' }))
  })

  it('stops loading even when both loads fail', async () => {
    getPushersMock.mockRejectedValue(new Error('boom'))
    getPushRulesMock.mockRejectedValue(new Error('boom'))
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).loading).toBe(false)
  })

  it('shows the no-rules hint when no rule is returned', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect((wrapper.vm as any).totalRules).toBe(0)
    expect(wrapper.text()).toContain('mobile_push.no_rules')
  })
})
