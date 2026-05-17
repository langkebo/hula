import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConnectionStatusBanner from '../ConnectionStatusBanner.vue'

type ConnectionStatusBannerVm = {
  onDiagnose: () => Promise<void>
}

const { showFeedbackMock, dialogInfoMock, runAllMock, MatrixDiagnosticsMock } = vi.hoisted(() => ({
  showFeedbackMock: vi.fn(),
  dialogInfoMock: vi.fn(),
  runAllMock: vi.fn(),
  MatrixDiagnosticsMock: vi.fn(function MatrixDiagnostics(this: unknown) {
    return {
      runAll: runAllMock
    }
  })
}))

const matrixStoreState = {
  homeserverUrl: ''
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('naive-ui', async () => {
  const { defineComponent } = await import('vue')

  return {
    NSpin: defineComponent({
      name: 'NSpin',
      template: '<div data-test="spin" />'
    }),
    useDialog: () => ({
      info: dialogInfoMock
    })
  }
})

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({
    showFeedback: showFeedbackMock
  })
}))

vi.mock('@/stores/domains/chat/matrix', () => ({
  useMatrixStore: () => matrixStoreState
}))

vi.mock('@/utils/MatrixDiagnostics', () => ({
  MatrixDiagnostics: MatrixDiagnosticsMock
}))

describe('ConnectionStatusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    matrixStoreState.homeserverUrl = ''
  })

  const mountComponent = () =>
    mount(ConnectionStatusBanner, {
      props: {
        state: 'error'
      }
    })

  it('在缺少 homeserver 时给出 warning 反馈', async () => {
    const wrapper = mountComponent()

    await (wrapper.vm as unknown as ConnectionStatusBannerVm).onDiagnose()

    expect(showFeedbackMock).toHaveBeenCalledWith('connection.diagnose_no_homeserver', 'warning')
    expect(runAllMock).not.toHaveBeenCalled()
  })

  it('诊断成功时弹出结果对话框', async () => {
    matrixStoreState.homeserverUrl = 'https://matrix.example.com'
    runAllMock.mockResolvedValue([
      {
        name: 'Homeserver',
        status: 'success',
        message: 'ok'
      }
    ])

    const wrapper = mountComponent()

    await (wrapper.vm as unknown as ConnectionStatusBannerVm).onDiagnose()

    expect(dialogInfoMock).toHaveBeenCalledTimes(1)
    expect(dialogInfoMock.mock.calls[0]?.[0]).toMatchObject({
      title: 'connection.diagnose_title',
      positiveText: 'OK'
    })
  })

  it('诊断失败时给出 error 反馈', async () => {
    matrixStoreState.homeserverUrl = 'https://matrix.example.com'
    runAllMock.mockRejectedValue(new Error('network down'))

    const wrapper = mountComponent()

    await (wrapper.vm as unknown as ConnectionStatusBannerVm).onDiagnose()

    expect(showFeedbackMock).toHaveBeenCalledWith('connection.diagnose_failed', 'error')
  })
})
