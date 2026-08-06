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

// 避免 matrix-js-sdk 重型转换（~6.7s）导致 5s 默认超时
vi.mock('@/services/matrix/MatrixEventService', () => ({
  default: { on: vi.fn(), off: vi.fn(), emit: vi.fn(), convertEventToMessage: vi.fn() }
}))

// AdminFacadeService 导入 16+ 子服务，触发重型依赖链导致超时
vi.mock('@/services/matrix/admin', () => ({
  adminService: {
    getReports: vi.fn(),
    getEventReport: vi.fn(),
    getEventReportHistory: vi.fn(),
    resolveReport: vi.fn(),
    getContentFilters: vi.fn(),
    addContentFilter: vi.fn(),
    removeContentFilter: vi.fn()
  }
}))

// 截断所有 matrix-js-sdk 直接导入路径
vi.mock('matrix-js-sdk', () => ({
  Direction: { Forward: 'f', Backward: 'b' },
  EventType: { Message: 'm.room.message' },
  PushRuleKind: {},
  Visibility: {},
  ClientEvent: {},
  RoomEvent: {},
  RoomStateEvent: {}
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
