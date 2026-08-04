import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock Tauri APIs (vi.hoisted so the mocks are available to hoisted vi.mock factories)
const { mockClose, mockGetByLabel } = vi.hoisted(() => ({
  mockClose: vi.fn().mockResolvedValue(undefined),
  mockGetByLabel: vi.fn()
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: mockClose,
    label: 'test-window'
  })
}))

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: {
    getByLabel: mockGetByLabel
  }
}))

vi.mock('@tauri-apps/api', () => ({
  window: {
    getCurrentWindow: () => ({
      close: mockClose,
      label: 'test-window'
    }),
    WebviewWindow: {
      getByLabel: mockGetByLabel
    }
  }
}))

import { usePlatformClose } from '../usePlatformClose'

describe('usePlatformClose', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns closeCurrentWindow and closeWindowByLabel functions', () => {
    const { closeCurrentWindow, closeWindowByLabel } = usePlatformClose()
    expect(typeof closeCurrentWindow).toBe('function')
    expect(typeof closeWindowByLabel).toBe('function')
  })

  it('closeCurrentWindow calls getCurrentWindow().close()', async () => {
    const { closeCurrentWindow } = usePlatformClose()
    await closeCurrentWindow()
    expect(mockClose).toHaveBeenCalledOnce()
  })

  it('closeWindowByLabel closes a window by its label', async () => {
    const mockWindowClose = vi.fn().mockResolvedValue(undefined)
    mockGetByLabel.mockResolvedValue({ close: mockWindowClose })
    const { closeWindowByLabel } = usePlatformClose()
    await closeWindowByLabel('login')
    expect(mockGetByLabel).toHaveBeenCalledWith('login')
    expect(mockWindowClose).toHaveBeenCalledOnce()
  })

  it('closeWindowByLabel does nothing if window not found', async () => {
    mockGetByLabel.mockResolvedValue(null)
    const { closeWindowByLabel } = usePlatformClose()
    await closeWindowByLabel('nonexistent')
    expect(mockGetByLabel).toHaveBeenCalledWith('nonexistent')
    // Should not throw
  })
})
