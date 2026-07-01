// src/composables/mobile/__tests__/usePushReceiver.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePushReceiver } from '../usePushReceiver'

const mockIsPermissionGranted = vi.fn()
const mockRequestPermission = vi.fn()
const mockSendNotification = vi.fn()

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: () => mockIsPermissionGranted(),
  requestPermission: () => mockRequestPermission(),
  sendNotification: (opts: any) => mockSendNotification(opts)
}))

describe('usePushReceiver', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsPermissionGranted.mockResolvedValue(false)
  })

  it('returns notifications as empty array initially', () => {
    const { notifications } = usePushReceiver()
    expect(notifications.value).toEqual([])
  })

  it('adds a notification via receivePush and preserves order', () => {
    const { notifications, receivePush } = usePushReceiver()

    receivePush({ id: '1', title: 'Test', body: 'Body 1' })
    receivePush({ id: '2', title: 'Test 2', body: 'Body 2' })

    expect(notifications.value).toHaveLength(2)
    expect(notifications.value[0].id).toBe('1')
    expect(notifications.value[1].id).toBe('2')
  })

  it('removes a notification by id', () => {
    const { notifications, receivePush, removeNotification } = usePushReceiver()

    receivePush({ id: '1', title: 'Test', body: 'Body' })
    receivePush({ id: '2', title: 'Test 2', body: 'Body 2' })
    removeNotification('1')

    expect(notifications.value).toHaveLength(1)
    expect(notifications.value[0].id).toBe('2')
  })

  it('clearAll empties the notification list', () => {
    const { notifications, receivePush, clearAll } = usePushReceiver()

    receivePush({ id: '1', title: 'A', body: 'B' })
    receivePush({ id: '2', title: 'C', body: 'D' })
    clearAll()

    expect(notifications.value).toEqual([])
  })

  it('requestPermission resolves with the permission status', async () => {
    mockRequestPermission.mockResolvedValue('granted')
    const { requestPermission } = usePushReceiver()

    const result = await requestPermission()
    expect(result).toBe('granted')
  })

  it('initial hasPermission is set from isPermissionGranted', async () => {
    mockIsPermissionGranted.mockResolvedValue(true)
    const { hasPermission } = usePushReceiver()

    // Wait for the promise in the composable to resolve
    await vi.waitFor(() => {
      expect(hasPermission.value).toBe(true)
    })
  })
})
