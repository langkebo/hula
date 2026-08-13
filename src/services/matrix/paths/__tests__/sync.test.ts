import { describe, expect, it } from 'vitest'
import { SYNC } from '../sync'

describe('SYNC', () => {
  it('SLIDING_SYNC_CANDIDATES lists both unstable and v4 endpoints', () => {
    expect(SYNC.SLIDING_SYNC_CANDIDATES).toEqual([
      '/_matrix/client/unstable/org.matrix.simplified_msc3575/sync',
      '/_matrix/client/v4/sync'
    ])
  })
})
