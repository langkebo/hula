export interface BurnStats {
  total_burned: number
  total_pending: number
  rooms_with_burn_enabled: number
}

export interface InviteBlocklist {
  blocked_users: string[]
  blocklist: string[]
  updated_ts: number
}

export interface InviteAllowlist {
  allowed_users: string[]
  allowlist: string[]
  updated_ts: number
}

export type RoomEphemeralEvent = Record<string, unknown>

export interface StickyEvent {
  event_id: string
  event_type: string
  content: Record<string, unknown>
  updated_ts: number
}

export interface RoomSummary {
  room_id: string
  room_type?: string
  name?: string
  topic?: string
  avatar_url?: string
  canonical_alias?: string
  join_rule?: string
  history_visibility?: string
  guest_access?: string
  is_direct?: boolean
  is_space?: boolean
  is_encrypted?: boolean
  member_count?: number
  joined_member_count?: number
  invited_member_count?: number
  last_event_ts?: number
  last_message_ts?: number
  heroes: RoomSummaryMember[]
  stats: RoomSummaryStats
}

export interface RoomSummaryMember {
  user_id: string
  display_name?: string
  avatar_url?: string
  membership: string
  is_hero: boolean
}

export interface RoomSummaryStats {
  room_id: string
  total_events: number
  total_state_events?: number
  total_messages: number
  total_media: number
  storage_size: number
}

export interface RoomSummaryState {
  event_type: string
  state_key: string
  event_id: string
  content: Record<string, unknown>
}

export function createEmptyBurnStats(): BurnStats {
  return {
    total_burned: 0,
    total_pending: 0,
    rooms_with_burn_enabled: 0
  }
}

export function parseEnabledResponse(data: { enabled?: boolean } | undefined): boolean {
  return data?.enabled || false
}

export function parseCreatedRoomId(data: { room_id?: string } | undefined): string | null {
  return data?.room_id || null
}

export function parseInviteBlocklist(data: InviteBlocklist | undefined): InviteBlocklist {
  const users = data?.blocked_users || data?.blocklist || []
  return {
    blocked_users: users,
    blocklist: users,
    updated_ts: data?.updated_ts || 0
  }
}

export function parseInviteAllowlist(data: InviteAllowlist | undefined): InviteAllowlist {
  const users = data?.allowed_users || data?.allowlist || []
  return {
    allowed_users: users,
    allowlist: users,
    updated_ts: data?.updated_ts || 0
  }
}

export function parseStickyEventsResponse(data: { events?: StickyEvent[] } | undefined): StickyEvent[] {
  return data?.events || []
}

export function parseRoomSummary(data: RoomSummary | undefined): RoomSummary | null {
  return data || null
}

export function parseRoomSummaryMembers(data: RoomSummaryMember[] | undefined): RoomSummaryMember[] {
  return data || []
}

export function parseRoomSummaryState(data: RoomSummaryState[] | undefined): RoomSummaryState[] {
  return data || []
}

export function parseRoomSummaryStats(data: RoomSummaryStats | undefined): RoomSummaryStats | null {
  return data || null
}

export function parseRoomEphemeralChunk(data: { chunk?: RoomEphemeralEvent[] } | undefined): RoomEphemeralEvent[] {
  return data?.chunk || []
}
