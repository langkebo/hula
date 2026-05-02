import type { MatrixClient, Room } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('../../MatrixClientService', () => ({
  matrixClientService: {
    getClient: vi.fn(() => null as MatrixClient | null)
  }
}))

const mockWidgetsManager = {
  createWidget: vi.fn(),
  getWidgetById: vi.fn(),
  updateWidget: vi.fn(),
  deleteWidget: vi.fn(),
  listRoomWidgets: vi.fn(),
  getJitsiConfig: vi.fn(),
  getWidgetConfig: vi.fn(),
  getWidgetPermissions: vi.fn(),
  setWidgetPermission: vi.fn(),
  deleteWidgetPermission: vi.fn(),
  createWidgetSession: vi.fn(),
  listWidgetSessions: vi.fn(),
  getWidgetSession: vi.fn(),
  terminateWidgetSession: vi.fn()
}

type WidgetsManagerLike = typeof mockWidgetsManager

const mockClient = {
  getWidgetsManager: vi.fn(),
  getRoom: vi.fn(),
  sendStateEvent: vi.fn(),
  getUserId: vi.fn(() => '@user:example.com'),
  getDomain: vi.fn(() => 'example.com')
}

const { matrixClientService } = await import('../../MatrixClientService')
const { matrixWidgetService } = await import('../MatrixWidgetService')

const sdkWidget = (overrides: Record<string, unknown> = {}) => ({
  widget_id: 'widget-1',
  room_id: '!room:example.com',
  type: 'jitsi',
  url: 'https://meet.example.com',
  name: 'Meeting',
  data: {},
  ...overrides
})

describe('MatrixWidgetService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    mockClient.getWidgetsManager.mockReturnValue(mockWidgetsManager as unknown as WidgetsManagerLike)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('lists room widgets via the new plural manager', async () => {
    mockWidgetsManager.listRoomWidgets.mockResolvedValueOnce({ widgets: [sdkWidget()] })

    const result = await matrixWidgetService.getRoomWidgets('!room:example.com')

    expect(result).toEqual([
      { id: 'widget-1', type: 'jitsi', url: 'https://meet.example.com', name: 'Meeting', data: {} }
    ])
    expect(mockWidgetsManager.listRoomWidgets).toHaveBeenCalledWith('!room:example.com')
  })

  it('falls back to room state when listRoomWidgets rejects in non-throwing mode', async () => {
    mockWidgetsManager.listRoomWidgets.mockRejectedValueOnce(new Error('network error'))
    mockClient.getRoom.mockReturnValueOnce({
      currentState: {
        getStateEvents: vi.fn().mockImplementation((eventType: string) =>
          eventType === 'm.widget'
            ? [
                {
                  getContent: () => ({
                    type: 'custom',
                    url: 'https://example.com/widget',
                    name: 'Fallback Widget'
                  }),
                  getStateKey: () => 'widget-fallback'
                }
              ]
            : []
        )
      }
    } as unknown as Room)

    const result = await matrixWidgetService.getWidgets('!room:example.com', false)

    expect(result).toEqual([
      {
        id: 'widget-fallback',
        type: 'custom',
        url: 'https://example.com/widget',
        name: 'Fallback Widget',
        data: undefined
      }
    ])
  })

  it('falls back to room state when the manager is unavailable', async () => {
    mockClient.getWidgetsManager.mockReturnValueOnce(null)
    mockClient.getRoom.mockReturnValueOnce({
      currentState: {
        getStateEvents: vi.fn().mockImplementation((eventType: string) =>
          eventType === 'im.vector.modular.widgets'
            ? [
                {
                  getId: () => 'widget-state',
                  getType: () => 'im.vector.modular.widgets',
                  getContent: () => ({
                    type: 'jitsi',
                    url: 'https://meet.example.com',
                    name: 'Meeting'
                  }),
                  getStateKey: () => 'widget-state'
                }
              ]
            : []
        )
      }
    } as unknown as Room)

    const result = await matrixWidgetService.getWidgets('!room:example.com')

    expect(result).toEqual([
      {
        id: 'widget-state',
        type: 'jitsi',
        url: 'https://meet.example.com',
        name: 'Meeting',
        data: undefined
      }
    ])
  })

  it('creates a widget via createWidget with the new body shape', async () => {
    mockWidgetsManager.createWidget.mockResolvedValueOnce({ widget: sdkWidget({ widget_id: 'widget-created' }) })

    const result = await matrixWidgetService.createWidget('!room:example.com', {
      widgetType: 'custom',
      url: 'https://example.com/widget',
      name: 'Custom Widget',
      data: { foo: 'bar' }
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('widget-created')
    expect(mockWidgetsManager.createWidget).toHaveBeenCalledWith({
      room_id: '!room:example.com',
      widget_type: 'custom',
      url: 'https://example.com/widget',
      name: 'Custom Widget',
      data: { foo: 'bar' }
    })
  })

  it('addWidget façade delegates to createWidget', async () => {
    mockWidgetsManager.createWidget.mockResolvedValueOnce({ widget: sdkWidget() })

    const ok = await matrixWidgetService.addWidget('!room:example.com', 'widget-1', {
      type: 'custom',
      url: 'https://example.com/widget',
      name: 'Custom Widget'
    })

    expect(ok).toBe(true)
    expect(mockWidgetsManager.createWidget).toHaveBeenCalledWith({
      room_id: '!room:example.com',
      widget_type: 'custom',
      url: 'https://example.com/widget',
      name: 'Custom Widget',
      data: undefined
    })
  })

  it('deleteWidget (and legacy removeWidget alias) both call deleteWidget(widgetId)', async () => {
    mockWidgetsManager.deleteWidget.mockResolvedValueOnce(undefined)
    mockWidgetsManager.deleteWidget.mockResolvedValueOnce(undefined)

    expect(await matrixWidgetService.deleteWidget('widget-1')).toBe(true)
    expect(await matrixWidgetService.removeWidget('!room:example.com', 'widget-1')).toBe(true)

    expect(mockWidgetsManager.deleteWidget).toHaveBeenNthCalledWith(1, 'widget-1')
    expect(mockWidgetsManager.deleteWidget).toHaveBeenNthCalledWith(2, 'widget-1')
  })

  it('getWidgetById returns the façade shape', async () => {
    mockWidgetsManager.getWidgetById.mockResolvedValueOnce({ widget: sdkWidget() })

    const widget = await matrixWidgetService.getWidgetById('widget-1')

    expect(widget?.id).toBe('widget-1')
    expect(mockWidgetsManager.getWidgetById).toHaveBeenCalledWith('widget-1')
  })

  it('updateWidget maps façade updates onto the SDK body', async () => {
    mockWidgetsManager.updateWidget.mockResolvedValueOnce({
      widget: sdkWidget({ url: 'https://new.example.com' })
    })

    const result = await matrixWidgetService.updateWidget('widget-1', { url: 'https://new.example.com' })

    expect(result?.url).toBe('https://new.example.com')
    expect(mockWidgetsManager.updateWidget).toHaveBeenCalledWith('widget-1', {
      url: 'https://new.example.com',
      name: undefined,
      data: undefined
    })
  })

  it('setWidgetPermission wraps args into the SDK body shape', async () => {
    mockWidgetsManager.setWidgetPermission.mockResolvedValueOnce({ ok: true })

    const result = await matrixWidgetService.setWidgetPermission('widget-1', '@alice:example.com', ['read', 'write'])

    expect(result).toEqual({ ok: true })
    expect(mockWidgetsManager.setWidgetPermission).toHaveBeenCalledWith('widget-1', {
      user_id: '@alice:example.com',
      permissions: ['read', 'write']
    })
  })

  it('getWidgetPermissions returns null when the manager is unavailable', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(matrixWidgetService.getWidgetPermissions('widget-1', false)).resolves.toBeNull()
  })

  it('deleteWidgetPermission resolves true and calls SDK with widgetId + userId', async () => {
    mockWidgetsManager.deleteWidgetPermission.mockResolvedValueOnce(undefined)

    await expect(matrixWidgetService.deleteWidgetPermission('widget-1', '@alice:example.com')).resolves.toBe(true)
    expect(mockWidgetsManager.deleteWidgetPermission).toHaveBeenCalledWith('widget-1', '@alice:example.com')
  })

  it('createWidgetSession forwards option fields using snake_case', async () => {
    mockWidgetsManager.createWidgetSession.mockResolvedValueOnce({ session_id: 's-1' })

    const result = await matrixWidgetService.createWidgetSession('widget-1', {
      deviceId: 'dev-1',
      expiresInMs: 60_000
    })

    expect(result).toEqual({ session_id: 's-1' })
    expect(mockWidgetsManager.createWidgetSession).toHaveBeenCalledWith('widget-1', {
      device_id: 'dev-1',
      expires_in_ms: 60_000
    })
  })

  it('getWidgetSessions delegates to listWidgetSessions', async () => {
    mockWidgetsManager.listWidgetSessions.mockResolvedValueOnce({ sessions: [] })

    await expect(matrixWidgetService.getWidgetSessions('widget-1')).resolves.toEqual({ sessions: [] })
    expect(mockWidgetsManager.listWidgetSessions).toHaveBeenCalledWith('widget-1')
  })

  it('terminateWidgetSession resolves true on success', async () => {
    mockWidgetsManager.terminateWidgetSession.mockResolvedValueOnce(undefined)

    await expect(matrixWidgetService.terminateWidgetSession('session-1')).resolves.toBe(true)
    expect(mockWidgetsManager.terminateWidgetSession).toHaveBeenCalledWith('session-1')
  })

  it('getJitsiConfig calls the SDK with a single roomId argument', async () => {
    mockWidgetsManager.getJitsiConfig.mockResolvedValueOnce({ conf_id: 'c-1' })

    await expect(matrixWidgetService.getJitsiConfig('!room:example.com')).resolves.toEqual({ conf_id: 'c-1' })
    expect(mockWidgetsManager.getJitsiConfig).toHaveBeenCalledWith('!room:example.com')
  })

  it('getWidgetConfig calls the SDK with a single widgetId argument', async () => {
    mockWidgetsManager.getWidgetConfig.mockResolvedValueOnce({ url: 'https://example.com' })

    await expect(matrixWidgetService.getWidgetConfig('widget-1')).resolves.toEqual({ url: 'https://example.com' })
    expect(mockWidgetsManager.getWidgetConfig).toHaveBeenCalledWith('widget-1')
  })
})
