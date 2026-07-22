import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { uploadService } from '@/services/UploadService'

const TEST_BASE_URL = 'https://matrix.test'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('UploadService', () => {
  describe('getOssToken', () => {
    it('returns parsed token on 200', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/_matrix/client/v3/upload/token`, () =>
          HttpResponse.json({ uploadUrl: 'https://oss.example/up' })
        )
      )
      const result = await uploadService.getOssToken({
        filename: 'test.png'
      })
      expect(result).toEqual({ uploadUrl: 'https://oss.example/up' })
    })

    it('returns null on 404 (graceful degradation)', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/_matrix/client/v3/upload/token`, () => new HttpResponse(null, { status: 404 }))
      )
      const result = await uploadService.getOssToken({
        filename: 'test.png'
      })
      expect(result).toBeNull()
    })

    it('returns null on network errors', async () => {
      server.use(http.post(`${TEST_BASE_URL}/_matrix/client/v3/upload/token`, () => HttpResponse.error()))
      const result = await uploadService.getOssToken({
        filename: 'test.png'
      })
      expect(result).toBeNull()
    })
  })

  describe('getUploadProvider', () => {
    it('returns provider info on 200', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v3/upload/provider`, () => HttpResponse.json({ provider: 'minio' }))
      )
      const result = await uploadService.getUploadProvider()
      expect(result.provider).toBe('minio')
    })

    it('returns default provider on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_matrix/client/v3/upload/provider`, () => new HttpResponse(null, { status: 500 }))
      )
      const result = await uploadService.getUploadProvider()
      expect(result.provider).toBe('default')
    })

    it('returns default provider on network error', async () => {
      server.use(http.get(`${TEST_BASE_URL}/_matrix/client/v3/upload/provider`, () => HttpResponse.error()))
      const result = await uploadService.getUploadProvider()
      expect(result.provider).toBe('default')
    })
  })
})
