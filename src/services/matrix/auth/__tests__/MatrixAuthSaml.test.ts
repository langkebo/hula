import { describe, expect, it, vi } from 'vitest'
import { matrixClientService } from '../../MatrixClientService'
import { authedRequestWithPath } from '../../MatrixHttpClient'
import { PREFIX_V3 } from '../../paths'
import { normalizeSdkMatrixError } from '../authErrors'
import { postMatrixJson } from '../authHelpers'
import { getSamlMetadata, getSamlRedirect, handleSamlCallback, samlLogout } from '../MatrixAuthSaml'

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: { getClient: vi.fn() }
}))

vi.mock('../../MatrixHttpClient', () => ({
  authedRequestWithPath: vi.fn()
}))

vi.mock('../../paths', () => ({
  PREFIX_V3: '/_matrix/client/v3'
}))

vi.mock('../authErrors', () => ({
  normalizeSdkMatrixError: vi.fn((_err: unknown, label: string) => new Error(label))
}))

vi.mock('../authHelpers', () => ({
  postMatrixJson: vi.fn()
}))

const mockGetClient = vi.mocked(matrixClientService.getClient)
const mockAuthedRequestWithPath = vi.mocked(authedRequestWithPath)
const mockPostMatrixJson = vi.mocked(postMatrixJson)
const mockNormalizeSdkMatrixError = vi.mocked(normalizeSdkMatrixError)

const mockSamlManager = {
  logout: vi.fn(),
  getSpMetadata: vi.fn(),
  getIdpMetadata: vi.fn().mockResolvedValue({ entityID: 'https://saml.example/meta' }),
  initiateLogin: vi.fn(),
  getLoginRedirectUrl: vi.fn()
}

const dummyClient = {
  some: 'client',
  getSamlAuthManager: vi.fn(() => mockSamlManager)
} as unknown as Parameters<typeof authedRequestWithPath>[0]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetClient.mockReturnValue(dummyClient)
})

describe('getSamlRedirect', () => {
  it('throws when the client is not initialized', async () => {
    mockGetClient.mockReturnValue(null)
    await expect(getSamlRedirect()).rejects.toThrow('matrix_error.common.client_not_initialized')
  })

  it('delegates to SamlAuthManager.getLoginRedirectUrl, without the raw /login/saml/redirect call', async () => {
    mockSamlManager.getLoginRedirectUrl.mockReturnValue('https://hs.example/_matrix/client/v3/login/sso/redirect/saml')
    const result = await getSamlRedirect()
    expect(result).toBe('https://hs.example/_matrix/client/v3/login/sso/redirect/saml')
    // 无 redirectUrl 时传空串 ⇒ SDK 不拼 `?...` 查询串（与旧行为等价）
    expect(mockSamlManager.getLoginRedirectUrl).toHaveBeenCalledWith('')
    // 旧实现裸调 `GET /login/saml/redirect`（后端不存在 ⇒ 404，见方案文档 §9.11.4）；
    // 收口后不得再出现任何裸调
    expect(mockAuthedRequestWithPath).not.toHaveBeenCalled()
  })

  it('passes redirectUrl through as the single argument', async () => {
    mockSamlManager.getLoginRedirectUrl.mockReturnValue(
      'https://hs.example/_matrix/client/v3/login/sso/redirect/saml?x=1'
    )
    await getSamlRedirect('https://cb.example')
    expect(mockSamlManager.getLoginRedirectUrl).toHaveBeenCalledWith('https://cb.example')
  })

  it('normalizes the error when the redirect URL cannot be built', async () => {
    mockSamlManager.getLoginRedirectUrl.mockImplementation(() => {
      throw new Error('boom')
    })
    await expect(getSamlRedirect()).rejects.toThrow('获取 SAML 重定向失败')
    expect(mockNormalizeSdkMatrixError).toHaveBeenCalled()
  })
})

describe('handleSamlCallback', () => {
  it('posts the saml response body and returns the login result', async () => {
    mockPostMatrixJson.mockResolvedValue({ user_id: '@u:matrix.org', access_token: 'tok', device_id: 'D' })
    const result = await handleSamlCallback('raw-saml')
    expect(result).toEqual({ user_id: '@u:matrix.org', access_token: 'tok', device_id: 'D' })
    expect(mockPostMatrixJson).toHaveBeenCalledWith(
      `${PREFIX_V3}/login/saml/callback`,
      { saml_response: 'raw-saml' },
      'SAML 回调处理失败'
    )
  })

  it('includes relay_state and session_id when provided', async () => {
    mockPostMatrixJson.mockResolvedValue({ user_id: '@u:matrix.org', access_token: 'tok', device_id: 'D' })
    await handleSamlCallback('raw-saml', 'relay-1', 'sess-1')
    expect(mockPostMatrixJson).toHaveBeenCalledWith(
      `${PREFIX_V3}/login/saml/callback`,
      { saml_response: 'raw-saml', relay_state: 'relay-1', session_id: 'sess-1' },
      'SAML 回调处理失败'
    )
  })
})

describe('samlLogout', () => {
  it('throws when the client is not initialized', async () => {
    mockGetClient.mockReturnValue(null)
    await expect(samlLogout()).rejects.toThrow('matrix_error.common.client_not_initialized')
  })

  it('returns the redirect_url after logout', async () => {
    mockSamlManager.logout.mockResolvedValue({ redirect_url: 'https://saml.example/done' })
    const result = await samlLogout('https://cb.example')
    expect(result).toBe('https://saml.example/done')
    expect(mockSamlManager.logout).toHaveBeenCalledWith('https://cb.example')
  })

  it('returns null when no redirect_url is present', async () => {
    mockSamlManager.logout.mockResolvedValue({})
    await expect(samlLogout()).resolves.toBeNull()
  })

  it('normalizes the error when logout fails', async () => {
    mockSamlManager.logout.mockRejectedValue(new Error('boom'))
    await expect(samlLogout()).rejects.toThrow('SAML 登出失败')
    expect(mockNormalizeSdkMatrixError).toHaveBeenCalled()
  })
})

describe('getSamlMetadata', () => {
  it('throws when the client is not initialized', async () => {
    mockGetClient.mockReturnValue(null)
    await expect(getSamlMetadata()).rejects.toThrow('matrix_error.common.client_not_initialized')
  })

  it('returns the raw metadata object', async () => {
    // getSamlMetadata 已改用 client.getSamlAuthManager().getIdpMetadata()
    const result = await getSamlMetadata()
    expect(result).toEqual({ entityID: 'https://saml.example/meta' })
    expect(mockSamlManager.getIdpMetadata).toHaveBeenCalled()
  })

  it('normalizes the error when metadata fetch fails', async () => {
    mockSamlManager.getIdpMetadata.mockRejectedValue(new Error('boom'))
    await expect(getSamlMetadata()).rejects.toThrow('获取 SAML 元数据失败')
    expect(mockNormalizeSdkMatrixError).toHaveBeenCalled()
  })
})
