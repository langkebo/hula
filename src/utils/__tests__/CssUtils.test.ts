import { afterEach, describe, expect, it, vi } from 'vitest'
import { cssVar } from '../CssUtils'

describe('cssVar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns empty string in non-browser environment', () => {
    vi.stubGlobal('window', undefined)
    expect(cssVar('--hula-color-primary-500')).toBe('')
  })

  it('returns CSS variable value when present', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: vi.fn(() => '#13987f')
    } as unknown as CSSStyleDeclaration)

    expect(cssVar('--hula-color-primary-500')).toBe('#13987f')
    expect(window.getComputedStyle).toHaveBeenCalledWith(document.documentElement)
  })

  it('returns empty string when CSS variable is missing', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: vi.fn(() => '')
    } as unknown as CSSStyleDeclaration)

    expect(cssVar('--missing-var')).toBe('')
  })

  it('trims whitespace from returned value', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: vi.fn(() => '   #13987f   ')
    } as unknown as CSSStyleDeclaration)

    expect(cssVar('--hula-color-primary-500')).toBe('#13987f')
  })
})
