/**
 * 消息持久化缓存 (IndexedDB)
 *
 * 用于离线存储消息，支持跨会话恢复
 */

import { openDB, IDBPDatabase } from 'idb'
import type { MessageType } from '@/types/message'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MessageCache')

const DB_NAME = 'hula-messages'
const DB_VERSION = 2
const MESSAGE_STORE = 'messages'
const ROOM_STORE = 'rooms'

interface StoredMessage extends MessageType {
  roomId: string
  eventId: string
  originServerTs: number
}

interface StoredRoom {
  roomId: string
  lastMessageTime: number
  updatedAt: number
  lastReadEventId?: string
}

class MessageCacheDB {
  private db: IDBPDatabase | null = null
  private initPromise: Promise<void> | null = null

  async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = this._init()
    return this.initPromise
  }

  private async _init(): Promise<void> {
    try {
      this.db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
          if (oldVersion < 1) {
            const msgStore = db.createObjectStore(MESSAGE_STORE, { keyPath: 'eventId' })
            msgStore.createIndex('roomId', 'roomId')
            msgStore.createIndex('timestamp', 'originServerTs')

            db.createObjectStore(ROOM_STORE, { keyPath: 'roomId' })
          }
          if (oldVersion < 2) {
            const tx = db.transaction(MESSAGE_STORE, 'readwrite')
            const msgStore = tx.objectStore(MESSAGE_STORE) as any
            if (msgStore && !msgStore.indexNames.contains('roomId')) {
              ;(msgStore as any).createIndex('roomId', 'roomId')
            }
            if (msgStore && !msgStore.indexNames.contains('timestamp')) {
              ;(msgStore as any).createIndex('timestamp', 'originServerTs')
            }
            tx.done.catch((err) => logger.error('升级索引失败:', err))
          }
        }
      })
      logger.info('消息缓存数据库已初始化')
    } catch (err) {
      logger.error('初始化消息缓存失败:', err)
      throw err
    }
  }

  async saveMessages(roomId: string, messages: MessageType[]): Promise<void> {
    if (!messages.length) return
    await this.init()
    if (!this.db) throw new Error('数据库未初始化')

    const tx = this.db.transaction(MESSAGE_STORE, 'readwrite')
    const store = tx.objectStore(MESSAGE_STORE)

    for (const msg of messages) {
      const eventId = (msg as any).eventId || (msg as any).id
      if (!eventId) continue

      const stored: StoredMessage = {
        ...msg,
        roomId,
        eventId,
        originServerTs: (msg as any).originServerTs || Date.now()
      }
      await store.put(stored)
    }

    await tx.done

    // 更新房间最后消息时间
    const lastMsg = messages[messages.length - 1]
    const lastTime = (lastMsg as any).originServerTs || Date.now()
    await this.updateRoomLastMessage(roomId, lastTime)
  }

  async saveMessage(roomId: string, message: MessageType): Promise<void> {
    await this.saveMessages(roomId, [message])
  }

  async loadRoomMessages(roomId: string, limit = 50, beforeTimestamp?: number): Promise<MessageType[]> {
    await this.init()
    if (!this.db) return []

    const tx = this.db.transaction(MESSAGE_STORE, 'readonly')
    const index = tx.store.index('roomId')

    const range = IDBKeyRange.only(roomId)
    let cursor = await index.openCursor(range, 'prev')

    const messages: MessageType[] = []
    let count = 0

    while (cursor && count < limit) {
      const msg = cursor.value as StoredMessage
      if (beforeTimestamp && msg.originServerTs >= beforeTimestamp) {
        cursor = await cursor.continue()
        continue
      }
      messages.push(msg)
      count++
      cursor = await cursor.continue()
    }

    return messages
  }

  async getRoomMessagesWithTimeRange(roomId: string, startTime: number, endTime: number): Promise<MessageType[]> {
    await this.init()
    if (!this.db) return []

    const tx = this.db.transaction(MESSAGE_STORE, 'readonly')
    const index = tx.store.index('roomId')

    const messages: MessageType[] = []
    let cursor = await index.openCursor(IDBKeyRange.only(roomId))

    while (cursor) {
      const msg = cursor.value as StoredMessage
      if (msg.originServerTs >= startTime && msg.originServerTs <= endTime) {
        messages.push(msg)
      }
      cursor = await cursor.continue()
    }

    return messages.sort((a, b) => (a as any).originServerTs - (b as any).originServerTs)
  }

  private async updateRoomLastMessage(roomId: string, lastMessageTime: number): Promise<void> {
    if (!this.db) return

    const tx = this.db.transaction(ROOM_STORE, 'readwrite')
    const store = tx.objectStore(ROOM_STORE)

    const existing = await store.get(roomId)
    const roomData: StoredRoom = {
      roomId,
      lastMessageTime,
      updatedAt: Date.now(),
      lastReadEventId: existing?.lastReadEventId
    }

    await store.put(roomData)
    await tx.done
  }

  async getLastMessageTime(roomId: string): Promise<number | null> {
    await this.init()
    if (!this.db) return null

    const room = await this.db.get(ROOM_STORE, roomId)
    return room?.lastMessageTime || null
  }

  async deleteRoomMessages(roomId: string): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(MESSAGE_STORE, 'readwrite')
    const index = tx.store.index('roomId')
    let cursor = await index.openCursor(IDBKeyRange.only(roomId))

    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }

    await tx.done

    // 删除房间记录
    await this.db.delete(ROOM_STORE, roomId)
  }

  async cleanOldMessages(days = 7): Promise<number> {
    await this.init()
    if (!this.db) return 0

    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
    const tx = this.db.transaction(MESSAGE_STORE, 'readwrite')
    const store = tx.objectStore(MESSAGE_STORE)
    const index = store.index('timestamp')

    let deletedCount = 0
    let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff))

    while (cursor) {
      await cursor.delete()
      deletedCount++
      cursor = await cursor.continue()
    }

    await tx.done
    logger.info(`清理了 ${deletedCount} 条超过 ${days} 天的旧消息`)
    return deletedCount
  }

  async clearAll(): Promise<void> {
    await this.init()
    if (!this.db) return

    await this.db.clear(MESSAGE_STORE)
    await this.db.clear(ROOM_STORE)
    logger.info('已清空所有缓存消息')
  }

  async getRoomList(): Promise<StoredRoom[]> {
    await this.init()
    if (!this.db) return []

    return await this.db.getAll(ROOM_STORE)
  }

  async updateLastReadEventId(roomId: string, eventId: string): Promise<void> {
    await this.init()
    if (!this.db) return

    const tx = this.db.transaction(ROOM_STORE, 'readwrite')
    const store = tx.objectStore(ROOM_STORE)

    const existing = await store.get(roomId)
    if (existing) {
      existing.lastReadEventId = eventId
      await store.put(existing)
    }

    await tx.done
  }

  async getCachedMessageCount(): Promise<number> {
    await this.init()
    if (!this.db) return 0

    return await this.db.count(MESSAGE_STORE)
  }
}

export const messageCacheDB = new MessageCacheDB()
export default messageCacheDB
