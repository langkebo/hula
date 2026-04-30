import { describe, expect, it } from 'vitest'
import { canManageSpaceByPowerLevel, SPACE_MANAGE_POWER_LEVEL } from '../spacePermissions'

describe('spacePermissions', () => {
  it('returns false when the client, user, or room context is missing', () => {
    expect(canManageSpaceByPowerLevel(undefined, '!space:server')).toBe(false)
    expect(canManageSpaceByPowerLevel({ getUserId: () => null }, '!space:server')).toBe(false)
    expect(
      canManageSpaceByPowerLevel(
        {
          getUserId: () => '@me:server',
          getRoom: () => null
        },
        '!space:server'
      )
    ).toBe(false)
  })

  it('returns false when the current user is not joined to the space', () => {
    expect(
      canManageSpaceByPowerLevel(
        {
          getUserId: () => '@me:server',
          getRoom: () => ({
            getMyMembership: () => 'invite',
            getMember: () => ({ powerLevel: 100 })
          })
        },
        '!space:server'
      )
    ).toBe(false)
  })

  it('returns false when the current user power level is below the manage threshold', () => {
    expect(
      canManageSpaceByPowerLevel(
        {
          getUserId: () => '@me:server',
          getRoom: () => ({
            getMyMembership: () => 'join',
            getMember: () => ({ powerLevel: SPACE_MANAGE_POWER_LEVEL - 1 })
          })
        },
        '!space:server'
      )
    ).toBe(false)
  })

  it('returns true when the current user meets the manage threshold', () => {
    expect(
      canManageSpaceByPowerLevel(
        {
          getUserId: () => '@me:server',
          getRoom: () => ({
            getMyMembership: () => 'join',
            getMember: () => ({ powerLevel: SPACE_MANAGE_POWER_LEVEL })
          })
        },
        '!space:server'
      )
    ).toBe(true)
  })

  it('falls back to currentState members and getPowerLevel when needed', () => {
    expect(
      canManageSpaceByPowerLevel(
        {
          getUserId: () => '@me:server',
          getRoom: () => ({
            getMyMembership: () => 'join',
            getMember: () => undefined,
            currentState: {
              getMember: () => ({
                getPowerLevel: () => 99
              })
            }
          })
        },
        '!space:server'
      )
    ).toBe(true)
  })
})
