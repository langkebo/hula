import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 浏览器 at-rest 凭证的「可开关」语义。
 *
 * 背景：`hasTauriRuntime()` 为真不代表 Rust 侧真的能存取 token —— 浏览器里的 Tauri shim
 * 会伪造 `__TAURI_INTERNALS__`，于是刷新页面读 IPC 拿不到 token、必掉登录。
 * 这里锁三件事：
 * 1. 无 Tauri runtime：默认读写 localStorage（Web 版前提）；
 * 2. 有 Tauri runtime 且未开开关：读写都是 no-op（真机凭证只由 Rust 保管）；
 * 3. 有 Tauri runtime 且显式置 `tjg:session:web-fallback=1`：允许用 localStorage 兜底。
 */

const harness = vi.hoisted(() => ({ hasTauriRuntime: vi.fn(() => false) }))

vi.mock('@/utils/AppHarness', () => ({ hasTauriRuntime: harness.hasTauriRuntime }))

import {
  isWebSessionStoreEnabled,
  persistWebAccessToken,
  readWebAccessToken,
  WEB_SESSION_FALLBACK_KEY
} from '../matrixClientPlatform'

const TOKEN_KEY = 'tjg.matrix.accessToken'

beforeEach(() => {
  window.localStorage.clear()
  harness.hasTauriRuntime.mockReturnValue(false)
})

afterEach(() => {
  window.localStorage.clear()
})

describe('web at-rest 凭证', () => {
  it('非 Tauri 环境默认启用，写入后可读回', () => {
    expect(isWebSessionStoreEnabled()).toBe(true)
    persistWebAccessToken('tok-web')
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('tok-web')
    expect(readWebAccessToken()).toBe('tok-web')
  })

  it('Tauri 环境默认不落 localStorage（凭证只由 Rust 保管）', () => {
    harness.hasTauriRuntime.mockReturnValue(true)
    expect(isWebSessionStoreEnabled()).toBe(false)
    persistWebAccessToken('tok-native')
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(readWebAccessToken()).toBeNull()
  })

  it('Tauri 环境 + 显式开关：允许用 localStorage 兜底（shim 场景）', () => {
    harness.hasTauriRuntime.mockReturnValue(true)
    window.localStorage.setItem(WEB_SESSION_FALLBACK_KEY, '1')
    expect(isWebSessionStoreEnabled()).toBe(true)
    persistWebAccessToken('tok-fallback')
    expect(readWebAccessToken()).toBe('tok-fallback')
  })

  it('开关传 null 时清除 token（登出）', () => {
    persistWebAccessToken('tok-web')
    persistWebAccessToken(null)
    expect(readWebAccessToken()).toBeNull()
  })
})
