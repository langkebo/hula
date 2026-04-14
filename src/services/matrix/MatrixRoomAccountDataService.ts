import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

export type NotificationOverride = 'default' | 'all' | 'none'

export interface RoomNotificationSettings {
  override?: NotificationOverride
  mode?: string
  keywords?: string[]
  sound_enabled?: boolean
}

export interface RoomNote {
  content: string
  updated_at: number
}

export interface ReadPosition {
  event_id: string
  updated_at: number
}

export class MatrixRoomAccountDataService extends BaseManager {
  private static readonly NOTIFICATION_EVENT_TYPE = 'com.hula.room.notification_settings'
  private static readonly NOTE_EVENT_TYPE = 'com.hula.room.note'
  private static readonly READ_POSITION_EVENT_TYPE = 'com.hula.room.read_position'
  private static instance: MatrixRoomAccountDataService = new MatrixRoomAccountDataService()

  static async getRoomNotificationSettings(roomId: string, throwOnError = true): Promise<RoomNotificationSettings | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }

      const accountDataManager = client.getAccountDataManager()
      const data = await accountDataManager.getRoomAccountDataFromServer(
        roomId,
        MatrixRoomAccountDataService.NOTIFICATION_EVENT_TYPE
      )

      if (!data) {
        return null
      }

      info(`[RoomAccountData] 获取房间通知设置成功: ${roomId}`)
      return data as RoomNotificationSettings
    } catch (error) {
      return MatrixRoomAccountDataService.instance.handleError(error, 'getRoomNotificationSettings', null, throwOnError)
    }
  }

  static async setRoomNotificationSettings(roomId: string, settings: RoomNotificationSettings, throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }

      const _accountDataManager = client.getAccountDataManager()
      await client.setRoomAccountData(roomId, MatrixRoomAccountDataService.NOTIFICATION_EVENT_TYPE, settings)

      info(`[RoomAccountData] 设置房间通知成功: ${roomId}`)
      return true
    } catch (error) {
      return MatrixRoomAccountDataService.instance.handleError(error, 'setRoomNotificationSettings', false, throwOnError)
    }
  }

  static async getRoomNote(roomId: string, throwOnError = true): Promise<RoomNote | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }

      const accountDataManager = client.getAccountDataManager()
      const data = await accountDataManager.getRoomAccountDataFromServer(
        roomId,
        MatrixRoomAccountDataService.NOTE_EVENT_TYPE
      )

      if (!data) {
        return null
      }

      info(`[RoomAccountData] 获取房间备注成功: ${roomId}`)
      return data as RoomNote
    } catch (error) {
      return MatrixRoomAccountDataService.instance.handleError(error, 'getRoomNote', null, throwOnError)
    }
  }

  static async setRoomNote(roomId: string, content: string, throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }

      const note: RoomNote = {
        content,
        updated_at: Date.now()
      }

      const _accountDataManager = client.getAccountDataManager()
      await client.setRoomAccountData(roomId, MatrixRoomAccountDataService.NOTE_EVENT_TYPE, note)

      info(`[RoomAccountData] 设置房间备注成功: ${roomId}`)
      return true
    } catch (error) {
      return MatrixRoomAccountDataService.instance.handleError(error, 'setRoomNote', false, throwOnError)
    }
  }

  static async deleteRoomNote(roomId: string, throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }

      const accountDataManager = client.getAccountDataManager()
      await accountDataManager.deleteAccountData(MatrixRoomAccountDataService.NOTE_EVENT_TYPE)

      info(`[RoomAccountData] 删除房间备注成功: ${roomId}`)
      return true
    } catch (error) {
      return MatrixRoomAccountDataService.instance.handleError(error, 'deleteRoomNote', false, throwOnError)
    }
  }

  static async getReadPosition(roomId: string, throwOnError = true): Promise<ReadPosition | null> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }

      const accountDataManager = client.getAccountDataManager()
      const data = await accountDataManager.getRoomAccountDataFromServer(
        roomId,
        MatrixRoomAccountDataService.READ_POSITION_EVENT_TYPE
      )

      if (!data) {
        return null
      }

      info(`[RoomAccountData] 获取阅读位置成功: ${roomId}`)
      return data as ReadPosition
    } catch (error) {
      return MatrixRoomAccountDataService.instance.handleError(error, 'getReadPosition', null, throwOnError)
    }
  }

  static async setReadPosition(roomId: string, eventId: string, throwOnError = false): Promise<boolean> {
    try {
      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }

      const position: ReadPosition = {
        event_id: eventId,
        updated_at: Date.now()
      }

      const _accountDataManager = client.getAccountDataManager()
      await client.setRoomAccountData(roomId, MatrixRoomAccountDataService.READ_POSITION_EVENT_TYPE, position)

      info(`[RoomAccountData] 设置阅读位置成功: ${roomId}`)
      return true
    } catch (error) {
      return MatrixRoomAccountDataService.instance.handleError(error, 'setReadPosition', false, throwOnError)
    }
  }
}

export default MatrixRoomAccountDataService
