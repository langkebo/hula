/**
 * MatrixQrLoginSdkService.reciprocateLogin 路径契约测试（FT-091）
 *
 * 验证 reciprocateLogin 调用 POST /v1/login/qr_token 时使用
 * MATRIX_PATHS.AUTH.QR_GENERATE_TOKEN（L3 常量），而非硬编码路径。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MATRIX_PATHS } from '../../paths'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const authedRequestWithPrefixImpl = vi.fn()
const httpAuthedRequestImpl = vi.fn()

function makeMockClient() {
  return {
    getDomain: vi.fn(() => 'example.com'),
    getHomeserverUrl: vi.fn(() => 'https://matrix.example.com'),
    getUserId: vi.fn(() => '@user:example.com'),
    getDeviceId: vi.fn(() => 'EXISTING_DEVICE_001'),
    // B-1：authedRequestWithPath 统一走 SDK manager 的 authedRequestWithPrefix
    getRoomManager: () => ({ authedRequestWithPrefix: authedRequestWithPrefixImpl }),
    http: { authedRequest: httpAuthedRequestImpl }
  }
}

function makeMockChannel() {
  let receiveCall = 0
  const receives = [
    { type: 'm.login.protocol', protocol: 'm.login.token', device_id: 'NEW_DEVICE_XYZ' },
    { type: 'm.login.success', user_id: '@user:example.com', device_id: 'NEW_DEVICE_XYZ' }
  ]
  return {
    connect: vi.fn(async () => {}),
    secureSend: vi.fn(async () => {}),
    secureReceive: vi.fn(async () => receives[receiveCall++]),
    close: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    cancelled: false,
    getCheckCode: vi.fn(() => undefined),
    generateCode: vi.fn(async () => new Uint8Array()),
    generateCodeAsync: vi.fn(async () => new Uint8Array())
  }
}

describe('MatrixQrLoginSdkService.reciprocateLogin qr_token path (FT-091)', () => {
  let service: import('../MatrixQrLoginSdkService').MatrixQrLoginSdkService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()

    authedRequestWithPrefixImpl.mockResolvedValue({
      login_token: 'token-abc-123',
      expires_in_ms: 60000
    })

    vi.doMock('../../MatrixClientService', () => ({
      default: {
        getClient: () => makeMockClient()
      }
    }))
  })

  it('MATRIX_PATHS.AUTH.QR_GENERATE_TOKEN 常量指向 v1 前缀的 qr_token 路径', () => {
    expect(MATRIX_PATHS.AUTH.QR_GENERATE_TOKEN).toBe('/_matrix/client/v1/login/qr_token')
  })

  it('reciprocateLogin 调用 authedRequest 时路径来自 MATRIX_PATHS.AUTH.QR_GENERATE_TOKEN', async () => {
    const mod = await import('../MatrixQrLoginSdkService')
    const mockChannel = makeMockChannel()
    const mockSession = { url: 'https://rz.example.com/s1', ready: true, cancelled: false }

    // 注入 mock channel 和 session（绕过 generateQrCode 的 WASM 依赖）
    ;(mod.matrixQrLoginSdkService as unknown as { channel: unknown }).channel = mockChannel
    ;(mod.matrixQrLoginSdkService as unknown as { session: unknown }).session = mockSession
    service = mod.matrixQrLoginSdkService

    await service.reciprocateLogin()

    // 应经 SDK manager 的 authedRequestWithPrefix 调用，路径来自 L3 常量
    const qrTokenCall = authedRequestWithPrefixImpl.mock.calls.find((call: unknown[]) => call[0] === 'POST')
    expect(qrTokenCall).toBeDefined()
    // B-1：完整前缀路径原样交由 SDK manager，前缀剥离由 SDK KNOWN_PREFIXES 完成
    expect(qrTokenCall![1]).toBe(MATRIX_PATHS.AUTH.QR_GENERATE_TOKEN)
  })

  it('reciprocateLogin 经 SDK manager 而非 client.http.authedRequest 发送请求', async () => {
    const mod = await import('../MatrixQrLoginSdkService')
    const mockChannel = makeMockChannel()
    const mockSession = { url: 'https://rz.example.com/s1', ready: true, cancelled: false }

    ;(mod.matrixQrLoginSdkService as unknown as { channel: unknown }).channel = mockChannel
    ;(mod.matrixQrLoginSdkService as unknown as { session: unknown }).session = mockSession
    service = mod.matrixQrLoginSdkService

    await service.reciprocateLogin()

    // B-1：统一入口是 SDK manager，而非底层 client.http.authedRequest
    const qrTokenCall = authedRequestWithPrefixImpl.mock.calls.find((call: unknown[]) => call[0] === 'POST')
    expect(qrTokenCall).toBeDefined()
    expect(qrTokenCall![1]).toBe(MATRIX_PATHS.AUTH.QR_GENERATE_TOKEN)
    expect(httpAuthedRequestImpl).not.toHaveBeenCalled()
  })

  it('源码中 reciprocateLogin 使用 MATRIX_PATHS.AUTH.QR_GENERATE_TOKEN 而非硬编码路径（FT-091）', () => {
    const sourcePath = resolve(process.cwd(), 'src/services/matrix/auth/MatrixQrLoginSdkService.ts')
    const sourceContent = readFileSync(sourcePath, 'utf8')

    // 提取 reciprocateLogin 方法体
    const reciprocateMatch = sourceContent.match(/async reciprocateLogin[\s\S]*?\n {2}\}/)
    expect(reciprocateMatch).toBeTruthy()
    const reciprocateBody = reciprocateMatch![0]

    // 应引用 L3 常量
    expect(reciprocateBody).toContain('MATRIX_PATHS.AUTH.QR_GENERATE_TOKEN')
    // 不应包含硬编码的 qr_token 路径字面量
    expect(reciprocateBody).not.toContain("'/login/qr_token'")
  })
})

describe('MatrixQrLoginSdkService.postJson 使用 SDK HTTP 基础设施（FT-087）', () => {
  // postJson 已拆分到 qrLoginHelpers.ts
  const helpersPath = resolve(process.cwd(), 'src/services/matrix/auth/qrLoginHelpers.ts')
  const helpersContent = readFileSync(helpersPath, 'utf8')

  it('postJson 函数体引用 matrixHttpClient 而非直接 fetch', () => {
    // 提取 postJson 函数体
    const postJsonMatch = helpersContent.match(/async function postJson[\s\S]*?\n}/)
    expect(postJsonMatch).toBeTruthy()
    const postJsonBody = postJsonMatch![0]

    // 应引用 matrixHttpClient（走 SDK 基础设施：重试、限流、URL 解析）
    expect(postJsonBody).toContain('matrixHttpClient')
    // 不应直接调用 getRuntimeAwareFetch（绕过 SDK 基础设施）
    expect(postJsonBody).not.toMatch(/getRuntimeAwareFetch\s*\(\s*\)/)
  })

  it('qrLoginHelpers 模块顶部引入 matrixHttpClient', () => {
    expect(helpersContent).toMatch(/import\s+\{[^}]*matrixHttpClient[^}]*\}\s+from\s+['"][^'']*MatrixHttpClient['"]/)
  })
})
