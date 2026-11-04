import { describe, expect, it } from 'vitest'
import {
  normalizeRequestedPlatform,
  PLATFORM_QUERY_KEY,
  PLATFORM_STORAGE_KEY,
  readRequestedPlatform,
  resolvePlatformType,
  resolveTauriPlatform
} from '../platformDetection'

const storageWith = (value: string | null) => ({ getItem: () => value })

describe('normalizeRequestedPlatform', () => {
  it('只接受 desktop / mobile', () => {
    expect(normalizeRequestedPlatform('mobile')).toBe('mobile')
    expect(normalizeRequestedPlatform('desktop')).toBe('desktop')
    expect(normalizeRequestedPlatform('ios')).toBeNull()
    expect(normalizeRequestedPlatform(null)).toBeNull()
  })
})

describe('readRequestedPlatform', () => {
  it('query 优先于 storage', () => {
    expect(readRequestedPlatform(`?${PLATFORM_QUERY_KEY}=mobile`, storageWith('desktop'))).toBe('mobile')
  })

  it('query 缺失时回落 storage', () => {
    expect(readRequestedPlatform('', storageWith('mobile'))).toBe('mobile')
  })

  it('两者都无效时返回 null', () => {
    expect(readRequestedPlatform('', storageWith('nope'))).toBeNull()
    expect(readRequestedPlatform('', null)).toBeNull()
    expect(PLATFORM_STORAGE_KEY).toBe('tjg:e2e:platform')
  })
})

describe('resolvePlatformType', () => {
  it('android / ios 为 mobile，其余为 desktop', () => {
    expect(resolvePlatformType('android')).toBe('mobile')
    expect(resolvePlatformType('ios')).toBe('mobile')
    expect(resolvePlatformType('windows')).toBe('desktop')
    expect(resolvePlatformType('macos')).toBe('desktop')
    expect(resolvePlatformType('linux')).toBe('desktop')
    expect(resolvePlatformType('')).toBe('desktop')
  })
})

describe('resolveTauriPlatform', () => {
  it('映射 Tauri 环境变量', () => {
    expect(resolveTauriPlatform('android')).toBe('mobile')
    expect(resolveTauriPlatform('ios')).toBe('mobile')
    expect(resolveTauriPlatform('darwin')).toBe('desktop')
    expect(resolveTauriPlatform('windows')).toBe('desktop')
    expect(resolveTauriPlatform(undefined)).toBeNull()
    expect(resolveTauriPlatform('')).toBeNull()
  })
})
