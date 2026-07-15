/**
 * Type definitions for mobile tab operations.
 *
 * These types provide a clean interface between the mobile view layer
 * and the underlying Matrix SDK service layer. Task A (mobile tab
 * operation views) imports these types to ensure type-safe interaction
 * with the Matrix services.
 */

// ---------------------------------------------------------------------------
// Room / DM types
// ---------------------------------------------------------------------------

export interface CreateDmParams {
  userId: string
  encrypted?: boolean
}

export interface CreateGroupParams {
  name: string
  topic?: string
  memberIds?: string[]
  avatarUrl?: string
  isEncrypted?: boolean
  joinRule?: 'invite' | 'knock' | 'public' | 'restricted'
}

// ---------------------------------------------------------------------------
// Contact types
// ---------------------------------------------------------------------------

export interface AddFriendParams {
  userId: string
  reason?: string
}

export interface RemoveContactParams {
  userId: string
}

export interface UserSearchParams {
  query: string
  limit?: number
}

// ---------------------------------------------------------------------------
// Room types
// ---------------------------------------------------------------------------

export interface JoinRoomParams {
  roomIdOrAlias: string
  serverNames?: string[]
}

export interface LeaveRoomParams {
  roomId: string
}

export interface DeleteRoomParams {
  roomId: string
}

export interface PublicRoomSearchParams {
  query?: string
  server?: string
  limit?: number
}

// ---------------------------------------------------------------------------
// Space types
// ---------------------------------------------------------------------------

export interface CreateSpaceParams {
  name: string
  topic?: string
  visibility?: 'public' | 'private'
  avatarUrl?: string
}

export interface InviteToSpaceParams {
  spaceId: string
  userId: string
}

// ---------------------------------------------------------------------------
// Profile types
// ---------------------------------------------------------------------------

export interface EditProfileParams {
  displayName?: string
  avatarUrl?: string
  avatarFile?: Blob | File
  extendedFields?: Record<string, string | number | boolean | null>
}

// ---------------------------------------------------------------------------
// Operation result types
// ---------------------------------------------------------------------------

export interface OperationSuccess<T = void> {
  success: true
  data: T
}

export interface OperationFailure {
  success: false
  code: string
  message: string
  i18nKey: string
}

export type OperationResult<T = void> = OperationSuccess<T> | OperationFailure
