import { describe, expect, it } from 'vitest'
import { MATRIX_PATHS, PREFIX_V3 } from '../paths'

describe('paths.ts top-level re-export', () => {
  it('re-exports PREFIX_V3', () => {
    expect(PREFIX_V3).toBe('/_matrix/client/v3')
  })

  it('re-exports MATRIX_PATHS with ROOM group', () => {
    expect(MATRIX_PATHS.ROOM.CREATE).toBe('/createRoom')
  })
})
