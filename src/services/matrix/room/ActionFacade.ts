import type { ICreateRoomOpts, Room } from 'matrix-js-sdk'
import { matrixRoomAccountDataService } from './AccountDataService'
import { matrixRoomAliasesService } from './AliasesService'
import { matrixRoomCreationService } from './CreationService'
import { matrixRoomDirectMessageService } from './DirectMessageService'
import { matrixRoomLifecycleService } from './LifecycleService'
import { matrixRoomMembershipService } from './MembershipService'
import { matrixRoomModerationService } from './ModerationService'
import { matrixRoomPinsService } from './PinsService'
import { matrixRoomStateService } from './StateService'
import { matrixRoomTagsService } from './TagsService'

export interface MatrixRoomActionFacade {
  createRoom(options: ICreateRoomOpts): Promise<Room>
  createGroupRoom(options: {
    name: string
    topic?: string
    avatarUrl?: string
    isPublic?: boolean
    alias?: string
    isEncrypted?: boolean
    historyVisibility?: 'shared' | 'invited' | 'joined' | 'world_readable'
  }): Promise<Room>
  createDirectRoom(userId: string): Promise<string>
  joinRoom(roomId: string): Promise<Room>
  leaveRoom(roomId: string): Promise<void>
  inviteUser(roomId: string, userId: string): Promise<void>
  kickUser(roomId: string, userId: string, reason?: string): Promise<void>
  banUser(roomId: string, userId: string, reason?: string): Promise<void>
  unbanUser(roomId: string, userId: string): Promise<void>
  setRoomName(roomId: string, name: string): Promise<void>
  setRoomTopic(roomId: string, topic: string): Promise<void>
  setRoomAvatar(roomId: string, avatarUrl: string): Promise<void>
  setPushRule(roomId: string, enabled: boolean): Promise<void>
  setDirectRoom(userId: string, roomId: string): Promise<void>
  incrementUnread(roomId: string, highlight?: boolean): Promise<void>
  clearUnread(roomId: string): Promise<void>
  forgetRoom(roomId: string): Promise<void>
  upgradeRoom(roomId: string, newVersion: string): Promise<string>
  knockRoom(roomId: string, reason?: string, viaServers?: string[]): Promise<{ room_id: string }>
  setRoomAlias(roomId: string, alias: string): Promise<void>
  deleteRoomAlias(alias: string): Promise<void>
  setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void>
  setPinnedEvents(roomId: string, eventIds: string[]): Promise<void>
  setInviteBlocklist(roomId: string, blocked: string[]): Promise<void>
  setInviteAllowlist(roomId: string, allowed: string[]): Promise<void>
  setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void>
  setTag(roomId: string, tag: string, order?: number): Promise<void>
  removeTag(roomId: string, tag: string): Promise<void>
  setReadLifetime(roomId: string, lifetimeMs: number): Promise<void>
  pinEvent(roomId: string, eventId: string): Promise<void>
  unpinEvent(roomId: string, eventId: string): Promise<void>
  joinRoomByAlias(roomIdOrAlias: string, serverName?: string[]): Promise<{ room_id: string }>
}

export const matrixRoomActionFacade: MatrixRoomActionFacade = {
  async createRoom(options) {
    return matrixRoomCreationService.createRoom(options)
  },

  async createGroupRoom(options) {
    return matrixRoomCreationService.createGroupRoom(options)
  },

  async createDirectRoom(userId) {
    return matrixRoomDirectMessageService.createDirectRoom(userId)
  },

  async joinRoom(roomId) {
    return matrixRoomMembershipService.joinRoom(roomId)
  },

  async leaveRoom(roomId) {
    return matrixRoomMembershipService.leaveRoom(roomId)
  },

  async inviteUser(roomId, userId) {
    return matrixRoomMembershipService.inviteUser(roomId, userId)
  },

  async kickUser(roomId, userId, reason) {
    return matrixRoomMembershipService.kickUser(roomId, userId, reason)
  },

  async banUser(roomId, userId, reason) {
    return matrixRoomMembershipService.banUser(roomId, userId, reason)
  },

  async unbanUser(roomId, userId) {
    return matrixRoomMembershipService.unbanUser(roomId, userId)
  },

  async setRoomName(roomId, name) {
    return matrixRoomStateService.setRoomName(roomId, name)
  },

  async setRoomTopic(roomId, topic) {
    return matrixRoomStateService.setRoomTopic(roomId, topic)
  },

  async setRoomAvatar(roomId, avatarUrl) {
    return matrixRoomStateService.setRoomAvatar(roomId, avatarUrl)
  },

  async setPushRule(roomId, enabled) {
    return matrixRoomStateService.setPushRule(roomId, enabled)
  },

  async setDirectRoom(userId, roomId) {
    return matrixRoomDirectMessageService.setDirectRoom(userId, roomId)
  },

  async incrementUnread(roomId, highlight = false) {
    return matrixRoomLifecycleService.incrementUnread(roomId, highlight)
  },

  async clearUnread(roomId) {
    return matrixRoomLifecycleService.clearUnread(roomId)
  },

  async forgetRoom(roomId) {
    return matrixRoomMembershipService.forgetRoom(roomId)
  },

  async upgradeRoom(roomId, newVersion) {
    return matrixRoomLifecycleService.upgradeRoom(roomId, newVersion)
  },

  async knockRoom(roomId, reason) {
    return matrixRoomMembershipService.knockRoom(roomId, reason)
  },

  async setRoomAlias(roomId, alias) {
    return matrixRoomAliasesService.setAlias(roomId, alias)
  },

  async deleteRoomAlias(alias) {
    return matrixRoomAliasesService.deleteAlias(alias)
  },

  async setRoomAccountData(roomId, eventType, content) {
    return matrixRoomAccountDataService.setRoomAccountData(roomId, eventType, content)
  },

  async setPinnedEvents(roomId, eventIds) {
    return matrixRoomPinsService.setPinnedEvents(roomId, eventIds)
  },

  async setInviteBlocklist(roomId, blocked) {
    return matrixRoomModerationService.setInviteBlocklist(roomId, blocked)
  },

  async setInviteAllowlist(roomId, allowed) {
    return matrixRoomModerationService.setInviteAllowlist(roomId, allowed)
  },

  async setStickyEvents(roomId, events) {
    return matrixRoomPinsService.setStickyEvents(roomId, events)
  },

  async setTag(roomId, tag, order) {
    return matrixRoomTagsService.setTag(roomId, tag, order)
  },

  async removeTag(roomId, tag) {
    return matrixRoomTagsService.removeTag(roomId, tag)
  },

  async setReadLifetime(roomId, lifetimeMs) {
    return matrixRoomAccountDataService.setReadLifetime(roomId, lifetimeMs)
  },

  async pinEvent(roomId, eventId) {
    return matrixRoomPinsService.pinEvent(roomId, eventId)
  },

  async unpinEvent(roomId, eventId) {
    return matrixRoomPinsService.unpinEvent(roomId, eventId)
  },

  async joinRoomByAlias(roomIdOrAlias, serverName) {
    return matrixRoomMembershipService.joinRoomByAlias(roomIdOrAlias, serverName)
  }
}
