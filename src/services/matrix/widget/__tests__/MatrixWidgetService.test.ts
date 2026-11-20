import type { MatrixClient } from 'matrix-js-sdk'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  makeJitsiConfig,
  makeRoomStateStub,
  makeRoomWidgetsResponse,
  makeSdkWidget,
  makeSdkWidgetListItem,
  makeSetPermissionResponse,
  makeWidgetCapabilities,
  makeWidgetConfig,
  makeWidgetSessionItem,
  makeWidgetSessionResponse,
  makeWidgetSessionsResponse
} from '@/services/matrix/widget/__tests__/fixtures/widget'

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

const mockWidgetManager = {
  createWidget: vi.fn(),
  getWidget: vi.fn(),
  updateWidget: vi.fn(),
  deleteWidget: vi.fn(),
  getRoomWidgets: vi.fn(),
  getJitsiConfig: vi.fn(),
  getWidgetConfig: vi.fn(),
  getWidgetPermissions: vi.fn(),
  setWidgetPermissions: vi.fn(),
  removeWidgetPermission: vi.fn(),
  createWidgetSession: vi.fn(),
  getWidgetSessions: vi.fn(),
  getWidgetSession: vi.fn(),
  deleteWidgetSession: vi.fn(),
  setWidgetCapabilities: vi.fn(),
  getWidgetCapabilities: vi.fn()
}

type WidgetManagerLike = typeof mockWidgetManager

const mockClient = {
  getWidgetManager: vi.fn(),
  getRoom: vi.fn(),
  sendStateEvent: vi.fn(),
  getUserId: vi.fn(() => '@user:example.com'),
  getDomain: vi.fn(() => 'example.com')
}

const { matrixClientService } = await import('../../MatrixClientService')
const { matrixWidgetService } = await import('../MatrixWidgetService')

describe('MatrixWidgetService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(matrixClientService.getClient).mockReturnValue(mockClient as unknown as MatrixClient)
    mockClient.getWidgetManager.mockReturnValue(mockWidgetManager as unknown as WidgetManagerLike)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('lists room widgets via the new plural manager', async () => {
    mockWidgetManager.getRoomWidgets.mockResolvedValueOnce(
      makeRoomWidgetsResponse([makeSdkWidgetListItem({ widget_id: 'widget-1', widget_type: 'jitsi' })])
    )

    const result = await matrixWidgetService.getRoomWidgets('!room:example.com')

    expect(result).toEqual([
      { id: 'widget-1', type: 'jitsi', url: 'https://meet.example.com', name: 'Meeting', data: {} }
    ])
    expect(mockWidgetManager.getRoomWidgets).toHaveBeenCalledWith('!room:example.com')
  })

  it('falls back to room state when listRoomWidgets rejects in non-throwing mode', async () => {
    mockWidgetManager.getRoomWidgets.mockRejectedValueOnce(new Error('network error'))
    mockClient.getRoom.mockReturnValueOnce(
      makeRoomStateStub({
        'm.widget': [
          {
            stateKey: 'widget-fallback',
            content: { type: 'custom', url: 'https://example.com/widget', name: 'Fallback Widget' }
          }
        ]
      })
    )

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
    mockClient.getWidgetManager.mockReturnValueOnce(null)
    mockClient.getRoom.mockReturnValueOnce(
      makeRoomStateStub({
        'im.vector.modular.widgets': [
          {
            stateKey: 'widget-state',
            content: { type: 'jitsi', url: 'https://meet.example.com', name: 'Meeting' }
          }
        ]
      })
    )

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

  it('setWidgetCapabilities 把能力数组直接交给 SDK setWidgetCapabilities', async () => {
    const capabilities = makeWidgetCapabilities({ capabilities: ['m.text', 'm.capability.screenshot'] })
    mockWidgetManager.setWidgetCapabilities.mockResolvedValueOnce(capabilities)

    const result = await matrixWidgetService.setWidgetCapabilities('!room:example.com', 'widget-1', [
      'm.text',
      'm.capability.screenshot'
    ])

    // 新层签名收的是能力数组本身，`{ capabilities }` 的包装由 SDK 内部完成
    expect(mockWidgetManager.setWidgetCapabilities).toHaveBeenCalledWith('!room:example.com', 'widget-1', [
      'm.text',
      'm.capability.screenshot'
    ])
    expect(result).toEqual(capabilities)
  })

  it('creates a widget via createWidget with the new body shape', async () => {
    mockWidgetManager.createWidget.mockResolvedValueOnce(makeSdkWidget({ widget_id: 'widget-created' }))

    const result = await matrixWidgetService.createWidget('!room:example.com', {
      widgetType: 'custom',
      url: 'https://example.com/widget',
      name: 'Custom Widget',
      data: { foo: 'bar' }
    })

    expect(result).not.toBeNull()
    expect(result?.id).toBe('widget-created')
    expect(mockWidgetManager.createWidget).toHaveBeenCalledWith({
      room_id: '!room:example.com',
      widget_type: 'custom',
      url: 'https://example.com/widget',
      name: 'Custom Widget',
      data: { foo: 'bar' }
    })
  })

  it('addWidget façade delegates to createWidget', async () => {
    mockWidgetManager.createWidget.mockResolvedValueOnce(makeSdkWidget())

    const ok = await matrixWidgetService.addWidget('!room:example.com', 'widget-1', {
      type: 'custom',
      url: 'https://example.com/widget',
      name: 'Custom Widget'
    })

    expect(ok).toBe(true)
    expect(mockWidgetManager.createWidget).toHaveBeenCalledWith({
      room_id: '!room:example.com',
      widget_type: 'custom',
      url: 'https://example.com/widget',
      name: 'Custom Widget',
      data: undefined
    })
  })

  it('deleteWidget (and legacy removeWidget alias) both call deleteWidget(widgetId)', async () => {
    mockWidgetManager.deleteWidget.mockResolvedValueOnce(undefined)
    mockWidgetManager.deleteWidget.mockResolvedValueOnce(undefined)

    expect(await matrixWidgetService.deleteWidget('widget-1')).toBe(true)
    expect(await matrixWidgetService.removeWidget('widget-1')).toBe(true)

    expect(mockWidgetManager.deleteWidget).toHaveBeenNthCalledWith(1, 'widget-1')
    expect(mockWidgetManager.deleteWidget).toHaveBeenNthCalledWith(2, 'widget-1')
  })

  it('getWidgetById returns the façade shape', async () => {
    mockWidgetManager.getWidget.mockResolvedValueOnce(makeSdkWidget())

    const widget = await matrixWidgetService.getWidgetById('widget-1')

    expect(widget?.id).toBe('widget-1')
    expect(mockWidgetManager.getWidget).toHaveBeenCalledWith('widget-1')
  })

  it('updateWidget maps façade updates onto the SDK body', async () => {
    // 后端返回**扁平** WidgetApiResponse（不是 `{widget}` 信封）
    mockWidgetManager.updateWidget.mockResolvedValueOnce(makeSdkWidget({ url: 'https://new.example.com' }))

    const result = await matrixWidgetService.updateWidget('widget-1', { url: 'https://new.example.com' })

    expect(result?.url).toBe('https://new.example.com')
    expect(mockWidgetManager.updateWidget).toHaveBeenCalledWith('widget-1', {
      url: 'https://new.example.com',
      name: undefined,
      data: undefined
    })
  })

  it('setWidgetPermission wraps args into the SDK body shape', async () => {
    const response = makeSetPermissionResponse()
    mockWidgetManager.setWidgetPermissions.mockResolvedValueOnce(response)

    const result = await matrixWidgetService.setWidgetPermission('widget-1', '@alice:example.com', ['read', 'write'])

    expect(result).toEqual(response)
    expect(mockWidgetManager.setWidgetPermissions).toHaveBeenCalledWith('widget-1', {
      user_id: '@alice:example.com',
      permissions: ['read', 'write']
    })
  })

  it('getWidgetPermissions returns null when the manager is unavailable', async () => {
    vi.mocked(matrixClientService.getClient).mockReturnValue(null)

    await expect(matrixWidgetService.getWidgetPermissions('widget-1', false)).resolves.toBeNull()
  })

  it('deleteWidgetPermission resolves true and calls SDK with widgetId + userId', async () => {
    mockWidgetManager.removeWidgetPermission.mockResolvedValueOnce(undefined)

    await expect(matrixWidgetService.deleteWidgetPermission('widget-1', '@alice:example.com')).resolves.toBe(true)
    expect(mockWidgetManager.removeWidgetPermission).toHaveBeenCalledWith('widget-1', '@alice:example.com')
  })

  it('createWidgetSession forwards option fields using snake_case', async () => {
    const session = makeWidgetSessionResponse(makeWidgetSessionItem({ session_id: 's-1' }))
    mockWidgetManager.createWidgetSession.mockResolvedValueOnce(session)

    const result = await matrixWidgetService.createWidgetSession('widget-1', {
      deviceId: 'dev-1',
      expiresInMs: 60_000
    })

    expect(result).toEqual(session)
    expect(mockWidgetManager.createWidgetSession).toHaveBeenCalledWith('widget-1', {
      device_id: 'dev-1',
      expires_in_ms: 60_000
    })
  })

  it('getWidgetSessions delegates to listWidgetSessions', async () => {
    const sessions = makeWidgetSessionsResponse()
    mockWidgetManager.getWidgetSessions.mockResolvedValueOnce(sessions)

    await expect(matrixWidgetService.getWidgetSessions('widget-1')).resolves.toEqual(sessions)
    expect(mockWidgetManager.getWidgetSessions).toHaveBeenCalledWith('widget-1')
  })

  it('terminateWidgetSession resolves true on success', async () => {
    mockWidgetManager.deleteWidgetSession.mockResolvedValueOnce(undefined)

    await expect(matrixWidgetService.terminateWidgetSession('session-1')).resolves.toBe(true)
    expect(mockWidgetManager.deleteWidgetSession).toHaveBeenCalledWith('session-1')
  })

  it('getJitsiConfig calls the SDK with a single roomId argument', async () => {
    const config = makeJitsiConfig({ conf_id: 'c-1' })
    mockWidgetManager.getJitsiConfig.mockResolvedValueOnce(config)

    await expect(matrixWidgetService.getJitsiConfig('!room:example.com')).resolves.toEqual(config)
    expect(mockWidgetManager.getJitsiConfig).toHaveBeenCalledWith('!room:example.com')
  })

  it('getWidgetConfig calls the SDK with a single widgetId argument', async () => {
    const config = makeWidgetConfig({ url: 'https://example.com' })
    mockWidgetManager.getWidgetConfig.mockResolvedValueOnce(config)

    await expect(matrixWidgetService.getWidgetConfig('widget-1')).resolves.toEqual(config)
    expect(mockWidgetManager.getWidgetConfig).toHaveBeenCalledWith('widget-1')
  })
})
