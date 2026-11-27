import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/services/matrix/MatrixCapabilityService', () => ({
  matrixCapabilityService: {
    hasCapability: vi.fn(() => false)
  }
}))

const adminState = vi.hoisted(() => ({ canShowAdminEntry: false }))

vi.mock('@/stores/domains/admin/admin', () => ({
  useAdminStore: () => ({
    canAccessAdmin: adminState.canShowAdminEntry,
    get canShowAdminEntry() {
      return adminState.canShowAdminEntry
    }
  })
}))

vi.mock('@/shared/composables/useLoginFlow', () => ({
  useLoginFlow: () => ({
    logout: vi.fn()
  })
}))

vi.mock('@/composables/common/useMitt', () => ({
  useMitt: {
    emit: vi.fn()
  }
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({
    createWebviewWindow: vi.fn()
  })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  })
}))

describe('usePluginsList', () => {
  it('普通用户不出现联邦入口，管理员才出现', async () => {
    const { usePluginsList } = await import('../config.tsx')

    adminState.canShowAdminEntry = false
    expect(usePluginsList().value.map((item) => item.url)).toEqual(['roomList', 'space'])

    adminState.canShowAdminEntry = true
    expect(usePluginsList().value.map((item) => item.url)).toEqual(['roomList', 'space', 'federation'])
  })

  it('exposes the updated sidebar plugin entries for room and space lists', async () => {
    const { usePluginsList } = await import('../config.tsx')
    adminState.canShowAdminEntry = false
    const plugins = usePluginsList()

    expect(plugins.value[0]).toMatchObject({
      icon: 'room',
      iconAction: 'room',
      title: 'home.plugins.room_list'
    })
    expect(plugins.value[1]).toMatchObject({
      icon: 'space',
      iconAction: 'space',
      title: 'home.plugins.space_list'
    })
  })
})
