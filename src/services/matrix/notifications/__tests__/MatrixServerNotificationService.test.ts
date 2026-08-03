import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '@/../tests/msw'
import { matrixServerNotificationService } from '../MatrixServerNotificationService'

const TEST_BASE_URL = 'https://matrix.example.com'

const server = setupMswServer(
  http.post(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({
      id: 1,
      title: body.title,
      content: body.content,
      level: body.level,
      read: false,
      dismissed: false
    })
  }),

  http.get(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/1`, () => {
    return HttpResponse.json({ id: 1, title: 'Test', content: 'Content', level: 'warning' })
  }),

  http.get(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/active`, () => {
    return HttpResponse.json([
      { id: 1, title: 'Test 1', content: 'Content 1' },
      { id: 2, title: 'Test 2', content: 'Content 2' }
    ])
  }),

  http.post(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/1/read`, () => {
    return HttpResponse.json({})
  }),

  http.post(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/1/dismiss`, () => {
    return HttpResponse.json({})
  }),

  http.delete(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/1`, () => {
    return HttpResponse.json({})
  }),

  http.get(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/templates`, () => {
    return HttpResponse.json({ templates: [{ name: 'template1', type: 'test' }] })
  })
)

// Mock getClient() to return a client whose authedRequest calls real fetch (MSW-interceptable)
// and whose getAdminManager().server.* also routes through fetch so MSW handlers apply.
const authedRequestImpl = async (method: string, path: string, _queryParams?: any, body?: any) => {
  const url = `${TEST_BASE_URL}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: 'Bearer test-access-token'
  }
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

vi.spyOn(matrixServerNotificationService as any, 'getClient').mockReturnValue({
  getUserId: () => '@test:example.com',
  http: {
    authedRequest: authedRequestImpl
  },
  getAdminManager: () => ({
    server: {
      createNotification: (payload: Record<string, unknown>) =>
        authedRequestImpl('POST', '/_synapse/admin/v1/server_notifications', undefined, payload),
      getNotification: (id: string) => authedRequestImpl('GET', `/_synapse/admin/v1/server_notifications/${id}`),
      listActiveNotifications: () => authedRequestImpl('GET', '/_synapse/admin/v1/server_notifications/active'),
      deactivateNotification: (id: string) =>
        authedRequestImpl('POST', `/_synapse/admin/v1/server_notifications/${id}/read`)
    }
  })
})

describe('MatrixServerNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createNotification', () => {
    it('should create notification', async () => {
      const result = await matrixServerNotificationService.createNotification({
        title: 'Test',
        content: 'Content',
        level: 'info'
      })

      expect(result).toBeTruthy()
      expect(result?.id).toBe(1)
    })

    it('should return null on error', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const result = await matrixServerNotificationService.createNotification({
        title: 'Test',
        content: 'Content',
        level: 'info'
      })

      expect(result).toBeNull()
    })
  })

  describe('getNotification', () => {
    it('should get notification by ID', async () => {
      const result = await matrixServerNotificationService.getNotification(1)

      expect(result).toBeTruthy()
      expect(result?.id).toBe(1)
    })

    it('should return null on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/999`, () => {
          return new HttpResponse(null, { status: 404 })
        })
      )

      const result = await matrixServerNotificationService.getNotification(999)

      expect(result).toBeNull()
    })
  })

  describe('listActive', () => {
    it('should list active notifications', async () => {
      const result = await matrixServerNotificationService.listActive()

      expect(result).toHaveLength(2)
    })

    it('should return empty array on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/active`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const result = await matrixServerNotificationService.listActive()

      expect(result).toEqual([])
    })
  })

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const result = await matrixServerNotificationService.markAsRead(1)

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/1/read`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const result = await matrixServerNotificationService.markAsRead(1)

      expect(result).toBe(false)
    })
  })

  describe('dismiss', () => {
    it('should dismiss notification', async () => {
      const result = await matrixServerNotificationService.dismiss(1)

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      server.use(
        http.post(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/1/dismiss`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const result = await matrixServerNotificationService.dismiss(1)

      expect(result).toBe(false)
    })
  })

  describe('delete', () => {
    it('should delete notification', async () => {
      const result = await matrixServerNotificationService.delete(1)

      expect(result).toBe(true)
    })

    it('should return false on error', async () => {
      server.use(
        http.delete(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/1`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const result = await matrixServerNotificationService.delete(1)

      expect(result).toBe(false)
    })
  })

  describe('listTemplates', () => {
    it('should list templates', async () => {
      const result = await matrixServerNotificationService.listTemplates()

      expect(Array.isArray(result)).toBe(true)
    })

    it('should return empty array on error', async () => {
      server.use(
        http.get(`${TEST_BASE_URL}/_synapse/admin/v1/server_notifications/templates`, () => {
          return new HttpResponse(null, { status: 500 })
        })
      )

      const result = await matrixServerNotificationService.listTemplates()

      expect(result).toEqual([])
    })
  })
})
