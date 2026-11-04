import { describe, expect, it } from 'vitest'
import { usePlatform } from '../usePlatform'

describe('usePlatform', () => {
  it('returns platform info without the removed isLandscape field', () => {
    const info = usePlatform()
    expect(info).not.toHaveProperty('isLandscape')
    expect(['desktop', 'mobile']).toContain(info.platform)
  })
})
