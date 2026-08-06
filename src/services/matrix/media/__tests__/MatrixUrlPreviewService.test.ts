import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
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
// The MatrixUrlPreviewService uses authedRequestWithPath, which calls the
// first overload: authedRequest(method, path, queryParams, body, { prefix }).
// The mock reconstructs the full URL from prefix + path + queryParams and hits MSW.
vi.spyOn(matrixUrlPreviewService as any, 'client', 'get').mockReturnValue({
  getUserId: () => '@test:example.com',
  getMediaApiUrl: () => TEST_BASE_URL,
  http: {
    authedRequest: async (
      method: string,
      path: string,
      queryParams?: Record<string, string>,
      _body?: unknown,
      opts?: { prefix?: string }
    ) => {
      const prefix = opts?.prefix ?? ''
      const queryString =
        queryParams && Object.keys(queryParams).length ? '?' + new URLSearchParams(queryParams).toString() : ''
      const url = `${TEST_BASE_URL}${prefix}${path}${queryString}`
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
