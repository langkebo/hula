import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18nMock, resolveMessage } from '~/tests/i18n-messages'
import DelayedMessagesModal from '../DelayedMessagesModal.vue'

vi.mock('vue-i18n', () => createI18nMock())

const items = [
  {
    delayId: 7,
    roomId: '!room:example.org',
    type: 'm.room.message',
    delayMs: 300000,
    scheduledAt: Date.now(),
    content: { msgtype: 'm.text', body: 'lunch reminder' }
  }
]

const mountComponent = (overrides: Record<string, unknown> = {}) =>
  mount(DelayedMessagesModal, {
    props: {
      show: true,
      items: [],
      loading: false,
      draftAvailable: true,
      roomNames: { '!room:example.org': 'Team room' },
      ...overrides
    },
    global: {
      stubs: {
        Modal: {
          template: '<div><slot /></div>'
        },
        Spin: {
          template: '<div><slot /></div>'
        },
        Button: {
          name: 'Button',
          props: ['disabled'],
          emits: ['click'],
          template: '<button type="button" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>'
        },
        Popselect: {
          name: 'Popselect',
          props: ['options'],
          emits: ['update:value'],
          template: '<div><slot /></div>'
        }
      }
    }
  })

const findButton = (wrapper: ReturnType<typeof mountComponent>, key: string) => {
  const text = resolveMessage(key) ?? key
  return wrapper.findAllComponents({ name: 'Button' }).find((button) => button.text().includes(text))
}

describe('DelayedMessagesModal', () => {
  it('shows the empty state when there are no pending messages', () => {
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain(resolveMessage('delayed_events.pending.empty'))
    expect(wrapper.text()).not.toContain('lunch reminder')
  })

  it('renders pending message details with room name, preview and actions', () => {
    const wrapper = mountComponent({ items })

    expect(wrapper.text()).toContain('Team room')
    expect(wrapper.text()).toContain('lunch reminder')
    expect(wrapper.text()).toContain(resolveMessage('delayed_events.actions.cancel'))
    expect(wrapper.text()).toContain(resolveMessage('delayed_events.actions.send_now'))
    expect(wrapper.text()).toContain(resolveMessage('delayed_events.actions.reschedule'))
  })

  it('emits schedule with the chosen preset delay', async () => {
    const wrapper = mountComponent()
    const presetButton = wrapper.findAllComponents({ name: 'Button' })[0]

    await presetButton.trigger('click')

    expect(wrapper.emitted('schedule')?.[0]).toEqual([5 * 60_000])
  })

  it('emits cancel and send-now for the selected task', async () => {
    const wrapper = mountComponent({ items })
    const sendNowButton = findButton(wrapper, 'delayed_events.actions.send_now')
    const cancelButton = findButton(wrapper, 'delayed_events.actions.cancel')

    await sendNowButton?.trigger('click')
    await cancelButton?.trigger('click')

    expect(wrapper.emitted('sendNow')?.[0]).toEqual([7])
    expect(wrapper.emitted('cancel')?.[0]).toEqual([7])
  })
})
