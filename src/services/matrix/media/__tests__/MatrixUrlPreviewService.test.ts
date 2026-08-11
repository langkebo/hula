import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDomain, matrixUrlPreviewService, simplifyUrl } from '../MatrixUrlPreviewService'

const { loggerSpy } = vi.hoisted(() => ({
  loggerSpy: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => loggerSpy
}))

const TEST_BASE_URL = 'https://matrix.example.com'

// Migration 2026-08-11: switched from mocking http.authedRequest to mocking
// SDK MediaManager.previewUrl. The service now calls client.getMediaManager().previewUrl(),
// which returns the raw og:* response. Field mapping logic (og:title → title) is
// verified here; URL construction is verified by urlPreview.contract.test.ts.
const previewUrlMock = vi.fn()
vi.spyOn(matrixUrlPreviewService as any, 'client', 'get').mockReturnValue({
  getUserId: () => '@test:example.com',
  getMediaApiUrl: () => TEST_BASE_URL,
  getMediaManager: () => ({ previewUrl: previewUrlMock })
})

describe('MatrixUrlPreviewService', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getPreview', () => {
    it('should return URL preview', async () => {
      previewUrlMock.mockResolvedValue({
        'og:title': 'Example Page',
        'og:description': 'A test page',
        'og:image': 'https://example.com/image.jpg'
      })

      const result = await matrixUrlPreviewService.getPreview({ url: 'https://example.com' })

      expect(result).toBeTruthy()
      expect(result?.title).toBe('Example Page')
    })

    it('should return null for empty response', async () => {
      previewUrlMock.mockResolvedValue({})

      const result = await matrixUrlPreviewService.getPreview({ url: 'https://empty-response.example.com' })

      expect(result).toBeNull()
    })

    it('should return null on error', async () => {
      previewUrlMock.mockRejectedValue(new Error('HTTP 500'))

      const result = await matrixUrlPreviewService.getPreview({ url: 'https://example.com' })

      expect(result).toBeNull()
    })
  })

  describe('getPreviews', () => {
    it('should return previews for multiple URLs', async () => {
      previewUrlMock.mockResolvedValue({ 'og:title': 'Page' })

      const urls = ['https://example.com', 'https://test.com']
      const results = await matrixUrlPreviewService.getPreviews(urls)

      expect(results.size).toBe(2)
    })
  })

  describe('extractUrlsFromMessage', () => {
    it('should extract URLs from message body', () => {
      const urls = matrixUrlPreviewService.extractUrlsFromMessage({
        body: 'Check out https://example.com and http://test.org'
      })

      expect(urls).toContain('https://example.com')
      expect(urls).toContain('http://test.org')
    })

    it('should extract matrix.to URLs', () => {
      const urls = matrixUrlPreviewService.extractUrlsFromMessage({
        body: 'Join at https://matrix.to/#/!room:example.com'
      })

      expect(urls.some((u) => u.includes('matrix.to'))).toBe(true)
    })
  })

  describe('getCachedPreview', () => {
    it('should return cached preview', () => {
      const preview = { url: 'https://example.com', title: 'Test' }
      matrixUrlPreviewService.cachePreview('https://example.com', preview)

      const result = matrixUrlPreviewService.getCachedPreview('https://example.com')
      expect(result).toEqual(preview)
    })

    it('should return null for expired cache', async () => {
      const preview = { url: 'https://example.com', title: 'Test' }
      matrixUrlPreviewService.cachePreview('https://example.com', preview)

      matrixUrlPreviewService.clearCache()

      const result = matrixUrlPreviewService.getCachedPreview('https://example.com')
      expect(result).toBeNull()
    })
  })

  describe('simplifyUrl', () => {
    it('should simplify URL for display', () => {
      expect(simplifyUrl('https://example.com/path/to/page')).toBe('example.com/path/to/page')
    })

    it('should truncate long URLs', () => {
      const long = 'https://example.com/' + 'a'.repeat(50)
      const result = simplifyUrl(long)
      expect(result.length).toBeLessThan(long.length)
    })
  })

  describe('getDomain', () => {
    it('should extract domain from URL', () => {
      expect(getDomain('https://example.com/page')).toBe('example.com')
    })

    it('should return empty string for invalid URL', () => {
      expect(getDomain('not-a-url')).toBe('')
    })
  })
})

describe('R-18: error logging', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('logs a warning when getDomain throws and returns empty string', () => {
    const result = getDomain('not-a-url')

    expect(result).toBe('')
    expect(loggerSpy.warn).toHaveBeenCalledTimes(1)
    expect(loggerSpy.warn).toHaveBeenCalledWith('getDomain failed:', expect.any(Error))
  })
})
