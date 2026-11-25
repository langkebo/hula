import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '../../../../../tests/msw'
import { __resetAuthMetadataProbeCacheForTests, matrixOidcService } from '../MatrixOidcService'

vi.mock('@tauri-apps/plugin-log', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trace: vi.fn()
}))

const BASE_URL = 'https://hs.auth-metadata.test'
const ISSUER = 'https://idp.auth-metadata.test'

// 只固定家服务器地址，客户端仍由生产工厂真实创建；请求路径与响应校验全部走真实 SDK。
vi.mock('@/services/backend/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/backend/config')>()
  return {
    ...actual,
    resolveMatrixRuntimeEndpointConfig: () => ({
      ...actual.resolveMatrixRuntimeEndpointConfig(),
      homeserverUrl: BASE_URL
    })
  }
})

// Vitest 下 SDK 会跳过异步 manager 扩展安装（`shouldSkipAsyncManagerInit`），
// `isVersionSupported` 依赖的 server-capabilities manager 未挂载，因此固定为 true。
vi.mock('../authHelpers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../authHelpers')>()
  return {
    ...actual,
    createTemporaryMatrixClient: () => {
      const client = actual.createTemporaryMatrixClient()
      client.isVersionSupported = () => Promise.resolve(true)
      return client
    }
  }
})

const AUTH_METADATA = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/authorize`,
  token_endpoint: `${ISSUER}/token`,
  revocation_endpoint: `${ISSUER}/revoke`,
  jwks_uri: `${ISSUER}/jwks`,
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code'],
  code_challenge_methods_supported: ['S256']
}

let authMetadataStatus: 200 | 404 = 200
let authMetadataRequests = 0

setupMswServer(
  http.get(`${BASE_URL}/_matrix/client/versions`, () => HttpResponse.json({ versions: ['v1.15'] })),
  http.get(`${BASE_URL}/_matrix/client/v1/auth_metadata`, () => {
    authMetadataRequests += 1
    if (authMetadataStatus === 404) {
      return HttpResponse.json({ errcode: 'M_UNRECOGNIZED', error: 'Unrecognized request' }, { status: 404 })
    }
    return HttpResponse.json(AUTH_METADATA)
  }),
  http.get(`${ISSUER}/jwks`, () =>
    HttpResponse.json({
      keys: [{ kty: 'RSA', kid: 'contract-test', alg: 'RS256', use: 'sig', e: 'AQAB', n: 'AQAB' }]
    })
  )
)

describe('matrixOidcService.probeAuthMetadata contract', () => {
  beforeEach(() => {
    authMetadataStatus = 200
    authMetadataRequests = 0
    __resetAuthMetadataProbeCacheForTests()
  })

  it('maps a 200 auth_metadata response to supported with issuer and authorization endpoint', async () => {
    authMetadataStatus = 200

    await expect(matrixOidcService.probeAuthMetadata()).resolves.toEqual({
      supported: true,
      issuer: ISSUER,
      authorizationEndpoint: `${ISSUER}/authorize`
    })
  })

  it('maps a 404 auth_metadata response to unsupported', async () => {
    authMetadataStatus = 404

    await expect(matrixOidcService.probeAuthMetadata()).resolves.toEqual({ supported: false })
  })

  it('reuses the cached result instead of probing again', async () => {
    await matrixOidcService.probeAuthMetadata()
    await matrixOidcService.probeAuthMetadata()

    expect(authMetadataRequests).toBe(1)
  })

  it('deduplicates concurrent probes into a single request', async () => {
    const [first, second] = await Promise.all([
      matrixOidcService.probeAuthMetadata(),
      matrixOidcService.probeAuthMetadata()
    ])

    expect(first).toEqual(second)
    expect(authMetadataRequests).toBe(1)
  })
})
