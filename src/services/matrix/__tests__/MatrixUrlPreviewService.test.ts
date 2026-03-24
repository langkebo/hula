import { describe, it, expect, vi, beforeEach } from 'vitest'
import { matrixUrlPreviewService, simplifyUrl, getDomain } from '../MatrixUrlPreviewService'

// Mock MatrixClientService
vi.mock('@/services/matrix/MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => ({
      getUserId: vi.fn(() => '@test:example.com'),
      getMediaApiUrl: vi.fn(() => 'https://example.com/_matrix/media'),
      http: {
        authedRequest: vi.fn()
      }
    }))
  }
}))

describe('MatrixUrlPreviewService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPreview', () => {
    it('should return URL preview', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        'og:title': 'Example Page',
        'og:description': 'A test page',
        'og:image': 'https://example.com/image.jpg'
      })

      const result = await matrixUrlPreviewService.getPreview({ url: 'https://example.com' })

      expect(result).toBeTruthy()
      expect(result?.title).toBe('Example Page')
    })

    it('should return null for empty response', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({})

      const result = await matrixUrlPreviewService.getPreview({ url: 'https://example.com' })

      expect(result).toBeNull()
    })
  })

  describe('getPreviews', () => {
    it('should return previews for multiple URLs', async () => {
      const mockClient = await import('@/services/matrix/MatrixClientService')
      const client = (mockClient.matrixClientService as any).getClient()

      vi.mocked(client.http.authedRequest).mockResolvedValue({
        'og:title': 'Page'
      })

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

      // Clear cache manually
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
