import { describe, expect, it, vi } from 'vitest'

// ModerationPanel is a self-contained container (fetches data from the store),
// while ModerationDashboard is a presentational component that needs a parent.
// The /admin/moderation route should map to ModerationPanel.
vi.mock('@/stores/domains/chat/moderation', () => ({
  useModerationStore: () => ({
    openReports: [],
    enabledFilters: [],
    loading: false,
    fetchReports: vi.fn(),
    fetchContentFilters: vi.fn(),
    resolveReport: vi.fn(),
    addContentFilter: vi.fn(),
    removeContentFilter: vi.fn()
  })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

describe('Moderation route alignment', () => {
  it('maps /admin/moderation to ModerationPanel component', async () => {
    const { getDesktopRoutes } = await import('@/router/routes/desktop')
    const routes = getDesktopRoutes()
    const adminRoute = routes.find((r) => r.path === '/admin')
    const moderationRoute = adminRoute?.children?.find((r) => r.path === 'moderation')
    expect(moderationRoute).toBeTruthy()
    expect(moderationRoute?.name).toBe('adminModeration')
    expect(typeof moderationRoute?.component).toBe('function')
    const componentFn = moderationRoute!.component as () => Promise<{ default: { name?: string } }>
    const mod = await componentFn()
    expect(mod.default?.name).toBe('ModerationPanel')
  })
})
