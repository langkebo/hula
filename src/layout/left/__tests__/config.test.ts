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

vi.mock('@/hooks/useLoginFlow', () => ({
  useLoginFlow: () => ({
    logout: vi.fn()
  })
}))

vi.mock('@/hooks/useMitt.ts', () => ({
  useMitt: {
    emit: vi.fn()
  }
}))

vi.mock('@/hooks/useWindow.ts', () => ({
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
  it('exposes the updated sidebar plugin entries for room and space lists', async () => {
    const { usePluginsList } = await import('../config.tsx')
    const plugins = usePluginsList()

    expect(plugins.value.map((item) => item.url)).toEqual(['roomList', 'space', 'robot'])
    expect(plugins.value[0]).toMatchObject({
      icon: 'view-grid-card',
      iconAction: 'view-grid-card',
      title: 'home.plugins.room_list'
    })
    expect(plugins.value[1]).toMatchObject({
      icon: 'peoples-two',
      iconAction: 'peoples-two',
      title: 'home.plugins.space_list'
    })
  })
})
