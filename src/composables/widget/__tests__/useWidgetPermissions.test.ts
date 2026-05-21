import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const widgetServiceMock = {
  getWidgetPermissions: vi.fn(),
  setWidgetPermission: vi.fn(),
  deleteWidgetPermission: vi.fn()
}

vi.mock('@/services/matrix/widget/MatrixWidgetService', () => ({
  matrixWidgetService: widgetServiceMock
}))

const { useWidgetPermissions, parsePermissionsResponse } = await import('../useWidgetPermissions')

// ============================================================================
// parsePermissionsResponse
// ============================================================================

describe('parsePermissionsResponse', () => {
  it('returns empty array for null input', () => {
    expect(parsePermissionsResponse(null)).toEqual([])
  })

  it('returns empty array for undefined input', () => {
    expect(parsePermissionsResponse(undefined)).toEqual([])
  })

  it('returns empty array for non-object input', () => {
    expect(parsePermissionsResponse('string')).toEqual([])
    expect(parsePermissionsResponse(42)).toEqual([])
    expect(parsePermissionsResponse(true)).toEqual([])
  })

  it('parses list-shape with user_id and permissions fields', () => {
    const result = parsePermissionsResponse({
      permissions: [{ user_id: '@alice:example.com', permissions: ['read', 'write'] }]
    })
    expect(result).toEqual([{ userId: '@alice:example.com', permissions: ['read', 'write'] }])
  })

  it('parses list-shape with userId (camelCase) field', () => {
    const result = parsePermissionsResponse({
      permissions: [{ userId: '@bob:example.com', permissions: ['read'] }]
    })
    expect(result).toEqual([{ userId: '@bob:example.com', permissions: ['read'] }])
  })

  it('parses list-shape with actions field instead of permissions', () => {
    const result = parsePermissionsResponse({
      permissions: [{ user_id: '@carol:example.com', actions: ['execute'] }]
    })
    expect(result).toEqual([{ userId: '@carol:example.com', permissions: ['execute'] }])
  })

  it('filters invalid entries in list-shape', () => {
    const result = parsePermissionsResponse({
      permissions: [
        { user_id: '@valid:example.com', permissions: ['read'] },
        { foo: 'bar' },
        null,
        undefined,
        { user_id: '@noPerms:example.com' },
        { permissions: ['orphan'] }
      ]
    })
    expect(result).toEqual([{ userId: '@valid:example.com', permissions: ['read'] }])
  })

  it('parses map-shape with userId as key and string[] as value', () => {
    const result = parsePermissionsResponse({
      '@alice:example.com': ['read', 'write'],
      '@bob:example.com': ['read']
    })
    expect(result).toEqual([
      { userId: '@alice:example.com', permissions: ['read', 'write'] },
      { userId: '@bob:example.com', permissions: ['read'] }
    ])
  })

  it('filters non-array values in map-shape', () => {
    const result = parsePermissionsResponse({
      '@alice:example.com': ['read'],
      '@bob:example.com': 'not-an-array',
      '@carol:example.com': 42
    })
    expect(result).toEqual([{ userId: '@alice:example.com', permissions: ['read'] }])
  })

  it('returns empty array for empty object', () => {
    expect(parsePermissionsResponse({})).toEqual([])
  })
})

// ============================================================================
// useWidgetPermissions
// ============================================================================

describe('useWidgetPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ---- load ----

  describe('load', () => {
    it('populates rows from parsed response', async () => {
      widgetServiceMock.getWidgetPermissions.mockResolvedValueOnce({
        permissions: [{ user_id: '@alice:e', permissions: ['read'] }]
      })

      const { load, rows } = useWidgetPermissions()
      await load('w1')

      expect(rows.value).toEqual([{ userId: '@alice:e', permissions: ['read'] }])
      expect(widgetServiceMock.getWidgetPermissions).toHaveBeenCalledWith('w1', false)
    })

    it('sets error on failure', async () => {
      widgetServiceMock.getWidgetPermissions.mockRejectedValueOnce(new Error('network error'))

      const { load, error } = useWidgetPermissions()
      await load('w1')

      expect(error.value).toBe('network error')
    })

    it('toggles loading state correctly', async () => {
      let resolveLoad!: (value: unknown) => void
      widgetServiceMock.getWidgetPermissions.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveLoad = resolve
        })
      )

      const { load, loading } = useWidgetPermissions()
      const promise = load('w1')

      expect(loading.value).toBe(true)

      resolveLoad({ permissions: [] })
      await promise

      expect(loading.value).toBe(false)
    })

    it('clears error before loading', async () => {
      widgetServiceMock.getWidgetPermissions
        .mockRejectedValueOnce(new Error('first fail'))
        .mockResolvedValueOnce({ permissions: [] })

      const { load, error } = useWidgetPermissions()
      await load('w1')
      expect(error.value).toBe('first fail')

      await load('w2')
      expect(error.value).toBeNull()
    })
  })

  // ---- grant ----

  describe('grant', () => {
    it('calls setWidgetPermission and reloads rows', async () => {
      widgetServiceMock.setWidgetPermission.mockResolvedValueOnce({ ok: true })
      widgetServiceMock.getWidgetPermissions.mockResolvedValueOnce({
        permissions: [{ user_id: '@alice:e', permissions: ['read', 'write'] }]
      })

      const { grant, rows } = useWidgetPermissions()
      const ok = await grant('w1', '@alice:e', ['read', 'write'])

      expect(ok).toBe(true)
      expect(widgetServiceMock.setWidgetPermission).toHaveBeenCalledWith('w1', '@alice:e', ['read', 'write'], true)
      expect(rows.value).toEqual([{ userId: '@alice:e', permissions: ['read', 'write'] }])
    })

    it('returns false and sets error on failure', async () => {
      widgetServiceMock.setWidgetPermission.mockRejectedValueOnce(new Error('forbidden'))

      const { grant, error } = useWidgetPermissions()
      const ok = await grant('w1', '@alice:e', ['read'])

      expect(ok).toBe(false)
      expect(error.value).toBe('forbidden')
    })
  })

  // ---- revoke ----

  describe('revoke', () => {
    it('succeeds and reloads rows', async () => {
      widgetServiceMock.deleteWidgetPermission.mockResolvedValueOnce(true)
      widgetServiceMock.getWidgetPermissions.mockResolvedValueOnce({
        permissions: []
      })

      const { revoke, rows } = useWidgetPermissions()
      const ok = await revoke('w1', '@alice:e')

      expect(ok).toBe(true)
      expect(widgetServiceMock.deleteWidgetPermission).toHaveBeenCalledWith('w1', '@alice:e', true)
      expect(rows.value).toEqual([])
    })

    it('does not reload when delete returns false', async () => {
      widgetServiceMock.deleteWidgetPermission.mockResolvedValueOnce(false)

      const { revoke } = useWidgetPermissions()
      const ok = await revoke('w1', '@alice:e')

      expect(ok).toBe(false)
      expect(widgetServiceMock.getWidgetPermissions).not.toHaveBeenCalled()
    })

    it('returns false and sets error on failure', async () => {
      widgetServiceMock.deleteWidgetPermission.mockRejectedValueOnce(new Error('server error'))

      const { revoke, error } = useWidgetPermissions()
      const ok = await revoke('w1', '@alice:e')

      expect(ok).toBe(false)
      expect(error.value).toBe('server error')
    })
  })

  // ---- mutating state ----

  describe('mutating state', () => {
    it('toggles mutating state during grant', async () => {
      let resolveGrant!: (value: unknown) => void
      widgetServiceMock.setWidgetPermission.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveGrant = resolve
        })
      )
      widgetServiceMock.getWidgetPermissions.mockResolvedValueOnce({ permissions: [] })

      const { grant, mutating } = useWidgetPermissions()
      const promise = grant('w1', '@alice:e', ['read'])

      expect(mutating.value).toBe(true)

      resolveGrant(true)
      await promise

      expect(mutating.value).toBe(false)
    })

    it('toggles mutating state during revoke', async () => {
      let resolveRevoke!: (v: boolean) => void
      widgetServiceMock.deleteWidgetPermission.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveRevoke = resolve
        })
      )

      const { revoke, mutating } = useWidgetPermissions()
      const promise = revoke('w1', '@alice:e')

      expect(mutating.value).toBe(true)

      resolveRevoke(true)
      await promise

      expect(mutating.value).toBe(false)
    })

    it('resets mutating to false even on grant error', async () => {
      widgetServiceMock.setWidgetPermission.mockRejectedValueOnce(new Error('fail'))

      const { grant, mutating } = useWidgetPermissions()
      await grant('w1', '@alice:e', ['read'])

      expect(mutating.value).toBe(false)
    })

    it('resets mutating to false even on revoke error', async () => {
      widgetServiceMock.deleteWidgetPermission.mockRejectedValueOnce(new Error('fail'))

      const { revoke, mutating } = useWidgetPermissions()
      await revoke('w1', '@alice:e')

      expect(mutating.value).toBe(false)
    })
  })
})
