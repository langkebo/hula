import { beforeEach, describe, expect, it, vi } from 'vitest'

const { serviceMock } = vi.hoisted(() => ({
  serviceMock: {
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    sendMessage: vi.fn(),
    getMessages: vi.fn(),
    completeSession: vi.fn(),
    pollForMessages: vi.fn()
  }
}))

vi.mock('@/services/matrix/rendezvous/MatrixRendezvousService', () => ({
  matrixRendezvousService: serviceMock
}))

import {
  makeCreateSessionResponse,
  makeGetMessagesResponse,
  makeRendezvousLoginCredentials,
  makeRendezvousMessage,
  makeRendezvousSession
} from '@/services/matrix/rendezvous/__tests__/fixtures/rendezvous'
import { useRendezvous } from '../useRendezvous'

describe('useRendezvous', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('createSession 成功后状态转为 active 并缓存响应', async () => {
    const response = makeCreateSessionResponse()
    serviceMock.createSession.mockResolvedValueOnce(response)

    const rendezvous = useRendezvous()
    await rendezvous.createSession()

    expect(serviceMock.createSession).toHaveBeenCalledWith({
      intent: 'login.start',
      transport: 'http.v1',
      transport_data: undefined,
      expires_in_ms: undefined
    })
    expect(rendezvous.sessionStatus.value).toBe('active')
    expect(rendezvous.createSessionResponse.value).toEqual(response)
    expect(rendezvous.loading.value).toBe(false)
    expect(rendezvous.error.value).toBeNull()
  })

  it('createSession 失败时状态转为 failed 并记录错误', async () => {
    serviceMock.createSession.mockRejectedValueOnce(new Error('M_LIMIT_EXCEEDED'))

    const rendezvous = useRendezvous()
    await expect(rendezvous.createSession()).rejects.toThrow('M_LIMIT_EXCEEDED')

    expect(rendezvous.sessionStatus.value).toBe('failed')
    expect(rendezvous.error.value).toBe('M_LIMIT_EXCEEDED')
    expect(rendezvous.loading.value).toBe(false)
  })

  it('getSession 缓存当前会话', async () => {
    const session = makeRendezvousSession()
    serviceMock.getSession.mockResolvedValueOnce(session)

    const rendezvous = useRendezvous()
    await rendezvous.getSession('s1', 'k1')

    expect(rendezvous.currentSession.value).toEqual(session)
    expect(serviceMock.getSession).toHaveBeenCalledWith('s1', 'k1')
  })

  it('getMessages 更新消息列表', async () => {
    const messages = [makeRendezvousMessage()]
    serviceMock.getMessages.mockResolvedValueOnce(makeGetMessagesResponse(messages))

    const rendezvous = useRendezvous()
    await rendezvous.getMessages('s1')

    expect(rendezvous.messages.value).toEqual(messages)
  })

  it('completeSession 成功后状态转为 completed', async () => {
    const credentials = makeRendezvousLoginCredentials()
    serviceMock.completeSession.mockResolvedValueOnce(credentials)

    const rendezvous = useRendezvous()
    const result = await rendezvous.completeSession('s1', 'k1')

    expect(result).toEqual(credentials)
    expect(rendezvous.sessionStatus.value).toBe('completed')
  })

  it('deleteSession 清空全部会话状态', async () => {
    serviceMock.createSession.mockResolvedValueOnce(makeCreateSessionResponse())
    serviceMock.getMessages.mockResolvedValueOnce(
      makeGetMessagesResponse([makeRendezvousMessage({ type: 't', content: {} })])
    )
    serviceMock.deleteSession.mockResolvedValueOnce(undefined)

    const rendezvous = useRendezvous()
    await rendezvous.createSession()
    await rendezvous.getMessages('s1')
    await rendezvous.deleteSession('s1')

    expect(rendezvous.currentSession.value).toBeNull()
    expect(rendezvous.createSessionResponse.value).toBeNull()
    expect(rendezvous.messages.value).toEqual([])
    expect(rendezvous.sessionStatus.value).toBe('idle')
  })

  it('pollForMessages 累积消息并转发给调用方回调', async () => {
    const batch = [makeRendezvousMessage({ type: 'm.login.approved' })]
    serviceMock.pollForMessages.mockImplementationOnce(async (_sessionId, options) => {
      options?.onMessage?.(batch)
      return batch
    })
    const userCallback = vi.fn()

    const rendezvous = useRendezvous()
    const result = await rendezvous.pollForMessages('s1', { onMessage: userCallback })

    expect(result).toEqual(batch)
    expect(rendezvous.messages.value).toEqual(batch)
    expect(userCallback).toHaveBeenCalledWith(batch)
  })

  it('后续成功调用会清除上一次错误', async () => {
    serviceMock.getSession.mockRejectedValueOnce(new Error('boom'))
    serviceMock.getSession.mockResolvedValueOnce(null)

    const rendezvous = useRendezvous()
    await expect(rendezvous.getSession('s1')).rejects.toThrow('boom')
    expect(rendezvous.error.value).toBe('boom')

    await rendezvous.getSession('s1')
    expect(rendezvous.error.value).toBeNull()
  })
})
