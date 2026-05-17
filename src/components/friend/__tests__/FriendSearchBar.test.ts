import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FriendSearchBar from '../FriendSearchBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('FriendSearchBar', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  const globalStubs = {
    NInput: {
      props: ['value'],
      template: `
        <input
          :value="value"
          @input="$emit('update:value', $event.target.value)"
          @keydown="$emit('keydown', $event)"
        />
      `
    }
  }

  it('renders correctly and handles input', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FriendSearchBar, {
      props: {
        modelValue: '',
        placeholder: 'Search friends'
      },
      global: {
        stubs: globalStubs
      }
    })

    const input = wrapper.find('input')
    await input.setValue('alice')
    vi.advanceTimersByTime(240)

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['alice'])
    expect(wrapper.emitted('search')?.[0]).toEqual(['alice'])
  })

  it('renders history chips and emits select-history', async () => {
    const history = ['alice', 'bob']
    const wrapper = mount(FriendSearchBar, {
      props: {
        modelValue: '',
        history
      },
      global: {
        stubs: globalStubs
      }
    })

    const chips = wrapper.findAll('.friend-search-bar__chip')
    expect(chips).toHaveLength(2)
    expect(chips[0].text()).toBe('alice')

    await chips[1].trigger('click')
    expect(wrapper.emitted('select-history')?.[0]).toEqual(['bob'])
  })

  it('emits clear-history event', async () => {
    const wrapper = mount(FriendSearchBar, {
      props: {
        modelValue: '',
        history: ['alice']
      },
      global: {
        stubs: globalStubs
      }
    })

    await wrapper.find('.friend-search-bar__clear').trigger('click')
    expect(wrapper.emitted('clear-history')).toBeTruthy()
  })

  it('does not render history panel when history is empty or disabled', () => {
    const emptyHistoryWrapper = mount(FriendSearchBar, {
      props: {
        modelValue: '',
        history: []
      },
      global: {
        stubs: globalStubs
      }
    })

    const hiddenHistoryWrapper = mount(FriendSearchBar, {
      props: {
        modelValue: '',
        history: ['alice'],
        showHistory: false
      },
      global: {
        stubs: globalStubs
      }
    })

    expect(emptyHistoryWrapper.find('.friend-search-bar__history').exists()).toBe(false)
    expect(hiddenHistoryWrapper.find('.friend-search-bar__history').exists()).toBe(false)
  })

  it('triggers search immediately when pressing Enter', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FriendSearchBar, {
      props: {
        modelValue: 'alice',
        placeholder: 'Search friends'
      },
      global: {
        stubs: globalStubs
      }
    })

    const input = wrapper.find('input')
    await input.trigger('keydown.enter')

    expect(wrapper.emitted('search')).toEqual([['alice']])

    vi.advanceTimersByTime(240)
    expect(wrapper.emitted('search')).toEqual([['alice']])
  })
})
