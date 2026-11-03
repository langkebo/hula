import { afterEach, describe, expect, it, vi } from 'vitest'
import { MatrixAuthService } from '../MatrixAuthService'

// MatrixAuthService 从 ../authHelpers 导入 createTemporaryMatrixClient，
// 因此必须 mock 真实导入源，mock @/services/matrix/sdk 不会生效。
vi.mock('../authHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../authHelpers')>()
  const fakeClient = {
    getAccountManager: () => ({
      getCasLoginUrl: (redirectAfter: string) =>
        `http://localhost:8008/_matrix/client/v3/login/sso/redirect/cas?redirect_after=${encodeURIComponent(
          redirectAfter
        )}`
    })
  }
  return {
    ...actual,
    createTemporaryMatrixClient: () => fakeClient as unknown as ReturnType<typeof actual.createTemporaryMatrixClient>
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('MatrixAuthService CAS', () => {
  it('returns true when flows contain m.login.cas', async () => {
    vi.spyOn(MatrixAuthService, 'getLoginFlows').mockResolvedValue([{ type: 'm.login.cas' }])
    await expect(MatrixAuthService.hasCasLoginFlow()).resolves.toBe(true)
  })

  it('returns false when flows lack m.login.cas', async () => {
    vi.spyOn(MatrixAuthService, 'getLoginFlows').mockResolvedValue([{ type: 'm.login.password' }])
    await expect(MatrixAuthService.hasCasLoginFlow()).resolves.toBe(false)
  })

  it('delegates CAS url building to the SDK', async () => {
    await expect(MatrixAuthService.getCasLoginUrl('/')).resolves.toContain('redirect_after=%2F')
  })
})
