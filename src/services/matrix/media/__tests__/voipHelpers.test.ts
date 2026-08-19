import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  })
}))

import {
  checkMediaPermissions,
  checkTurnAvailability,
  checkVoipAvailability,
  getCallById,
  getCallStatsFromPeerConn,
  getMediaDeviceList,
  getTurnServerConfig
} from '../voipHelpers'
import type { VoIPCall } from '../voipTypes'

/** 创建一个模拟的 RTCPeerConnection，可自定义 stats 报告 */
function createMockPeerConn(reports: Array<Record<string, unknown>> = []) {
  return {
    getStats: vi.fn().mockResolvedValue({
      forEach: vi.fn((cb: (report: RTCStats & Record<string, unknown>) => void) => {
        for (const report of reports) {
          cb(report as RTCStats & Record<string, unknown>)
        }
      })
    })
  } as unknown as RTCPeerConnection
}

/** 创建一个模拟的 VoIPCall */
function createMockCall(overrides: Partial<VoIPCall> = {}): VoIPCall {
  return {
    callId: 'test-call-id',
    roomId: '!test-room:server',
    isVideo: false,
    peerConn: undefined,
    on: vi.fn(),
    off: vi.fn(),
    hangup: vi.fn(),
    answer: vi.fn(),
    ...overrides
  } as unknown as VoIPCall
}

/** 创建一个模拟的 MatrixClient，可自定义 callEventHandler 和 turnServerManager */
function createMockClient(
  options: {
    calls?: Record<string, VoIPCall>
    callEventHandler?: unknown
    turnServerConfig?: unknown
    turnServerThrows?: boolean
  } = {}
): MatrixClient {
  const { calls = {}, turnServerConfig, turnServerThrows = false } = options

  const turnServerManager = {
    getTurnServerConfig: turnServerThrows
      ? vi.fn().mockRejectedValue(new Error('TURN request failed'))
      : vi.fn().mockResolvedValue(turnServerConfig ?? {})
  }

  // SDK 的 CallEventHandler.calls 是 Map<string, MatrixCall>；
  // 当显式传入 callEventHandler 时直接使用（含 undefined/null），否则用 calls Record 构建 Map
  const handler = 'callEventHandler' in options ? options.callEventHandler : { calls: new Map(Object.entries(calls)) }

  const client: Record<string, unknown> = {
    callEventHandler: handler,
    getTurnServerManager: () => turnServerManager
  }

  return client as unknown as MatrixClient
}

describe('voipHelpers', () => {
  describe('getCallById', () => {
    it('应返回找到的通话对象', () => {
      const call = createMockCall({ callId: 'call-1' })
      const client = createMockClient({ calls: { 'call-1': call } })

      const result = getCallById('call-1', client)

      expect(result).toBe(call)
    })

    it('未找到通话时应返回 undefined', () => {
      const client = createMockClient({ calls: { 'call-1': createMockCall() } })

      const result = getCallById('non-existent', client)

      expect(result).toBeUndefined()
    })

    it('当客户端没有 callEventHandler 时应返回 undefined', () => {
      const client = {} as unknown as MatrixClient

      const result = getCallById('call-1', client)

      expect(result).toBeUndefined()
    })

    it('当 callEventHandler 没有 calls 属性时应返回 undefined', () => {
      const client = {
        callEventHandler: {}
      } as unknown as MatrixClient

      const result = getCallById('call-1', client)

      expect(result).toBeUndefined()
    })

    it('当 calls 为空对象时应返回 undefined', () => {
      const client = createMockClient({ calls: {} })

      const result = getCallById('call-1', client)

      expect(result).toBeUndefined()
    })
  })

  describe('getCallStatsFromPeerConn', () => {
    it('没有 peerConn 时应返回 null', async () => {
      const call = createMockCall({ peerConn: undefined })

      const result = await getCallStatsFromPeerConn(call)

      expect(result).toBeNull()
    })

    it('应正确提取 inbound-rtp / outbound-rtp / candidate-pair 统计', async () => {
      const reports = [
        {
          type: 'inbound-rtp',
          bytesReceived: 1024,
          packetsLost: 5,
          jitter: 0.2
        },
        {
          type: 'inbound-rtp',
          bytesReceived: 2048,
          packetsLost: 3,
          jitter: 0.1
        },
        {
          type: 'outbound-rtp',
          bytesSent: 4096
        },
        {
          type: 'outbound-rtp',
          bytesSent: 8192
        },
        {
          type: 'candidate-pair',
          state: 'succeeded',
          currentRoundTripTime: 0.05
        },
        {
          type: 'candidate-pair',
          state: 'failed',
          currentRoundTripTime: 0.99
        }
      ]

      const call = createMockCall({ peerConn: createMockPeerConn(reports) })

      const result = await getCallStatsFromPeerConn(call)

      expect(result).not.toBeNull()
      expect(result!.bytesReceived).toBe(3072) // 1024 + 2048
      expect(result!.bytesSent).toBe(12288) // 4096 + 8192
      expect(result!.packetsLost).toBe(3) // 最后一个 inbound-rtp 覆盖
      expect(result!.jitter).toBe(0.1) // 最后一个 inbound-rtp 覆盖
      expect(result!.roundTripTime).toBe(0.05) // 只有 succeeded 的 candidate-pair
    })

    it('没有匹配报告时各字段应为 0', async () => {
      const reports = [{ type: 'other-type' }, { type: 'candidate-pair', state: 'failed', currentRoundTripTime: 0.5 }]

      const call = createMockCall({ peerConn: createMockPeerConn(reports) })

      const result = await getCallStatsFromPeerConn(call)

      expect(result).not.toBeNull()
      expect(result!.bytesReceived).toBe(0)
      expect(result!.bytesSent).toBe(0)
      expect(result!.packetsLost).toBe(0)
      expect(result!.jitter).toBe(0)
      expect(result!.roundTripTime).toBe(0)
    })

    it('报告中缺少字段时应使用默认值 0', async () => {
      const reports = [
        { type: 'inbound-rtp' },
        { type: 'outbound-rtp' },
        { type: 'candidate-pair', state: 'succeeded' }
      ]

      const call = createMockCall({ peerConn: createMockPeerConn(reports) })

      const result = await getCallStatsFromPeerConn(call)

      expect(result).not.toBeNull()
      expect(result!.bytesReceived).toBe(0)
      expect(result!.bytesSent).toBe(0)
      expect(result!.packetsLost).toBe(0)
      expect(result!.jitter).toBe(0)
      expect(result!.roundTripTime).toBe(0)
    })

    it('getStats 抛出异常时应返回 null', async () => {
      const peerConn = {
        getStats: vi.fn().mockRejectedValue(new Error('getStats failed'))
      } as unknown as RTCPeerConnection
      const call = createMockCall({ peerConn })

      const result = await getCallStatsFromPeerConn(call)

      expect(result).toBeNull()
    })

    it('只有 outbound-rtp 报告时 bytesSent 正确累积，bytesReceived 为 0', async () => {
      const reports = [
        { type: 'outbound-rtp', bytesSent: 1000 },
        { type: 'outbound-rtp', bytesSent: 2000 }
      ]

      const call = createMockCall({ peerConn: createMockPeerConn(reports) })

      const result = await getCallStatsFromPeerConn(call)

      expect(result).not.toBeNull()
      expect(result!.bytesReceived).toBe(0)
      expect(result!.bytesSent).toBe(3000)
    })
  })

  describe('checkMediaPermissions', () => {
    let enumerateDevicesMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      enumerateDevicesMock = vi.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { enumerateDevices: enumerateDevicesMock },
        writable: true,
        configurable: true
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('同时有音频和视频设备时应返回 { audio: true, video: true }', async () => {
      enumerateDevicesMock.mockResolvedValue([{ kind: 'audioinput' }, { kind: 'videoinput' }])

      const result = await checkMediaPermissions()

      expect(result).toEqual({ audio: true, video: true })
    })

    it('只有音频设备时应返回 { audio: true, video: false }', async () => {
      enumerateDevicesMock.mockResolvedValue([{ kind: 'audioinput' }, { kind: 'audioinput' }])

      const result = await checkMediaPermissions()

      expect(result).toEqual({ audio: true, video: false })
    })

    it('只有视频设备时应返回 { audio: false, video: true }', async () => {
      enumerateDevicesMock.mockResolvedValue([{ kind: 'videoinput' }])

      const result = await checkMediaPermissions()

      expect(result).toEqual({ audio: false, video: true })
    })

    it('没有任何设备时应返回 { audio: false, video: false }', async () => {
      enumerateDevicesMock.mockResolvedValue([])

      const result = await checkMediaPermissions()

      expect(result).toEqual({ audio: false, video: false })
    })

    it('设备列表中包含其他类型（如 audiooutput）时不应影响结果', async () => {
      enumerateDevicesMock.mockResolvedValue([{ kind: 'audiooutput' }, { kind: 'audioinput' }])

      const result = await checkMediaPermissions()

      expect(result).toEqual({ audio: true, video: false })
    })

    it('enumerateDevices 抛出异常时应返回 { audio: false, video: false }', async () => {
      enumerateDevicesMock.mockRejectedValue(new Error('Permission denied'))

      const result = await checkMediaPermissions()

      expect(result).toEqual({ audio: false, video: false })
    })
  })

  describe('getMediaDeviceList', () => {
    let enumerateDevicesMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      enumerateDevicesMock = vi.fn()
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: { enumerateDevices: enumerateDevicesMock },
        writable: true,
        configurable: true
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('应正确分类并返回音频和视频设备列表', async () => {
      const mockDevices = [
        { kind: 'audioinput', label: 'Mic 1' },
        { kind: 'audioinput', label: 'Mic 2' },
        { kind: 'videoinput', label: 'Camera 1' },
        { kind: 'audiooutput', label: 'Speaker 1' }
      ]
      enumerateDevicesMock.mockResolvedValue(mockDevices)

      const result = await getMediaDeviceList()

      expect(result.audio).toHaveLength(2)
      expect(result.video).toHaveLength(1)
      expect(result.audio[0].label).toBe('Mic 1')
      expect(result.audio[1].label).toBe('Mic 2')
      expect(result.video[0].label).toBe('Camera 1')
    })

    it('没有设备时应返回空数组', async () => {
      enumerateDevicesMock.mockResolvedValue([])

      const result = await getMediaDeviceList()

      expect(result).toEqual({ audio: [], video: [] })
    })

    it('只有音频设备时视频列表应为空', async () => {
      enumerateDevicesMock.mockResolvedValue([{ kind: 'audioinput', label: 'Mic' }])

      const result = await getMediaDeviceList()

      expect(result.audio).toHaveLength(1)
      expect(result.video).toHaveLength(0)
    })

    it('只有视频设备时音频列表应为空', async () => {
      enumerateDevicesMock.mockResolvedValue([{ kind: 'videoinput', label: 'Camera' }])

      const result = await getMediaDeviceList()

      expect(result.audio).toHaveLength(0)
      expect(result.video).toHaveLength(1)
    })

    it('enumerateDevices 抛出异常时应返回空数组', async () => {
      enumerateDevicesMock.mockRejectedValue(new Error('Device access denied'))

      const result = await getMediaDeviceList()

      expect(result).toEqual({ audio: [], video: [] })
    })

    it('应过滤掉非 input 类型的设备', async () => {
      enumerateDevicesMock.mockResolvedValue([
        { kind: 'audiooutput', label: 'Speaker' },
        { kind: 'audioinput', label: 'Mic' },
        { kind: 'videooutput', label: 'Display' }
      ])

      const result = await getMediaDeviceList()

      expect(result.audio).toHaveLength(1)
      expect(result.video).toHaveLength(0)
    })
  })

  describe('getTurnServerConfig', () => {
    it('应正确返回完整的 TURN 服务器配置', async () => {
      const turnServerConfig = {
        username: 'user123',
        password: 'pass456',
        uris: ['turn:turn.example.com:3478'],
        ttl: 7200
      }
      const client = createMockClient({ turnServerConfig })

      const result = await getTurnServerConfig(client)

      expect(result).toEqual({
        username: 'user123',
        password: 'pass456',
        uris: ['turn:turn.example.com:3478'],
        ttl: 7200
      })
    })

    it('当配置字段缺失时应使用默认值', async () => {
      const turnServerConfig = {
        username: null,
        password: null,
        uris: null,
        ttl: null
      }
      const client = createMockClient({ turnServerConfig })

      const result = await getTurnServerConfig(client)

      expect(result).toEqual({
        username: '',
        password: '',
        uris: [],
        ttl: 3600
      })
    })

    it('当配置字段为 undefined 时应使用默认值', async () => {
      const turnServerConfig = {}
      const client = createMockClient({ turnServerConfig })

      const result = await getTurnServerConfig(client)

      expect(result).toEqual({
        username: '',
        password: '',
        uris: [],
        ttl: 3600
      })
    })

    it('当部分字段缺失时应混合使用已有值和默认值', async () => {
      const turnServerConfig = {
        username: 'partial-user',
        uris: ['turn:server:3478']
        // password 和 ttl 缺失
      }
      const client = createMockClient({ turnServerConfig })

      const result = await getTurnServerConfig(client)

      expect(result).toEqual({
        username: 'partial-user',
        password: '',
        uris: ['turn:server:3478'],
        ttl: 3600
      })
    })

    it('getTurnServerConfig 抛出异常时应重新抛出', async () => {
      const client = createMockClient({ turnServerThrows: true })

      await expect(getTurnServerConfig(client)).rejects.toThrow('TURN request failed')
    })
  })

  describe('checkTurnAvailability', () => {
    it('有 uris 时应返回 available=true 并包含 turnServer 配置', async () => {
      const turnServerConfig = {
        username: 'user',
        password: 'pass',
        uris: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
        ttl: 3600
      }
      const client = createMockClient({ turnServerConfig })

      const result = await checkTurnAvailability(client)

      expect(result.available).toBe(true)
      expect(result.turnServer).toEqual({
        username: 'user',
        password: 'pass',
        uris: ['turn:turn.example.com:3478', 'turns:turn.example.com:5349'],
        ttl: 3600
      })
    })

    it('uris 为空数组时应返回 available=false 并附带原因', async () => {
      const turnServerConfig = {
        username: 'user',
        password: 'pass',
        uris: [],
        ttl: 3600
      }
      const client = createMockClient({ turnServerConfig })

      const result = await checkTurnAvailability(client)

      expect(result.available).toBe(false)
      expect(result.reason).toBe('TURN 服务器未部署，语音通话可能在 NAT 环境下不可用')
      expect(result.turnServer).toBeUndefined()
    })

    it('uris 为 null 时应返回 available=false', async () => {
      const turnServerConfig = {
        username: 'user',
        password: 'pass',
        uris: null,
        ttl: 3600
      }
      const client = createMockClient({ turnServerConfig })

      const result = await checkTurnAvailability(client)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('NAT')
    })

    it('uris 为 undefined 时应返回 available=false', async () => {
      const turnServerConfig = {}
      const client = createMockClient({ turnServerConfig })

      const result = await checkTurnAvailability(client)

      expect(result.available).toBe(false)
      expect(result.reason).toContain('NAT')
    })

    it('turnServerConfig 中字段缺失时返回的 turnServer 应使用默认值', async () => {
      const turnServerConfig = {
        uris: ['turn:server:3478']
        // username, password, ttl 缺失
      }
      const client = createMockClient({ turnServerConfig })

      const result = await checkTurnAvailability(client)

      expect(result.available).toBe(true)
      expect(result.turnServer).toEqual({
        username: '',
        password: '',
        uris: ['turn:server:3478'],
        ttl: 3600
      })
    })

    it('getTurnServerConfig 抛出 Error 时应返回 available=false 并包含原因', async () => {
      const client = createMockClient({ turnServerThrows: true })

      const result = await checkTurnAvailability(client)

      expect(result.available).toBe(false)
      expect(result.reason).toBe('TURN 服务检测失败，语音通话功能可能受限')
      expect(result.turnServer).toBeUndefined()
    })

    it('getTurnServerConfig 抛出非 Error 值时应返回 available=false', async () => {
      const turnServerManager = {
        getTurnServerConfig: vi.fn().mockRejectedValue('string error')
      }
      const client = {
        getTurnServerManager: () => turnServerManager
      } as unknown as MatrixClient

      const result = await checkTurnAvailability(client)

      expect(result.available).toBe(false)
      expect(result.reason).toBe('TURN 服务检测失败，语音通话功能可能受限')
    })
  })

  describe('checkVoipAvailability', () => {
    it('callEventHandler 存在且 TURN 可用时应全部可用', async () => {
      const client = createMockClient({
        callEventHandler: {},
        turnServerConfig: {
          username: 'user',
          password: 'pass',
          uris: ['turn:server:3478'],
          ttl: 3600
        }
      })

      const result = await checkVoipAvailability(client)

      expect(result).toEqual({
        voipAvailable: true,
        turnAvailable: true
      })
      expect(result.message).toBeUndefined()
    })

    it('没有 callEventHandler 时应返回 voipAvailable=false', async () => {
      const client = createMockClient({
        callEventHandler: undefined,
        turnServerConfig: {
          username: 'user',
          password: 'pass',
          uris: ['turn:server:3478'],
          ttl: 3600
        }
      })

      const result = await checkVoipAvailability(client)

      expect(result.voipAvailable).toBe(false)
      expect(result.turnAvailable).toBe(true)
      expect(result.message).toBe('VoIP 模块不可用')
    })

    it('callEventHandler 存在但 TURN 不可用时应返回 turnAvailable=false', async () => {
      const client = createMockClient({
        callEventHandler: {},
        turnServerConfig: {
          username: 'user',
          password: 'pass',
          uris: [],
          ttl: 3600
        }
      })

      const result = await checkVoipAvailability(client)

      expect(result.voipAvailable).toBe(true)
      expect(result.turnAvailable).toBe(false)
      expect(result.message).toBe('TURN 服务器未部署，语音通话可能在 NAT 环境下不可用')
    })

    it('没有 callEventHandler 且 TURN 也不可用时应全部不可用', async () => {
      const client = createMockClient({
        callEventHandler: undefined,
        turnServerConfig: {
          uris: []
        }
      })

      const result = await checkVoipAvailability(client)

      expect(result.voipAvailable).toBe(false)
      expect(result.turnAvailable).toBe(false)
      expect(result.message).toBe('VoIP 模块不可用')
    })

    it('callEventHandler 存在但 TURN 检测抛出异常时应返回 turnAvailable=false', async () => {
      const client = createMockClient({
        callEventHandler: {},
        turnServerThrows: true
      })

      const result = await checkVoipAvailability(client)

      expect(result.voipAvailable).toBe(true)
      expect(result.turnAvailable).toBe(false)
      expect(result.message).toBe('TURN 服务检测失败，语音通话功能可能受限')
    })

    it('callEventHandler 为 null 时应返回 voipAvailable=false', async () => {
      const client = createMockClient({
        callEventHandler: null,
        turnServerConfig: {
          uris: ['turn:server:3478']
        }
      })

      const result = await checkVoipAvailability(client)

      expect(result.voipAvailable).toBe(false)
      expect(result.turnAvailable).toBe(true)
      expect(result.message).toBe('VoIP 模块不可用')
    })
  })
})
