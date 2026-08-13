import { describe, expect, it } from 'vitest'
import { MEDIA } from '../media'

describe('MEDIA', () => {
  it('prefixes', () => {
    expect(MEDIA.DOWNLOAD_PREFIX).toBe('/_matrix/media/r0/download/')
    expect(MEDIA.MEDIA_PREFIX).toBe('/_matrix/media/')
  })
})
