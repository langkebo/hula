import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import InvitePermissionPanel from '../InvitePermissionPanel.vue'

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
    NTag: passthrough('NTag'),
    NList: passthrough('NList'),
    NListItem: passthrough('NListItem'),
    NFlex: passthrough('NFlex'),
    NSpace: passthrough('NSpace'),
    NEmpty: passthrough('NEmpty')
  }
})

describe('InvitePermissionPanel', () => {
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
    await section.find('[data-test="NButton"]').trigger('click')
    expect(wrapper.emitted('add-user')).toBeTruthy()
    expect(wrapper.emitted('add-user')?.[0]).toEqual(['blocklist', '@newuser:example.com'])
  })

  it('添加用户到白名单时触发 add-user 事件', async () => {
    const wrapper = mount(InvitePermissionPanel, {
      props: { visible: true, mode: 'allowlist', blocklist: [], allowlist: [] }
    })
    const section = wrapper.find('[data-test="allowlist-section"]')
    await section.find('[data-test="NInput"]').setValue('@newuser2:example.com')
    await section.find('[data-test="NButton"]').trigger('click')
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
