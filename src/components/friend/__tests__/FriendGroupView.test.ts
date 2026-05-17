import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import FriendGroupView from '../FriendGroupView.vue'

const { groupsMock, useFriendsMock } = vi.hoisted(() => ({
  groupsMock: [
    { group_id: 'group-1', name: 'Design Team', member_count: 3 },
    { group_id: 'group-2', name: 'Backend Guild', member_count: 5 }
  ],
  useFriendsMock: {
    getFriendGroups: vi.fn(),
    createFriendGroup: vi.fn(),
    renameFriendGroup: vi.fn(),
    deleteFriendGroup: vi.fn()
  }
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === 'friend.group.result_count') {
        return `friend.group.result_count:${params?.keyword ?? ''}:${params?.count ?? ''}`
      }

      return key
    }
  })
}))

vi.mock('@/composables/useFriends', () => ({
  useFriends: () => useFriendsMock
}))

vi.mock('naive-ui', () => {
  const passthrough = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', { 'data-test': name }, slots.default?.())
      }
    })

  return {
    useMessage: () => ({
      success: vi.fn(),
      error: vi.fn()
    }),
    NIcon: passthrough('NIcon'),
    NFlex: passthrough('NFlex'),
    NButton: defineComponent({
      name: 'NButton',
      emits: ['click'],
      setup(_, { emit, slots }) {
        return () =>
          h(
            'button',
            {
              type: 'button',
              'data-test': 'NButton',
              onClick: () => emit('click')
            },
            [...(slots.icon?.() ?? []), ...(slots.default?.() ?? [])]
          )
      }
    }),
    NDivider: passthrough('NDivider'),
    NSpin: passthrough('NSpin'),
    NScrollbar: passthrough('NScrollbar'),
    NEmpty: defineComponent({
      name: 'NEmpty',
      props: {
        description: {
          type: String,
          default: ''
        }
      },
      setup(props) {
        return () => h('div', { 'data-test': 'NEmpty', 'data-description': props.description })
      }
    }),
    NModal: passthrough('NModal'),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: {
          type: String,
          default: ''
        }
      },
      emits: ['update:value'],
      setup(props, { emit }) {
        return () =>
          h('input', {
            value: props.value,
            onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
          })
      }
    }),
    NDropdown: passthrough('NDropdown')
  }
})

vi.mock('@/components/friend/FriendSearchBar.vue', () => ({
  default: defineComponent({
    name: 'FriendSearchBarStub',
    props: {
      modelValue: {
        type: String,
        default: ''
      },
      history: {
        type: Array,
        default: () => []
      },
      showHistory: {
        type: Boolean,
        default: false
      }
    },
    emits: ['update:modelValue', 'search', 'select-history', 'clear-history'],
    setup(props, { emit }) {
      return () =>
        h('div', { 'data-test': 'friend-search-bar-stub' }, [
          h('div', { 'data-test': 'friend-search-history-visible' }, String(props.showHistory)),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'friend-search-trigger',
              onClick: () => emit('search', 'design')
            },
            'search'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-test': 'friend-search-select-history',
              onClick: () => emit('select-history', 'Backend')
            },
            'select-history'
          )
        ])
    }
  })
}))

describe('FriendGroupView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useFriendsMock.getFriendGroups.mockResolvedValue(groupsMock)
  })

  it('filters groups via the shared search bar and renders unified search summary feedback', async () => {
    localStorage.setItem(
      'hula-friend-group-search-history',
      JSON.stringify([{ value: 'Backend', updatedAt: Date.now() }])
    )

    const wrapper = mount(FriendGroupView)
    await flushPromises()

    expect(wrapper.get('[data-test="friend-search-history-visible"]').text()).toBe('true')
    expect(wrapper.text()).toContain('Design Team')
    expect(wrapper.text()).toContain('Backend Guild')

    await wrapper.get('[data-test="friend-search-trigger"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('friend.group.result_count:design:1')
    expect(wrapper.text()).toContain('friend.search.clear_current')
    expect(wrapper.text()).toContain('Design Team')
    expect(wrapper.text()).not.toContain('Backend Guild')

    await wrapper.get('.friend-group-view__search-clear').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Design Team')
    expect(wrapper.text()).toContain('Backend Guild')
    expect(wrapper.text()).not.toContain('friend.group.result_count:design:1')

    await wrapper.get('[data-test="friend-search-select-history"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Backend Guild')
    expect(wrapper.text()).not.toContain('Design Team')
  })
})
