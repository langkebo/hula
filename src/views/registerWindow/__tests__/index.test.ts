import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const {
  currentWindowShowMock,
  saveMatrixSessionEndpointConfigMock,
  restoreWithAccessTokenMock,
  completeDesktopLoginTransitionMock,
  matrixRegisterMock,
  createModalWindowMock,
  showFeedbackMock
} = vi.hoisted(() => ({
  currentWindowShowMock: vi.fn(),
  saveMatrixSessionEndpointConfigMock: vi.fn(),
  restoreWithAccessTokenMock: vi.fn(),
  completeDesktopLoginTransitionMock: vi.fn(),
  matrixRegisterMock: vi.fn(),
  createModalWindowMock: vi.fn(),
  showFeedbackMock: vi.fn()
}))

class MockWorker {
  onerror: ((error: ErrorEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null

  postMessage(): void {}

  terminate(): void {}
}

vi.stubGlobal('Worker', MockWorker as unknown as typeof Worker)

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    show: currentWindowShowMock
  }),
  WebviewWindow: {
    getCurrent: () => ({
      show: currentWindowShowMock,
      label: 'register'
    })
  }
}))

vi.mock('dayjs', () => {
  const dayjsMock = () => ({
    year: () => 2026,
    format: () => '2026-05-15',
    add: () => dayjsMock(),
    subtract: () => dayjsMock(),
    locale: vi.fn()
  })
  dayjsMock.extend = vi.fn()
  dayjsMock.duration = vi.fn()
  dayjsMock.locale = vi.fn()
  return {
    default: dayjsMock
  }
})

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'auth.register.actions.submit') return '注册'
      if (key === 'auth.register.messages.register_success') return '注册成功'
      if (key === 'auth.register.messages.register_fail') return '注册失败'
      if (key === 'auth.register.actions.sending') return '发送中'
      if (key === 'auth.register.actions.retry_in') return `${params?.seconds || 0}s`
      return key
    }
  })
}))

vi.mock('naive-ui', () => {
  const NForm = defineComponent({
    name: 'NForm',
    setup(_, { slots, expose }) {
      expose({
        validate: vi.fn().mockResolvedValue(undefined)
      })

      return () => h('form', {}, slots.default?.())
    }
  })

  const NInput = defineComponent({
    name: 'NInput',
    props: ['value', 'modelValue'],
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          value: props.value ?? props.modelValue ?? '',
          onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
        })
    }
  })

  const NAutoComplete = defineComponent({
    name: 'NAutoComplete',
    props: ['value'],
    emits: ['update:value'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          value: props.value ?? '',
          onInput: (event: Event) => emit('update:value', (event.target as HTMLInputElement).value)
        })
    }
  })

  const NCheckbox = defineComponent({
    name: 'NCheckbox',
    props: ['checked'],
    emits: ['update:checked'],
    setup(props, { emit }) {
      return () =>
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          onChange: (event: Event) => emit('update:checked', (event.target as HTMLInputElement).checked)
        })
    }
  })

  const NButton = defineComponent({
    name: 'NButton',
    emits: ['click'],
    setup(_, { slots, emit }) {
      return () =>
        h(
          'button',
          {
            type: 'button',
            onClick: () => emit('click')
          },
          slots.default?.()
        )
    }
  })

  const stub = (name: string) =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h('div', {}, slots.default?.())
      }
    })

  return {
    darkTheme: { name: 'dark' },
    lightTheme: { name: 'light' },
    NConfigProvider: stub('NConfigProvider'),
    NFlex: stub('NFlex'),
    NForm,
    NFormItem: stub('NFormItem'),
    NInput,
    NAutoComplete,
    NCheckbox,
    NButton,
    NModal: stub('NModal')
  }
})

vi.mock('@/services/backend', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({
    homeserverUrl: 'https://matrix.example.com',
    identityServerUrl: 'https://identity.example.com'
  }),
  saveMatrixSessionEndpointConfig: saveMatrixSessionEndpointConfigMock
}))

vi.mock('@/services/matrix/auth/SessionOrchestrator', () => ({
  sessionOrchestrator: {
    restoreWithAccessToken: restoreWithAccessTokenMock,
    loginWithPassword: vi.fn(),
    completeDesktopLoginTransition: completeDesktopLoginTransitionMock
  }
}))

vi.mock('@/services/matrix/auth/MatrixAuthService', () => ({
  MatrixAuthService: {
    requestEmailToken: vi.fn(),
    submitEmailToken: vi.fn(),
    register: matrixRegisterMock
  }
}))

vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({
    themeContent: 'light'
  })
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isMac: () => false,
  isWindows: () => false
}))

vi.mock('@/utils/Validate', () => ({
  validateAlphaNumeric: vi.fn(() => true),
  validateSpecialChar: vi.fn(() => true)
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    createModalWindow: createModalWindowMock
  })
}))

vi.mock('@/components/windows/ActionBar.vue', () => ({
  default: {
    name: 'ActionBar',
    template: '<div class="action-bar" />'
  }
}))

vi.mock('@/components/atomic/PinInput.vue', () => ({
  default: {
    name: 'PinInput',
    template: '<div class="pin-input" />'
  }
}))

vi.mock('@/components/common/Validation.vue', () => ({
  default: {
    name: 'Validation',
    template: '<div class="validation" />'
  }
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

const RegisterView = (await import('../index.vue')).default

describe('registerWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    currentWindowShowMock.mockResolvedValue(undefined)
    completeDesktopLoginTransitionMock.mockResolvedValue(undefined)
    restoreWithAccessTokenMock.mockResolvedValue(undefined)
    matrixRegisterMock.mockResolvedValue({
      user_id: '@alice:example.com',
      access_token: 'registered-token',
      refresh_token: 'registered-refresh-token'
    })
  })

  it('saves session endpoint before restoring runtime session after direct register', async () => {
    const wrapper = mount(RegisterView, {
      global: {
        stubs: {
          'action-bar': true
        }
      }
    })
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('alice')
    await inputs[1].setValue('secret!')
    await inputs[2].setValue('secret!')
    await inputs[4].setValue(true)

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(matrixRegisterMock).toHaveBeenCalledWith('alice', 'secret!', undefined, undefined, undefined, undefined)
    expect(saveMatrixSessionEndpointConfigMock).toHaveBeenCalledWith({
      homeserverUrl: 'https://matrix.example.com',
      identityServerUrl: 'https://identity.example.com'
    })
    expect(restoreWithAccessTokenMock).toHaveBeenCalledWith({
      uid: '@alice:example.com',
      accessToken: 'registered-token',
      refreshToken: 'registered-refresh-token',
      account: 'alice',
      displayName: 'alice',
      avatar: expect.any(String),
      client: 'PC',
      persistTokens: true,
      bootstrapAfterRestore: true
    })
    expect(saveMatrixSessionEndpointConfigMock.mock.invocationCallOrder[0]).toBeLessThan(
      restoreWithAccessTokenMock.mock.invocationCallOrder[0]
    )
    expect(completeDesktopLoginTransitionMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith('注册成功', 'success')
  })
})
