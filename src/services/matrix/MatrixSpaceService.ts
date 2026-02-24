import type { Room } from 'matrix-js-sdk'
import matrixClientService from './MatrixClientService'
import { info, error } from '@tauri-apps/plugin-log'

export interface Space {
  roomId: string
  name: string
  topic?: string
  avatarUrl?: string
  isPublic: boolean
  isJoined: boolean
  memberCount: number
  children: SpaceChild[]
}

export interface SpaceChild {
  roomId: string
  name?: string
  avatarUrl?: string
  order?: string
  suggested: boolean
  viaServers: string[]
  isSpace: boolean
  isJoined: boolean
}

export interface SpaceHierarchy {
  spaceId: string
  rooms: SpaceChild[]
  nextBatch?: string
}

export interface CreateSpaceOptions {
  name: string
  topic?: string
  avatarUrl?: string
  isPublic: boolean
  alias?: string
}

export interface AddChildOptions {
  spaceId: string
  childRoomId: string
  viaServers?: string[]
  order?: string
  suggested?: boolean
}

class MatrixSpaceService {
  async createSpace(options: CreateSpaceOptions): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Space] 客户端未初始化')
    }

    try {
      const createOptions: any = {
        name: options.name,
        preset: options.isPublic ? 'public_chat' : 'private_chat',
        room_alias_name: options.alias,
        topic: options.topic,
        initial_state: [
          {
            type: 'm.room.history_visibility',
            state_key: '',
            content: {
              history_visibility: options.isPublic ? 'world_readable' : 'shared'
            }
          },
          {
            type: 'm.space',
            state_key: '',
            content: {}
          }
        ],
        creation_content: {
          type: 'm.space'
        }
      }

      if (options.avatarUrl) {
        createOptions.initial_state.push({
          type: 'm.room.avatar',
          state_key: '',
          content: {
            url: options.avatarUrl
          }
        })
      }

      const response = await client.createRoom(createOptions)
      info(`[Space] 创建空间成功: ${response.room_id}`)
      return response.room_id
    } catch (err) {
      error(`[Space] 创建空间失败: ${err}`)
      throw err
    }
  }

  async addChildToSpace(options: AddChildOptions): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Space] 客户端未初始化')
    }

    try {
      const content: any = {
        via: options.viaServers || [client.getDomain() || 'matrix.org'],
        suggested: options.suggested ?? false
      }

      if (options.order) {
        content.order = options.order
      }

      await client.sendStateEvent(
        options.spaceId,
        'm.space.child' as any,
        content,
        options.childRoomId
      )
      info(`[Space] 添加子房间成功: ${options.childRoomId} -> ${options.spaceId}`)
    } catch (err) {
      error(`[Space] 添加子房间失败: ${err}`)
      throw err
    }
  }

  async removeChildFromSpace(spaceId: string, childRoomId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Space] 客户端未初始化')
    }

    try {
      await client.sendStateEvent(
        spaceId,
        'm.space.child' as any,
        {},
        childRoomId
      )
      info(`[Space] 移除子房间成功: ${childRoomId} -> ${spaceId}`)
    } catch (err) {
      error(`[Space] 移除子房间失败: ${err}`)
      throw err
    }
  }

  async getSpace(spaceId: string): Promise<Space | null> {
    const client = matrixClientService.getClient()
    if (!client) return null

    try {
      const room = client.getRoom(spaceId)
      if (!room) return null

      if (!this.isSpace(room)) return null

      return this.roomToSpace(room)
    } catch (err) {
      error(`[Space] 获取空间信息失败: ${err}`)
      return null
    }
  }

  async getSpaceChildren(spaceId: string): Promise<SpaceChild[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    try {
      const room = client.getRoom(spaceId)
      if (!room) return []

      const children: SpaceChild[] = []
      const childEvents = room.currentState.getStateEvents('m.space.child' as any)

      for (const event of childEvents) {
        const stateKey = event.getStateKey()
        if (!stateKey) continue

        const content = event.getContent()
        if (!content.via || content.via.length === 0) continue

        const childRoom = client.getRoom(stateKey)
        const isSpace = childRoom ? this.isSpace(childRoom) : false

        children.push({
          roomId: stateKey,
          name: childRoom?.name,
          avatarUrl: childRoom?.getMxcAvatarUrl() || undefined,
          order: content.order,
          suggested: content.suggested ?? false,
          viaServers: content.via || [],
          isSpace,
          isJoined: !!childRoom
        })
      }

      return children.sort((a, b) => {
        if (a.order && b.order) {
          return a.order.localeCompare(b.order)
        }
        if (a.order) return -1
        if (b.order) return 1
        return (a.name || '').localeCompare(b.name || '')
      })
    } catch (err) {
      error(`[Space] 获取子房间失败: ${err}`)
      return []
    }
  }

  async getSpaceHierarchy(spaceId: string, maxDepth: number = 1): Promise<SpaceHierarchy[]> {
    const result: SpaceHierarchy[] = []
    await this.buildSpaceHierarchy(spaceId, result, maxDepth, 0)
    return result
  }

  private async buildSpaceHierarchy(
    spaceId: string,
    result: SpaceHierarchy[],
    maxDepth: number,
    currentDepth: number
  ): Promise<void> {
    if (currentDepth >= maxDepth) return

    const children = await this.getSpaceChildren(spaceId)
    result.push({
      spaceId,
      rooms: children
    })

    for (const child of children) {
      if (child.isSpace && child.isJoined) {
        await this.buildSpaceHierarchy(child.roomId, result, maxDepth, currentDepth + 1)
      }
    }
  }

  getJoinedSpaces(): Space[] {
    const client = matrixClientService.getClient()
    if (!client) return []

    try {
      const rooms = client.getRooms()
      return rooms
        .filter(room => this.isSpace(room))
        .map(room => this.roomToSpace(room))
    } catch (err) {
      error(`[Space] 获取已加入空间失败: ${err}`)
      return []
    }
  }

  isSpace(room: Room): boolean {
    const createEvent = room.currentState.getStateEvents('m.room.create' as any, '')
    if (!createEvent) return false

    const createContent = createEvent.getContent()
    return createContent.type === 'm.space'
  }

  private roomToSpace(room: Room): Space {
    const client = matrixClientService.getClient()
    const myUserId = client?.getUserId()
    const member = myUserId ? room.getMember(myUserId) : null

    return {
      roomId: room.roomId,
      name: room.name || room.roomId,
      topic: room.currentState.getStateEvents('m.room.topic' as any, '')?.getContent()?.topic,
      avatarUrl: room.getMxcAvatarUrl() || undefined,
      isPublic: room.getJoinRule() === 'public',
      isJoined: member?.membership === 'join',
      memberCount: room.getJoinedMemberCount(),
      children: []
    }
  }

  async updateSpaceOrder(spaceId: string, childRoomId: string, order: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Space] 客户端未初始化')
    }

    try {
      const room = client.getRoom(spaceId)
      if (!room) {
        throw new Error(`[Space] 空间不存在: ${spaceId}`)
      }

      const existingEvent = room.currentState.getStateEvents('m.space.child' as any, childRoomId)
      const existingContent = existingEvent?.getContent() || {}

      await client.sendStateEvent(
        spaceId,
        'm.space.child' as any,
        {
          ...existingContent,
          order
        },
        childRoomId
      )
      info(`[Space] 更新子房间顺序成功: ${childRoomId}`)
    } catch (err) {
      error(`[Space] 更新子房间顺序失败: ${err}`)
      throw err
    }
  }

  async setSpaceSuggested(spaceId: string, childRoomId: string, suggested: boolean): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Space] 客户端未初始化')
    }

    try {
      const room = client.getRoom(spaceId)
      if (!room) {
        throw new Error(`[Space] 空间不存在: ${spaceId}`)
      }

      const existingEvent = room.currentState.getStateEvents('m.space.child' as any, childRoomId)
      const existingContent = existingEvent?.getContent() || {}

      await client.sendStateEvent(
        spaceId,
        'm.space.child' as any,
        {
          ...existingContent,
          suggested
        },
        childRoomId
      )
      info(`[Space] 设置建议房间成功: ${childRoomId}`)
    } catch (err) {
      error(`[Space] 设置建议房间失败: ${err}`)
      throw err
    }
  }

  async getSpaceParents(roomId: string): Promise<string[]> {
    const client = matrixClientService.getClient()
    if (!client) return []

    try {
      const parents: string[] = []
      const rooms = client.getRooms()

      for (const room of rooms) {
        if (!this.isSpace(room)) continue

        const childEvent = room.currentState.getStateEvents('m.space.child' as any, roomId)
        if (childEvent && childEvent.getContent()?.via) {
          parents.push(room.roomId)
        }
      }

      return parents
    } catch {
      return []
    }
  }

  async inviteToSpace(spaceId: string, userId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Space] 客户端未初始化')
    }

    try {
      await client.invite(spaceId, userId)
      info(`[Space] 邀请用户加入空间: ${userId} -> ${spaceId}`)
    } catch (err) {
      error(`[Space] 邀请用户失败: ${err}`)
      throw err
    }
  }

  async joinSpace(spaceId: string, viaServers?: string[]): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Space] 客户端未初始化')
    }

    try {
      await client.joinRoom(spaceId, { viaServers })
      info(`[Space] 加入空间成功: ${spaceId}`)
    } catch (err) {
      error(`[Space] 加入空间失败: ${err}`)
      throw err
    }
  }

  async leaveSpace(spaceId: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Space] 客户端未初始化')
    }

    try {
      await client.leave(spaceId)
      info(`[Space] 离开空间成功: ${spaceId}`)
    } catch (err) {
      error(`[Space] 离开空间失败: ${err}`)
      throw err
    }
  }
}

export const matrixSpaceService = new MatrixSpaceService()
export default matrixSpaceService
