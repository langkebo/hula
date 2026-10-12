import { invoke } from '@tauri-apps/api/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  describeSecureStorageBackend,
  ENCRYPTED_FILE_FALLBACK_BACKEND,
  getSecureSecret,
  getSecureStorageBackendInfo,
  mapBackendInfo,
  resetSecureStorageBackendCache,
  setSecureSecret
} from '../secureStorage'

const logSpies = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => logSpies
}))

const invokeMock = vi.mocked(invoke)

function stubTauriRuntime(): void {
  vi.stubGlobal('window', { __TAURI_INTERNALS__: {} } as Window & { __TAURI_INTERNALS__: unknown })
}

function warnMessages(): string[] {
  return logSpies.warn.mock.calls.map(([message]) => String(message))
}

function infoMessages(): string[] {
  return logSpies.info.mock.calls.map(([message]) => String(message))
}

/**
 * secure storage 可用性/后端上报的回归测试。
 *
 * 核心契约（2026-10-13 修复）：**降级必须可见** ——
 * 当系统密钥库不可用、secret 实际落在 master-key 加密的文件 fallback 时，
 * 上报的后端**不得**是平台密钥库名，且必须给出 `degraded=true`。
 * 历史缺陷：`backend` 按平台硬编码 ⇒ `available=true, backend=macos_keychain`
 * 与同一次运行里的 `Keychain bug detected … Falling back to file storage` 直接矛盾。
 */
describe('secureStorage 后端上报', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    resetSecureStorageBackendCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    resetSecureStorageBackendCache()
  })

  describe('mapBackendInfo', () => {
    it('原生后端：degraded=false', () => {
      const info = mapBackendInfo({
        available: true,
        backend: 'macos_keychain',
        nativeAvailable: true,
        degraded: false
      })
      expect(info).toEqual({
        available: true,
        backend: 'macos_keychain',
        nativeAvailable: true,
        degraded: false
      })
    })

    it('仅文件 fallback：degraded=true 且后端为 encrypted_file_fallback', () => {
      const info = mapBackendInfo({
        available: true,
        backend: ENCRYPTED_FILE_FALLBACK_BACKEND,
        nativeAvailable: false,
        degraded: true
      })
      expect(info.degraded).toBe(true)
      expect(info.nativeAvailable).toBe(false)
      expect(info.backend).toBe(ENCRYPTED_FILE_FALLBACK_BACKEND)
    })

    it('老二进制（缺新字段）时按 backend 推导，不把未知后端当作原生', () => {
      const info = mapBackendInfo({ available: true, backend: ENCRYPTED_FILE_FALLBACK_BACKEND })
      expect(info.degraded).toBe(true)
      expect(info.nativeAvailable).toBe(false)
    })

    it('不可用 / 空响应：全部为 false，backend 为 null', () => {
      expect(mapBackendInfo({ available: false, backend: 'unavailable' })).toEqual({
        available: false,
        backend: 'unavailable',
        nativeAvailable: false,
        degraded: false
      })
      expect(mapBackendInfo(undefined)).toEqual({
        available: false,
        backend: null,
        nativeAvailable: false,
        degraded: false
      })
    })
  })

  describe('describeSecureStorageBackend', () => {
    it('降级时描述文件 fallback，且**绝不**出现 keychain 字样', () => {
      const text = describeSecureStorageBackend({
        available: true,
        backend: ENCRYPTED_FILE_FALLBACK_BACKEND,
        nativeAvailable: false,
        degraded: true
      })
      expect(text).toContain('加密文件 fallback')
      expect(text).toContain('系统密钥库不可用')
      expect(text.toLowerCase()).not.toContain('keychain')
    })

    it('原生可用时描述系统密钥库并带出后端标识', () => {
      const text = describeSecureStorageBackend({
        available: true,
        backend: 'macos_keychain',
        nativeAvailable: true,
        degraded: false
      })
      expect(text).toContain('系统密钥库')
      expect(text).toContain('macos_keychain')
    })

    it('不可用时不编造后端', () => {
      expect(
        describeSecureStorageBackend({ available: false, backend: null, nativeAvailable: false, degraded: false })
      ).toContain('后端未上报')
    })
  })

  describe('getSecureStorageBackendInfo', () => {
    it('非 Tauri 环境不发起 IPC，直接返回不可用', async () => {
      const info = await getSecureStorageBackendInfo()
      expect(info.available).toBe(false)
      expect(invokeMock).not.toHaveBeenCalled()
    })

    it('降级时打 warn（不是 info），并把后端标识写进日志', async () => {
      stubTauriRuntime()
      invokeMock.mockResolvedValue({
        available: true,
        backend: ENCRYPTED_FILE_FALLBACK_BACKEND,
        nativeAvailable: false,
        degraded: true
      })

      const info = await getSecureStorageBackendInfo()

      expect(info).toMatchObject({ available: true, degraded: true })
      const degradedWarn = warnMessages().find((message) => message.includes('降级'))
      expect(degradedWarn).toBeDefined()
      expect(degradedWarn).toContain('master-key')
      expect(degradedWarn).not.toContain('keychain')
      expect(infoMessages().some((message) => message.includes('生效后端'))).toBe(false)
    })

    it('原生可用时打 info，且不产生降级告警', async () => {
      stubTauriRuntime()
      invokeMock.mockResolvedValue({
        available: true,
        backend: 'macos_keychain',
        nativeAvailable: true,
        degraded: false
      })

      const info = await getSecureStorageBackendInfo()

      expect(info.degraded).toBe(false)
      expect(infoMessages().some((message) => message.includes('生效后端'))).toBe(true)
      expect(warnMessages().some((message) => message.includes('降级'))).toBe(false)
    })

    it('IPC 抛错时降级为"不可用"且不抛出', async () => {
      stubTauriRuntime()
      invokeMock.mockRejectedValue(new Error('ipc down'))

      await expect(getSecureStorageBackendInfo()).resolves.toMatchObject({ available: false })
    })

    it('缓存生效：同一 TTL 窗口内只探测一次', async () => {
      stubTauriRuntime()
      invokeMock.mockResolvedValue({ available: true, backend: 'macos_keychain', nativeAvailable: true })

      await getSecureStorageBackendInfo()
      await getSecureStorageBackendInfo()

      expect(invokeMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('读写咽喉的可用性判据与后端一致性', () => {
    it('降级（available=true）时仍允许读写 —— 降级不等于不可用', async () => {
      stubTauriRuntime()
      invokeMock.mockImplementation(async (command: string) => {
        if (command === 'check_secure_storage_available') {
          return { available: true, backend: ENCRYPTED_FILE_FALLBACK_BACKEND, nativeAvailable: false, degraded: true }
        }
        if (command === 'get_secret') return 'stored-value'
        return undefined
      })

      await expect(getSecureSecret('k')).resolves.toBe('stored-value')
      await expect(setSecureSecret('k', 'v')).resolves.toBe(true)
    })

    it('不可用时读返回 null、写返回 false（不发起 IPC）', async () => {
      stubTauriRuntime()
      invokeMock.mockResolvedValue({ available: false, backend: 'unavailable' })

      await expect(getSecureSecret('k')).resolves.toBeNull()
      await expect(setSecureSecret('k', 'v')).resolves.toBe(false)
      // 只探测了可用性，没有真的去 get/set
      expect(invokeMock.mock.calls.map(([command]) => command)).toEqual(['check_secure_storage_available'])
    })
  })
})
