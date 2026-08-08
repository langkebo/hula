import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HomeserverDialog from '../HomeserverDialog.vue'

type HomeserverDialogVm = {
  homeserverUrl: string
  handleSave: () => Promise<void>
}

const {
  showFeedbackMock,
  discoverAndSaveMatrixEndpointsMock,
  resolveMatrixEndpointConfigMock,
  saveMatrixIdentityServerUrlMock,
  isValidHttpUrlMock,
  isPotentialHomeserverInputMock
} = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  discoverAndSaveMatrixEndpointsMock: vi.fn(),
  resolveMatrixEndpointConfigMock: vi.fn(),
  saveMatrixIdentityServerUrlMock: vi.fn(),
  isValidHttpUrlMock: vi.fn(),
  isPotentialHomeserverInputMock: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NModal: defineComponent({
      name: 'NModal',
      props: {
        show: { type: Boolean, default: false }
      },
      emits: ['update:show', 'close'],
      template: '<div v-if="show"><slot /><slot name="footer" /></div>'
    }),
    NInput: defineComponent({
      name: 'NInput',
      props: {
        value: { type: String, default: '' }
      },
      emits: ['update:value', 'keyup.enter'],
      template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />'
    }),
    NButton: defineComponent({
      name: 'NButton',
      template: '<button type="button"><slot /></button>'
    })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/services/backend', () => ({
  discoverAndSaveMatrixEndpoints: discoverAndSaveMatrixEndpointsMock,
  resolveMatrixEndpointConfig: resolveMatrixEndpointConfigMock,
  saveMatrixIdentityServerUrl: saveMatrixIdentityServerUrlMock,
  isValidHttpUrl: isValidHttpUrlMock,
  isPotentialHomeserverInput: isPotentialHomeserverInputMock
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

describe('HomeserverDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveMatrixEndpointConfigMock.mockReturnValue({
      homeserverUrl: 'https://default.example.com',
      identityServerUrl: 'https://identity.example.com'
    })
    isValidHttpUrlMock.mockImplementation((value: string) => {
      try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
      } catch {
        return false
      }
    })
    isPotentialHomeserverInputMock.mockImplementation((value: string) => {
      return isValidHttpUrlMock(value) || isValidHttpUrlMock(`http://${value}`) || /^[^/\s]+\.[^/\s]+$/.test(value)
    })
  })

  const mountComponent = () =>
    mount(HomeserverDialog, {
      props: {
        show: true
      }
    })

  it('在 homeserver 为空或非法时给出 warning 反馈', async () => {
    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as HomeserverDialogVm

    vm.homeserverUrl = ''
    await vm.handleSave()
    expect(showFeedbackMock).toHaveBeenCalledWith('menu.homeserver_empty', 'warning')

    showFeedbackMock.mockClear()
    discoverAndSaveMatrixEndpointsMock.mockClear()

    vm.homeserverUrl = 'bad input'
    await vm.handleSave()
    expect(showFeedbackMock).toHaveBeenCalledWith('menu.homeserver_invalid', 'warning')
    expect(discoverAndSaveMatrixEndpointsMock).not.toHaveBeenCalled()
  })

  it('保存成功后发出 save 事件并播报 success', async () => {
    discoverAndSaveMatrixEndpointsMock.mockResolvedValue({
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: ''
    })

    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as HomeserverDialogVm
    vm.homeserverUrl = 'matrix.example.com'

    await vm.handleSave()

    expect(discoverAndSaveMatrixEndpointsMock).toHaveBeenCalledWith('matrix.example.com', {
      homeserverUrl: 'https://default.example.com',
      identityServerUrl: 'https://identity.example.com'
    })
    expect(saveMatrixIdentityServerUrlMock).toHaveBeenCalledWith('')
    expect(showFeedbackMock).toHaveBeenCalledWith('menu.homeserver_saved', 'success')
    expect(wrapper.emitted('save')).toEqual([
      [
        {
          homeserverUrl: 'https://matrix.example.com',
          identityServerUrl: ''
        }
      ]
    ])
    expect(wrapper.emitted('update:show')).toEqual([[false]])
  })

  it('保存失败时播报 error', async () => {
    discoverAndSaveMatrixEndpointsMock.mockRejectedValue(new Error('discovery failed'))

    const wrapper = mountComponent()
    const vm = wrapper.vm as unknown as HomeserverDialogVm
    vm.homeserverUrl = 'https://matrix.example.com'

    await vm.handleSave()

    expect(showFeedbackMock).toHaveBeenCalledWith('menu.homeserver_save_failed', 'error')
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
