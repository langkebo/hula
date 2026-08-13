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

const dummyClient = { some: 'client' } as unknown as Parameters<typeof authedRequestWithPath>[0]

beforeEach(() => {
  vi.clearAllMocks()
  mockGetClient.mockReturnValue(dummyClient)
})

describe('getSamlRedirect', () => {
  it('throws when the client is not initialized', async () => {
    mockGetClient.mockReturnValue(null)
    await expect(getSamlRedirect()).rejects.toThrow('matrix_error.common.client_not_initialized')
  })

  it('returns the redirect_url from the homeserver', async () => {
    mockAuthedRequestWithPath.mockResolvedValue({ redirect_url: 'https://saml.example/start' })
    const result = await getSamlRedirect()
    expect(result).toBe('https://saml.example/start')
    expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(dummyClient, 'GET', '/login/saml/redirect', undefined)
  })

  it('passes idp_id and redirectUrl as query params when provided', async () => {
    mockAuthedRequestWithPath.mockResolvedValue({ redirect_url: 'https://saml.example/start' })
    await getSamlRedirect('idp-1', 'https://cb.example')
    expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(dummyClient, 'GET', '/login/saml/redirect', {
      idp_id: 'idp-1',
      redirectUrl: 'https://cb.example'
    })
  })

  it('returns empty string when redirect_url is absent', async () => {
    mockAuthedRequestWithPath.mockResolvedValue({})
    await expect(getSamlRedirect()).resolves.toBe('')
  })

  it('normalizes the error when the request fails', async () => {
    mockAuthedRequestWithPath.mockRejectedValue(new Error('boom'))
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
    mockAuthedRequestWithPath.mockResolvedValue({ redirect_url: 'https://saml.example/done' })
    const result = await samlLogout('https://cb.example')
    expect(result).toBe('https://saml.example/done')
    expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(dummyClient, 'POST', '/login/saml/logout', {
      redirectUrl: 'https://cb.example'
    })
  })

  it('returns null when no redirect_url is present', async () => {
    mockAuthedRequestWithPath.mockResolvedValue({})
    await expect(samlLogout()).resolves.toBeNull()
  })

  it('normalizes the error when logout fails', async () => {
    mockAuthedRequestWithPath.mockRejectedValue(new Error('boom'))
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
    mockAuthedRequestWithPath.mockResolvedValue({ entityID: 'https://saml.example/meta' })
    const result = await getSamlMetadata()
    expect(result).toEqual({ entityID: 'https://saml.example/meta' })
    expect(mockAuthedRequestWithPath).toHaveBeenCalledWith(dummyClient, 'GET', '/login/saml/metadata')
  })

  it('normalizes the error when metadata fetch fails', async () => {
    mockAuthedRequestWithPath.mockRejectedValue(new Error('boom'))
    await expect(getSamlMetadata()).rejects.toThrow('获取 SAML 元数据失败')
    expect(mockNormalizeSdkMatrixError).toHaveBeenCalled()
  })
})
