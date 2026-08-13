import { describe, expect, it } from 'vitest'
import type { MatrixClient } from '@/services/matrix/sdk'
import { isFriendManagerRegistered } from '../managerExtensions'

describe('isFriendManagerRegistered', () => {
  it('returns false for null client', () => {
    expect(isFriendManagerRegistered(null)).toBe(false)
  })

  it('returns false for client without friend manager accessor', () => {
    expect(isFriendManagerRegistered({} as MatrixClient)).toBe(false)
  })

  it('returns true when getFriendManager is a function', () => {
    const client = { getFriendManager: () => ({}) } as unknown as MatrixClient
    expect(isFriendManagerRegistered(client)).toBe(true)
  })

  it('returns true when friendManager has a start method', () => {
    const client = { friendManager: { start: () => Promise.resolve() } } as unknown as MatrixClient
    expect(isFriendManagerRegistered(client)).toBe(true)
  })

  it('returns false when friendManager lacks a start method', () => {
    const client = { friendManager: {} } as unknown as MatrixClient
    expect(isFriendManagerRegistered(client)).toBe(false)
  })

  it('returns false when friendManager is null', () => {
    const client = { friendManager: null } as unknown as MatrixClient
    expect(isFriendManagerRegistered(client)).toBe(false)
  })
})
