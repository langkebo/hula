/**
 * Matrix 设置服务
 * 提供账户、设备、通知、隐私等设置相关的 API 封装
 */

import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'

export interface UserProfile {
  userId: string
  displayName: string | null
  avatarUrl: string | null
  about?: string
}

export interface Device {
  deviceId: string
  displayName: string | null
  lastSeenIp: string | null
  lastSeenTs: number | null
  isCurrentDevice: boolean
  userAgent: string | null
}

export interface PushRule {
  ruleId: string
  actions: string[]
  conditions: PushCondition[]
  enabled: boolean
  pattern?: string
}

export interface PushCondition {
  kind: string
  key?: string
  pattern?: string
}

export interface PushRules {
  global: {
    override: PushRule[]
    content: PushRule[]
    room: PushRule[]
    sender: PushRule[]
    underride: PushRule[]
  }
}

export interface Pusher {
  pushkey: string
  kind: string
  appId: string
  appDisplayName: string
  deviceDisplayName: string
  profileTag: string | null
  lang: string
  data: Record<string, unknown>
}

export interface PrivacySettings {
  showOnlineStatus: boolean
  showTypingStatus: boolean
  shareReadReceipts: boolean
  allowPublicRoomDiscovery: boolean
  allow3pidDiscovery: boolean
}

export interface KeyBackupInfo {
  version: string | null
  algorithm: string | null
  authData: Record<string, unknown> | null
  count: number
  etag: string | null
}

export interface HighlightWord {
  word: string
  enabled: boolean
}

export interface RoomPushRule {
  roomId: string
  ruleType: 'all_messages' | 'mentions_only' | 'mute'
  enabled: boolean
}

export interface LoginHistory {
  deviceId: string
  deviceName: string | null
  ip: string | null
  timestamp: number
  userAgent: string | null
}

class MatrixSettingsService extends BaseManager {
  private get client() {
    return matrixClientService.getClient()
  }

  private get http() {
    return this.client?.http
  }

  async getProfile(userId?: string, throwOnError = true): Promise<UserProfile | null> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      const targetUserId = userId || this.client.getUserId()
      if (!targetUserId) {
        throw new Error('User ID not available')
      }

      const response = await this.http!.authedRequest(
        'GET',
        `/_matrix/client/v3/profile/${encodeURIComponent(targetUserId)}`,
        undefined,
        undefined,
        { prefix: '' }
      )

      return {
        userId: targetUserId,
        displayName: response.displayname || null,
        avatarUrl: response.avatar_url || null,
        about: response.about || undefined
      }
    } catch (error) {
      return this.handleError(error, 'getProfile', null, throwOnError)
    }
  }

  async updateProfile(data: Partial<UserProfile>, throwOnError = false): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      const userId = this.client.getUserId()
      if (!userId) {
        throw new Error('User ID not available')
      }

      const body: Record<string, unknown> = {}
      if (data.displayName !== undefined) {
        body.displayname = data.displayName
      }
      if (data.avatarUrl !== undefined) {
        body.avatar_url = data.avatarUrl
      }
      if (data.about !== undefined) {
        body.about = data.about
      }

      await this.http!.authedRequest(
        'PUT',
        `/_matrix/client/v3/profile/${encodeURIComponent(userId)}`,
        undefined,
        body,
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'updateProfile', false, throwOnError)
    }
  }

  async changePassword(oldPassword: string, newPassword: string, throwOnError = false): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      await this.http!.authedRequest(
        'POST',
        '/_matrix/client/v3/account/password',
        undefined,
        {
          auth: {
            type: 'm.login.password',
            password: oldPassword
          },
          new_password: newPassword,
          logout_devices: false
        },
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'changePassword', false, throwOnError)
    }
  }

  async deactivateAccount(password: string, throwOnError = false): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      await this.http!.authedRequest(
        'POST',
        '/_matrix/client/v3/account/deactivate',
        undefined,
        {
          auth: {
            type: 'm.login.password',
            password: password
          },
          erase: true
        },
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'deactivateAccount', false, throwOnError)
    }
  }

  async getDevices(throwOnError = true): Promise<Device[]> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      const response = await this.http!.authedRequest('GET', '/_matrix/client/v3/devices', undefined, undefined, {
        prefix: ''
      })

      const currentDeviceId = this.client.getDeviceId()

      return (response.devices || []).map((device: any) => ({
        deviceId: device.device_id,
        displayName: device.display_name || null,
        lastSeenIp: device.last_seen_ip || null,
        lastSeenTs: device.last_seen_ts || null,
        isCurrentDevice: device.device_id === currentDeviceId,
        userAgent: device.user_agent || null
      }))
    } catch (error) {
      return this.handleError(error, 'getDevices', [] as Device[], throwOnError)
    }
  }

  async updateDevice(deviceId: string, displayName: string, throwOnError = false): Promise<boolean> {
    try {
      await this.http!.authedRequest(
        'PUT',
        `/_matrix/client/v3/devices/${encodeURIComponent(deviceId)}`,
        undefined,
        { display_name: displayName },
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'updateDevice', false, throwOnError)
    }
  }

  async deleteDevice(deviceId: string, throwOnError = false): Promise<boolean> {
    try {
      await this.http!.authedRequest(
        'DELETE',
        `/_matrix/client/v3/devices/${encodeURIComponent(deviceId)}`,
        undefined,
        undefined,
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'deleteDevice', false, throwOnError)
    }
  }

  async deleteDevices(deviceIds: string[], throwOnError = false): Promise<boolean> {
    try {
      await this.http!.authedRequest(
        'POST',
        '/_matrix/client/v3/delete_devices',
        undefined,
        { devices: deviceIds },
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'deleteDevices', false, throwOnError)
    }
  }

  async getPushRules(throwOnError = true): Promise<PushRules | null> {
    try {
      const response = await this.http!.authedRequest('GET', '/_matrix/client/v3/pushrules', undefined, undefined, {
        prefix: ''
      })

      return {
        global: {
          override: response.global?.override || [],
          content: response.global?.content || [],
          room: response.global?.room || [],
          sender: response.global?.sender || [],
          underride: response.global?.underride || []
        }
      }
    } catch (error) {
      return this.handleError(error, 'getPushRules', null, throwOnError)
    }
  }

  async setPushRuleEnabled(scope: string, kind: string, ruleId: string, enabled: boolean, throwOnError = false): Promise<boolean> {
    try {
      await this.http!.authedRequest(
        'PUT',
        `/_matrix/client/v3/pushrules/${scope}/${kind}/${encodeURIComponent(ruleId)}/enabled`,
        undefined,
        { enabled },
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'setPushRuleEnabled', false, throwOnError)
    }
  }

  async getPushers(throwOnError = true): Promise<Pusher[]> {
    try {
      const response = await this.http!.authedRequest('GET', '/_matrix/client/v3/pushers', undefined, undefined, {
        prefix: ''
      })

      return response.pushers || []
    } catch (error) {
      return this.handleError(error, 'getPushers', [] as Pusher[], throwOnError)
    }
  }

  async setPusher(pusher: Partial<Pusher>, throwOnError = false): Promise<boolean> {
    try {
      await this.http!.authedRequest(
        'POST',
        '/_matrix/client/v3/pushers/set',
        undefined,
        {
          pushkey: pusher.pushkey,
          kind: pusher.kind || 'http',
          app_id: pusher.appId,
          app_display_name: pusher.appDisplayName,
          device_display_name: pusher.deviceDisplayName,
          profile_tag: pusher.profileTag,
          lang: pusher.lang || 'en',
          data: pusher.data
        },
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'setPusher', false, throwOnError)
    }
  }

  async getIgnoredUsers(throwOnError = true): Promise<string[]> {
    try {
      const response = await this.http!.authedRequest(
        'GET',
        '/_matrix/client/v3/account_data/m.ignored_user_list',
        undefined,
        undefined,
        { prefix: '' }
      )

      return Object.keys(response.ignored_users || {})
    } catch (error) {
      return this.handleError(error, 'getIgnoredUsers', [] as string[], throwOnError)
    }
  }

  async setIgnoredUsers(users: string[], throwOnError = false): Promise<boolean> {
    try {
      const ignoredUsers: Record<string, Record<string, never>> = {}
      for (const userId of users) {
        ignoredUsers[userId] = {}
      }
      await this.http!.authedRequest(
        'PUT',
        '/_matrix/client/v3/account_data/m.ignored_user_list',
        undefined,
        { ignored_users: ignoredUsers },
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'setIgnoredUsers', false, throwOnError)
    }
  }

  async ignoreUser(userId: string, throwOnError = false): Promise<boolean> {
    const ignored = await this.getIgnoredUsers(false)
    if (!ignored.includes(userId)) {
      return this.setIgnoredUsers([...ignored, userId], throwOnError)
    }
    return true
  }

  async unignoreUser(userId: string, throwOnError = false): Promise<boolean> {
    const ignored = await this.getIgnoredUsers(false)
    return this.setIgnoredUsers(ignored.filter((id) => id !== userId), throwOnError)
  }

  async getPrivacySettings(throwOnError = true): Promise<PrivacySettings> {
    try {
      const response = await this.http!.authedRequest(
        'GET',
        '/_matrix/client/v3/account_data/m.privacy',
        undefined,
        undefined,
        { prefix: '' }
      )

      return {
        showOnlineStatus: response.show_online_status ?? true,
        showTypingStatus: response.show_typing_status ?? true,
        shareReadReceipts: response.share_read_receipts ?? true,
        allowPublicRoomDiscovery: response.allow_public_room_discovery ?? false,
        allow3pidDiscovery: response.allow_3pid_discovery ?? false
      }
    } catch (error) {
      return this.handleError(
        error,
        'getPrivacySettings',
        {
          showOnlineStatus: true,
          showTypingStatus: true,
          shareReadReceipts: true,
          allowPublicRoomDiscovery: false,
          allow3pidDiscovery: false
        } as PrivacySettings,
        throwOnError
      )
    }
  }

  async setPrivacySettings(settings: Partial<PrivacySettings>, throwOnError = false): Promise<boolean> {
    try {
      await this.http!.authedRequest(
        'PUT',
        '/_matrix/client/v3/account_data/m.privacy',
        undefined,
        {
          show_online_status: settings.showOnlineStatus,
          show_typing_status: settings.showTypingStatus,
          share_read_receipts: settings.shareReadReceipts,
          allow_public_room_discovery: settings.allowPublicRoomDiscovery,
          allow_3pid_discovery: settings.allow3pidDiscovery
        },
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'setPrivacySettings', false, throwOnError)
    }
  }

  async getKeyBackupInfo(throwOnError = true): Promise<KeyBackupInfo | null> {
    try {
      const response = await this.http!.authedRequest(
        'GET',
        '/_matrix/client/v3/room_keys/version',
        undefined,
        undefined,
        { prefix: '' }
      )

      return {
        version: response.version || null,
        algorithm: response.algorithm || null,
        authData: response.auth_data || null,
        count: response.count || 0,
        etag: response.etag || null
      }
    } catch (error) {
      return this.handleError(error, 'getKeyBackupInfo', null, throwOnError)
    }
  }

  async getAccountData<T = unknown>(eventType: string, throwOnError = true): Promise<T | null> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      const userId = this.client.getUserId()
      if (!userId) {
        throw new Error('User ID not available')
      }

      const response = await this.http!.authedRequest(
        'GET',
        `/_matrix/client/v3/user/${encodeURIComponent(userId)}/account_data/${eventType}`,
        undefined,
        undefined,
        { prefix: '' }
      )

      return response as T
    } catch (error) {
      return this.handleError(error, 'getAccountData', null, throwOnError)
    }
  }

  async setAccountData<T = unknown>(eventType: string, data: T, throwOnError = false): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      const userId = this.client.getUserId()
      if (!userId) {
        throw new Error('User ID not available')
      }

      await this.http!.authedRequest(
        'PUT',
        `/_matrix/client/v3/user/${encodeURIComponent(userId)}/account_data/${eventType}`,
        undefined,
        data,
        { prefix: '' }
      )

      return true
    } catch (error) {
      return this.handleError(error, 'setAccountData', false, throwOnError)
    }
  }

  async getHighlightWords(throwOnError = true): Promise<HighlightWord[]> {
    try {
      const data = await this.getAccountData<{ words?: string[] }>('m.highlight_words', false)
      if (!data?.words) {
        return []
      }
      return data.words.map((word) => ({ word, enabled: true }))
    } catch (error) {
      return this.handleError(error, 'getHighlightWords', [] as HighlightWord[], throwOnError)
    }
  }

  async setHighlightWords(words: string[], throwOnError = false): Promise<boolean> {
    return this.setAccountData('m.highlight_words', { words }, throwOnError)
  }

  async addHighlightWord(word: string, throwOnError = false): Promise<boolean> {
    const words = await this.getHighlightWords(false)
    const wordList = words.filter((w) => w.enabled).map((w) => w.word)
    if (!wordList.includes(word)) {
      wordList.push(word)
      return this.setHighlightWords(wordList, throwOnError)
    }
    return true
  }

  async removeHighlightWord(word: string, throwOnError = false): Promise<boolean> {
    const words = await this.getHighlightWords(false)
    const wordList = words.filter((w) => w.enabled && w.word !== word).map((w) => w.word)
    return this.setHighlightWords(wordList, throwOnError)
  }

  async getRoomPushRules(throwOnError = true): Promise<RoomPushRule[]> {
    try {
      const rules = await this.getPushRules(false)
      if (!rules) return []

      const roomRules: RoomPushRule[] = []
      for (const rule of rules.global.room || []) {
        const isMute = rule.actions?.length === 0 || rule.actions?.some((a: string) => a === 'dont_notify')
        roomRules.push({
          roomId: rule.ruleId,
          ruleType: isMute ? 'mute' : 'all_messages',
          enabled: rule.enabled
        })
      }
      return roomRules
    } catch (error) {
      return this.handleError(error, 'getRoomPushRules', [] as RoomPushRule[], throwOnError)
    }
  }

  async setRoomPushRule(roomId: string, ruleType: 'all_messages' | 'mentions_only' | 'mute', throwOnError = false): Promise<boolean> {
    try {
      if (ruleType === 'mute') {
        await this.http!.authedRequest(
          'PUT',
          `/_matrix/client/v3/pushrules/global/room/${encodeURIComponent(roomId)}`,
          undefined,
          {
            actions: ['dont_notify']
          },
          { prefix: '' }
        )
      } else {
        await this.http!.authedRequest(
          'DELETE',
          `/_matrix/client/v3/pushrules/global/room/${encodeURIComponent(roomId)}`,
          undefined,
          undefined,
          { prefix: '' }
        )
      }
      return true
    } catch (error) {
      return this.handleError(error, 'setRoomPushRule', false, throwOnError)
    }
  }

  async deleteRoomPushRule(roomId: string, throwOnError = false): Promise<boolean> {
    try {
      await this.http!.authedRequest(
        'DELETE',
        `/_matrix/client/v3/pushrules/global/room/${encodeURIComponent(roomId)}`,
        undefined,
        undefined,
        { prefix: '' }
      )
      return true
    } catch (error) {
      return this.handleError(error, 'deleteRoomPushRule', false, throwOnError)
    }
  }

  async getLoginHistory(throwOnError = true): Promise<LoginHistory[]> {
    try {
      const devices = await this.getDevices(false)
      return devices
        .map((device) => ({
          deviceId: device.deviceId,
          deviceName: device.displayName,
          ip: device.lastSeenIp,
          timestamp: device.lastSeenTs || 0,
          userAgent: device.userAgent
        }))
        .sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
      return this.handleError(error, 'getLoginHistory', [] as LoginHistory[], throwOnError)
    }
  }

  async verifyDevice(deviceId: string, throwOnError = false): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      const crypto = this.client.getCrypto() as any
      if (!crypto) {
        throw new Error('Crypto not available')
      }

      const userId = this.client.getUserId()
      if (!userId) {
        throw new Error('User ID not available')
      }

      if (typeof crypto.setDeviceVerified === 'function') {
        await crypto.setDeviceVerified(userId, deviceId)
        return true
      }

      return false
    } catch (error) {
      return this.handleError(error, 'verifyDevice', false, throwOnError)
    }
  }

  async getDeviceTrust(deviceId: string, throwOnError = true): Promise<'verified' | 'unverified' | 'unknown'> {
    try {
      if (!this.client) {
        throw new Error('Client not initialized')
      }

      const crypto = this.client.getCrypto() as any
      if (!crypto) {
        return 'unknown'
      }

      const userId = this.client.getUserId()
      if (!userId) {
        return 'unknown'
      }

      if (typeof crypto.getDevice === 'function') {
        const deviceData = await crypto.getDevice(userId, deviceId)
        if (!deviceData) {
          return 'unknown'
        }
        return deviceData.verified ? 'verified' : 'unverified'
      }

      return 'unknown'
    } catch (error) {
      return this.handleError(error, 'getDeviceTrust', 'unknown' as const, throwOnError)
    }
  }
}

export const matrixSettingsService = new MatrixSettingsService()
export default matrixSettingsService
