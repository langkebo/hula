import { describe, expect, it, vi } from 'vitest'

// ModerationPanel is a self-contained container (fetches data from the store).
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

// Task 2: ModerationPanel 已改走 MatrixEventReportService（经 BaseMatrixService → MatrixClientService 重型链），
// 这里 mock 掉避免动态导入组件时拉入 matrix-js-sdk
vi.mock('@/services/matrix/moderation/MatrixEventReportService', () => ({
  matrixEventReportService: {
    listReports: vi.fn().mockResolvedValue([]),
    getReportsByStatus: vi.fn().mockResolvedValue([]),
    getReportsCount: vi.fn().mockResolvedValue({ total_reports: 0 }),
    getStatusCount: vi.fn().mockResolvedValue({ status: 'open', count: 0 }),
    resolveReport: vi.fn(),
    dismissReport: vi.fn(),
    escalateReport: vi.fn(),
    deleteReport: vi.fn(),
    getReportHistory: vi.fn().mockResolvedValue([])
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
