import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('usePlatform isLandscape', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns true when window is landscape', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    )
    const { usePlatform } = await import('../usePlatform')
    const { isLandscape } = usePlatform()
    expect(isLandscape).toBe(true)
  })

  it('returns false when window is portrait', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      })
    )
    const { usePlatform } = await import('../usePlatform')
    const { isLandscape } = usePlatform()
    expect(isLandscape).toBe(false)
  })
})
