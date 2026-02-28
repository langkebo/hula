import { openDB, type IDBPDatabase } from 'idb'
import { info, error } from '@tauri-apps/plugin-log'

export interface CachedMessage {
  id: string
  roomId: string
  senderId: string
  content: Record<string, unknown>
  timestamp: number
  type: string
  status: 'pending' | 'sent' | 'failed'
  retryCount: number
}

export interface PendingMessage {
  id: string
  roomId: string
  content: Record<string, unknown>
  timestamp: number
  type: string
  tempId: string
}

class OfflineMessageService {
  private db: IDBPDatabase | null = null
  private dbName = 'hula-offline-messages'
  private dbVersion = 1

  async initialize(): Promise<void> {
    try {
      this.db = await openDB(this.dbName, this.dbVersion, {
        upgrade: (db) => {
          if (!db.objectStoreNames.contains('messages')) {
            const messageStore = db.createObjectStore('messages', { keyPath: 'id' })
            messageStore.createIndex('roomId', 'roomId')
            messageStore.createIndex('status', 'status')
            messageStore.createIndex('timestamp', 'timestamp')
          }

          if (!db.objectStoreNames.contains('pending')) {
            const pendingStore = db.createObjectStore('pending', { keyPath: 'id' })
            pendingStore.createIndex('roomId', 'roomId')
          }
        }
      })

      info('[OfflineMessage] 初始化完成')
    } catch (err) {
      error(`[OfflineMessage] 初始化失败: ${err}`)
    }
  }

  async cacheMessage(message: CachedMessage): Promise<void> {
    if (!this.db) return

    try {
      await this.db.put('messages', message)
    } catch (err) {
      error(`[OfflineMessage] 缓存消息失败: ${err}`)
    }
  }

  async getCachedMessages(roomId: string, limit = 100): Promise<CachedMessage[]> {
    if (!this.db) return []

    try {
      const tx = this.db.transaction('messages', 'readonly')
      const index = tx.store.index('roomId')
      const messages = await index.getAll(IDBKeyRange.only(roomId))

      return messages.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
    } catch (err) {
      error(`[OfflineMessage] 获取缓存消息失败: ${err}`)
      return []
    }
  }

  async addPendingMessage(message: PendingMessage): Promise<void> {
    if (!this.db) return

    try {
      await this.db.put('pending', {
        ...message,
        status: 'pending',
        retryCount: 0,
        timestamp: Date.now()
      })
      info(`[OfflineMessage] 添加待发送消息: ${message.tempId}`)
    } catch (err) {
      error(`[OfflineMessage] 添加待发送消息失败: ${err}`)
    }
  }

  async getPendingMessages(): Promise<PendingMessage[]> {
    if (!this.db) return []

    try {
      return await this.db.getAll('pending')
    } catch (err) {
      error(`[OfflineMessage] 获取待发送消息失败: ${err}`)
      return []
    }
  }

  async removePendingMessage(id: string): Promise<void> {
    if (!this.db) return

    try {
      await this.db.delete('pending', id)
      info(`[OfflineMessage] 移除待发送消息: ${id}`)
    } catch (err) {
      error(`[OfflineMessage] 移除待发送消息失败: ${err}`)
    }
  }

  async updatePendingStatus(id: string, status: 'pending' | 'sent' | 'failed'): Promise<void> {
    if (!this.db) return

    try {
      const message = await this.db.get('pending', id)
      if (message) {
        message.status = status
        await this.db.put('pending', message)
      }
    } catch (err) {
      error(`[OfflineMessage] 更新消息状态失败: ${err}`)
    }
  }

  async clearRoomCache(roomId: string): Promise<void> {
    if (!this.db) return

    try {
      const tx = this.db.transaction('messages', 'readwrite')
      const index = tx.store.index('roomId')
      const keys = await index.getAllKeys(IDBKeyRange.only(roomId))

      for (const key of keys) {
        await tx.store.delete(key)
      }

      await tx.done
      info(`[OfflineMessage] 清除房间缓存: ${roomId}`)
    } catch (err) {
      error(`[OfflineMessage] 清除房间缓存失败: ${err}`)
    }
  }

  async getCacheSize(): Promise<number> {
    if (!this.db) return 0

    try {
      const count = await this.db.count('messages')
      return count
    } catch {
      return 0
    }
  }

  async clearAllCache(): Promise<void> {
    if (!this.db) return

    try {
      await this.db.clear('messages')
      await this.db.clear('pending')
      info('[OfflineMessage] 清除所有缓存')
    } catch (err) {
      error(`[OfflineMessage] 清除所有缓存失败: ${err}`)
    }
  }

  cleanup(): void {
    this.db = null
    info('[OfflineMessage] 已清理')
  }
}

export const offlineMessageService = new OfflineMessageService()
export default offlineMessageService
