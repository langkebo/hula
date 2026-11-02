import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18nMock, resolveMessage } from '~/tests/i18n-messages'
import MsgInputToolbar from '../MsgInputToolbar.vue'

vi.mock('vue-i18n', () => ({
  ...createI18nMock(),
  I18nT: { name: 'I18nT', template: '<span><slot /></span>' }
}))
vi.mock('@/utils/PlatformConstants', () => ({ isMac: () => false }))

const mountComponent = (delayedSupported: boolean) =>
  mount(MsgInputToolbar, {
    props: {
      disabledSend: false,
      isAIMode: false,
      isAIStreaming: false,
      isSharing: false,
      delayedSupported,
      arrow: false,
      chatKey: 'Enter',
      sendOptions: []
    },
    global: {
      stubs: {
        Tooltip: {
          template: '<div><slot name="trigger" /><slot /></div>'
        },
        Button: {
          name: 'Button',
          emits: ['click'],
          template: '<button type="button" @click="$emit(\'click\')"><slot /><slot name="icon" /></button>'
        },
        ButtonGroup: { template: '<div><slot /></div>' },
        Popselect: { template: '<div><slot /><slot name="action" /></div>' },
        Flex: { template: '<div><slot /></div>' }
      }
    }
  })

const findScheduledButton = (wrapper: ReturnType<typeof mountComponent>) => {
  const label = resolveMessage('delayed_events.entry')
  return wrapper.findAllComponents({ name: 'Button' }).find((button) => button.attributes('aria-label') === label)
}

describe('MsgInputToolbar delayed-send entry', () => {
  it('does not render the entry when the server lacks MSC4140 support', () => {
    const wrapper = mountComponent(false)

    expect(findScheduledButton(wrapper)).toBeUndefined()
  })

  it('renders the entry and emits openDelayedModal when supported', async () => {
    const wrapper = mountComponent(true)
    const scheduledButton = findScheduledButton(wrapper)

    expect(scheduledButton).toBeTruthy()

    await scheduledButton?.trigger('click')
    expect(wrapper.emitted('openDelayedModal')).toHaveLength(1)
  })
})
