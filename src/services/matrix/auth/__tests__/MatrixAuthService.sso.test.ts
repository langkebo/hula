import { afterEach, describe, expect, it, vi } from 'vitest'
import { MatrixAuthService } from '../MatrixAuthService'

// MatrixAuthService 从 ../authHelpers 导入 createTemporaryMatrixClient，
// 因此必须 mock 真实导入源。
vi.mock('../authHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../authHelpers')>()
  const fakeClient = {
    getSsoLoginUrl: (redirectAfter: string, loginType?: string) =>
      `http://localhost:8008/_matrix/client/v3/login/sso/redirect/${loginType ?? 'sso'}?redirectUrl=${encodeURIComponent(
        redirectAfter
      )}`
  }
  return {
    ...actual,
    createTemporaryMatrixClient: () => fakeClient as unknown as ReturnType<typeof actual.createTemporaryMatrixClient>
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MatrixAuthService SSO flow', () => {
  it('reports unsupported when m.login.sso flow is absent', async () => {
    vi.spyOn(MatrixAuthService, 'getLoginFlows').mockResolvedValue([{ type: 'm.login.password' }])

    await expect(MatrixAuthService.getSsoLoginFlow()).resolves.toEqual({ supported: false, providers: [] })
  })

  it('reports supported with empty providers when flow omits identity_providers', async () => {
    vi.spyOn(MatrixAuthService, 'getLoginFlows').mockResolvedValue([{ type: 'm.login.sso' }])

    await expect(MatrixAuthService.getSsoLoginFlow()).resolves.toEqual({ supported: true, providers: [] })
  })

  it('keeps only providers with a non-empty string id', async () => {
    vi.spyOn(MatrixAuthService, 'getLoginFlows').mockResolvedValue([
      {
        type: 'm.login.sso',
        identity_providers: [
          { id: 'oidc-corp', name: 'Corp SSO', brand: 'oidc', icon: 'mxc://icon' },
          { name: 'missing id' },
          { id: '' }
        ]
      }
    ])

    await expect(MatrixAuthService.getSsoLoginFlow()).resolves.toEqual({
      supported: true,
      providers: [{ id: 'oidc-corp', name: 'Corp SSO', brand: 'oidc', icon: 'mxc://icon' }]
    })
  })

  it('treats probe failure as unsupported', async () => {
    vi.spyOn(MatrixAuthService, 'getLoginFlows').mockRejectedValue(new Error('network down'))

    await expect(MatrixAuthService.getSsoLoginFlow()).resolves.toEqual({ supported: false, providers: [] })
  })

  it('delegates SSO url building to the SDK with the provider id', async () => {
    await expect(MatrixAuthService.buildSsoLoginUrl('/', 'oidc-corp')).resolves.toContain(
      '/login/sso/redirect/oidc-corp'
    )
  })
})
