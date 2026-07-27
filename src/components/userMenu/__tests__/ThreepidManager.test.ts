import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThreepidManager from '../ThreepidManager.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const NList = defineComponent({
    name: 'NList',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-list' }, slots.default?.())
    }
  })

  const NListItem = defineComponent({
    name: 'NListItem',
    setup(_, { slots }) {
      return () => h('div', { class: 'n-list-item' }, slots.default?.())
    }
  })

  const NInput = defineComponent({
    name: 'NInput',
    props: {
      value: { type: String, default: '' },
      placeholder: { type: String, default: '' }
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          class: 'n-input',
          value: props.value,
          placeholder: props.placeholder,
          onInput: (e: Event) => emit('update:value', (e.target as HTMLInputElement).value)
        })
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    props: {
      type: { type: String, default: 'default' },
      size: { type: String, default: 'medium' }
    },
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () => h('button', { class: 'n-button', type: 'button', onClick: () => emit('click') }, slots.default?.())
    }
  })

  const NSelect = defineComponent({
    name: 'NSelect',
    props: {
      value: { type: String, default: '' },
      options: { type: Array, default: () => [] }
    },
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h(
          'select',
          {
            class: 'n-select',
            value: props.value,
            onChange: (e: Event) => emit('update:value', (e.target as HTMLSelectElement).value)
          },
          props.options.map((opt: any) => h('option', { value: opt.value }, opt.label))
        )
    }
  })

  const NEmpty = defineComponent({
    name: 'NEmpty',
    props: { description: { type: String, default: '' } },
    setup(props) {
      return () => h('div', { class: 'n-empty' }, props.description)
    }
  })

  return { NButton, NEmpty, NInput, NList, NListItem, NSelect }
})

describe('ThreepidManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('渲染已绑定邮箱列表', () => {
    const wrapper = mount(ThreepidManager, {
      props: {
        emails: [{ address: 'alice@example.com' }, { address: 'bob@example.com' }],
        phones: []
      }
    })

    const items = wrapper.findAll('[data-testid="email-address"]')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toBe('alice@example.com')
    expect(items[1].text()).toBe('bob@example.com')
  })

  it('渲染已绑定手机号列表（脱敏显示）', () => {
    const wrapper = mount(ThreepidManager, {
      props: {
        emails: [],
        phones: [{ address: '+8613812341234' }]
      }
    })

    expect(wrapper.find('[data-testid="phone-masked"]').text()).toBe('+86 138****1234')
  })

  it('点击解绑按钮触发 unbind 事件', async () => {
    const wrapper = mount(ThreepidManager, {
      props: {
        emails: [{ address: 'alice@example.com' }],
        phones: [{ address: '+8613812341234' }]
      }
    })

    await wrapper.find('[data-testid="unbind-email"]').trigger('click')

    expect(wrapper.emitted('unbind')).toBeTruthy()
    expect(wrapper.emitted('unbind')![0]).toEqual(['email', 'alice@example.com'])
  })

  it('添加邮箱表单（输入邮箱 → 触发 add-email 事件）', async () => {
    const wrapper = mount(ThreepidManager, {
      props: { emails: [], phones: [] }
    })

    await wrapper.find('[data-testid="new-email-input"]').setValue('new@example.com')
    await wrapper.find('[data-testid="add-email-btn"]').trigger('click')

    expect(wrapper.emitted('add-email')).toBeTruthy()
    expect(wrapper.emitted('add-email')![0]).toEqual(['new@example.com'])
  })

  it('添加手机号表单（国家区号 + 手机号 → 触发 add-phone 事件）', async () => {
    const wrapper = mount(ThreepidManager, {
      props: { emails: [], phones: [] }
    })

    await wrapper.find('[data-testid="country-code-select"]').setValue('+1')
    await wrapper.find('[data-testid="new-phone-input"]').setValue('5551234567')
    await wrapper.find('[data-testid="add-phone-btn"]').trigger('click')

    expect(wrapper.emitted('add-phone')).toBeTruthy()
    expect(wrapper.emitted('add-phone')![0]).toEqual(['+1', '5551234567'])
  })

  it('空列表时显示空状态提示', () => {
    const wrapper = mount(ThreepidManager, {
      props: { emails: [], phones: [] }
    })

    expect(wrapper.findAll('.n-empty')).toHaveLength(2)
  })

  it('组件有 role=region 可访问性属性', () => {
    const wrapper = mount(ThreepidManager, {
      props: { emails: [], phones: [] }
    })

    expect(wrapper.find('[role="region"]').exists()).toBe(true)
  })

  it('手机号脱敏格式为 +86 138****1234', () => {
    const wrapper = mount(ThreepidManager, {
      props: {
        emails: [],
        phones: [{ address: '+8613812341234' }, { address: '+8613900005678' }]
      }
    })

    const masked = wrapper.findAll('[data-testid="phone-masked"]')
    expect(masked[0].text()).toBe('+86 138****1234')
    expect(masked[1].text()).toBe('+86 139****5678')
  })
})
