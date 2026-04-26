import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

const { createDefaultIntegrationsCatalog, useIntegrations } = await import('../useIntegrations')

describe('useIntegrations', () => {
  beforeEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('uses default catalog and legacy storage on first load', () => {
    localStorage.setItem('hula-integrations-enabled', 'false')
    localStorage.setItem(
      'hula-integrations-permissions',
      JSON.stringify({ userInfo: false, roomList: true, sendMessage: true })
    )

    const state = useIntegrations(createDefaultIntegrationsCatalog())

    expect(state.integrationsEnabled.value).toBe(false)
    expect(state.permissions.value).toEqual({ userInfo: false, roomList: true, sendMessage: true })
    expect(state.integrations.value.map((item) => item.id)).toEqual(['github', 'giphy'])
    expect(state.availableIntegrations.value.map((item) => item.id)).toEqual(['jira', 'google-calendar'])
  })

  it('persists enable flag, permissions and integration status into shared state', () => {
    const state = useIntegrations(createDefaultIntegrationsCatalog())

    state.setIntegrationsEnabled(false)
    state.setPermission('roomList', true)
    state.setIntegrationEnabled('giphy', true)

    const persisted = JSON.parse(localStorage.getItem('hula-integrations-state') || '{}')
    expect(persisted.enabled).toBe(false)
    expect(persisted.permissions.roomList).toBe(true)
    expect(persisted.installed).toEqual([
      { id: 'github', enabled: true },
      { id: 'giphy', enabled: true }
    ])
  })

  it('installs and removes integrations while keeping available list synced', async () => {
    const state = useIntegrations(createDefaultIntegrationsCatalog())

    await state.installIntegration('jira')
    expect(state.integrations.value.map((item) => item.id)).toContain('jira')
    expect(state.availableIntegrations.value.map((item) => item.id)).not.toContain('jira')

    const removed = state.removeIntegration('jira')
    expect(removed).toBe(true)
    expect(state.integrations.value.map((item) => item.id)).not.toContain('jira')
    expect(state.availableIntegrations.value.map((item) => item.id)).toContain('jira')
  })

  it('filters available integrations from the shared search query', () => {
    const state = useIntegrations(createDefaultIntegrationsCatalog())

    state.setSearchQuery('calendar')
    expect(state.filteredAvailableIntegrations.value.map((item) => item.id)).toEqual(['google-calendar'])
    expect(state.searchAvailableIntegrations()).toBe(1)
  })

  it('hydrates from shared persisted state for multi-end sync', () => {
    localStorage.setItem(
      'hula-integrations-state',
      JSON.stringify({
        version: 1,
        enabled: true,
        permissions: { userInfo: true, roomList: true, sendMessage: false },
        installed: [
          { id: 'github', enabled: true },
          { id: 'jira', enabled: false }
        ],
        availableIds: ['giphy', 'google-calendar']
      })
    )

    const state = useIntegrations(createDefaultIntegrationsCatalog())

    expect(state.integrations.value).toEqual([
      expect.objectContaining({ id: 'github', enabled: true }),
      expect.objectContaining({ id: 'jira', enabled: false })
    ])
    expect(state.availableIntegrations.value.map((item) => item.id)).toEqual(['giphy', 'google-calendar'])
    expect(state.permissions.value.roomList).toBe(true)
  })

  it('supports delayed installs and exposes loading state', async () => {
    vi.useFakeTimers()
    const state = useIntegrations(createDefaultIntegrationsCatalog())

    const promise = state.installIntegration('jira', 1000)
    expect(state.loading.value).toBe(true)

    await vi.advanceTimersByTimeAsync(1000)
    await promise

    expect(state.loading.value).toBe(false)
    expect(state.integrations.value.map((item) => item.id)).toContain('jira')
  })

  it('reacts to shared storage updates for cross-end sync', () => {
    const state = useIntegrations(createDefaultIntegrationsCatalog())

    localStorage.setItem(
      'hula-integrations-state',
      JSON.stringify({
        version: 1,
        enabled: false,
        permissions: { userInfo: false, roomList: true, sendMessage: true },
        installed: [{ id: 'google-calendar', enabled: true }],
        availableIds: ['github', 'giphy', 'jira']
      })
    )
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'hula-integrations-state',
        newValue: localStorage.getItem('hula-integrations-state'),
        storageArea: localStorage
      })
    )

    expect(state.integrationsEnabled.value).toBe(false)
    expect(state.permissions.value).toEqual({ userInfo: false, roomList: true, sendMessage: true })
    expect(state.integrations.value.map((item) => item.id)).toEqual(['google-calendar'])
  })
})
