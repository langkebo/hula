import { describe, expect, it, vi } from 'vitest'
import { createMobileStorageLayout } from '@/mobile/platform/storageLayout'

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

describe('mobileStorageLayout', () => {
  const mobileStorageLayout = createMobileStorageLayout()

  it('confines download and cache directories to AppData', () => {
    expect(mobileStorageLayout.downloadBaseDir).toBe('AppData')
    expect(mobileStorageLayout.cacheBaseDir).toBe('AppData')
    expect(mobileStorageLayout.cacheBaseDirName).toBe('AppData')
  })

  it('resolves scoped paths against AppData only', async () => {
    expect(mobileStorageLayout.scopedBaseDirs).toHaveLength(1)
    expect(mobileStorageLayout.scopedBaseDirs[0].baseDir).toBe('AppData')
    await expect(mobileStorageLayout.scopedBaseDirs[0].resolvePath()).resolves.toBe('/app-data')
    await expect(mobileStorageLayout.resolveDownloadBaseDirPath()).resolves.toBe('/app-data')
  })
})
