import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const getClientMock = vi.fn()
vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => getClientMock() },
  matrixClientService: { getClient: () => getClientMock() }
}))

vi.mock('@/services/offline/OfflineQueueService', () => ({
  offlineQueueService: {
    enqueue: vi.fn()
  }
}))

import { offlineQueueService } from '@/services/offline/OfflineQueueService'

const { MatrixRoomStateService } = await import('../StateService')

describe('MatrixRoomStateService', () => {
  let service: InstanceType<typeof MatrixRoomStateService>

  beforeEach(() => {
    service = new MatrixRoomStateService()
    getClientMock.mockReset()
  })

  describe('setRoomName', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.setRoomName('!r', 'x')).rejects.toThrow('客户端未初始化')
    })

    it('forwards to client.setRoomName', async () => {
      const setRoomName = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setRoomName })
      await service.setRoomName('!r', 'New')
      expect(setRoomName).toHaveBeenCalledWith('!r', 'New')
    })

    it('enqueues when offline', async () => {
      // 模拟离线状态
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true
      })

      await service.setRoomName('!r', 'Offline Name')

      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('state', '!r', {
        roomId: '!r',
        type: 'name',
        content: 'Offline Name'
      })

      // 恢复在线状态
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnLine,
        configurable: true
      })
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({ setRoomName: vi.fn().mockRejectedValue(new Error('403')) })
      await expect(service.setRoomName('!r', 'x')).rejects.toThrow('403')
    })
  })

  describe('setRoomTopic', () => {
    it('forwards to client.setRoomTopic', async () => {
      const setRoomTopic = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ setRoomTopic })
      await service.setRoomTopic('!r', 'hello')
      expect(setRoomTopic).toHaveBeenCalledWith('!r', 'hello')
    })

    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.setRoomTopic('!r', 'x')).rejects.toThrow('客户端未初始化')
    })
  })

  describe('setRoomAvatar', () => {
    it('sends m.room.avatar state event with url', async () => {
      const sendStateEvent = vi.fn().mockResolvedValue(undefined)
      getClientMock.mockReturnValueOnce({ sendStateEvent })
      await service.setRoomAvatar('!r', 'mxc://e/abc')
      expect(sendStateEvent).toHaveBeenCalledWith('!r', 'm.room.avatar', { url: 'mxc://e/abc' }, '')
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({
        sendStateEvent: vi.fn().mockRejectedValue(new Error('403'))
      })
      await expect(service.setRoomAvatar('!r', 'mxc://e/x')).rejects.toThrow('403')
    })
  })

  describe('getRoomState', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.getRoomState('!r')).rejects.toThrow('客户端未初始化')
    })

    it('throws when room is missing from local cache', async () => {
      getClientMock.mockReturnValueOnce({ getRoom: () => null })
      await expect(service.getRoomState('!r')).rejects.toThrow('房间不存在: !r')
    })

    it('returns all state events via currentState', async () => {
      const events = [{ type: 'm.room.name' }, { type: 'm.room.topic' }]
      const room = { currentState: { getStateEvents: vi.fn().mockReturnValue(events) } }
      getClientMock.mockReturnValueOnce({ getRoom: () => room })
      expect(await service.getRoomState('!r')).toBe(events)
      expect(room.currentState.getStateEvents).toHaveBeenCalledWith('*')
    })
  })

  describe('setPushRule', () => {
    it('throws when client is not initialized', async () => {
      getClientMock.mockReturnValueOnce(null)
      await expect(service.setPushRule('!r', true)).rejects.toThrow('客户端未初始化')
    })

    it('enabled=true deletes override push rule for the room', async () => {
      const deletePushRule = vi.fn().mockResolvedValue(undefined)
      const addPushRule = vi.fn()
      getClientMock.mockReturnValueOnce({ deletePushRule, addPushRule })
      await service.setPushRule('!r', true)
      expect(deletePushRule).toHaveBeenCalledWith('global', 'override', '!r')
      expect(addPushRule).not.toHaveBeenCalled()
    })

    it('enabled=false installs an empty-actions override rule for the room', async () => {
      const addPushRule = vi.fn().mockResolvedValue(undefined)
      const deletePushRule = vi.fn()
      getClientMock.mockReturnValueOnce({ deletePushRule, addPushRule })
      await service.setPushRule('!r', false)
      expect(addPushRule).toHaveBeenCalledWith('global', 'override', '!r', {
        conditions: [{ kind: 'event_match', key: 'room_id', pattern: '!r' }],
        actions: []
      })
      expect(deletePushRule).not.toHaveBeenCalled()
    })

    it('re-throws backend errors', async () => {
      getClientMock.mockReturnValueOnce({
        deletePushRule: vi.fn().mockRejectedValue(new Error('500')),
        addPushRule: vi.fn()
      })
      await expect(service.setPushRule('!r', true)).rejects.toThrow('500')
    })

    it('enqueues when offline', async () => {
      // 模拟离线状态
      const originalOnLine = navigator.onLine
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true
      })

      await service.setPushRule('!r', true)

      expect(offlineQueueService.enqueue).toHaveBeenCalledWith('push_rule', '!r', {
        roomId: '!r',
        enabled: true
      })

      // 恢复在线状态
      Object.defineProperty(navigator, 'onLine', {
        value: originalOnLine,
        configurable: true
      })
    })
  })
})
