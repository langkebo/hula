/**
 * Matrix 同步服务
 *
 * 提供数据同步功能
 */

import { error, info } from '@tauri-apps/plugin-log'
import { type MatrixClient, NotificationCountType, type Room } from 'matrix-js-sdk'
import matrixClientService from '../MatrixClientService'

/**
 * 同步选项
 */
export interface SyncOptions {
  /** 预设: preflight, initialSync, realtime */
  preset?: 'preflight' | 'initialSync' | 'realtime'
  /** 房间ID过滤 */
  roomIds?: string[]
  /** 事件类型过滤 */
  eventTypes?: string[]
  /** 包含归档房间 */
  includeArchived?: boolean
  /** 完整状态 */
  fullState?: boolean
  /** 跳过邀请处理 */
  skipInvites?: boolean
  /** 跳过超时 */
  skipTimeouts?: boolean
}

/**
 * 同步状态
 */
export interface SyncState {
  /** 当前同步位置 */
  currentIdx: number
  /** 房间数量 */
  roomCount: number
  /** 是否正在同步 */
  isSyncing: boolean
  /** 最后同步时间 */
  lastSyncTime: number
}

/**
 * 同步服务
 */
class SyncService {
  private client: MatrixClient | null = null
  private observedClient: MatrixClient | null = null
  private syncState: SyncState = {
    currentIdx: 0,
    roomCount: 0,
    isSyncing: false,
    lastSyncTime: 0
  }
  private syncListeners: Map<string, (...args: unknown[]) => void> = new Map()

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    if (this.observedClient && this.observedClient !== client) {
      for (const [event, callback] of this.syncListeners.entries()) {
        this.observedClient.off(event, callback)
      }
    }
    this.client = client
    this.observedClient = null
    this.getClient()
    info('[Sync] 服务已初始化')
  }

  private getClient(): MatrixClient | null {
    const client = matrixClientService.getClient() || this.client
    if (!client) {
      return null
    }

    if (this.observedClient !== client) {
      if (this.observedClient) {
        for (const [event, callback] of this.syncListeners.entries()) {
          this.observedClient.off(event, callback)
        }
      }

      this.client = client
      for (const [event, callback] of this.syncListeners.entries()) {
        client.on(event, callback)
      }
      this.observedClient = client
    }

    return client
  }

  /**
   * 开始同步
   */
  async startSync(options?: SyncOptions): Promise<void> {
    const client = this.getClient()
    if (!client) {
      throw new Error('Client 未初始化')
    }

    if (this.syncState.isSyncing) {
      info('[Sync] 同步已在进行中')
      return
    }

    this.syncState.isSyncing = true

    try {
      // 使用客户端内置的同步功能
      await client.sync(options as Record<string, unknown>)
      this.syncState.lastSyncTime = Date.now()
      info('[Sync] 同步完成')
    } catch (err) {
      error(`[Sync] 同步失败: ${err}`)
      throw err
    } finally {
      this.syncState.isSyncing = false
    }
  }

  /**
   * 停止同步
   */
  async stopSync(): Promise<void> {
    const client = this.getClient()
    if (!client) {
      return
    }

    try {
      client.stopClient()
      this.syncState.isSyncing = false
      info('[Sync] 同步已停止')
    } catch (err) {
      error(`[Sync] 停止同步失败: ${err}`)
    }
  }

  /**
   * 获取同步状态
   */
  getSyncState(): SyncState {
    return { ...this.syncState }
  }

  /**
   * 获取房间列表
   */
  getRooms(): Room[] {
    const client = this.getClient()
    if (!client) {
      return []
    }

    return client.getRooms() || []
  }

  /**
   * 获取已加入的房间
   */
  getJoinedRooms(): Room[] {
    return this.getRooms().filter((room) => room.getMyMembership?.() === 'join')
  }

  async getJoinedRoomIds(): Promise<string[]> {
    const client = this.getClient()
    if (!client) return []
    try {
      const result = await client.http.authedRequest('GET', '/_matrix/client/v3/joined_rooms')
      const r = result as Record<string, unknown>
      return (r?.joined_rooms as string[]) ?? []
    } catch (err) {
      error(`[Sync] 获取已加入房间列表失败: ${err}`)
      return []
    }
  }

  /**
   * 获取邀请的房间
   */
  getInvitedRooms(): Room[] {
    return this.getRooms().filter((room) => room.getMyMembership?.() === 'invite')
  }

  /**
   * 获取离开的房间
   */
  getLeftRooms(): Room[] {
    return this.getRooms().filter((room) => room.getMyMembership?.() === 'leave')
  }

  /**
   * 监听同步事件
   */
  onSync(event: string, callback: (...args: unknown[]) => void): void {
    const existingCallback = this.syncListeners.get(event)
    if (existingCallback && this.observedClient) {
      this.observedClient.off(event, existingCallback)
    }

    this.syncListeners.set(event, callback)

    const client = this.getClient()
    if (client && this.observedClient === client && existingCallback !== callback) {
      client.on(event, callback)
    }
  }

  /**
   * 移除同步监听
   */
  offSync(event: string): void {
    const callback = this.syncListeners.get(event)
    if (callback && this.observedClient) {
      this.observedClient.off(event, callback)
    }

    this.syncListeners.delete(event)
  }

  /**
   * 获取未读通知数
   */
  getUnreadNotificationCount(): number {
    let total = 0
    const rooms = this.getJoinedRooms()

    for (const room of rooms) {
      const highlight = room.getUnreadNotificationCount!(NotificationCountType.Highlight)
      total += highlight || 0
    }

    return total
  }

  /**
   * 获取未读消息数
   */
  getUnreadMessageCount(): number {
    let total = 0
    const rooms = this.getJoinedRooms()

    for (const room of rooms) {
      const notification = room.getUnreadNotificationCount!(NotificationCountType.Total)
      total += notification || 0
    }

    return total
  }
}

/**
 * 单例实例
 */
export const syncService = new SyncService()

/**
 * Vue Composable
 */
import { ref } from 'vue'

export function useSync() {
  const rooms = ref<Room[]>([])
  const isSyncing = ref(false)
  const unreadCount = ref(0)
  const notificationCount = ref(0)

  async function startSync() {
    isSyncing.value = true
    try {
      await syncService.startSync()
      refreshRooms()
    } finally {
      isSyncing.value = false
    }
  }

  async function stopSync() {
    await syncService.stopSync()
    isSyncing.value = false
  }

  function refreshRooms() {
    rooms.value = syncService.getRooms()
    unreadCount.value = syncService.getUnreadMessageCount()
    notificationCount.value = syncService.getUnreadNotificationCount()
  }

  return {
    rooms,
    isSyncing,
    unreadCount,
    notificationCount,
    startSync,
    stopSync,
    refreshRooms,
    getJoinedRooms: () => syncService.getJoinedRooms(),
    getInvitedRooms: () => syncService.getInvitedRooms(),
    getLeftRooms: () => syncService.getLeftRooms()
  }
}

export default syncService
