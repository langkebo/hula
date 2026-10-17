import { describe, expect, it } from 'vitest'
import { MATRIX_PATHS, PREFIX_V3 } from '../paths'

describe('paths.ts top-level re-export', () => {
  it('re-exports PREFIX_V3', () => {
    expect(PREFIX_V3).toBe('/_matrix/client/v3')
  })

  it('re-exports MATRIX_PATHS with ROOM group', () => {
    expect(MATRIX_PATHS.ROOM.REPORT_SCANNER_INFO('!r', '$e')).toBe(
      '/_matrix/vendor/v1/rooms/!r/report/%24e/scanner_info'
    )
  })
})
