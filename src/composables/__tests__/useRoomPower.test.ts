import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: {
    getUserId: () => '@me:example.com'
  }
}))

vi.mock('@/services/matrix/sdk-entry', () => ({
  EventType: {
    RoomPowerLevels: 'm.room.power_levels'
  }
}))

import { useRoomPower } from '../useRoomPower'

type PowerContent = Record<string, unknown>

const makeRoom = (content: PowerContent) =>
  ({
    currentState: {
      getStateEvents: (type: string) =>
        type === 'm.room.power_levels'
          ? {
              getContent: () => content
            }
          : null
    }
  }) as unknown as Parameters<typeof useRoomPower>[0]

describe('useRoomPower §18.5.2', () => {
  it('falls back to Matrix defaults when the power-level event is missing', () => {
    const power = useRoomPower({ currentState: { getStateEvents: () => null } } as never)
    expect(power.myLevel.value).toBe(0)
    expect(power.canSend('m.room.message')).toBe(true)
    expect(power.canSend('m.room.name')).toBe(false)
    expect(power.canBan.value).toBe(false)
    expect(power.canRedact()).toBe(false)
    expect(power.canInvite.value).toBe(true)
  })

  it('grants moderator rights when the user meets per-event and per-action thresholds', () => {
    const power = useRoomPower(
      makeRoom({
        users: { '@me:example.com': 75, '@peer:example.com': 30 },
        users_default: 0,
        events: { 'm.room.message': 0 },
        events_default: 0,
        state_default: 50,
        kick: 50,
        ban: 80,
        redact: 50,
        invite: 50
      })
    )

    expect(power.myLevel.value).toBe(75)
    expect(power.canSend('m.room.message')).toBe(true)
    expect(power.canSend('m.room.name')).toBe(true)
    expect(power.canKick('@peer:example.com')).toBe(true)
    expect(power.canBan.value).toBe(false)
    expect(power.canRedact()).toBe(true)
    expect(power.canInvite.value).toBe(true)
    expect(power.canChangePowerOf('@peer:example.com')).toBe(true)
    expect(power.canChangePowerOf('@me:example.com')).toBe(false)
  })

  it('lets a user redact their own event even when below the room-wide floor', () => {
    const power = useRoomPower(
      makeRoom({
        users: { '@me:example.com': 20 },
        redact: 50,
        events: { 'm.room.redaction': 0 }
      })
    )

    expect(power.canRedact()).toBe(false)
    expect(power.canRedact('@me:example.com')).toBe(true)
    expect(power.canRedact('@peer:example.com')).toBe(false)
  })

  it('refuses to change power of an equal- or higher-ranked member', () => {
    const power = useRoomPower(
      makeRoom({
        users: { '@me:example.com': 60, '@peer:example.com': 60, '@admin:example.com': 100 },
        events: { 'm.room.power_levels': 50 },
        state_default: 50
      })
    )

    expect(power.canChangePowerOf('@peer:example.com')).toBe(false)
    expect(power.canChangePowerOf('@admin:example.com')).toBe(false)
  })
})
