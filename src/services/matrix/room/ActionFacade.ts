// src/services/matrix/room/ActionFacade.ts

import type { ICreateRoomOpts, Room } from 'matrix-js-sdk'
import { matrixRoomAccountDataService } from './AccountDataService'
import type { CreateGroupRoomOptions } from './CreationService'
import { matrixRoomCreationService } from './CreationService'
import { matrixRoomMembershipService } from './MembershipService'
import { roomOperations } from './RoomOperations'

export interface MatrixRoomActionFacade {
  // --- Delegated to CreationService (deep) ---
  createRoom(options: ICreateRoomOpts): Promise<Room>
  createGroupRoom(options: CreateGroupRoomOptions): Promise<Room>

  // --- Delegated to RoomOperations (absorbed) ---
  createDirectRoom(userId: string): Promise<string>
  setDirectRoom(userId: string, roomId: string): Promise<void>
  setRoomName(roomId: string, name: string): Promise<void>
  setRoomTopic(roomId: string, topic: string): Promise<void>
  setRoomAvatar(roomId: string, avatarUrl: string): Promise<void>
  setRoomVisibility(roomId: string, visibility: 'public' | 'private'): Promise<void>
  getRoomVisibility(roomId: string): Promise<'public' | 'private'>
  setPushRule(roomId: string, enabled: boolean): Promise<void>
  setRoomAlias(roomId: string, alias: string): Promise<void>
  deleteRoomAlias(alias: string): Promise<void>
  setPinnedEvents(roomId: string, eventIds: string[]): Promise<void>
  pinEvent(roomId: string, eventId: string): Promise<void>
  unpinEvent(roomId: string, eventId: string): Promise<void>
  getRetentionPolicy(roomId: string): Promise<{ content: Record<string, unknown> } | null>
  setRetentionPolicy(roomId: string, content: Record<string, unknown>): Promise<void>
  setStickyEvents(roomId: string, events: Record<string, unknown>): Promise<void>
  setTag(roomId: string, tag: string, order?: number): Promise<void>
  removeTag(roomId: string, tag: string): Promise<void>
  setInviteBlocklist(roomId: string, blocked: string[]): Promise<void>
  setInviteAllowlist(roomId: string, allowed: string[]): Promise<void>
  upgradeRoom(roomId: string, newVersion: string): Promise<string>
  incrementUnread(roomId: string, highlight?: boolean): Promise<void>
  clearUnread(roomId: string): Promise<void>

  // --- Delegated to MembershipService (deep) ---
  joinRoom(roomId: string): Promise<Room>
  leaveRoom(roomId: string): Promise<void>
  inviteUser(roomId: string, userId: string): Promise<void>
  kickUser(roomId: string, userId: string, reason?: string): Promise<void>
  banUser(roomId: string, userId: string, reason?: string): Promise<void>
  unbanUser(roomId: string, userId: string): Promise<void>
  forgetRoom(roomId: string): Promise<void>
  knockRoom(roomId: string, reason?: string, viaServers?: string[]): Promise<{ room_id: string }>
  joinRoomByAlias(roomIdOrAlias: string, serverName?: string[]): Promise<{ room_id: string }>

  // --- Delegated to AccountDataService (deep) ---
  setRoomAccountData(roomId: string, eventType: string, content: Record<string, unknown>): Promise<void>
  setReadLifetime(roomId: string, lifetimeMs: number): Promise<void>
}

export const matrixRoomActionFacade: MatrixRoomActionFacade = {
  // Creation (deep)
  createRoom: (options) => matrixRoomCreationService.createRoom(options),
  createGroupRoom: (options) => matrixRoomCreationService.createGroupRoom(options),

  // Absorbed
  createDirectRoom: (userId) => roomOperations.createDirectRoom(userId),
  setDirectRoom: (userId, roomId) => roomOperations.setDirectRoom(userId, roomId),
  setRoomName: (roomId, name) => roomOperations.setRoomName(roomId, name),
  setRoomTopic: (roomId, topic) => roomOperations.setRoomTopic(roomId, topic),
  setRoomAvatar: (roomId, avatarUrl) => roomOperations.setRoomAvatar(roomId, avatarUrl),
  setRoomVisibility: (roomId, visibility) => roomOperations.setRoomVisibility(roomId, visibility),
  getRoomVisibility: (roomId) => roomOperations.getRoomVisibility(roomId),
  setPushRule: (roomId, enabled) => roomOperations.setPushRule(roomId, enabled),
  setRoomAlias: (roomId, alias) => roomOperations.setAlias(roomId, alias),
  deleteRoomAlias: (alias) => roomOperations.deleteAlias(alias),
  setPinnedEvents: (roomId, eventIds) => roomOperations.setPinnedEvents(roomId, eventIds),
  pinEvent: (roomId, eventId) => roomOperations.pinEvent(roomId, eventId),
  unpinEvent: (roomId, eventId) => roomOperations.unpinEvent(roomId, eventId),
  getRetentionPolicy: (roomId) => roomOperations.getRetentionPolicy(roomId),
  setRetentionPolicy: (roomId, content) => roomOperations.setRetentionPolicy(roomId, content),
  setStickyEvents: (roomId, events) => roomOperations.setStickyEvents(roomId, events),
  setTag: (roomId, tag, order?) => roomOperations.setTag(roomId, tag, order),
  removeTag: (roomId, tag) => roomOperations.removeTag(roomId, tag),
  setInviteBlocklist: (roomId, blocked) => roomOperations.setInviteBlocklist(roomId, blocked),
  setInviteAllowlist: (roomId, allowed) => roomOperations.setInviteAllowlist(roomId, allowed),
  upgradeRoom: (roomId, newVersion) => roomOperations.upgradeRoom(roomId, newVersion),
  incrementUnread: (roomId, highlight?) => roomOperations.incrementUnread(roomId, highlight),
  clearUnread: (roomId) => roomOperations.clearUnread(roomId),

  // Membership (deep)
  joinRoom: (roomId) => matrixRoomMembershipService.joinRoom(roomId),
  leaveRoom: (roomId) => matrixRoomMembershipService.leaveRoom(roomId),
  inviteUser: (roomId, userId) => matrixRoomMembershipService.inviteUser(roomId, userId),
  kickUser: (roomId, userId, reason?) => matrixRoomMembershipService.kickUser(roomId, userId, reason),
  banUser: (roomId, userId, reason?) => matrixRoomMembershipService.banUser(roomId, userId, reason),
  unbanUser: (roomId, userId) => matrixRoomMembershipService.unbanUser(roomId, userId),
  forgetRoom: (roomId) => matrixRoomMembershipService.forgetRoom(roomId),
  knockRoom: (roomId, reason?, viaServers?) => matrixRoomMembershipService.knockRoom(roomId, reason, viaServers),
  joinRoomByAlias: (roomIdOrAlias, serverName?) =>
    matrixRoomMembershipService.joinRoomByAlias(roomIdOrAlias, serverName),

  // AccountData (deep)
  setRoomAccountData: (roomId, eventType, content) =>
    matrixRoomAccountDataService.setRoomAccountData(roomId, eventType, content),
  setReadLifetime: (roomId, lifetimeMs) => matrixRoomAccountDataService.setReadLifetime(roomId, lifetimeMs)
}
