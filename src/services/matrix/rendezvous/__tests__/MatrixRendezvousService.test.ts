import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const { getClientMock } = vi.hoisted(() => ({ getClientMock: vi.fn() }))

vi.mock('../../MatrixClientService', () => ({
  default: { getClient: getClientMock },
  matrixClientService: { getClient: getClientMock }
}))

import { matrixRendezvousService } from '../MatrixRendezvousService'

const makeManager = () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  sendMessage: vi.fn(),
  getMessages: vi.fn(),
  connectToSession: vi.fn(),
  completeSession: vi.fn(),
  pollForMessages: vi.fn()
})

describe('MatrixRendezvousService', () => {
  let manager: ReturnType<typeof makeManager>

  beforeEach(() => {
    manager = makeManager()
    getClientMock.mockReset()
    getClientMock.mockReturnValue({ getRendezvousManager: () => manager })
  })

  it('客户端未初始化时抛错', async () => {
    getClientMock.mockReturnValue(null)
    await expect(
      matrixRendezvousService.createSession({ intent: 'login.start', transport: 'http.v1' })
    ).rejects.toThrow('Matrix client not initialized')
  })

  it('客户端缺少 RendezvousManager 时抛错', async () => {
    getClientMock.mockReturnValue({})
    await expect(matrixRendezvousService.getSession('sid')).rejects.toThrow(
      'RendezvousManager not available on Matrix client'
    )
  })

  it('createSession 透传选项并返回二维码会话信息', async () => {
    manager.createSession.mockResolvedValueOnce({
      url: 'https://hs.test/rendezvous/s1',
      session_id: 's1',
      key: 'k1'
    })

    const options = {
      intent: 'login.start' as const,
      transport: 'http.v1' as const,
      expires_in_ms: 60000
    }
    await expect(matrixRendezvousService.createSession(options)).resolves.toEqual({
      url: 'https://hs.test/rendezvous/s1',
      session_id: 's1',
      key: 'k1'
    })
    expect(manager.createSession).toHaveBeenCalledWith(options)
  })

  it('updateSession 传递状态与会话密钥', async () => {
    manager.updateSession.mockResolvedValueOnce({ session_id: 's1', status: 'connected' })

    await expect(matrixRendezvousService.updateSession('s1', 'connected', 'k1')).resolves.toEqual({
      session_id: 's1',
      status: 'connected'
    })
    expect(manager.updateSession).toHaveBeenCalledWith('s1', 'connected', 'k1')
  })

  it('sendMessage/getMessages 透传消息载荷', async () => {
    const message = { type: 'm.login.protocol', content: { protocol: 'org.matrix.msc3906.v1' } }
    manager.sendMessage.mockResolvedValueOnce({ session_id: 's1', message_id: 'm1', sent_ts: 1 })
    manager.getMessages.mockResolvedValueOnce({ messages: [message] })

    await expect(matrixRendezvousService.sendMessage('s1', message, 'k1')).resolves.toEqual({
      session_id: 's1',
      message_id: 'm1',
      sent_ts: 1
    })
    expect(manager.sendMessage).toHaveBeenCalledWith('s1', message, 'k1')

    await expect(matrixRendezvousService.getMessages('s1', 'k1')).resolves.toEqual({ messages: [message] })
  })

  it('completeSession 返回登录凭证', async () => {
    manager.completeSession.mockResolvedValueOnce({
      access_token: 'at',
      device_id: 'DEV',
      user_id: '@u:hs'
    })

    await expect(matrixRendezvousService.completeSession('s1', 'k1')).resolves.toEqual({
      access_token: 'at',
      device_id: 'DEV',
      user_id: '@u:hs'
    })
  })

  it('deleteSession 失败时向上抛出', async () => {
    manager.deleteSession.mockRejectedValueOnce(new Error('M_NOT_FOUND'))
    await expect(matrixRendezvousService.deleteSession('s404')).rejects.toThrow('M_NOT_FOUND')
  })

  it('pollForMessages 透传轮询选项', async () => {
    const onMessage = vi.fn()
    manager.pollForMessages.mockResolvedValueOnce([{ type: 't', content: {} }])

    const result = await matrixRendezvousService.pollForMessages('s1', {
      interval: 500,
      maxAttempts: 3,
      onMessage,
      sessionKey: 'k1'
    })

    expect(result).toHaveLength(1)
    expect(manager.pollForMessages).toHaveBeenCalledWith('s1', {
      interval: 500,
      maxAttempts: 3,
      onMessage,
      sessionKey: 'k1'
    })
  })
})
