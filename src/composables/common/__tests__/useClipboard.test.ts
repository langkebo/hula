import { beforeEach, describe, expect, it, vi } from 'vitest'

const writeTextMock = vi.fn()

let tauriRuntime = false

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeText: (...args: unknown[]) => writeTextMock(...args)
}))
vi.mock('@/utils/AppHarness', () => ({
  hasTauriRuntime: () => tauriRuntime
}))

import { useClipboard } from '../useClipboard'

describe('useClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tauriRuntime = false
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true
    })
  })

  it('uses Tauri writeText when running in a Tauri runtime', async () => {
    tauriRuntime = true
    const { write } = useClipboard()
    await write('hello')
    expect(writeTextMock).toHaveBeenCalledTimes(1)
    expect(writeTextMock).toHaveBeenCalledWith('hello')
  })

  it('falls back to navigator.clipboard when not in a Tauri runtime', async () => {
    tauriRuntime = false
    const { write } = useClipboard()
    await write('hello')
    expect(writeTextMock).toHaveBeenCalledTimes(1)
    expect(writeTextMock).toHaveBeenCalledWith('hello')
  })

  it('falls back to navigator.clipboard when Tauri writeText throws', async () => {
    tauriRuntime = true
    writeTextMock.mockRejectedValueOnce(new Error('denied'))
    const { write } = useClipboard()
    await write('hello')
    expect(writeTextMock).toHaveBeenCalledTimes(2)
  })

  it('rejects when neither clipboard backend is available', async () => {
    tauriRuntime = false
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const { write } = useClipboard()
    await expect(write('hello')).rejects.toThrow(/not supported/)
  })
})
