import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  locateSettingsAnchor,
  SETTINGS_ANCHOR_HIGHLIGHT_CLASS,
  SETTINGS_ANCHOR_HIGHLIGHT_MS,
  scrollToSettingsAnchor
} from '../settingsAnchorNavigation'

function stubReducedMotion(reducedMotion: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reducedMotion && query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }))
  )
}

function mountAnchor(anchorId: string) {
  const anchor = document.createElement('div')
  anchor.dataset.settingsAnchor = anchorId
  const scrollIntoView = vi.fn()
  anchor.scrollIntoView = scrollIntoView
  document.body.appendChild(anchor)
  return { anchor, scrollIntoView }
}

describe('settingsAnchorNavigation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('常规模式使用平滑滚动并保留 2s 高亮', () => {
    stubReducedMotion(false)
    const { anchor, scrollIntoView } = mountAnchor('appearance-theme')

    expect(scrollToSettingsAnchor('appearance-theme')).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
    expect(anchor.classList.contains(SETTINGS_ANCHOR_HIGHLIGHT_CLASS)).toBe(true)

    vi.advanceTimersByTime(SETTINGS_ANCHOR_HIGHLIGHT_MS)
    expect(anchor.classList.contains(SETTINGS_ANCHOR_HIGHLIGHT_CLASS)).toBe(false)
  })

  it('reduced motion 下退化为即时滚动', () => {
    stubReducedMotion(true)
    const { scrollIntoView } = mountAnchor('appearance-theme')

    expect(scrollToSettingsAnchor('appearance-theme')).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' })
  })

  it('锚点不存在时返回 false 且不抛错', async () => {
    stubReducedMotion(false)

    expect(scrollToSettingsAnchor('missing-anchor')).toBe(false)
    await expect(locateSettingsAnchor('missing-anchor')).resolves.toBe(false)
  })
})
