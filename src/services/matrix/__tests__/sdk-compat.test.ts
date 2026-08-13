import { describe, expect, it } from 'vitest'

describe('sdk-compat', () => {
  it('can be imported without throwing', async () => {
    const mod = await import('../sdk-compat')
    expect(mod).toBeDefined()
  })

  it('exposes only the type-only space re-exports (no runtime exports)', async () => {
    const mod = await import('../sdk-compat')
    // The module is a pure type-only re-export shim: it has no runtime
    // exports other than the module namespace itself.
    expect(Object.keys(mod).sort()).toEqual([])
  })
})
