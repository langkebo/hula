import { type ComputedRef, computed, type Ref, ref } from 'vue'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { EventType, type Room, type RoomMember } from '@/services/matrix/sdk-entry'

/**
 * §18.5.2 — Power-level helpers for a room.
 *
 * Reads the room's `m.room.power_levels` state event and exposes
 * boolean checks for the common permission questions: can I send an
 * event, kick/ban a member, redact an event, raise/lower another
 * member's PL. Mirrors the semantics of matrix-js-sdk `RoomState`
 * helpers but keeps them reactive and SDK-agnostic for UI consumers.
 *
 * Every helper is defensive: if the power-level event is missing, the
 * Matrix defaults apply (`users_default=0`, `events_default=0`,
 * `state_default=50`, `kick/ban/redact=50`).
 */

type PowerLevelContent = {
  users?: Record<string, number>
  users_default?: number
  events?: Record<string, number>
  events_default?: number
  state_default?: number
  kick?: number
  ban?: number
  redact?: number
  invite?: number
}

type RoomInput = Room | Ref<Room | null | undefined> | null | undefined

const DEFAULTS = {
  usersDefault: 0,
  eventsDefault: 0,
  stateDefault: 50,
  kick: 50,
  ban: 50,
  redact: 50,
  invite: 0
}

function resolveRoom(input: RoomInput): Room | null {
  if (!input) return null
  if (typeof input === 'object' && 'value' in input) return input.value ?? null
  return input
}

function readPowerLevels(room: Room | null): PowerLevelContent {
  if (!room) return {}
  const ev = room.currentState?.getStateEvents?.(EventType.RoomPowerLevels, '') as
    | { getContent?: () => PowerLevelContent }
    | null
    | undefined
  const content = ev?.getContent?.()
  return content ?? {}
}

function memberId(member: RoomMember | string | null | undefined): string | null {
  if (!member) return null
  return typeof member === 'string' ? member : ((member as RoomMember).userId ?? null)
}

function plForUser(pl: PowerLevelContent, userId: string | null): number {
  if (!userId) return pl.users_default ?? DEFAULTS.usersDefault
  return pl.users?.[userId] ?? pl.users_default ?? DEFAULTS.usersDefault
}

function plForEvent(pl: PowerLevelContent, eventType: string, stateEvent: boolean): number {
  if (pl.events && Object.hasOwn(pl.events, eventType)) {
    return pl.events[eventType]
  }
  return stateEvent ? (pl.state_default ?? DEFAULTS.stateDefault) : (pl.events_default ?? DEFAULTS.eventsDefault)
}

function isStateEvent(eventType: string): boolean {
  return eventType.startsWith('m.room.') && eventType !== 'm.room.message' && eventType !== 'm.room.encrypted'
}

export interface UseRoomPower {
  myUserId: Ref<string | null>
  myLevel: ComputedRef<number>
  canSend: (eventType: string) => boolean
  canKick: (member: RoomMember | string) => boolean
  canBan: ComputedRef<boolean>
  canRedact: (eventSenderId?: string) => boolean
  canInvite: ComputedRef<boolean>
  canChangePowerOf: (member: RoomMember | string) => boolean
  refresh: () => void
}

export function useRoomPower(roomInput: RoomInput): UseRoomPower {
  const revision = ref(0)
  const myUserId = ref<string | null>(matrixClientService.getUserId?.() ?? null)

  const pl = computed<PowerLevelContent>(() => {
    // Touch `revision` so `refresh()` re-evaluates.
    void revision.value
    return readPowerLevels(resolveRoom(roomInput))
  })

  const myLevel = computed(() => plForUser(pl.value, myUserId.value))

  const canSend = (eventType: string) => myLevel.value >= plForEvent(pl.value, eventType, isStateEvent(eventType))

  const canKick = (member: RoomMember | string) => {
    const targetId = memberId(member)
    const targetLevel = plForUser(pl.value, targetId)
    const required = pl.value.kick ?? DEFAULTS.kick
    return myLevel.value >= required && myLevel.value > targetLevel
  }

  const canBan = computed(() => myLevel.value >= (pl.value.ban ?? DEFAULTS.ban))

  const canRedact = (eventSenderId?: string) => {
    const globalFloor = pl.value.redact ?? DEFAULTS.redact
    if (myLevel.value >= globalFloor) return true
    // Senders can always redact their own events when they can send the redact event type.
    if (eventSenderId && eventSenderId === myUserId.value) {
      return myLevel.value >= plForEvent(pl.value, 'm.room.redaction', false)
    }
    return false
  }

  const canInvite = computed(() => myLevel.value >= (pl.value.invite ?? DEFAULTS.invite))

  const canChangePowerOf = (member: RoomMember | string) => {
    const targetId = memberId(member)
    if (!targetId || !myUserId.value) return false
    if (targetId === myUserId.value) return false
    const targetLevel = plForUser(pl.value, targetId)
    const requiredToEditPowerLevels = plForEvent(pl.value, EventType.RoomPowerLevels, true)
    return myLevel.value >= requiredToEditPowerLevels && myLevel.value > targetLevel
  }

  const refresh = () => {
    myUserId.value = matrixClientService.getUserId?.() ?? myUserId.value
    revision.value++
  }

  return {
    myUserId,
    myLevel,
    canSend,
    canKick,
    canBan,
    canRedact,
    canInvite,
    canChangePowerOf,
    refresh
  }
}
