import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsTabStore } from '@/stores/domains/settings/settingsTab'
import { createI18nMock } from '~/tests/i18n-messages'
import { resolveProbeHint, useServiceCapabilityItems } from '../useServiceCapabilityItems'

vi.mock('vue-i18n', () => createI18nMock())

const { statusMock, aliasesMock, refreshMock, platform } = vi.hoisted(() => ({
  statusMock: vi.fn(),
  aliasesMock: vi.fn(),
  refreshMock: vi.fn(),
  platform: { isDesktop: true }
}))

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  useServerCapability: () => ({
    getCapabilityStatus: statusMock,
    getCapabilityAliases: aliasesMock,
    refreshCapabilities: refreshMock
  })
}))

vi.mock('@/composables/usePlatform', () => ({
  usePlatform: () => platform
}))

vi.mock('@/services/matrix/capabilityProbe', () => ({
  canProbeCapability: () => false,
  probeCapabilities: vi.fn(async () => ({}))
}))

vi.mock('@/stores/domains/user/user', () => ({
  useUserStore: () => ({ userInfo: { uid: '@me:hs' } })
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '!r:hs' })
}))

describe('useServiceCapabilityItems', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    platform.isDesktop = true
    statusMock.mockReturnValue('supported')
    aliasesMock.mockReturnValue({ unstable: [], capabilities: [] })
  })

  it('maps the three capability states onto panel items', () => {
    statusMock.mockImplementation((key: string) => {
      if (key === 'voip') return 'unknown'
      if (key === 'sticky-events') return 'unsupported'
      return 'supported'
    })
    aliasesMock.mockReturnValue({ unstable: ['org.matrix.msc4354'], capabilities: [] })

    const { items } = useServiceCapabilityItems()
    const byKey = new Map(items.value.map((item) => [item.key, item]))

    expect(items.value).toHaveLength(14)
    expect(byKey.get('e2ee')?.state).toBe('ready')
    expect(byKey.get('e2ee')?.hint).toBe('')
    expect(byKey.get('voip')?.state).toBe('degraded')
    expect(byKey.get('voip')?.hint).toContain('能力快照尚未加载')
    expect(byKey.get('sticky-events')?.state).toBe('unavailable')
    expect(byKey.get('sticky-events')?.hint).toContain('org.matrix.msc4354')
  })

  it('explains client-decided capabilities without server keys', () => {
    statusMock.mockImplementation((key: string) => (key === 'e2ee' ? 'unsupported' : 'supported'))

    const { items } = useServiceCapabilityItems()
    const e2ee = items.value.find((item) => item.key === 'e2ee')

    expect(e2ee?.state).toBe('unavailable')
    expect(e2ee?.hint).toContain('由客户端状态判定')
  })

  it('refreshes the capability snapshot through the service', async () => {
    const { refresh } = useServiceCapabilityItems()

    await refresh()

    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it('jumps to the related settings tab', () => {
    const settingsTab = useSettingsTabStore()
    const { openSettings } = useServiceCapabilityItems()

    openSettings('voip')
    expect(settingsTab.activeTab).toBe('voiceVideo')

    openSettings('burn-after-read')
    expect(settingsTab.activeTab).toBe('burnAfterRead')

    openSettings('sliding-sync')
    expect(settingsTab.activeTab).toBe('burnAfterRead')
  })

  it('hides the admin capability on mobile', () => {
    platform.isDesktop = false

    const { items } = useServiceCapabilityItems()

    expect(items.value.some((item) => item.key === 'admin-api')).toBe(false)
    expect(items.value).toHaveLength(13)
  })
})

describe('resolveProbeHint（宣告 vs 路由的冲突提示）', () => {
  const t = (key: string) => key
  const probe = (outcome: 'route-present' | 'route-missing' | 'inconclusive') =>
    ({ capability: 'rtc-transports', outcome, route: '', httpStatus: 0, errcode: '', reason: '', at: 0 }) as const

  it('未宣告但路由存在 → 提示「宣告与实现不一致」', () => {
    expect(resolveProbeHint('unsupported', probe('route-present'), t)).toBe(
      'common.capability.hint.probeDeclaredMissing'
    )
  })

  it('已宣告但路由 404 → 提示「入口可能点不开」', () => {
    expect(resolveProbeHint('supported', probe('route-missing'), t)).toBe(
      'common.capability.hint.probeDeclaredButMissing'
    )
  })

  it('一致时不额外提示（未宣告且路由缺失 / 已宣告且路由存在）', () => {
    expect(resolveProbeHint('unsupported', probe('route-missing'), t)).toBeUndefined()
    expect(resolveProbeHint('supported', probe('route-present'), t)).toBeUndefined()
  })

  it('inconclusive 与无探测结果都不提示（不冤枉服务端）', () => {
    expect(resolveProbeHint('unsupported', probe('inconclusive'), t)).toBeUndefined()
    expect(resolveProbeHint('unsupported', undefined, t)).toBeUndefined()
  })
})
