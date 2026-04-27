import { describe, expect, it, vi } from 'vitest'

const osMock = vi.hoisted(() => ({
  type: vi.fn(() => 'windows'),
  version: vi.fn(() => '10.0.19045')
}))

vi.mock('@tauri-apps/plugin-os', () => osMock)

import {
  Platform,
  getOSType,
  getOSVersion,
  getPlatformType,
  initializePlatform,
  isAndroid,
  isCompatibility,
  isDesktop,
  isIOS,
  isLinux,
  isMac,
  isMac26,
  isMobile,
  isWindows,
  isWindows10
} from '../PlatformConstants'

initializePlatform()

describe('PlatformConstants (initialized as Windows 10 build 19045)', () => {
  it('initializePlatform is idempotent', () => {
    osMock.type.mockReturnValueOnce('macos')
    initializePlatform()
    expect(getOSType()).toBe('windows')
  })

  it('reports os type and version', () => {
    expect(getOSType()).toBe('windows')
    expect(getOSVersion()).toBe('10.0.19045')
  })

  it('detects desktop platform type', () => {
    expect(getPlatformType()).toBe('desktop')
    expect(isDesktop()).toBe(true)
    expect(isMobile()).toBe(false)
  })

  it('detects Windows specifically', () => {
    expect(isWindows()).toBe(true)
    expect(isWindows10()).toBe(true)
  })

  it('returns false for non-current OSes', () => {
    expect(isMac()).toBe(false)
    expect(isMac26()).toBe(false)
    expect(isLinux()).toBe(false)
    expect(isAndroid()).toBe(false)
    expect(isIOS()).toBe(false)
  })

  it('isCompatibility is true for Windows', () => {
    expect(isCompatibility()).toBe(true)
  })

  it('Platform aggregate exposes the detection helpers', () => {
    expect(Platform.getOSType).toBe(getOSType)
    expect(Platform.isDesktop).toBe(isDesktop)
    expect(Platform.isMobile).toBe(isMobile)
    expect(Platform.isWindows).toBe(isWindows)
  })
})
