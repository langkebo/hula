import { describe, expect, it } from 'vitest'
import { SPACE } from '../space'

describe('SPACE', () => {
  it('PREFIX_V1 hierarchy endpoints', () => {
    expect(SPACE.HIERARCHY('!s:server')).toBe('/_matrix/client/v1/spaces/!s%3Aserver/hierarchy')
    expect(SPACE.HIERARCHY_V1('!s')).toBe('/_matrix/client/v1/spaces/!s/hierarchy/v1')
    expect(SPACE.ROOM_HIERARCHY('!s')).toBe('/_matrix/client/v1/rooms/!s/hierarchy')
  })

  it('constants', () => {
    expect(SPACE.CREATE).toBe('/spaces')
    expect(SPACE.PUBLIC).toBe('/spaces/public')
    expect(SPACE.SEARCH).toBe('/spaces/search')
    expect(SPACE.STATISTICS).toBe('/spaces/statistics')
    expect(SPACE.USER).toBe('/spaces/user')
  })

  it('space scoped parameterized paths', () => {
    expect(SPACE.BY_ID('!s')).toBe('/spaces/!s')
    expect(SPACE.UPDATE('!s')).toBe('/spaces/!s')
    expect(SPACE.DELETE('!s')).toBe('/spaces/!s')
    expect(SPACE.CHILDREN('!s')).toBe('/spaces/!s/children')
    expect(SPACE.CHILD_BY_ID('!s', '!r')).toBe('/spaces/!s/children/!r')
    expect(SPACE.MEMBERS('!s')).toBe('/spaces/!s/members')
    expect(SPACE.ROOMS('!s')).toBe('/spaces/!s/rooms')
    expect(SPACE.TREE_PATH('!s')).toBe('/spaces/!s/tree_path')
    expect(SPACE.SUMMARY_WITH_CHILDREN('!s')).toBe('/spaces/!s/summary/with_children')
  })

  it('room scoped paths', () => {
    expect(SPACE.BY_ROOM('!r')).toBe('/spaces/room/!r')
    expect(SPACE.PARENTS('!r')).toBe('/spaces/room/!r/parents')
  })
})
