import { describe, expect, it } from 'vitest'
import { RELATIONS } from '../relations'

describe('RELATIONS', () => {
  it('BASE encodes roomId and eventId', () => {
    expect(RELATIONS.BASE('!r:server', '$e')).toBe('/rooms/!r%3Aserver/relations/%24e')
  })

  it('BY_TYPE appends encoded relType', () => {
    expect(RELATIONS.BY_TYPE('!r', '$e', 'm.annotation')).toBe('/rooms/!r/relations/%24e/m.annotation')
  })

  it('SEND appends relType and txnId', () => {
    expect(RELATIONS.SEND('!r', '$e', 'm.reaction', 'txn001')).toBe('/rooms/!r/relations/%24e/m.reaction/txn001')
  })

  it('AGGREGATIONS uses aggregations prefix', () => {
    expect(RELATIONS.AGGREGATIONS('!r', '$e', 'm.annotation')).toBe('/rooms/!r/aggregations/%24e/m.annotation')
  })
})
