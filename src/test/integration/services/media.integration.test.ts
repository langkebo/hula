/**
 * MatrixMediaService 集成测试
 * 测试与真实后端服务器的媒体交互
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { INTEGRATION_TEST_CONFIG, isIntegrationTestEnabled } from '../config'
import { createTestUser, cleanupTestResources, checkServerHealth, TestUser } from '../fixtures'

describe.skipIf(!isIntegrationTestEnabled())('MatrixMediaService Integration Tests', () => {
  let testUser: TestUser
  let accessToken: string

  beforeAll(async () => {
    const serverOk = await checkServerHealth()
    if (!serverOk) {
      throw new Error('Backend server is not running.')
    }
  }, INTEGRATION_TEST_CONFIG.timeout.medium)

  afterAll(async () => {
    await cleanupTestResources()
  }, INTEGRATION_TEST_CONFIG.timeout.long)

  beforeEach(async () => {
    testUser = await createTestUser()
    accessToken = testUser.accessToken
  })

  describe('upload', () => {
    it('should upload small file', async () => {
      const content = new Blob(['Integration test content'], { type: 'text/plain' })
      const filename = 'test.txt'

      const formData = new FormData()
      formData.append('file', content, filename)

      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/media/v3/upload?filename=${filename}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: content
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.content_uri).toBeDefined()
      expect(data.content_uri).toMatch(/^mxc:\/\//)
    })

    it('should upload image file', async () => {
      const content = new Blob(
        [
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00,
            0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
            0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f, 0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc,
            0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
          ])
        ],
        { type: 'image/png' }
      )

      const response = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/media/v3/upload?filename=test.png`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'image/png'
          },
          body: content
        }
      )

      expect(response.ok).toBe(true)
      const data = await response.json()
      expect(data.content_uri).toBeDefined()
    })
  })

  describe('download', () => {
    it('should download uploaded file', async () => {
      const content = new Blob(['Download test content'], { type: 'text/plain' })

      const uploadResponse = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/media/v3/upload?filename=download_test.txt`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: content
        }
      )

      const { content_uri } = await uploadResponse.json()
      expect(content_uri).toBeDefined()

      const mxcMatch = content_uri.match(/mxc:\/\/([^/]+)\/(.+)/)
      expect(mxcMatch).not.toBeNull()

      if (mxcMatch) {
        const [, serverName, mediaId] = mxcMatch
        const downloadResponse = await fetch(
          `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/media/v3/download/${serverName}/${mediaId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        )

        expect(downloadResponse.ok).toBe(true)
        const downloadedContent = await downloadResponse.text()
        expect(downloadedContent).toBe('Download test content')
      }
    })
  })

  describe('thumbnail', () => {
    it('should get thumbnail for image', async () => {
      const pngContent = new Blob(
        [
          Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00,
            0x00, 0x10, 0x00, 0x00, 0x00, 0x10, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
            0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xff, 0xff, 0x3f, 0x00, 0x05, 0xfe, 0x02, 0xfe, 0xdc,
            0xcc, 0x59, 0xe7, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
          ])
        ],
        { type: 'image/png' }
      )

      const uploadResponse = await fetch(
        `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/media/v3/upload?filename=thumb_test.png`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'image/png'
          },
          body: pngContent
        }
      )

      const { content_uri } = await uploadResponse.json()
      const mxcMatch = content_uri.match(/mxc:\/\/([^/]+)\/(.+)/)

      if (mxcMatch) {
        const [, serverName, mediaId] = mxcMatch
        const thumbResponse = await fetch(
          `${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/media/v3/thumbnail/${serverName}/${mediaId}?width=32&height=32&method=scale`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        )

        expect(thumbResponse.ok).toBe(true)
      }
    })
  })

  describe('config', () => {
    it('should get media config', async () => {
      const response = await fetch(`${INTEGRATION_TEST_CONFIG.homeserverUrl}/_matrix/media/v3/config`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      expect(response.ok).toBe(true)
      const config = await response.json()
      expect(config.m.upload.size).toBeDefined()
    })
  })
})
