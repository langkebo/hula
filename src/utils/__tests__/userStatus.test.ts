import { describe, expect, it } from 'vitest'
import { mapUserStateToPresence } from '../userStatus'

describe('mapUserStateToPresence', () => {
  it('returns online for id 0 regardless of title', () => {
    expect(mapUserStateToPresence({ id: '0', title: 'whatever' })).toBe('online')
  })

  it('returns online for id 1 regardless of title', () => {
    expect(mapUserStateToPresence({ id: '1', title: 'foo' })).toBe('online')
  })

  it('returns online when title contains "online"', () => {
    expect(mapUserStateToPresence({ id: '5', title: 'Online' })).toBe('online')
    expect(mapUserStateToPresence({ id: '5', title: 'online status' })).toBe('online')
  })

  it('returns online when title contains 在线', () => {
    expect(mapUserStateToPresence({ id: '5', title: '在线' })).toBe('online')
  })

  it('returns offline when title contains "offline"', () => {
    expect(mapUserStateToPresence({ id: '7', title: 'Offline' })).toBe('offline')
  })

  it('returns offline when title contains 离线/隐身/invisible', () => {
    expect(mapUserStateToPresence({ id: '7', title: '离线' })).toBe('offline')
    expect(mapUserStateToPresence({ id: '8', title: '隐身' })).toBe('offline')
    expect(mapUserStateToPresence({ id: '9', title: 'Invisible' })).toBe('offline')
  })

  it('returns unavailable for non-matching titles', () => {
    expect(mapUserStateToPresence({ id: '4', title: '忙碌' })).toBe('unavailable')
    expect(mapUserStateToPresence({ id: '4', title: '' })).toBe('unavailable')
    expect(mapUserStateToPresence({ id: '4', title: '   ' })).toBe('unavailable')
  })

  it('trims whitespace before comparing the title', () => {
    expect(mapUserStateToPresence({ id: '5', title: '  online  ' })).toBe('online')
  })
})
