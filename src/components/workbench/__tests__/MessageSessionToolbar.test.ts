import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MessageSessionToolbar from '../MessageSessionToolbar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent, h } = await import('vue')

  const passthrough = (name: string) =>
    defineComponent({
      name,
      props: ['value'],
      emits: ['update:value', 'click'],
      setup(props, { emit, slots }) {
        return () =>
          h(
            'button',
            {
              'data-test': name,
              'data-value': props.value ?? '',
              onClick: () => emit('click'),
              onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
            },
            slots.default?.()
          )
      }
    })

  return {
    NButton: passthrough('NButton'),
    NFlex: defineComponent({
      name: 'NFlex',
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NFlex' }, slots.default?.())
      }
    }),
    NIcon: defineComponent({
      name: 'NIcon',
      setup(_, { slots }) {
        return () => h('div', { 'data-test': 'NIcon' }, slots.default?.())
      }
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: ['value'],
      emits: ['update:value'],
      setup(props, { emit, slots }) {
        return () =>
          h('label', { 'data-test': 'NInput' }, [
            slots.prefix?.(),
            h('input', {
              value: props.value,
              onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
            })
          ])
      }
    }),
    NDivider: defineComponent({
      name: 'NDivider',
      setup() {
        return () => h('div', { 'data-test': 'NDivider' })
      }
    })
  }
})

describe('MessageSessionToolbar', () => {
  it('renders a room-specific title and filtered summary badge', () => {
    const wrapper = mount(MessageSessionToolbar, {
      props: {
        title: '房间',
        searchKeyword: '',
        sessionTypeFilter: 'all',
        sessionEngagementFilter: 'unread',
        sessionSort: 'recent',
        filteredCount: 4,
        totalCount: 12
      }
    })

    expect(wrapper.text()).toContain('房间')
    expect(wrapper.text()).toContain('4/12')
  })

  it('emits create and join actions when corresponding buttons are visible', async () => {
    const wrapper = mount(MessageSessionToolbar, {
      props: {
        searchKeyword: '',
        sessionTypeFilter: 'all',
        sessionEngagementFilter: 'all',
        sessionSort: 'recent',
        filteredCount: 0,
        totalCount: 0,
        showCreateAction: true,
        showJoinAction: true
      }
    })

    const buttons = wrapper.findAll('[data-test="NButton"]')
    await buttons[0]?.trigger('click')
    await buttons[1]?.trigger('click')

    expect(wrapper.emitted('joinRoom')).toHaveLength(1)
    expect(wrapper.emitted('createRoom')).toHaveLength(1)
  })
})
