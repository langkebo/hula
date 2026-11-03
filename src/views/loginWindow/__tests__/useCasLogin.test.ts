import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useCasLogin } from '../hooks/useCasLogin'

const { invoke, listen, unlistenFn, showFeedback, hasCasLoginFlow, getCasLoginUrl, hasTauriRuntime, onToken } =
  vi.hoisted(() => ({
    invoke: vi.fn(),
    listen: vi.fn(),
    unlistenFn: vi.fn(),
    showFeedback: vi.fn(),
    hasCasLoginFlow: vi.fn(),
    getCasLoginUrl: vi.fn(),
    hasTauriRuntime: vi.fn(() => true),
    onToken: vi.fn()
  }))

vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen }))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback })
}))
vi.mock('@/services/backend', () => ({
  resolveMatrixRuntimeEndpointConfig: () => ({ homeserverUrl: 'http://localhost:8008' })
}))
// 被测代码直接从 MatrixAuthService 导入静态方法，必须 mock 同一模块路径
vi.mock('@/services/matrix/auth/MatrixAuthService', () => ({
  MatrixAuthService: { hasCasLoginFlow, getCasLoginUrl }
}))
vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime }))
vi.mock('@/utils/PlatformConstants', () => ({ isDesktop: () => true }))

describe('useCasLogin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hasTauriRuntime.mockReturnValue(true)
    hasCasLoginFlow.mockResolvedValue(true)
    getCasLoginUrl.mockResolvedValue(
      'http://localhost:8008/_matrix/client/v3/login/sso/redirect/cas?redirect_after=%2F'
    )
    invoke.mockResolvedValue(undefined)
    listen.mockResolvedValue(unlistenFn)
  })

  it('detect 在服务端支持 m.login.cas 时置 casAvailable 为 true', async () => {
    const { casAvailable, detect } = useCasLogin({ onToken })

    await detect()

    expect(hasCasLoginFlow).toHaveBeenCalled()
    expect(casAvailable.value).toBe(true)
  })

  it('非桌面或非 Tauri 运行时保持 casAvailable 为 false 且不探测', async () => {
    hasTauriRuntime.mockReturnValue(false)
    const { casAvailable, detect } = useCasLogin({ onToken })

    await detect()

    expect(hasCasLoginFlow).not.toHaveBeenCalled()
    expect(casAvailable.value).toBe(false)
  })

  it('startCasLogin 用 SDK 返回的 URL 打开 Tauri CAS 窗口', async () => {
    const { detect, startCasLogin } = useCasLogin({ onToken })

    await detect()
    await startCasLogin()

    expect(getCasLoginUrl).toHaveBeenCalledWith('/')
    expect(invoke).toHaveBeenCalledWith('open_cas_login_window', {
      loginUrl: expect.stringContaining('login/sso/redirect/cas'),
      homeserverOrigin: 'http://localhost:8008'
    })
  })

  it('casAvailable 为 false 时不调用 invoke', async () => {
    const { startCasLogin } = useCasLogin({ onToken })

    await startCasLogin()

    expect(invoke).not.toHaveBeenCalled()
  })

  it('打开 CAS 窗口失败时反馈错误且不抛出', async () => {
    invoke.mockRejectedValue(new Error('failed to open window'))
    const { detect, startCasLogin } = useCasLogin({ onToken })

    await detect()
    await expect(startCasLogin()).resolves.toBeUndefined()

    expect(showFeedback).toHaveBeenCalledWith('login.cas.failed', 'error')
  })

  it('registerListener 转发 token 事件并在卸载时 unlisten', async () => {
    let api: ReturnType<typeof useCasLogin> | undefined
    const Harness = defineComponent({
      setup() {
        api = useCasLogin({ onToken })
        return {}
      },
      template: '<div />'
    })

    const wrapper = mount(Harness)
    await api?.registerListener()

    const handler = listen.mock.calls[0]?.[1] as (event: { payload: string }) => void
    handler({ payload: 'cas-login-token-1' })
    await flushPromises()

    expect(onToken).toHaveBeenCalledWith('cas-login-token-1')

    wrapper.unmount()

    expect(unlistenFn).toHaveBeenCalled()
  })
})
