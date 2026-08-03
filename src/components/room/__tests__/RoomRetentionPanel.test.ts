import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RoomRetentionPanel from '../RoomRetentionPanel.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/services/matrix/room/ActionFacade', () => ({
  matrixRoomActionFacade: {
    getRetentionPolicy: vi.fn().mockResolvedValue(null),
    setRetentionPolicy: vi.fn().mockResolvedValue(undefined)
  }
}))

const loadPolicyMock = vi.fn()
const savePolicyMock = vi.fn()

vi.mock('@/composables/room/useRoomRetention', () => ({
  useRoomRetention: () => ({
    mode: { value: 'unlimited' },
    days: { value: 30 },
    count: { value: 1000 },
    isLoading: { value: false },
    isSaving: { value: false },
    isConfigValid: { value: true },
    setMode: vi.fn(),
    setDays: vi.fn(),
    setCount: vi.fn(),
    loadPolicy: (...args: unknown[]) => loadPolicyMock(...args),
    savePolicy: (...args: unknown[]) => savePolicyMock(...args)
  })
}))

const showFeedbackMock = vi.fn()
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: (...args: unknown[]) => showFeedbackMock(...args) })
}))

const naiveStubs = {
  Card: {
    template:
      '<div class="n-card"><div class="n-card-header">{{ title }}</div><div class="n-card-body"><slot /></div></div>',
    props: ['title', 'size', 'bordered']
  },
  Spin: { template: '<div class="n-spin"><slot /></div>', props: ['size', 'show'] },
  RadioGroup: {
    template: '<div class="n-radio-group" role="radiogroup"><slot /></div>',
    props: ['value', 'disabled'],
    emits: ['update:value']
  },
  Radio: {
    template:
      '<label class="n-radio" :class="{ \'is-disabled\': disabled }" @change="$emit(\'change\', radioValue)"><input type="radio" :value="radioValue" :checked="modelValue === radioValue" :disabled="disabled" /><slot /></label>',
    props: {
      radioValue: { type: [String, Number, Boolean], default: null },
      disabled: Boolean,
      modelValue: { type: [String, Number, Boolean], default: null }
    },
    emits: ['change']
  },
  InputNumber: {
    template:
      '<input class="n-input-number" type="number" :value="value" :disabled="disabled" @input="$emit(\'update:value\', Number($event.target.value))" />',
    props: ['value', 'min', 'max', 'disabled'],
    emits: ['update:value']
  },
  Button: {
    template:
      '<button class="n-button" :disabled="disabled" :loading="loading" @click="$emit(\'click\')"><slot /></button>',
    props: ['disabled', 'loading', 'type', 'size', 'block', 'secondary'],
    emits: ['click']
  }
}

describe('RoomRetentionPanel — P2-1 房间保留策略面板', () => {
  beforeEach(() => {
    loadPolicyMock.mockReset()
    savePolicyMock.mockReset()
    showFeedbackMock.mockReset()
  })

  const mountPanel = (props: Record<string, unknown> = {}) =>
    mount(RoomRetentionPanel, {
      props: { roomId: '!room:hs', canEdit: true, ...props },
      global: { stubs: naiveStubs }
    })

  it('挂载时调用 loadPolicy 加载当前房间保留策略', async () => {
    loadPolicyMock.mockResolvedValue(undefined)
    const wrapper = mountPanel()
    await flushPromises()

    expect(loadPolicyMock).toHaveBeenCalledWith('!room:hs')
    expect(wrapper.find('[data-testid="room-retention-panel"]').exists()).toBe(true)
  })

  it('当前模式为 unlimited 时显示"不限制"标签', async () => {
    loadPolicyMock.mockResolvedValue(undefined)
    const wrapper = mountPanel()
    await flushPromises()

    expect(wrapper.find('[data-testid="retention-mode-unlimited"]').exists()).toBe(true)
  })

  it('切换模式为 by_days 并点击保存调用 savePolicy', async () => {
    loadPolicyMock.mockResolvedValue(undefined)
    savePolicyMock.mockResolvedValue(undefined)

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="retention-mode-by-days"]').trigger('change')
    await wrapper.find('[data-testid="retention-save-btn"]').trigger('click')
    await flushPromises()

    expect(savePolicyMock).toHaveBeenCalledWith('!room:hs')
    expect(showFeedbackMock).toHaveBeenCalledWith('room.retention.save_success', 'success')
  })

  it('保存失败时显示错误反馈', async () => {
    loadPolicyMock.mockResolvedValue(undefined)
    savePolicyMock.mockRejectedValue(new Error('boom'))

    const wrapper = mountPanel()
    await flushPromises()

    await wrapper.find('[data-testid="retention-save-btn"]').trigger('click')
    await flushPromises()

    expect(showFeedbackMock).toHaveBeenCalledWith('room.retention.save_failed', 'error')
  })

  it('canEdit=false 时禁用所有编辑控件', async () => {
    loadPolicyMock.mockResolvedValue(undefined)
    const wrapper = mountPanel({ canEdit: false })
    await flushPromises()

    expect(wrapper.find('[data-testid="retention-save-btn"]').attributes('disabled')).toBeDefined()
  })
})
