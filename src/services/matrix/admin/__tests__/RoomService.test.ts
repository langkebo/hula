import type { AdminManager } from 'matrix-js-sdk/admin'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminRoomService } from '../RoomService'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

const makeAdmin = () =>
  ({
    getRoomsPaginated: vi.fn(),
    getRoom: vi.fn(),
    getRoomMembers: vi.fn(),
    getRoomState: vi.fn(),
    deleteRoom: vi.fn(),
    deleteRoomAdmin: vi.fn(),
    blockRoom: vi.fn(),
    shutdownRoom: vi.fn(),
    joinRoom: vi.fn(),
    removeRoomMember: vi.fn(),
    getRoomMessages: vi.fn(),
    getRoomAliases: vi.fn(),
    getRoomVersion: vi.fn(),
    getRoomBlockStatus: vi.fn(),
    unblockRoom: vi.fn(),
    makeRoomAdmin: vi.fn(),
    purgeRoomHistory: vi.fn(),
    purgeRoom: vi.fn(),
    getRoomStats: vi.fn(),
    getRoomStatsByRoom: vi.fn(),
    getRoomListings: vi.fn(),
    setRoomPublicListing: vi.fn(),
    getRoomEventContext: vi.fn(),
    searchRoomEvents: vi.fn(),
    searchRooms: vi.fn(),
    getRoomForwardExtremities: vi.fn(),
    listSpaces: vi.fn(),
    getSpaceUsers: vi.fn(),
    getSpaceRooms: vi.fn()
  }) as unknown as AdminManager

describe('AdminRoomService', () => {
  let admin: ReturnType<typeof makeAdmin>
  let client: {
    kick: ReturnType<typeof vi.fn>
    ban: ReturnType<typeof vi.fn>
    unban: ReturnType<typeof vi.fn>
  }
  let service: AdminRoomService

  beforeEach(() => {
    admin = makeAdmin()
    client = {
      kick: vi.fn().mockResolvedValue(undefined),
      ban: vi.fn().mockResolvedValue(undefined),
      unban: vi.fn().mockResolvedValue(undefined)
    }
    service = new AdminRoomService(
      async () => admin,
      () => client as never
    )
  })

  it('getRooms maps SDK room payload to RoomInfo', async () => {
    ;(admin as any).getRoomsPaginated.mockResolvedValueOnce({
      items: [
        {
          room_id: '!room:server.com',
          name: 'Room',
          topic: 'Topic',
          joined_members: 5,
          joined_local_members: 3,
          invited_members: 2,
          created_ts: 100,
          creator: '@alice:server.com',
          public: true
        }
      ],
      nextToken: 'next'
    })

    const result = await service.getRooms()

    expect(result).toEqual({
      rooms: [
        {
          roomId: '!room:server.com',
          name: 'Room',
          topic: 'Topic',
          joinedMembers: 5,
          joinedLocalMembers: 3,
          invitedMembers: 2,
          invitedLocalMembers: 0,
          createTime: 100,
          creator: '@alice:server.com',
          public: true
        }
      ],
      nextToken: 'next'
    })
  })

  it('deleteRoom validates matrix room id', async () => {
    await expect(service.deleteRoom('bad-room')).rejects.toThrow('Invalid room ID')
  })

  it('shutdownRoom maps kicked and alias fields', async () => {
    ;(admin as any).shutdownRoom.mockResolvedValueOnce({
      kicked_users: ['@u1:server.com'],
      failed_to_kick_users: ['@u2:server.com'],
      local_aliases: ['#room:server.com']
    })

    const result = await service.shutdownRoom('!room:server.com')

    expect(result).toEqual({
      kickedUsers: ['@u1:server.com'],
      failedToKickUsers: ['@u2:server.com'],
      localAliases: ['#room:server.com']
    })
  })

  it('kickUser delegates to MatrixClient', async () => {
    await service.kickUser('!room:server.com', '@u1:server.com', 'spam')
    expect(client.kick).toHaveBeenCalledWith('!room:server.com', '@u1:server.com', 'spam')
  })

  it('purgeHistory maps camelCase options to snake_case', async () => {
    ;(admin as any).purgeRoomHistory.mockResolvedValueOnce({ purge_id: 'pid-1' })

    const result = await service.purgeHistory('!room:server.com', {
      purgeUpToEventId: '$event',
      purgeUpToTs: 123,
      deleteLocalEvents: true
    })

    expect(result).toEqual({ purgeId: 'pid-1' })
    expect((admin as any).purgeRoomHistory).toHaveBeenCalledWith('!room:server.com', {
      purge_up_to_event_id: '$event',
      purge_up_to_ts: 123,
      delete_local_events: true
    })
  })

  it('getRoomForwardExtremities returns array directly', async () => {
    ;(admin as any).getRoomForwardExtremities.mockResolvedValueOnce([{ event_id: '$a' }])
    expect(await service.getRoomForwardExtremities('!room:server.com')).toEqual([{ event_id: '$a' }])
  })

  it('deleteRoomV2 maps option keys and response fields', async () => {
    ;(admin as any).deleteRoomAdmin.mockResolvedValueOnce({
      kicked_users: ['@u1:server.com'],
      failed_to_kick_users: [],
      local_aliases: ['#room:server.com'],
      new_room_id: '!new:server.com'
    })

    const result = await service.deleteRoomV2('!room:server.com', {
      purge: true,
      force: true,
      newRoomUserId: '@admin:server.com',
      roomName: 'Archive',
      message: 'bye',
      block: true
    })

    expect((admin as any).deleteRoomAdmin).toHaveBeenCalledWith('!room:server.com', {
      purge: true,
      force_purge: true,
      new_room_user_id: '@admin:server.com',
      room_name: 'Archive',
      message: 'bye',
      block: true
    })
    expect(result.newRoomId).toBe('!new:server.com')
  })

  it('deleteRoomCompat keeps force_purge compatibility body', async () => {
    ;(admin as any).deleteRoomAdmin.mockResolvedValueOnce({
      kicked_users: ['@u1:server.com'],
      new_room_id: '!new:server.com'
    })

    const result = await service.deleteRoomCompat('!room:server.com', {
      purge: true,
      force: true,
      newRoomUserId: '@admin:server.com',
      roomName: 'Archive',
      message: 'bye'
    })

    expect((admin as any).deleteRoomAdmin).toHaveBeenCalledWith('!room:server.com', {
      purge: true,
      force_purge: true,
      new_room_user_id: '@admin:server.com',
      room_name: 'Archive',
      message: 'bye'
    })
    expect(result).toEqual({
      kickedUsers: ['@u1:server.com'],
      newRoomId: '!new:server.com'
    })
  })
})
