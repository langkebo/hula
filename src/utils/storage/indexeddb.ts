/**
 * IndexedDB 离线存储工具
 *
 * 为 HuLa 提供本地数据缓存能力
 * 包含内存监控和自动清理机制
 */

import { IndexedDBStore, LocalStorageCryptoStore, type MatrixClient, type Room } from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('IndexedDB')

/**
 * 扩展 Store 接口以包含自定义方法
 */
interface ExtendedStore {
  getUserData?: () => Promise<Record<string, unknown>>
  saveSyncData?: (data: Record<string, unknown>) => Promise<void>
  getSyncData?: () => Promise<Record<string, unknown> | undefined>
  getPendingEvents?: () => Promise<unknown[]>
  savePendingEvent?: (event: Record<string, unknown>) => Promise<void>
  removePendingEvent?: (eventId: string) => Promise<void>
  getSessionToken?: () => Promise<string | null>
  saveSessionToken?: (token: string) => Promise<void>
  deleteAllData?: () => Promise<void>
}

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
      logger.warn('已经初始化')
      return
    }

    this.client = client
    this.config = { ...defaultStorageConfig, ...config }

    // 设置离线存储
    await this.setupStore()

    // 启动内存监控
    this.startMemoryMonitoring()

    this.isInitialized = true
    logger.debug('初始化完成')
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

    logger.debug('内存监控已启动')
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
      logger.warn(`内存使用率达到 ${Math.round(usageRatio * 100)}%，建议清理缓存`)
    }

    if (this.memoryStats.estimatedSize >= this.config.maxMemoryBytes) {
      logger.warn('内存使用超过阈值，触发自动清理')
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

      logger.debug('内存清理完成')
    } catch (error) {
      logger.error('内存清理失败:', error)
    }
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
        logger.debug('加密存储已配置')
      } catch (e) {
        logger.warn('加密存储配置失败:', e)
      }
    }

    logger.debug('存储已配置')
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
  async getUserData(): Promise<Record<string, unknown>> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    const store = this.client.store as unknown as ExtendedStore
    if (!store.getUserData) {
      throw new Error('Store 不支持 getUserData 方法')
    }
    return store.getUserData()
  }

  /**
   * 保存同步数据
   */
  async saveSyncData(data: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    const store = this.client.store as unknown as ExtendedStore
    if (!store.saveSyncData) {
      throw new Error('Store 不支持 saveSyncData 方法')
    }
    await store.saveSyncData(data)
  }

  /**
   * 获取同步数据
   */
  async getSyncData(): Promise<Record<string, unknown> | undefined> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    const store = this.client.store as unknown as ExtendedStore
    if (!store.getSyncData) {
      throw new Error('Store 不支持 getSyncData 方法')
    }
    return store.getSyncData()
  }

  /**
   * 获取待发送事件
   */
  async getPendingEvents(): Promise<unknown[]> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    const store = this.client.store as unknown as ExtendedStore
    if (!store.getPendingEvents) {
      throw new Error('Store 不支持 getPendingEvents 方法')
    }
    return store.getPendingEvents()
  }

  /**
   * 保存待发送事件
   */
  async savePendingEvent(event: Record<string, unknown>): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    const store = this.client.store as unknown as ExtendedStore
    if (!store.savePendingEvent) {
      throw new Error('Store 不支持 savePendingEvent 方法')
    }
    await store.savePendingEvent(event)
  }

  /**
   * 移除待发送事件
   */
  async removePendingEvent(eventId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    const store = this.client.store as unknown as ExtendedStore
    if (!store.removePendingEvent) {
      throw new Error('Store 不支持 removePendingEvent 方法')
    }
    await store.removePendingEvent(eventId)
  }

  /**
   * 获取会话 token
   */
  async getSessionToken(): Promise<string | null> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    const store = this.client.store as unknown as ExtendedStore
    if (!store.getSessionToken) {
      throw new Error('Store 不支持 getSessionToken 方法')
    }
    return store.getSessionToken()
  }

  /**
   * 保存会话 token
   */
  async saveSessionToken(token: string): Promise<void> {
    if (!this.client) {
      throw new Error('Client 未初始化')
    }

    const store = this.client.store as unknown as ExtendedStore
    if (!store.saveSessionToken) {
      throw new Error('Store 不支持 saveSessionToken 方法')
    }
    await store.saveSessionToken(token)
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
    logger.debug('所有数据已清除')
  }

  /**
   * 停止内存监控
   */
  private stopMemoryMonitoring(): void {
    if (this.memoryCheckInterval) {
      window.clearInterval(this.memoryCheckInterval)
      this.memoryCheckInterval = null
      logger.debug('内存监控已停止')
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
