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
    deleteRoomPublicListing: vi.fn(),
    getRoomTokenSync: vi.fn(),
    cascadeRedactEvent: vi.fn(),
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

  it('shutdownRoom maps kicked fields', async () => {
    // SDK/后端 `AdminShutdownRoomResult` 只有 `{closed_room, kicked_users, failed_to_kick_users}`
    // —— `local_aliases` / `new_room_id` 是本后端**从不返回**的字段（SDK 类型注释原文）。
    ;(admin as any).shutdownRoom.mockResolvedValueOnce({
      kicked_users: ['@u1:server.com'],
      failed_to_kick_users: ['@u2:server.com']
    })

    const result = await service.shutdownRoom('!room:server.com')

    expect(result).toEqual({
      kickedUsers: ['@u1:server.com'],
      failedToKickUsers: ['@u2:server.com']
    })
  })

  it('kickUser delegates to MatrixClient', async () => {
    await service.kickUser('!room:server.com', '@u1:server.com', 'spam')
    expect(client.kick).toHaveBeenCalledWith('!room:server.com', '@u1:server.com', 'spam')
  })

  it('purgeHistory 只发送后端支持的字段并回传真实结果', async () => {
    // 后端 `admin/room/management.rs::purge_history` 只读 `purge_up_to_ts` / `dry_run`，
    // 返回 `{success, deleted_events, dry_run}`（无 `purge_id`；那是 purgeRoom 的字段）。
    ;(admin as any).purgeRoomHistory.mockResolvedValueOnce({ success: true, deleted_events: 9, dry_run: false })

    const result = await service.purgeHistory('!room:server.com', { purgeUpToTs: 123, dryRun: true })

    expect(result).toEqual({ success: true, deletedEvents: 9, dryRun: false })
    expect((admin as any).purgeRoomHistory).toHaveBeenCalledWith('!room:server.com', {
      purge_up_to_ts: 123,
      dry_run: true
    })
  })

  it('getRoomForwardExtremities returns array directly', async () => {
    ;(admin as any).getRoomForwardExtremities.mockResolvedValueOnce([{ event_id: '$a' }])
    expect(await service.getRoomForwardExtremities('!room:server.com')).toEqual([{ event_id: '$a' }])
  })

  it('setRoomPublicListing 上线走 setRoomPublicListing，下线走 deleteRoomPublicListing', async () => {
    ;(admin as any).setRoomPublicListing.mockResolvedValueOnce(undefined)
    ;(admin as any).deleteRoomPublicListing.mockResolvedValueOnce(undefined)

    await service.setRoomPublicListing('!room:server.com', true)
    await service.setRoomPublicListing('!room:server.com', false)

    expect((admin as any).setRoomPublicListing).toHaveBeenCalledWith('!room:server.com')
    expect((admin as any).deleteRoomPublicListing).toHaveBeenCalledWith('!room:server.com')
  })

  it('getRoomTokenSync 返回对象，失败时降级为 null', async () => {
    ;(admin as any).getRoomTokenSync.mockResolvedValueOnce({ enabled: true, token: 't' })
    await expect(service.getRoomTokenSync('!room:server.com')).resolves.toEqual({ enabled: true, token: 't' })

    ;(admin as any).getRoomTokenSync.mockRejectedValueOnce(new Error('forbidden'))
    await expect(service.getRoomTokenSync('!room:server.com')).resolves.toBeNull()
  })

  it('cascadeRedactEvent 传递可选参数并返回 redacted_count', async () => {
    ;(admin as any).cascadeRedactEvent.mockResolvedValueOnce({ redacted_count: 3 })

    const count = await service.cascadeRedactEvent('!room:server.com', '$event', {
      maxDepth: 4,
      reason: 'spam'
    })

    expect((admin as any).cascadeRedactEvent).toHaveBeenCalledWith('!room:server.com', {
      eventId: '$event',
      maxDepth: 4,
      reason: 'spam'
    })
    expect(count).toBe(3)
  })

  it('cascadeRedactEvent 省略未提供的可选参数', async () => {
    ;(admin as any).cascadeRedactEvent.mockResolvedValueOnce({ redacted_count: 0 })

    await service.cascadeRedactEvent('!room:server.com', '$event')

    expect((admin as any).cascadeRedactEvent).toHaveBeenCalledWith('!room:server.com', { eventId: '$event' })
  })

  it('deleteRoom maps option keys and response fields', async () => {
    ;(admin as any).deleteRoom.mockResolvedValueOnce(undefined)

    const result = await service.deleteRoom('!room:server.com', {
      purge: true,
      force: true,
      newRoomUserId: '@admin:server.com',
      roomName: 'Archive',
      message: 'bye',
      block: true
    })

    expect((admin as any).deleteRoom).toHaveBeenCalledWith('!room:server.com', {
      block: true,
      purge: true,
      force_purge: true,
      reason: 'bye'
    })
    expect(result.kickedUsers).toEqual([])
    expect(result.newRoomId).toBeUndefined()
  })
})
