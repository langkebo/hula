import { beforeEach, describe, expect, it, vi } from 'vitest'

const { queryServiceMock } = vi.hoisted(() => ({
  queryServiceMock: {
    getRooms: vi.fn(),
    getRoom: vi.fn(),
    getMembers: vi.fn()
  }
}))

vi.mock('../QueryService', () => ({
  matrixRoomQueryService: queryServiceMock
}))

import { matrixRoomQueryFacade } from '../QueryFacade'

describe('matrixRoomQueryFacade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRooms', () => {
    it('委托给 matrixRoomQueryService.getRooms', async () => {
      const rooms = [{ roomId: '!a:e' }, { roomId: '!b:e' }] as never
      queryServiceMock.getRooms.mockResolvedValue(rooms)

      const result = await matrixRoomQueryFacade.getRooms()

      expect(queryServiceMock.getRooms).toHaveBeenCalledTimes(1)
      expect(queryServiceMock.getRooms).toHaveBeenCalledWith()
      expect(result).toBe(rooms)
    })

    it('透传底层服务抛出的错误', async () => {
      const error = new Error('network')
      queryServiceMock.getRooms.mockRejectedValue(error)
      await expect(matrixRoomQueryFacade.getRooms()).rejects.toThrow('network')
    })
  })

  describe('getRoom', () => {
    it('默认 throwOnError=true 委托给 queryService.getRoom', async () => {
      const room = { roomId: '!a:e' } as never
      queryServiceMock.getRoom.mockResolvedValue(room)

      const result = await matrixRoomQueryFacade.getRoom('!a:e')

      expect(queryServiceMock.getRoom).toHaveBeenCalledWith('!a:e', true)
      expect(result).toBe(room)
    })

    it('throwOnError=true 时显式传递 true', async () => {
      const room = { roomId: '!a:e' } as never
      queryServiceMock.getRoom.mockResolvedValue(room)

      await matrixRoomQueryFacade.getRoom('!a:e', true)

      expect(queryServiceMock.getRoom).toHaveBeenCalledWith('!a:e', true)
    })

    it('throwOnError=false 时传递 false 并允许返回 null', async () => {
      queryServiceMock.getRoom.mockResolvedValue(null)

      const result = await matrixRoomQueryFacade.getRoom('!missing:e', false)

      expect(queryServiceMock.getRoom).toHaveBeenCalledWith('!missing:e', false)
      expect(result).toBeNull()
    })

    it('透传底层抛出的错误', async () => {
      queryServiceMock.getRoom.mockRejectedValue(new Error('404'))
      await expect(matrixRoomQueryFacade.getRoom('!x:e')).rejects.toThrow('404')
    })
  })

  describe('getMembers', () => {
    it('委托给 matrixRoomQueryService.getMembers', async () => {
      const members = [{ userId: '@a:e' }, { userId: '@b:e' }] as never
      queryServiceMock.getMembers.mockResolvedValue(members)

      const result = await matrixRoomQueryFacade.getMembers('!room:e')

      expect(queryServiceMock.getMembers).toHaveBeenCalledWith('!room:e')
      expect(result).toBe(members)
    })

    it('透传底层错误', async () => {
      queryServiceMock.getMembers.mockRejectedValue(new Error('forbidden'))
      await expect(matrixRoomQueryFacade.getMembers('!r:e')).rejects.toThrow('forbidden')
    })
  })
})
