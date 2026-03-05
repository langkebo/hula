/**
 * Matrix 同步服务
 *
 * 提供数据同步功能
 */

import type { MatrixClient } from 'matrix-js-sdk'
import { info, error } from '@tauri-apps/plugin-log'

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
  private syncState: SyncState = {
    currentIdx: 0,
    roomCount: 0,
    isSyncing: false,
    lastSyncTime: 0
  }
  private syncListeners: Map<string, Function> = new Map()

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    info('[Sync] 服务已初始化')
  }

  /**
   * 开始同步
   */
  async startSync(options?: SyncOptions): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    if (this.syncState.isSyncing) {
      info('[Sync] 同步已在进行中')
      return
    }

    this.syncState.isSyncing = true

    try {
      // 使用客户端内置的同步功能
      await (this.client as any).sync(options || {})
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
    if (!this.client) {
      return
    }

    try {
      this.client.stopClient()
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
  getRooms(): any[] {
    if (!this.client) {
      return []
    }

    return this.client.getRooms() || []
  }

  /**
   * 获取已加入的房间
   */
  getJoinedRooms(): any[] {
    return this.getRooms().filter((room) => room.getMyMembership?.() === 'join')
  }

  /**
   * 获取邀请的房间
   */
  getInvitedRooms(): any[] {
    return this.getRooms().filter((room) => room.getMyMembership?.() === 'invite')
  }

  /**
   * 获取离开的房间
   */
  getLeftRooms(): any[] {
    return this.getRooms().filter((room) => room.getMyMembership?.() === 'leave')
  }

  /**
   * 监听同步事件
   */
  onSync(event: string, callback: Function): void {
    this.syncListeners.set(event, callback)

    if (this.client) {
      ;(this.client as any).on(event, callback)
    }
  }

  /**
   * 移除同步监听
   */
  offSync(event: string): void {
    const callback = this.syncListeners.get(event)
    if (callback && this.client) {
      ;(this.client as any).off(event, callback)
      this.syncListeners.delete(event)
    }
  }

  /**
   * 获取未读通知数
   */
  getUnreadNotificationCount(): number {
    let total = 0
    const rooms = this.getJoinedRooms()

    for (const room of rooms) {
      const unread = (room as any).getUnreadNotificationCount()
      total += unread?.highlight || 0
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
      const unread = (room as any).getUnreadNotificationCount()
      total += unread?.notification || 0
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
  const rooms = ref<any[]>([])
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
