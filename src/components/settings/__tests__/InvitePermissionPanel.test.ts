import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import InvitePermissionPanel from '../InvitePermissionPanel.vue'

/**
 * 桌面邀请权限面板。
 *
 * 背景：该面板原先被 `SecuritySettings.vue` 以 `<InvitePermissionPanel />` 挂载，
 * **不传 props 也不接事件**，而面板自身没有任何状态与服务调用——三档模式点了没反应，
 * 名单加了也不落库，等于一个纯装饰组件。本次改为自包含（与移动端同一套 API）。
 */

const { getPolicyMock, getPolicyStrictMock, setPolicyMock } = vi.hoisted(() => ({
  getPolicyMock: vi.fn(),
  getPolicyStrictMock: vi.fn(),
  setPolicyMock: vi.fn()
}))

vi.mock('@/services/matrix', () => ({
  matrixAccountService: {
    getInvitePolicy: () => getPolicyMock(),
    getInvitePolicyStrict: () => getPolicyStrictMock(),
    setInvitePolicy: (...args: unknown[]) => setPolicyMock(...args)
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: ['value', 'options', 'type', 'size', 'bordered', 'disabled', 'placeholder'],
      emits: ['update:value'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    NRadioGroup: defineComponent({
      name: 'NRadioGroup',
      props: { value: { type: String, default: '' } },
      emits: ['update:value'],
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NRadioGroup', role: 'radiogroup' }, slots.default?.())
      }
    }),
    NRadio: defineComponent({
      name: 'NRadio',
      props: { value: { type: String, default: '' } },
      setup(props, { slots }) {
        return () =>
          h('label', { 'data-test': 'NRadio', 'data-value': props.value }, [
            h('input', { type: 'radio', value: props.value }),
            slots.default?.()
          ])
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: { value: { type: String, default: '' } },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            'data-test': 'NInput',
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    }),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { slots, emit }) {
        return () =>
          h('button', { type: 'button', 'data-test': 'NButton', onClick: () => emit('click') }, slots.default?.())
      }
    }),
    NSwitch: defineComponent({
      name: 'NSwitch',
      props: { value: { type: Boolean, default: false }, disabled: { type: Boolean, default: false } },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('button', {
            type: 'button',
            'data-test': 'NSwitch',
            'data-value': String(props.value),
            disabled: props.disabled,
            onClick: () => emit('update:value', !props.value)
          })
      }
    }),
    NSpin: passthrough('NSpin'),
    NTag: passthrough('NTag'),
    NList: passthrough('NList'),
    NListItem: passthrough('NListItem'),
    NFlex: passthrough('NFlex'),
    NSpace: passthrough('NSpace'),
    NEmpty: passthrough('NEmpty')
  }
})

describe('InvitePermissionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    getPolicyMock.mockResolvedValue({
      mode: 'allow_all',
      blocklist: [],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    // 写前重读走严格变体：默认与宽松变体同一份值
    getPolicyStrictMock.mockResolvedValue({
      mode: 'allow_all',
      blocklist: [],
      allowlist: [],
      allowStrangers: true,
      contacts: []
    })
    setPolicyMock.mockResolvedValue(true)
  })

  describe('自包含加载与持久化', () => {
    it('挂载时从 account data 加载策略', async () => {
      mount(InvitePermissionPanel)
      await flushPromises()
      expect(getPolicyMock).toHaveBeenCalled()
    })

    it('把加载到的模式反映到单选项上', async () => {
      getPolicyMock.mockResolvedValue({
        mode: 'blocklist',
        blocklist: ['@spam:evil.org'],
        allowlist: [],
        allowStrangers: true,
        contacts: []
      })
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()
      expect(wrapper.find('[data-test="blocklist-section"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="blocklist-section"]').text()).toContain('@spam:evil.org')
    })

    it('切换模式会写回 account data（不再只是 emit）', async () => {
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()
      wrapper.findComponent({ name: 'NRadioGroup' }).vm.$emit('update:value', 'blocklist')
      await flushPromises()
      expect(setPolicyMock).toHaveBeenCalledWith(expect.objectContaining({ mode: 'blocklist', allowStrangers: true }))
    })

    it('添加用户会写回 account data', async () => {
      getPolicyMock.mockResolvedValue({
        mode: 'blocklist',
        blocklist: [],
        allowlist: [],
        allowStrangers: true,
        contacts: []
      })
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()
      const section = wrapper.find('[data-test="blocklist-section"]')
      await section.find('[data-test="NInput"]').setValue('@new:example.com')
      await section.find('[data-test="add-blocklist-button"]').trigger('click')
      await flushPromises()
      expect(setPolicyMock).toHaveBeenCalledWith(expect.objectContaining({ blocklist: ['@new:example.com'] }))
    })

    it('同一用户不重复加入名单', async () => {
      getPolicyMock.mockResolvedValue({
        mode: 'blocklist',
        blocklist: ['@dup:example.com'],
        allowlist: [],
        allowStrangers: true,
        contacts: []
      })
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()
      const section = wrapper.find('[data-test="blocklist-section"]')
      await section.find('[data-test="NInput"]').setValue('@dup:example.com')
      await section.find('[data-test="add-blocklist-button"]').trigger('click')
      await flushPromises()
      expect(setPolicyMock).not.toHaveBeenCalled()
    })

    it('移除用户会写回 account data', async () => {
      getPolicyMock.mockResolvedValue({
        mode: 'blocklist',
        blocklist: ['@alice:example.com'],
        allowlist: [],
        allowStrangers: true,
        contacts: []
      })
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()
      const removeButton = wrapper.find('[data-test="blocklist-section"] [data-test="NListItem"] [data-test="NButton"]')
      await removeButton.trigger('click')
      await flushPromises()
      expect(setPolicyMock).toHaveBeenCalledWith(expect.objectContaining({ blocklist: [] }))
    })

    it('加载失败不抛错，退回默认策略', async () => {
      getPolicyMock.mockRejectedValue(new Error('offline'))
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()
      expect(wrapper.find('.invite-permission-panel').exists()).toBe(true)
      expect(wrapper.find('[data-test="blocklist-section"]').exists()).toBe(false)
    })

    it('保存失败不抛错', async () => {
      setPolicyMock.mockRejectedValue(new Error('boom'))
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()
      wrapper.findComponent({ name: 'NRadioGroup' }).vm.$emit('update:value', 'allowlist')
      await flushPromises()
      expect(wrapper.find('.invite-permission-panel').exists()).toBe(true)
    })

    /**
     * Important #2：`SecuritySettings` 同时挂了 `BlockedUsersSection`，两者写同一份
     * account data。面板挂载时的快照会过期，写前必须重读最新策略。
     */
    it('写回前重读最新策略，不覆盖另一编辑器的改动', async () => {
      getPolicyMock.mockResolvedValueOnce({
        mode: 'allow_all',
        blocklist: [],
        allowlist: [],
        allowStrangers: false,
        contacts: []
      })
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()

      // BlockedUsersSection 在面板挂载之后屏蔽了一个人（写前严格重读看得到）
      getPolicyStrictMock.mockResolvedValue({
        mode: 'allow_all',
        blocklist: ['@blocked:evil.org'],
        allowlist: [],
        allowStrangers: false,
        contacts: []
      })

      wrapper.findComponent({ name: 'NRadioGroup' }).vm.$emit('update:value', 'blocklist')
      await flushPromises()

      // 旧实现：面板用挂载时的空快照写回 → @blocked 被静默解除屏蔽
      expect(setPolicyMock).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'blocklist', blocklist: ['@blocked:evil.org'] })
      )
    })

    /**
     * 评审 Important #1（同类残留）：宽松的 `getInvitePolicy()` 读取失败时返回默认
     * 策略，写前重读若用它，会把账号上的 mode/blocklist/allowlist 静默覆盖成默认值。
     * 严格变体读取失败必须中止写入。
     */
    it('写前严格重读失败时中止写入，不拿默认策略覆盖账号', async () => {
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()

      getPolicyStrictMock.mockRejectedValue(new TypeError('read failed'))

      wrapper.findComponent({ name: 'NRadioGroup' }).vm.$emit('update:value', 'blocklist')
      await flushPromises()

      expect(setPolicyMock).not.toHaveBeenCalled()
    })

    /**
     * Important #3：`allowStrangers` 在 blocklist 模式下决定"非名单用户"是否放行，
     * 因此该模式下面板必须允许操作这个开关；只有 allowlist 由名单独占决定。
     */
    it('blocklist 模式下允许非联系人私聊开关可用，且不再显示失效提示', () => {
      const wrapper = mount(InvitePermissionPanel, {
        props: { visible: true, mode: 'blocklist', blocklist: [], allowlist: [] }
      })
      const toggle = wrapper.find('[data-test="allow-strangers"]')
      expect(toggle.exists()).toBe(true)
      expect(toggle.attributes('disabled')).toBeUndefined()
      expect(wrapper.find('[data-test="allow-strangers-note"]').exists()).toBe(false)
    })

    it('allowlist 模式下开关禁用并提示名单决定一切', () => {
      const wrapper = mount(InvitePermissionPanel, {
        props: { visible: true, mode: 'allowlist', blocklist: [], allowlist: [] }
      })
      expect(wrapper.find('[data-test="allow-strangers"]').attributes('disabled')).toBeDefined()
      expect(wrapper.find('[data-test="allow-strangers-note"]').exists()).toBe(true)
    })

    it('allow_all 模式下开关可用且不显示失效提示', () => {
      const wrapper = mount(InvitePermissionPanel, {
        props: { visible: true, mode: 'allow_all', blocklist: [], allowlist: [] }
      })
      expect(wrapper.find('[data-test="allow-strangers"]').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('[data-test="allow-strangers-note"]').exists()).toBe(false)
    })

    it('blocklist 模式下切换开关会写回且不丢名单', async () => {
      const policy = {
        mode: 'blocklist',
        blocklist: ['@spam:evil.org'],
        allowlist: [],
        allowStrangers: false,
        contacts: []
      }
      getPolicyMock.mockResolvedValue(policy)
      getPolicyStrictMock.mockResolvedValue(policy)
      const wrapper = mount(InvitePermissionPanel)
      await flushPromises()
      await wrapper.find('[data-test="allow-strangers"]').trigger('click')
      await flushPromises()
      expect(setPolicyMock).toHaveBeenCalledWith(
        expect.objectContaining({ allowStrangers: true, blocklist: ['@spam:evil.org'] })
      )
    })
  })

  it('visible=true 时渲染面板', () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: { visible: true, mode: 'allow_all', blocklist: [], allowlist: [] }
    })
    expect(wrapper.find('.invite-permission-panel').exists()).toBe(true)
  })

  it('visible=false 时不渲染', () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: { visible: false, mode: 'allow_all', blocklist: [], allowlist: [] }
    })
    expect(wrapper.find('.invite-permission-panel').exists()).toBe(false)
  })

  it('面板有 role=region 可访问性属性', () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: { visible: true, mode: 'allow_all', blocklist: [], allowlist: [] }
    })
    expect(wrapper.find('.invite-permission-panel').attributes('role')).toBe('region')
  })

  it('显示三种模式选项（allow_all / blocklist / allowlist）', () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: { visible: true, mode: 'allow_all', blocklist: [], allowlist: [] }
    })
    const radios = wrapper.findAll('[data-test="NRadio"]')
    expect(radios).toHaveLength(3)
    const values = radios.map((r) => r.attributes('data-value'))
    expect(values).toEqual(['allow_all', 'blocklist', 'allowlist'])
  })

  it('切换模式时触发 mode-change 事件', async () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: { visible: true, mode: 'allow_all', blocklist: [], allowlist: [] }
    })
    const radioGroup = wrapper.findComponent({ name: 'NRadioGroup' })
    radioGroup.vm.$emit('update:value', 'blocklist')
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('mode-change')).toBeTruthy()
    expect(wrapper.emitted('mode-change')?.[0]).toEqual(['blocklist'])
  })

  it('blocklist 模式下显示黑名单列表', () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: {
        visible: true,
        mode: 'blocklist',
        blocklist: ['@alice:example.com'],
        allowlist: []
      }
    })
    const section = wrapper.find('[data-test="blocklist-section"]')
    expect(section.exists()).toBe(true)
    expect(section.text()).toContain('@alice:example.com')
  })

  it('allowlist 模式下显示白名单列表', () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: {
        visible: true,
        mode: 'allowlist',
        blocklist: [],
        allowlist: ['@bob:example.com']
      }
    })
    const section = wrapper.find('[data-test="allowlist-section"]')
    expect(section.exists()).toBe(true)
    expect(section.text()).toContain('@bob:example.com')
  })

  it('添加用户到黑名单时触发 add-user 事件', async () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: { visible: true, mode: 'blocklist', blocklist: [], allowlist: [] }
    })
    const section = wrapper.find('[data-test="blocklist-section"]')
    await section.find('[data-test="NInput"]').setValue('@newuser:example.com')
    await section.find('[data-test="add-blocklist-button"]').trigger('click')
    expect(wrapper.emitted('add-user')).toBeTruthy()
    expect(wrapper.emitted('add-user')?.[0]).toEqual(['blocklist', '@newuser:example.com'])
  })

  it('添加用户到白名单时触发 add-user 事件', async () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: { visible: true, mode: 'allowlist', blocklist: [], allowlist: [] }
    })
    const section = wrapper.find('[data-test="allowlist-section"]')
    await section.find('[data-test="NInput"]').setValue('@newuser2:example.com')
    await section.find('[data-test="add-allowlist-button"]').trigger('click')
    expect(wrapper.emitted('add-user')?.[0]).toEqual(['allowlist', '@newuser2:example.com'])
  })

  it('移除用户时触发 remove-user 事件', async () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: {
        visible: true,
        mode: 'blocklist',
        blocklist: ['@alice:example.com'],
        allowlist: []
      }
    })
    const removeButton = wrapper.find('[data-test="blocklist-section"] [data-test="NListItem"] [data-test="NButton"]')
    await removeButton.trigger('click')
    expect(wrapper.emitted('remove-user')).toBeTruthy()
    expect(wrapper.emitted('remove-user')?.[0]).toEqual(['blocklist', '@alice:example.com'])
  })
})
