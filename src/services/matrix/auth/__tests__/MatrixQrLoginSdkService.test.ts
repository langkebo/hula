/**
 * MatrixQrLoginSdkService 单元测试
 *
 * 通过 vi.mock 注入 SDK（loadSdkRendezvous）、依赖（MatrixClientService /
 * MatrixHttpClient / qrLoginHelpers）与 WASM 解析模块，覆盖各导出方法的
 * 正常、空值（无活跃会话 / 未初始化客户端）与错误分支。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixQrLoginSdkService } from '../MatrixQrLoginSdkService'

const mocks = vi.hoisted(() => ({
  getClient: vi.fn(),
  authedRequestWithPath: vi.fn(),
  loadSdkRendezvous: vi.fn(),
  getRuntimeAwareFetch: vi.fn(),
  bytesToBase64: vi.fn(),
  base64ToBytes: vi.fn(),
  generateDeviceId: vi.fn(),
  postJson: vi.fn(),
  resolveEndpoint: vi.fn(),
  qrFromBytes: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  default: { getClient: mocks.getClient }
}))

vi.mock('../../MatrixHttpClient', () => ({
  authedRequestWithPath: mocks.authedRequestWithPath,
  matrixHttpClient: { request: vi.fn() }
}))

vi.mock('../../paths', () => ({
  PREFIX_V3: '/_matrix/client/v3',
  MATRIX_PATHS: { AUTH: { QR_GENERATE_TOKEN: '/_matrix/client/v1/login/qr_token' } }
}))

vi.mock('../qrLoginHelpers', () => ({
  base64ToBytes: mocks.base64ToBytes,
  bytesToBase64: mocks.bytesToBase64,
  generateDeviceId: mocks.generateDeviceId,
  getRuntimeAwareFetch: mocks.getRuntimeAwareFetch,
  loadSdkRendezvous: mocks.loadSdkRendezvous,
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
  postJson: mocks.postJson,
  resolveMatrixRuntimeEndpointConfig: mocks.resolveEndpoint,
  PREFIX_V3: '/_matrix/client/v3'
}))

vi.mock('@matrix-org/matrix-sdk-crypto-wasm', () => ({
  QrCodeData: { fromBytes: mocks.qrFromBytes }
}))

class MockSession {
  url = 'https://rz.example.com/s'
  ready = true
  cancelled = false
  send = vi.fn(async () => {})
  receive = vi.fn(async () => undefined)
  cancel = vi.fn(async () => {})
  close = vi.fn(async () => {})
}

class MockChannel {
  getCheckCode(): string | undefined {
    return 'ABCD'
  }
  generateCode(): Promise<Uint8Array> {
    return Promise.resolve(new Uint8Array([1, 2, 3]))
  }
  connect(): Promise<void> {
    return Promise.resolve()
  }
  secureSend(): Promise<void> {
    return Promise.resolve()
  }
  secureReceive(): Promise<unknown> {
    return Promise.resolve(undefined)
  }
  close(): Promise<void> {
    return Promise.resolve()
  }
  cancel(): Promise<void> {
    return Promise.resolve()
  }
  cancelled = false
}

function mockSdk(opts: { channel?: Record<string, unknown>; session?: Record<string, unknown> } = {}): void {
  class S extends MockSession {
    constructor(..._args: unknown[]) {
      super()
      Object.assign(this, opts.session)
    }
  }
  class C extends MockChannel {
    constructor(..._args: unknown[]) {
      super()
      Object.assign(this, opts.channel)
    }
  }
  mocks.loadSdkRendezvous.mockResolvedValue({
    MSC4108RendezvousSession: S,
    MSC4108SecureChannel: C
  } as never)
}

function makeQueue(receives: unknown[]): { channel: unknown; session: unknown } {
  let i = 0
  const channel = {
    connect: vi.fn(async () => {}),
    secureSend: vi.fn(async () => {}),
    secureReceive: vi.fn(async () => receives[i++]),
    close: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
    cancelled: false,
    getCheckCode: vi.fn(() => 'ABCD'),
    generateCode: vi.fn(async () => new Uint8Array([1, 2, 3]))
  }
  const session = { url: 'https://rz.example.com/s', ready: true, cancelled: false, send: vi.fn(), close: vi.fn() }
  return { channel, session }
}

function injectSession(channel: unknown, session: unknown): void {
  ;(matrixQrLoginSdkService as unknown as { channel: unknown }).channel = channel
  ;(matrixQrLoginSdkService as unknown as { session: unknown }).session = session
}

function makeClient(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    getDomain: vi.fn(() => 'example.com'),
    getHomeserverUrl: vi.fn(() => 'https://matrix.example.com'),
    getUserId: vi.fn(() => '@user:example.com'),
    getDeviceId: vi.fn(() => 'EXISTING_DEVICE_001'),
    ...overrides
  }
}

const svc = matrixQrLoginSdkService

describe('MatrixQrLoginSdkService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRuntimeAwareFetch.mockReturnValue(vi.fn())
    mocks.bytesToBase64.mockReturnValue('BASE64')
    mocks.base64ToBytes.mockReturnValue(new Uint8Array([1, 2, 3]))
    mocks.generateDeviceId.mockReturnValue('NEW_DEVICE_001')
    mocks.resolveEndpoint.mockReturnValue({ homeserverUrl: 'https://fallback.example.com' })
    mocks.postJson.mockResolvedValue({
      user_id: '@user:example.com',
      access_token: 'at',
      device_id: 'NEW_DEVICE_001',
      refresh_token: 'rt',
      expires_in: 3600
    })
    mockSdk()
    svc.reset()
  })

  describe('getStatus / reset / onStatusChange', () => {
    it('starts in idle status', () => {
      expect(svc.getStatus()).toBe('idle')
    })

    it('reset returns to idle and clears the session', () => {
      const { channel, session } = makeQueue([])
      injectSession(channel, session)
      svc.reset()
      expect(svc.getStatus()).toBe('idle')
      expect((svc as unknown as { channel: unknown }).channel).toBeNull()
    })

    it('onStatusChange registers and returns an unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = svc.onStatusChange(listener)
      svc.reset()
      expect(listener).toHaveBeenCalledWith('idle', undefined)
      unsubscribe()
      svc.reset()
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  describe('generateQrCodeAsNewDevice', () => {
    it('throws when homeserverUrl is empty', async () => {
      await expect(svc.generateQrCodeAsNewDevice('')).rejects.toThrow('Homeserver URL is required for QR login')
      expect(mocks.loadSdkRendezvous).not.toHaveBeenCalled()
    })

    it('generates a QR code and returns payload on success', async () => {
      const result = await svc.generateQrCodeAsNewDevice('https://hs.example.com')
      expect(result).toEqual({
        qrCodeBase64: 'BASE64',
        checkCode: 'ABCD',
        rendezvousUrl: 'https://rz.example.com/s'
      })
      expect(svc.getStatus()).toBe('waiting_scan')
    })

    it('sets failed status and throws when code generation fails', async () => {
      mockSdk({
        channel: { generateCode: async () => Promise.reject(new Error('gen-fail')) }
      })
      await expect(svc.generateQrCodeAsNewDevice('https://hs.example.com')).rejects.toThrow('生成二维码失败: gen-fail')
      expect(svc.getStatus()).toBe('failed')
    })
  })

  describe('generateQrCode (existing device)', () => {
    it('throws when the Matrix client is not initialized', async () => {
      mocks.getClient.mockReturnValue(null)
      await expect(svc.generateQrCode()).rejects.toThrow('Matrix client not initialized')
    })

    it('throws when the server domain cannot be determined', async () => {
      mocks.getClient.mockReturnValue(makeClient({ getDomain: vi.fn(() => null) }) as never)
      await expect(svc.generateQrCode()).rejects.toThrow('Cannot determine server domain')
      expect(svc.getStatus()).toBe('failed')
    })

    it('generates a reciprocate-mode QR code on success', async () => {
      mocks.getClient.mockReturnValue(makeClient() as never)
      const result = await svc.generateQrCode()
      expect(result).toEqual({
        qrCodeBase64: 'BASE64',
        checkCode: 'ABCD',
        rendezvousUrl: 'https://rz.example.com/s'
      })
      expect(svc.getStatus()).toBe('waiting_scan')
    })
  })

  describe('waitForReciprocationAndLogin', () => {
    it('throws when there is no active session', async () => {
      await expect(svc.waitForReciprocationAndLogin()).rejects.toThrow('No active QR session')
    })

    it('throws when protocol negotiation message is missing', async () => {
      const { channel, session } = makeQueue([{ type: 'm.other' }])
      injectSession(channel, session)
      await expect(svc.waitForReciprocationAndLogin()).rejects.toThrow('未收到协议协商消息')
      expect(svc.getStatus()).toBe('failed')
    })

    it('throws when the existing device does not offer m.login.token', async () => {
      const { channel, session } = makeQueue([{ type: 'm.login.protocols', protocols: ['m.other'], homeserver: 'hs' }])
      injectSession(channel, session)
      await expect(svc.waitForReciprocationAndLogin()).rejects.toThrow('现有设备未提供 m.login.token 协议')
      expect(svc.getStatus()).toBe('failed')
    })

    it('throws when the login token is missing', async () => {
      const { channel, session } = makeQueue([
        { type: 'm.login.protocols', protocols: ['m.login.token'], homeserver: 'hs' },
        { type: 'm.login.secrets' }
      ])
      injectSession(channel, session)
      await expect(svc.waitForReciprocationAndLogin()).rejects.toThrow('未收到登录令牌')
      expect(svc.getStatus()).toBe('failed')
    })

    it('performs the full login flow on success', async () => {
      const { channel, session } = makeQueue([
        { type: 'm.login.protocols', protocols: ['m.login.token'], homeserver: 'hs' },
        { type: 'm.login.secrets', login_token: 'tok', homeserver_url: 'https://hs.example.com' }
      ])
      injectSession(channel, session)
      const result = await svc.waitForReciprocationAndLogin('Alice')
      expect(result).toEqual({
        user_id: '@user:example.com',
        access_token: 'at',
        device_id: 'NEW_DEVICE_001',
        refresh_token: 'rt',
        expires_in: 3600,
        homeserver_url: 'https://hs.example.com'
      })
      expect(svc.getStatus()).toBe('success')
      expect(mocks.postJson).toHaveBeenCalledWith('/_matrix/client/v3/login', expect.objectContaining({ token: 'tok' }))
    })

    it('falls back to runtime endpoint config when homeserver_url is missing', async () => {
      const { channel, session } = makeQueue([
        { type: 'm.login.protocols', protocols: ['m.login.token'], homeserver: 'hs' },
        { type: 'm.login.secrets', login_token: 'tok' }
      ])
      injectSession(channel, session)
      const result = await svc.waitForReciprocationAndLogin()
      expect(result.homeserver_url).toBe('https://fallback.example.com')
    })
  })

  describe('reciprocateLogin', () => {
    it('throws when there is no active session', async () => {
      await expect(svc.reciprocateLogin()).rejects.toThrow('No active QR session')
    })

    it('throws when the Matrix client is not initialized', async () => {
      const { channel, session } = makeQueue([])
      injectSession(channel, session)
      mocks.getClient.mockReturnValue(null)
      await expect(svc.reciprocateLogin()).rejects.toThrow('Matrix client not initialized')
    })

    it('throws when the new device does not select m.login.token', async () => {
      const { channel, session } = makeQueue([{ type: 'm.other' }])
      injectSession(channel, session)
      mocks.getClient.mockReturnValue(makeClient() as never)
      mocks.authedRequestWithPath.mockResolvedValue({ login_token: 'tok', expires_in_ms: 60000 })
      await expect(svc.reciprocateLogin()).rejects.toThrow('协议协商失败')
      expect(svc.getStatus()).toBe('failed')
    })

    it('throws when the new device does not report success', async () => {
      const { channel, session } = makeQueue([
        { type: 'm.login.protocol', protocol: 'm.login.token', device_id: 'NEW_DEV' },
        { type: 'm.login.nope' }
      ])
      injectSession(channel, session)
      mocks.getClient.mockReturnValue(makeClient() as never)
      mocks.authedRequestWithPath.mockResolvedValue({ login_token: 'tok', expires_in_ms: 60000 })
      await expect(svc.reciprocateLogin()).rejects.toThrow('新设备登录未成功完成')
      expect(svc.getStatus()).toBe('failed')
    })

    it('performs the full reciprocate flow on success', async () => {
      const { channel, session } = makeQueue([
        { type: 'm.login.protocol', protocol: 'm.login.token', device_id: 'NEW_DEV' },
        { type: 'm.login.success', user_id: '@user:example.com', device_id: 'NEW_DEV' }
      ])
      injectSession(channel, session)
      mocks.getClient.mockReturnValue(makeClient() as never)
      mocks.authedRequestWithPath.mockResolvedValue({ login_token: 'tok', expires_in_ms: 60000 })
      const result = await svc.reciprocateLogin()
      expect(result).toEqual({ user_id: '@user:example.com', device_id: 'NEW_DEV' })
      expect(svc.getStatus()).toBe('success')
      expect(mocks.authedRequestWithPath).toHaveBeenCalledWith(
        expect.anything(),
        'POST',
        '/_matrix/client/v1/login/qr_token'
      )
    })
  })

  describe('declineLogin', () => {
    it('resolves early when there is no active channel', async () => {
      await expect(svc.declineLogin()).resolves.toBeUndefined()
    })

    it('sends a failure payload and sets cancelled status', async () => {
      const { channel, session } = makeQueue([])
      injectSession(channel, session)
      await svc.declineLogin()
      expect((channel as { secureSend: ReturnType<typeof vi.fn> }).secureSend).toHaveBeenCalledWith({
        type: 'm.login.failure',
        reason: 'user_declined',
        detail: 'Existing device declined the login'
      })
      expect(svc.getStatus()).toBe('cancelled')
    })
  })

  describe('scanQrCode', () => {
    it('throws when the QR code has no rendezvous URL', async () => {
      mocks.qrFromBytes.mockReturnValue({ serverName: 'hs', publicKey: new Uint8Array(), rendezvousUrl: null })
      await expect(svc.scanQrCode('AAA')).rejects.toThrow('Invalid QR code: missing rendezvous URL')
      expect(svc.getStatus()).toBe('failed')
    })

    it('parses the QR code and connects on success', async () => {
      mocks.qrFromBytes.mockReturnValue({
        serverName: 'hs',
        publicKey: new Uint8Array([9]),
        rendezvousUrl: 'https://rz.example.com/s'
      })
      const result = await svc.scanQrCode('AAA')
      expect(result).toEqual({ serverName: 'hs', checkCode: 'ABCD' })
      expect(svc.getStatus()).toBe('waiting_confirm')
    })

    it('throws when QR parsing fails', async () => {
      mocks.qrFromBytes.mockImplementation(() => {
        throw new Error('bad-qr')
      })
      await expect(svc.scanQrCode('AAA')).rejects.toThrow('扫码失败: bad-qr')
      expect(svc.getStatus()).toBe('failed')
    })
  })

  describe('completeNewDeviceLogin', () => {
    it('throws when there is no active session', async () => {
      await expect(svc.completeNewDeviceLogin()).rejects.toThrow('No active QR session')
    })

    it('throws when protocol negotiation message is missing', async () => {
      const { channel, session } = makeQueue([{ type: 'm.other' }])
      injectSession(channel, session)
      await expect(svc.completeNewDeviceLogin()).rejects.toThrow('未收到协议协商消息')
      expect(svc.getStatus()).toBe('failed')
    })

    it('throws when the login token is missing', async () => {
      const { channel, session } = makeQueue([
        { type: 'm.login.protocols', protocols: ['m.login.token'], homeserver: 'hs' },
        { type: 'm.login.secrets' }
      ])
      injectSession(channel, session)
      await expect(svc.completeNewDeviceLogin()).rejects.toThrow('未收到登录令牌')
      expect(svc.getStatus()).toBe('failed')
    })

    it('performs the full new-device login flow on success', async () => {
      const { channel, session } = makeQueue([
        { type: 'm.login.protocols', protocols: ['m.login.token'], homeserver: 'hs' },
        {
          type: 'm.login.secrets',
          login_token: 'tok',
          homeserver_url: 'https://hs.example.com',
          user_id: '@u',
          device_id: 'NEW_DEVICE_001',
          expires_at: 1
        }
      ])
      injectSession(channel, session)
      const result = await svc.completeNewDeviceLogin('Alice')
      expect(result.user_id).toBe('@user:example.com')
      expect(result.homeserver_url).toBe('https://hs.example.com')
      expect(svc.getStatus()).toBe('success')
    })
  })

  describe('cancel', () => {
    it('sets cancelled status and clears the session', async () => {
      const { channel, session } = makeQueue([])
      injectSession(channel, session)
      await svc.cancel()
      expect((channel as { cancel: ReturnType<typeof vi.fn> }).cancel).toHaveBeenCalledWith(4)
      expect(svc.getStatus()).toBe('cancelled')
      expect((svc as unknown as { channel: unknown }).channel).toBeNull()
    })

    it('still sets cancelled status when no channel exists', async () => {
      await svc.cancel()
      expect(svc.getStatus()).toBe('cancelled')
    })
  })
})
