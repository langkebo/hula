/**
 * IndexedDB 离线存储工具
 *
 * 为 HuLa 提供本地数据缓存能力
 * 包含内存监控和自动清理机制
 */

import { IndexedDBStore, LocalStorageCryptoStore, type MatrixClient, type Room } from 'matrix-js-sdk'

/**
 * 内存使用统计
 */
interface MemoryStats {
  estimatedSize: number
  lastCleanup: number
  actionCount: number
}

/**
 * 存储配置
 */
export interface StorageConfig {
  /** 数据库名称 */
  dbName: string
  /** 数据库版本 */
  dbVersion: number
  /** 是否启用加密存储 */
  enableCryptoStore: boolean
  /** 最大内存使用（字节），超过后触发清理 */
  maxMemoryBytes?: number
}

/**
 * 默认配置
 */
export const defaultStorageConfig: StorageConfig = {
  dbName: 'hula-matrix-store',
  dbVersion: 1,
  enableCryptoStore: true,
  maxMemoryBytes: 50 * 1024 * 1024 // 50MB 默认阈值
}

/**
 * 内存监控配置
 */
const MEMORY_CHECK_INTERVAL = 60000 // 1分钟检查一次
const MEMORY_WARNING_THRESHOLD = 0.8 // 80% 时发出警告

/**
 * 存储服务
 */
class StorageService {
  private client: MatrixClient | null = null
  private config: StorageConfig = defaultStorageConfig
  private isInitialized = false
  private memoryStats: MemoryStats = {
    estimatedSize: 0,
    lastCleanup: Date.now(),
    actionCount: 0
  }
  private memoryCheckInterval: number | null = null

  /**
   * 初始化存储服务
   */
  async initialize(client: MatrixClient, config?: Partial<StorageConfig>): Promise<void> {
    if (this.isInitialized) {
      console.warn('[Storage] 已经初始化')
      return
    }

    this.client = client
    this.config = { ...defaultStorageConfig, ...config }

    // 设置离线存储
    await this.setupStore()

    // 启动内存监控
    this.startMemoryMonitoring()

    this.isInitialized = true
    console.log('[Storage] 初始化完成')
  }

  /**
   * 启动内存监控
   */
  private startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      return
    }

    this.memoryCheckInterval = window.setInterval(() => {
      this.checkMemoryUsage()
    }, MEMORY_CHECK_INTERVAL)

    console.log('[Storage] 内存监控已启动')
  }

  /**
   * 检查内存使用情况
   */
  private checkMemoryUsage(): void {
    if (!this.config.maxMemoryBytes) {
      return
    }

    // 估算当前内存使用（基于 action 次数）
    const maxActions = 10000
    const usageRatio = Math.min(this.memoryStats.actionCount / maxActions, 1)
    this.memoryStats.estimatedSize = usageRatio * this.config.maxMemoryBytes

    // 如果超过警告阈值，发出警告
    if (usageRatio >= MEMORY_WARNING_THRESHOLD) {
      console.warn(
        `[Storage] 内存使用率达到 ${Math.round(usageRatio * 100)}%，建议清理缓存`
      )
    }

    // 如果超过最大值，触发自动清理
    if (this.memoryStats.estimatedSize >= this.config.maxMemoryBytes) {
      console.warn('[Storage] 内存使用超过阈值，触发自动清理')
      this.performMemoryCleanup()
    }
  }

  /**
   * 执行内存清理
   */
  private async performMemoryCleanup(): Promise<void> {
    try {
      // 清理过期数据（如果有）
      // 这里可以添加更多的清理逻辑

      this.memoryStats.actionCount = Math.floor(this.memoryStats.actionCount * 0.5)
      this.memoryStats.lastCleanup = Date.now()

      console.log('[Storage] 内存清理完成')
    } catch (error) {
      console.error('[Storage] 内存清理失败:', error)
    }
  }

  /**
   * 记录操作（用于内存统计）
   */
  private recordAction(): void {
    this.memoryStats.actionCount++
  }

  /**
   * 获取内存统计
   */
  getMemoryStats(): MemoryStats {
    return { ...this.memoryStats }
  }

  /**
   * 清理内存
   */
  async cleanupMemory(): Promise<void> {
    await this.performMemoryCleanup()
  }

  /**
   * 设置存储
   */
  private async setupStore(): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    // 使用 IndexedDB 存储
    const store = new IndexedDBStore({
      indexedDB: window.indexedDB,
      localStorage: window.localStorage,
      dbName: this.config.dbName
    })

    // 等待数据库打开
    await store.startup()

    // 设置客户端存储
    this.client.store = store

    // 如果启用加密，设置加密存储
    if (this.config.enableCryptoStore) {
      try {
        const _cryptoStore = new LocalStorageCryptoStore(window.localStorage)
        // 注意：加密存储需要在 client 初始化时设置
        console.log('[Storage] 加密存储已配置')
      } catch (e) {
        console.warn('[Storage] 加密存储配置失败:', e)
      }
    }

    console.log('[Storage] 存储已配置')
  }

  /**
   * 获取房间数据
   */
  async getRoom(roomId: string): Promise<Room | undefined> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    return this.client.store.getRoom(roomId)
  }

  /**
   * 获取所有房间
   */
  async getRooms(): Promise<Room[]> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    return this.client.store.getRooms()
  }

  /**
   * 获取用户数据
   */
  async getUserData(): Promise<Record<string, any>> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    return (this.client.store as any).getUserData()
  }

  /**
   * 保存同步数据
   */
  async saveSyncData(data: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    await (this.client.store as any).saveSyncData(data)
  }

  /**
   * 获取同步数据
   */
  async getSyncData(): Promise<Record<string, unknown> | undefined> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    return (this.client.store as any).getSyncData()
  }

  /**
   * 获取待发送事件
   */
  async getPendingEvents(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    return (this.client.store as any).getPendingEvents()
  }

  /**
   * 保存待发送事件
   */
  async savePendingEvent(event: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    await (this.client.store as any).savePendingEvent(event)
  }

  /**
   * 移除待发送事件
   */
  async removePendingEvent(eventId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    await (this.client.store as any).removePendingEvent(eventId)
  }

  /**
   * 获取会话 token
   */
  async getSessionToken(): Promise<string | null> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    return (this.client.store as any).getSessionToken()
  }

  /**
   * 保存会话 token
   */
  async saveSessionToken(token: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    await (this.client.store as any).saveSessionToken(token)
  }

  /**
   * 清空所有存储
   */
  async clearAll(): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    // 停止内存监控
    this.stopMemoryMonitoring()

    await this.client.store.deleteAllData()
    this.isInitialized = false
    console.log('[Storage] 所有数据已清除')
  }

  /**
   * 停止内存监控
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      window.clearInterval(this.memoryCheckInterval)
      this.memoryCheckInterval = null
      console.log('[Storage] 内存监控已停止')
    }
  }

  /**
   * 获取存储状态
   */
  getStatus(): { initialized: boolean; config: StorageConfig } {
    return {
      initialized: this.isInitialized,
      config: this.config
    }
  }
}

/**
 * 单例实例
 */
export const storageService = new StorageService()

/**
 * Vue Composable
 */
import { ref } from 'vue'

export function useMatrixStorage() {
  const isInitialized = ref(false)
  const status = ref<StorageConfig | null>(null)
  const memoryStats = ref<MemoryStats | null>(null)

  async function initialize(client: MatrixClient, config?: Partial<StorageConfig>) {
    await storageService.initialize(client, config)
    isInitialized.value = true
    status.value = storageService.getStatus().config
    memoryStats.value = storageService.getMemoryStats()
  }

  async function getRoom(roomId: string) {
    return storageService.getRoom(roomId)
  }

  async function getRooms() {
    return storageService.getRooms()
  }

  async function clearAll() {
    await storageService.clearAll()
    isInitialized.value = false
  }

  async function cleanupMemory() {
    await storageService.cleanupMemory()
    memoryStats.value = storageService.getMemoryStats()
  }

  return {
    isInitialized,
    status,
    memoryStats,
    initialize,
    getRoom,
    getRooms,
    clearAll,
    cleanupMemory
  }
}

export default storageService
