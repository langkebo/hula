import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'
import { OPENCLAW_WORKBENCH_KEY } from '../../composables/useOpenClawContext'
import OpenClawComposer from '../OpenClawComposer.vue'

describe('OpenClawComposer', () => {
  let mockContext: any

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Create a fresh reactive mock context for each test
    mockContext = {
      inputMessage: '',
      isSending: false,
      canSend: true,
      availableModels: ['gpt-4o', 'gpt-4-turbo'],
      selectedModelId: 'gpt-4o',
      translate: vi.fn((key) => key),
      handleSend: vi.fn(),
      handleStopGeneration: vi.fn(),
      getCurrentConversation: vi.fn(() => ({ id: 'conv-1', messages: [] })),
      updateCurrentConversation: vi.fn(),
      getAvailableModels: vi.fn(() => ['gpt-4o', 'gpt-4-turbo']),
      getSelectedModelId: vi.fn(() => 'gpt-4o'),
      setSelectedModelId: vi.fn(),
      showFeedback: vi.fn(),
      focusConfigSection: vi.fn(),
      openSearch: vi.fn(),
      scrollToBottom: vi.fn()
    }
  })

  const mountComponent = (ctxOverrides = {}) => {
    const ctx = reactive({ ...mockContext, ...ctxOverrides })
    return mount(OpenClawComposer, {
      global: {
        plugins: [createPinia()],
        provide: {
          [OPENCLAW_WORKBENCH_KEY as any]: ctx
        }
      }
    })
  }

  vi.mock('naive-ui', () => ({
    NInput: {
      name: 'NInput',
      template: '<input class="n-input" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
      props: ['value'],
      setup() {
        return {
          focus: vi.fn()
        }
      }
    },
    NButton: {
      name: 'NButton',
      template: '<button class="n-button" @click="$emit(\'click\')"><slot /></button>'
    },
    NTooltip: {
      name: 'NTooltip',
      template: '<div><slot name="trigger" /><slot /></div>'
    },
    NScrollbar: {
      name: 'NScrollbar',
      template: '<div><slot /></div>'
    }
  }))

  it('renders correctly', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('.openclaw-workbench__composer').exists()).toBe(true)
    expect(wrapper.find('.n-input').exists()).toBe(true)
  })

  it('shows slash command menu when input starts with /', async () => {
    const wrapper = mountComponent()
    const input = wrapper.find('.n-input')

    await input.setValue('/')
    await nextTick()

    // Check if the menu is visible in the DOM
    expect(wrapper.find('.openclaw-workbench__command-menu').exists()).toBe(true)
  })

  it('filters commands in slash menu', async () => {
    const wrapper = mountComponent()
    const input = wrapper.find('.n-input')

    await input.setValue('/st')
    await nextTick()

    const items = wrapper.findAll('.openclaw-workbench__command-item')
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].text()).toContain('/stop')
  })

  it('executes command when clicking menu item', async () => {
    const wrapper = mountComponent({ inputMessage: '/clear' })
    await nextTick()

    const items = wrapper.findAll('.openclaw-workbench__command-item')
    const clearItem = items.find((item) => item.text().includes('/clear'))
    // Use mousedown instead of click as per component implementation
    await clearItem?.trigger('mousedown')

    // Check if input was cleared in the DOM
    const input = wrapper.find('.n-input')
    expect((input.element as HTMLInputElement).value).toBe('')
  })

  it('handles enter to send normal message', async () => {
    // Let's pass a spy in ctxOverrides
    const handleSendSpy = vi.fn()
    const wrapper = mountComponent({ inputMessage: 'Hello AI', handleSend: handleSendSpy })

    const input = wrapper.find('.n-input')
    await input.trigger('keydown', { key: 'Enter' })

    expect(handleSendSpy).toHaveBeenCalled()
  })

  it('shows stop button when sending', async () => {
    const wrapper = mountComponent({ isSending: true })

    // Find button that contains stop generation text
    const buttons = wrapper.findAll('.n-button')
    const stopBtn = buttons.find((btn) => btn.text().includes('ai_assistant.robot.openclaw_stop_generation'))
    expect(stopBtn?.exists()).toBe(true)
  })
})
