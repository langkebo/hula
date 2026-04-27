import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const widgetServiceMock = {
  getWidgets: vi.fn(),
  createWidget: vi.fn(),
  deleteWidget: vi.fn(),
  updateWidget: vi.fn(),
  getWidgetPermissions: vi.fn(),
  setWidgetPermission: vi.fn(),
  deleteWidgetPermission: vi.fn()
}

vi.mock('@/services/matrix/widget/MatrixWidgetService', () => ({
  matrixWidgetService: widgetServiceMock
}))

const { useWidgets } = await import('../useWidgets')
const { useWidgetPermissions, parsePermissionsResponse } = await import('../useWidgetPermissions')

describe('useWidgets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('loads widgets (non-throwing) and exposes loading state', async () => {
    widgetServiceMock.getWidgets.mockResolvedValueOnce([{ id: 'w1', type: 'jitsi', url: 'u' }])

    const { widgets, loading, load } = useWidgets(() => '!room:example.com')
    const promise = load()
    expect(loading.value).toBe(true)
    await promise

    expect(loading.value).toBe(false)
    expect(widgets.value).toEqual([{ id: 'w1', type: 'jitsi', url: 'u' }])
    expect(widgetServiceMock.getWidgets).toHaveBeenCalledWith('!room:example.com', false)
  })

  it('no-ops load when roomId is empty', async () => {
    const { load, widgets } = useWidgets(() => '')
    await load()
    expect(widgets.value).toEqual([])
    expect(widgetServiceMock.getWidgets).not.toHaveBeenCalled()
  })

  it('surfaces error from service into error ref without throwing', async () => {
    widgetServiceMock.getWidgets.mockRejectedValueOnce(new Error('boom'))
    const { load, error } = useWidgets(() => '!r')
    await load()
    expect(error.value).toBe('boom')
  })

  it('create calls createWidget then reloads list', async () => {
    widgetServiceMock.createWidget.mockResolvedValueOnce({ id: 'w1', type: 'custom', url: 'u' })
    widgetServiceMock.getWidgets.mockResolvedValueOnce([{ id: 'w1', type: 'custom', url: 'u' }])

    const { create, widgets } = useWidgets(() => '!r')
    const result = await create({ widgetType: 'custom', url: 'u', name: 'n' })

    expect(result).toEqual({ id: 'w1', type: 'custom', url: 'u' })
    expect(widgetServiceMock.createWidget).toHaveBeenCalledWith(
      '!r',
      { widgetType: 'custom', url: 'u', name: 'n' },
      true
    )
    expect(widgets.value).toEqual([{ id: 'w1', type: 'custom', url: 'u' }])
  })

  it('remove reloads list only when deletion succeeds', async () => {
    widgetServiceMock.deleteWidget.mockResolvedValueOnce(true)
    widgetServiceMock.getWidgets.mockResolvedValueOnce([])

    const { remove } = useWidgets(() => '!r')
    const ok = await remove('w1')
    expect(ok).toBe(true)
    expect(widgetServiceMock.getWidgets).toHaveBeenCalled()
  })

  it('remove does not reload when deletion fails', async () => {
    widgetServiceMock.deleteWidget.mockResolvedValueOnce(false)
    const { remove } = useWidgets(() => '!r')
    const ok = await remove('w1')
    expect(ok).toBe(false)
    expect(widgetServiceMock.getWidgets).not.toHaveBeenCalled()
  })
})

describe('parsePermissionsResponse', () => {
  it('parses list-shape responses with user_id/permissions', () => {
    const result = parsePermissionsResponse({
      permissions: [{ user_id: '@alice:example.com', permissions: ['read', 'write'] }]
    })
    expect(result).toEqual([{ userId: '@alice:example.com', permissions: ['read', 'write'] }])
  })

  it('parses list-shape responses with userId/actions aliases', () => {
    const result = parsePermissionsResponse({
      permissions: [{ userId: '@bob:example.com', actions: ['read'] }]
    })
    expect(result).toEqual([{ userId: '@bob:example.com', permissions: ['read'] }])
  })

  it('parses map-shape responses', () => {
    const result = parsePermissionsResponse({ '@alice:example.com': ['read'] })
    expect(result).toEqual([{ userId: '@alice:example.com', permissions: ['read'] }])
  })

  it('returns empty array for nullish / non-object input', () => {
    expect(parsePermissionsResponse(null)).toEqual([])
    expect(parsePermissionsResponse('string')).toEqual([])
    expect(parsePermissionsResponse(42)).toEqual([])
  })

  it('skips malformed list entries instead of throwing', () => {
    const result = parsePermissionsResponse({
      permissions: [{ user_id: '@a:e', permissions: ['read'] }, { foo: 'bar' }, null]
    })
    expect(result).toEqual([{ userId: '@a:e', permissions: ['read'] }])
  })
})

describe('useWidgetPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('load populates rows from parsed response', async () => {
    widgetServiceMock.getWidgetPermissions.mockResolvedValueOnce({
      permissions: [{ user_id: '@alice:e', permissions: ['read'] }]
    })

    const { load, rows } = useWidgetPermissions()
    await load('w1')

    expect(rows.value).toEqual([{ userId: '@alice:e', permissions: ['read'] }])
    expect(widgetServiceMock.getWidgetPermissions).toHaveBeenCalledWith('w1', false)
  })

  it('grant calls setWidgetPermission and reloads rows', async () => {
    widgetServiceMock.setWidgetPermission.mockResolvedValueOnce({ ok: true })
    widgetServiceMock.getWidgetPermissions.mockResolvedValueOnce({
      permissions: [{ user_id: '@alice:e', permissions: ['read'] }]
    })

    const { grant, rows } = useWidgetPermissions()
    const ok = await grant('w1', '@alice:e', ['read'])

    expect(ok).toBe(true)
    expect(widgetServiceMock.setWidgetPermission).toHaveBeenCalledWith('w1', '@alice:e', ['read'], true)
    expect(rows.value).toEqual([{ userId: '@alice:e', permissions: ['read'] }])
  })

  it('revoke surfaces service false and skips reload', async () => {
    widgetServiceMock.deleteWidgetPermission.mockResolvedValueOnce(false)
    const { revoke } = useWidgetPermissions()
    const ok = await revoke('w1', '@alice:e')
    expect(ok).toBe(false)
    expect(widgetServiceMock.getWidgetPermissions).not.toHaveBeenCalled()
  })

  it('grant captures service error and returns false', async () => {
    widgetServiceMock.setWidgetPermission.mockRejectedValueOnce(new Error('nope'))
    const { grant, error } = useWidgetPermissions()
    const ok = await grant('w1', '@alice:e', ['read'])
    await nextTick()
    expect(ok).toBe(false)
    expect(error.value).toBe('nope')
  })
})
