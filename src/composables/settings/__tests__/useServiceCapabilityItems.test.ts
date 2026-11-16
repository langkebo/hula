import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsTabStore } from '@/stores/domains/settings/settingsTab'
import { createI18nMock } from '~/tests/i18n-messages'
import { useServiceCapabilityItems } from '../useServiceCapabilityItems'

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
