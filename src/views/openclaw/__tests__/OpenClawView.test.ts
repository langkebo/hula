import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import * as workbenchHook from '../composables/useOpenClawWorkbench'
import OpenClawView from '../OpenClawView.vue'

// Mock workbench data
const mockWorkbench = {
  isConnected: ref(true),
  isLoading: ref(false),
  connectionState: ref({ state: 'connected' }),
  conversations: ref([{ id: 'conv-1', title: 'Test Chat', messages: [], updatedAt: Date.now() }]),
  activeConversationId: ref('conv-1'),
  currentConversation: ref({ id: 'conv-1', title: 'Test Chat', messages: [], updatedAt: Date.now() }),
  inputMessage: ref(''),
  isSending: ref(false),
  expandedReasoningIds: ref([]),
  openClawConfig: ref({ temperature: 0.7, maxTokens: 4096 }),
  selectedModelId: ref('gpt-4o'),
  availableModels: ref(['gpt-4o', 'gpt-4-turbo']),
  installStatus: ref(null),
  installStatusLoading: ref(false),
  canSend: ref(true),
  translate: vi.fn((key) => key),
  handleConnect: vi.fn(),
  handleDisconnect: vi.fn(),
  handleSend: vi.fn(),
  handleStopGeneration: vi.fn(),
  handleCreateConversation: vi.fn(),
  updateCurrentConversation: vi.fn(),
  persistConnectionConfig: vi.fn(),
  loadStoredData: vi.fn(),
  loadInstallStatus: vi.fn()
}

// Mock useOpenClawWorkbench
vi.spyOn(workbenchHook, 'useOpenClawWorkbench').mockReturnValue(mockWorkbench as any)

// Mock components
vi.mock('../components/OpenClawSidebar.vue', () => ({
  default: { name: 'OpenClawSidebar', template: '<div class="sidebar-mock" />' }
}))
vi.mock('../components/OpenClawMessageList.vue', () => ({
  default: {
    name: 'OpenClawMessageList',
    template: '<div class="message-list-mock" />',
    setup() {
      return { openSearch: vi.fn() }
    }
  }
}))
vi.mock('../components/OpenClawComposer.vue', () => ({
  default: { name: 'OpenClawComposer', template: '<div class="composer-mock" />' }
}))
vi.mock('../components/OpenClawSettingsPanel.vue', () => ({
  default: {
    name: 'OpenClawSettingsPanel',
    template: '<div class="settings-mock" />',
    setup() {
      return { show: vi.fn() }
    }
  }
}))

vi.mock('naive-ui', () => ({
  NInput: {
    name: 'NInput',
    template: '<input class="n-input" :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
    props: ['value']
  },
  NButton: {
    name: 'NButton',
    template: '<button class="n-button" @click="$emit(\'click\')"><slot /></button>'
  },
  NModal: {
    name: 'NModal',
    template: '<div v-if="show" class="n-modal"><slot /></div>',
    props: ['show']
  },
  NEmpty: {
    name: 'NEmpty',
    template: '<div class="n-empty" />'
  },
  NScrollbar: {
    name: 'NScrollbar',
    template: '<div><slot /></div>'
  }
}))

describe('OpenClawView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mountComponent = () =>
    mount(OpenClawView, {
      global: {
        plugins: [createPinia()]
      }
    })

  it('renders workbench structure', () => {
    const wrapper = mountComponent()
    expect(wrapper.find('.openclaw-workbench').exists()).toBe(true)
    expect(wrapper.find('.sidebar-mock').exists()).toBe(true)
    expect(wrapper.find('.composer-mock').exists()).toBe(true)
  })

  it('opens command palette on Cmd+K', async () => {
    const wrapper = mountComponent()

    // Simulate Cmd+K
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
        bubbles: true
      })
    )

    await nextTick()
    // The modal should be visible. In our mock it uses v-if="show"
    expect(wrapper.find('.n-modal').exists()).toBe(true)
  })

  it('filters palette items', async () => {
    const wrapper = mountComponent()

    // Open palette
    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true
      })
    )
    await nextTick()

    const input = wrapper.find('.openclaw-workbench__palette input')
    await input.setValue('new')
    await nextTick()

    const items = wrapper.findAll('.openclaw-workbench__palette-item')
    expect(items.length).toBeGreaterThan(0)
    expect(items[0].text()).toContain('ai_assistant.robot.palette_new_chat')
  })

  it('executes palette command on click', async () => {
    const wrapper = mountComponent()

    window.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true
      })
    )
    await nextTick()

    const items = wrapper.findAll('.openclaw-workbench__palette-item')
    const newChatBtn = items.find((item) => item.text().includes('ai_assistant.robot.palette_new_chat'))

    await newChatBtn?.trigger('click')
    expect(mockWorkbench.handleCreateConversation).toHaveBeenCalled()
    // After execution, the modal should be hidden
    expect(wrapper.find('.n-modal').exists()).toBe(false)
  })
})
