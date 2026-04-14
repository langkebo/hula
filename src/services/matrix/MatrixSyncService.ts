/**
 * Matrix 同步服务
 *
 * 提供数据同步功能
 */

import type { MatrixClient, Room } from 'matrix-js-sdk'
import type { ExtendedMatrixClientForSync, ExtendedRoomForSync } from '@/types/matrix-api'
import { BaseManager } from './BaseManager'
import { info, error as logError } from '@tauri-apps/plugin-log'

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
export class SyncService extends BaseManager {
  private client: MatrixClient | null = null
  private syncState: SyncState = {
    currentIdx: 0,
    roomCount: 0,
    isSyncing: false,
    lastSyncTime: 0
  }
  private syncListeners: Map<string, (...args: unknown[]) => void> = new Map()
  private syncToken: string | null = null
  private retryCount = 0
  private maxRetries = 3
  private syncIntervalTimer: number | null = null
  private syncIntervalMs: number = 30000

  /**
   * 初始化服务
   */
  initialize(client: MatrixClient): void {
    this.client = client
    this.loadSyncToken()
    info('[Sync] 服务已初始化')
  }

  /**
   * 从本地存储加载同步 token
   */
  private loadSyncToken(): void {
    try {
      const stored = localStorage.getItem('hula_sync_token')
      if (stored) {
        this.syncToken = stored
        info('[Sync] 已加载同步 token')
      }
    } catch (_err) {}
  }

  /**
   * 保存同步 token 到本地存储
   */
  private saveSyncToken(token: string): void {
    try {
      localStorage.setItem('hula_sync_token', token)
      this.syncToken = token
      info('[Sync] 已保存同步 token')
    } catch (_err) {}
  }

  /**
   * 获取同步超时时间（移动端30s，桌面端60s）
   */
  private getSyncTimeout(): number {
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent)
    return isMobile ? 30000 : 60000
  }

  /**
   * 开始同步
   */
  async startSync(options?: SyncOptions, throwOnError = true): Promise<void> {
    if (!this.client) {
      return this.handleError(new Error('Client 未初始化'), 'startSync', undefined as unknown as void, throwOnError)
    }

    if (this.syncState.isSyncing) {
      info('[Sync] 同步已在进行中')
      return
    }

    this.syncState.isSyncing = true

    const syncParams: Record<string, unknown> = {
      timeout: this.getSyncTimeout(),
      full_state: !this.syncToken || options?.fullState === true,
      set_presence: 'online'
    }

    if (this.syncToken && !options?.fullState) {
      syncParams.since = this.syncToken
    }

    try {
      const extendedClient = this.client as unknown as ExtendedMatrixClientForSync
      const response = await extendedClient.sync?.(syncParams)

      if (response?.next_batch) {
        this.saveSyncToken(response.next_batch)
        this.retryCount = 0
        this.processSyncResponse(response)
      }

      this.syncState.lastSyncTime = Date.now()
      info('[Sync] 同步完成')
    } catch (err) {
      await this.handleSyncError(err)
    } finally {
      this.syncState.isSyncing = false
    }
  }

  /**
   * 处理同步错误（重试机制）
   */
  private async handleSyncError(err: unknown): Promise<void> {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      const delay = 2 ** this.retryCount * 1000
      info(`[Sync] ${delay}ms 后进行第 ${this.retryCount} 次重试`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return this.startSync()
    }
    this.emit('sync_error', err)
  }

  /**
   * 处理同步响应，更新未读计数
   */
  private processSyncResponse(response: any): void {
    if (response.rooms?.join) {
      for (const [roomId, roomData] of Object.entries(response.rooms.join) as any) {
        const unread = roomData.unread_notifications
        if (unread) {
          this.emit('room_unread', {
            roomId,
            notificationCount: unread.notification_count,
            highlightCount: unread.highlight_count
          })
        }
      }
    }
    this.emit('sync_complete', response)
  }

  /**
   * 触发事件
   */
  private emit(event: string, data: any): void {
    const callback = this.syncListeners.get(event)
    if (callback) {
      callback(data)
    }
  }

  /**
   * 设置定时同步间隔
   */
  setSyncInterval(intervalMs: number): void {
    this.syncIntervalMs = intervalMs
    if (this.syncIntervalTimer) {
      clearInterval(this.syncIntervalTimer)
    }
    this.syncIntervalTimer = window.setInterval(() => {
      if (!this.syncState.isSyncing && navigator.onLine) {
        this.startSync().catch((err) => logError(`[Sync] 定时同步失败: ${err}`))
      }
    }, intervalMs)
  }

  /**
   * 清除同步 token（登出时调用）
   */
  clearSyncToken(): void {
    try {
      localStorage.removeItem('hula_sync_token')
      this.syncToken = null
      info('[Sync] 已清除同步 token')
    } catch (_err) {}
  }

  /**
   * 停止同步
   */
  async stopSync(throwOnError = false): Promise<void> {
    if (!this.client) {
      return
    }

    try {
      this.client.stopClient()
      this.syncState.isSyncing = false
      info('[Sync] 同步已停止')
    } catch (error) {
      this.handleError(error, 'stopSync', undefined as unknown as void, throwOnError)
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
    if (!this.client) {
      return []
    }

    return this.client.getRooms() || []
  }

  /**
   * 获取已加入的房间
   */
  getJoinedRooms(): Room[] {
    return this.getRooms().filter((room) => room.getMyMembership?.() === 'join')
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
    this.syncListeners.set(event, callback)

    if (this.client) {
      const extendedClient = this.client as unknown as ExtendedMatrixClientForSync
      extendedClient.on?.(event, callback)
    }
  }

  /**
   * 移除同步监听
   */
  offSync(event: string): void {
    const callback = this.syncListeners.get(event)
    if (callback && this.client) {
      const extendedClient = this.client as unknown as ExtendedMatrixClientForSync
      extendedClient.off?.(event, callback)
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
      const extendedRoom = room as unknown as ExtendedRoomForSync
      const unread = extendedRoom.getUnreadNotificationCount?.()
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
      const extendedRoom = room as unknown as ExtendedRoomForSync
      const unread = extendedRoom.getUnreadNotificationCount?.()
      total += unread?.notification || 0
    }

    return total
  }

  async startVideoCall(roomId: string): Promise<string> {
    const { matrixVoIPService } = await import('./MatrixVoIPService')
    return matrixVoIPService.startCall(roomId, { audio: true, video: true })
  }

  async startVoiceCall(roomId: string): Promise<string> {
    const { matrixVoIPService } = await import('./MatrixVoIPService')
    return matrixVoIPService.startCall(roomId, { audio: true, video: false })
  }
}

/**
 * 单例实例
 */
export const syncService = new SyncService()
export const matrixSyncService = syncService

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
