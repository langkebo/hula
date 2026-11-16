import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getStorageLayout, registerStorageLayout } from '@/platform/storageLayout'

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => '/app-data'),
  appCacheDir: vi.fn(async () => '/app-cache'),
  resourceDir: vi.fn(async () => '/resource')
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    AppData: 'AppData',
    AppCache: 'AppCache',
    Resource: 'Resource'
  }
}))

describe('platform storage layout registry', () => {
  beforeEach(() => {
    registerStorageLayout(false)
  })

  it('returns the desktop layout when registered as non-mobile', () => {
    const layout = getStorageLayout()
    expect(layout.downloadBaseDir).toBe('Resource')
    expect(layout.cacheBaseDir).toBe('AppCache')
    expect(layout.cacheBaseDirName).toBe('AppCache')
    expect(layout.scopedBaseDirs).toHaveLength(3)
  })

  it('switches to mobile layout after registration', () => {
    registerStorageLayout(true)
    const layout = getStorageLayout()
    expect(layout.downloadBaseDir).toBe('AppData')
    expect(layout.cacheBaseDir).toBe('AppData')
    expect(layout.cacheBaseDirName).toBe('AppData')
    expect(layout.scopedBaseDirs).toHaveLength(1)
  })

  it('resets back to desktop layout', () => {
    registerStorageLayout(true)
    registerStorageLayout(false)
    expect(getStorageLayout().cacheBaseDirName).toBe('AppCache')
  })
})
