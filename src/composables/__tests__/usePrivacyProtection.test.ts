import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onMounted: (fn: () => void) => fn(),
    onUnmounted: vi.fn()
  }
})

const mockListen = vi.fn(() => Promise.resolve(vi.fn()))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen
}))

vi.mock('@/utils/PlatformConstants', () => ({
  isDesktop: () => true
}))

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

vi.mock('@/utils/Logger', () => ({
  createLogger: vi.fn(() => mockLogger)
}))

describe('usePrivacyProtection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listens on a tauri-safe privacy event name', async () => {
    const { usePrivacyProtection } = await import('../usePrivacyProtection')

    usePrivacyProtection()

    expect(mockListen).toHaveBeenCalledTimes(1)
    expect(mockListen).toHaveBeenCalledWith('com:hula:privacy', expect.any(Function))
  })
})
