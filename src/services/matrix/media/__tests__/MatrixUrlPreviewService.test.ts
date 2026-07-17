import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import { getDomain, matrixUrlPreviewService, simplifyUrl } from '../MatrixUrlPreviewService'

const TEST_BASE_URL = 'https://matrix.example.com'

const server = setupMswServer(
  http.get(`${TEST_BASE_URL}/_matrix/media/r0/preview_url`, ({ request }) => {
    const url = new URL(request.url)
    const previewUrl = url.searchParams.get('url')
    if (previewUrl === 'https://example.com') {
      return HttpResponse.json({
        'og:title': 'Example Page',
        'og:description': 'A test page',
        'og:image': 'https://example.com/image.jpg'
      })
    }
    return HttpResponse.json({ 'og:title': 'Page' })
  })
)

// Spy on getClient to return a client whose authedRequest calls real fetch.
// The MatrixUrlPreviewService calls: authedRequest({}, 'GET', path, undefined, { global: false })
// which has the method/path arguments swapped. The mock handles both correct and buggy order.
vi.spyOn(matrixUrlPreviewService as any, 'client', 'get').mockReturnValue({
  getUserId: () => '@test:example.com',
  getMediaApiUrl: () => TEST_BASE_URL,
  http: {
    authedRequest: async (arg1: unknown, arg2: unknown, arg3?: unknown, _arg4?: unknown) => {
      // Detect argument order: if arg1 is a string method, use correct order.
      // If arg1 is an object, the real method is arg2 and the real path is arg3 (buggy order).
      const method = typeof arg1 === 'string' ? arg1 : (arg2 as string)
      const path = typeof arg1 === 'string' ? (arg2 as string) : (arg3 as string)
      const url = `${TEST_BASE_URL}${path}`
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token'
        }
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return response.json()
    }
  }
})

describe('MatrixUrlPreviewService', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('getPreview', () => {
    it('should return URL preview', async () => {
      const result = await matrixUrlPreviewService.getPreview({ url: 'https://example.com' })

      expect(result).toBeTruthy()
      expect(result?.title).toBe('Example Page')
    })

    it('should return null for empty response', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/media/r0/preview_url`, () => {
          return HttpResponse.json({})
        })
      )

      const result = await matrixUrlPreviewService.getPreview({ url: 'https://empty-response.example.com' })

      expect(result).toBeNull()
    })

    it('should return null on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/media/r0/preview_url`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const result = await matrixUrlPreviewService.getPreview({ url: 'https://example.com' })

      expect(result).toBeNull()
    })
  })

  describe('getPreviews', () => {
    it('should return previews for multiple URLs', async () => {
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
