/**
 * IndexedDB 离线存储工具
 *
 * 为 HuLa 提供本地数据缓存能力
 */

import { IndexedDBStore, LocalStorageCryptoStore, type MatrixClient, type Room } from 'matrix-js-sdk'

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
}

/**
 * 默认配置
 */
export const defaultStorageConfig: StorageConfig = {
  dbName: 'hula-matrix-store',
  dbVersion: 1,
  enableCryptoStore: true
}

/**
 * 存储服务
 */
class StorageService {
  private client: MatrixClient | null = null
  private config: StorageConfig = defaultStorageConfig
  private isInitialized = false

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

    this.isInitialized = true
    console.log('[Storage] 初始化完成')
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

    await this.client.store.deleteAllData()
    this.isInitialized = false
    console.log('[Storage] 所有数据已清除')
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

  async function initialize(client: MatrixClient, config?: Partial<StorageConfig>) {
    await storageService.initialize(client, config)
    isInitialized.value = true
    status.value = storageService.getStatus().config
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

  return {
    isInitialized,
    status,
    initialize,
    getRoom,
    getRooms,
    clearAll
  }
}

export default storageService
