import { beforeEach, describe, expect, it, vi } from 'vitest'
import { extractLinkSegments, normalizeExternalUrl, openExternalUrl } from '@/composables/common/useLinkSegments'

const openShellMock = vi.fn()
const windowOpenMock = vi.fn()

vi.mock('@tauri-apps/plugin-shell', () => ({
  open: (...args: unknown[]) => openShellMock(...args)
}))

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

describe('useLinkSegments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.open = windowOpenMock as typeof window.open
  })

  describe('extractLinkSegments', () => {
    it('returns empty array for empty string', () => {
      expect(extractLinkSegments('')).toEqual([])
    })

    it('returns empty array for null-ish input', () => {
      expect(extractLinkSegments(null as unknown as string)).toEqual([])
      expect(extractLinkSegments(undefined as unknown as string)).toEqual([])
    })

    it('returns single non-link segment for plain text', () => {
      const result = extractLinkSegments('hello world')
      expect(result).toEqual([{ text: 'hello world', isLink: false }])
    })

    it('detects http links', () => {
      const result = extractLinkSegments('visit http://example.com now')
      expect(result).toHaveLength(3)
      expect(result[0]).toEqual({ text: 'visit ', isLink: false })
      expect(result[1]).toEqual({ text: 'http://example.com', isLink: true })
      expect(result[2]).toEqual({ text: ' now', isLink: false })
    })

    it('detects https links', () => {
      const result = extractLinkSegments('https://secure.example.com/path')
      expect(result).toHaveLength(1)
      expect(result[0].isLink).toBe(true)
    })

    it('handles multiple links', () => {
      const result = extractLinkSegments('see http://a.com and https://b.com')
      const links = result.filter((s) => s.isLink)
      expect(links).toHaveLength(2)
      expect(links[0].text).toBe('http://a.com')
      expect(links[1].text).toBe('https://b.com')
    })

    it('handles links at start of string', () => {
      const result = extractLinkSegments('https://start.com is the link')
      expect(result[0]).toEqual({ text: 'https://start.com', isLink: true })
    })

    it('handles links at end of string', () => {
      const result = extractLinkSegments('link is https://end.com')
      expect(result[result.length - 1]).toEqual({ text: 'https://end.com', isLink: true })
    })

    it('replaces &nbsp; with unicode space', () => {
      const result = extractLinkSegments('hello&nbsp;world')
      expect(result[0].text).toContain('\u00a0')
    })

    it('handles complex URLs with paths and params', () => {
      const url = 'https://example.com/path/to/page?q=test&page=1#section'
      const result = extractLinkSegments(url)
      expect(result).toHaveLength(1)
      expect(result[0].isLink).toBe(true)
      expect(result[0].text).toBe(url)
    })
  })

  describe('normalizeExternalUrl', () => {
    it('returns empty for empty input', () => {
      expect(normalizeExternalUrl('')).toBe('')
    })

    it('returns empty for whitespace', () => {
      expect(normalizeExternalUrl('   ')).toBe('')
    })

    it('preserves http URLs', () => {
      expect(normalizeExternalUrl('http://example.com')).toBe('http://example.com')
    })

    it('preserves https URLs', () => {
      expect(normalizeExternalUrl('https://example.com')).toBe('https://example.com')
    })

    it('preserves mailto URLs', () => {
      expect(normalizeExternalUrl('mailto:test@example.com')).toBe('mailto:test@example.com')
    })

    it('adds https to bare domains', () => {
      expect(normalizeExternalUrl('example.com')).toBe('https://example.com')
    })

    it('trims whitespace', () => {
      expect(normalizeExternalUrl('  https://example.com  ')).toBe('https://example.com')
    })

    it('handles null/undefined safely', () => {
      expect(normalizeExternalUrl(null as unknown as string)).toBe('')
      expect(normalizeExternalUrl(undefined as unknown as string)).toBe('')
    })

    it('rejects unsupported protocols', () => {
      expect(normalizeExternalUrl('javascript:alert(1)')).toBe('')
      expect(normalizeExternalUrl('file:///tmp/test')).toBe('')
      expect(normalizeExternalUrl('ftp://example.com')).toBe('')
    })
  })

  describe('openExternalUrl', () => {
    it('opens allowed URLs with shell first', async () => {
      await openExternalUrl('https://example.com')

      expect(openShellMock).toHaveBeenCalledWith('https://example.com')
      expect(windowOpenMock).not.toHaveBeenCalled()
    })

    it('falls back to window.open when shell open fails', async () => {
      openShellMock.mockRejectedValueOnce(new Error('shell unavailable'))

      await openExternalUrl('example.com')

      expect(windowOpenMock).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
    })

    it('does not open rejected protocols', async () => {
      const result = await openExternalUrl('javascript:alert(1)')

      expect(result).toBe(false)
      expect(openShellMock).not.toHaveBeenCalled()
      expect(windowOpenMock).not.toHaveBeenCalled()
    })
  })
})
