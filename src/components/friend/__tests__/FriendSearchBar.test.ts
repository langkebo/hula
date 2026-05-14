import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import FriendSearchBar from '../FriendSearchBar.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

describe('FriendSearchBar', () => {
  const globalStubs = {
    NInput: {
      props: ['value'],
      template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />'
    }
  }

  it('renders correctly and handles input', async () => {
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

    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['alice'])
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
})
