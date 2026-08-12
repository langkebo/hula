import { describe, expect, it } from 'vitest'
import { MATRIX_PATHS } from '../index'

describe('paths single source of truth', () => {
  it('MATRIX_PATHS is defined', () => {
    expect(MATRIX_PATHS).toBeDefined()
  })

  it('SDK_PATHS marker exists for SDK-sourced constants', async () => {
    const mod = await import('../index')
    expect(mod.SDK_PATHS).toBeDefined()
    expect(Array.isArray(mod.SDK_PATHS)).toBe(true)
    expect(mod.SDK_PATHS.length).toBeGreaterThan(0)
  })
})
