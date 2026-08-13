import { describe, expect, it } from 'vitest'
import { MATRIX_PATHS, PREFIX_V3 } from '../index'

describe('paths/index aggregate', () => {
  it('re-exports PREFIX_V3', () => {
    expect(PREFIX_V3).toBe('/_matrix/client/v3')
  })

  it('MATRIX_PATHS exposes all module groups', () => {
    expect(MATRIX_PATHS.AUTH).toBeDefined()
    expect(MATRIX_PATHS.ROOM).toBeDefined()
    expect(MATRIX_PATHS.BURN).toBeDefined()
    expect(MATRIX_PATHS.FRIENDS).toBeDefined()
    expect(MATRIX_PATHS.CRYPTO).toBeDefined()
    expect(MATRIX_PATHS.SPACE).toBeDefined()
    expect(MATRIX_PATHS.AI).toBeDefined()
    expect(MATRIX_PATHS.SYNC).toBeDefined()
    expect(MATRIX_PATHS.NOTIFICATION).toBeDefined()
    expect(MATRIX_PATHS.MEDIA).toBeDefined()
    expect(MATRIX_PATHS.USER).toBeDefined()
    expect(MATRIX_PATHS.ADMIN).toBeDefined()
    expect(MATRIX_PATHS.RENDEZVOUS).toBeDefined()
    expect(MATRIX_PATHS.VOICE).toBeDefined()
    expect(MATRIX_PATHS.WELL_KNOWN).toBeDefined()
    expect(MATRIX_PATHS.CLIENT_CONFIG).toBeDefined()
    expect(MATRIX_PATHS.GUEST).toBeDefined()
    expect(MATRIX_PATHS.ACCOUNT_DATA).toBeDefined()
    expect(MATRIX_PATHS.RELATIONS).toBeDefined()
    expect(MATRIX_PATHS.WIDGET).toBeDefined()
    expect(MATRIX_PATHS.MODERATION).toBeDefined()
  })

  it('MATRIX_PATHS.EXTENSIONS is populated from backend endpoints', () => {
    expect(MATRIX_PATHS.EXTENSIONS).toBeDefined()
    expect(Object.keys(MATRIX_PATHS.EXTENSIONS).length).toBeGreaterThan(0)
  })
})
