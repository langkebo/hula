import { describe, expect, it, vi } from 'vitest'
import { createWindowSessionReady, type WindowSessionReadyDeps } from '../useWindowSessionReady'

/** 构造可控依赖；默认「有会话 + 恢复成功 + 有 client」。 */
function makeDeps(overrides: Partial<WindowSessionReadyDeps> = {}) {
  let client: unknown | null = null
  const deps: WindowSessionReadyDeps = {
    hasAuthenticatedSession: vi.fn(async () => true),
    ensureClientReady: vi.fn(async () => {
      client = { tag: 'client' }
    }),
    waitForClientReady: vi.fn(async () => client),
    getClient: () => client,
    ...overrides
  }
  return {
    deps,
    setClient(value: unknown | null) {
      client = value
    }
  }
}

describe('createWindowSessionReady — 三态', () => {
  it('本窗口已有 client ⇒ ready，且走快速路径（不做任何恢复调用）', async () => {
    const { deps } = makeDeps({ getClient: () => ({ tag: 'existing' }) })
    const s = createWindowSessionReady(deps)

    await expect(s.ensureSessionReady()).resolves.toBe('ready')

    expect(s.state.value).toBe('ready')
    expect(s.ready.value).toBe(true)
    expect(deps.hasAuthenticatedSession).not.toHaveBeenCalled()
    expect(deps.ensureClientReady).not.toHaveBeenCalled()
    expect(deps.waitForClientReady).not.toHaveBeenCalled()
  })

  it('无本地会话 ⇒ no-session，且不尝试重建 client', async () => {
    const { deps } = makeDeps({ hasAuthenticatedSession: vi.fn(async () => false) })
    const s = createWindowSessionReady(deps)

    await expect(s.ensureSessionReady()).resolves.toBe('no-session')

    expect(s.state.value).toBe('no-session')
    expect(s.ready.value).toBe(false)
    expect(s.error.value).toBeNull()
    expect(deps.ensureClientReady).not.toHaveBeenCalled()
  })

  it('ensureClientReady 抛错 ⇒ error，并把原始 message 暴露给 UI', async () => {
    const { deps } = makeDeps({
      ensureClientReady: vi.fn(async () => {
        throw new Error('access_token_missing')
      })
    })
    const s = createWindowSessionReady(deps)

    await expect(s.ensureSessionReady()).resolves.toBe('error')

    expect(s.state.value).toBe('error')
    expect(s.error.value?.message).toBe('access_token_missing')
  })

  it('ensureClientReady 静默返回但没建出 client ⇒ no-session（不是 ready）', async () => {
    const { deps } = makeDeps({ ensureClientReady: vi.fn(async () => undefined) })
    const s = createWindowSessionReady(deps)

    await expect(s.ensureSessionReady()).resolves.toBe('no-session')
    expect(deps.waitForClientReady).not.toHaveBeenCalled()
  })

  it('client 建出但等待就绪超时 ⇒ error（可重试，不落终态）', async () => {
    const { deps } = makeDeps({
      waitForClientReady: vi.fn(async () => {
        throw new Error('timeout')
      })
    })
    const s = createWindowSessionReady(deps)

    await expect(s.ensureSessionReady()).resolves.toBe('error')
    expect(s.error.value?.message).toBe('timeout')
  })

  it('全链路成功 ⇒ ready，且把超时值透传给 waitForClientReady', async () => {
    const { deps } = makeDeps()
    const s = createWindowSessionReady(deps, { timeoutMs: 1234 })

    await expect(s.ensureSessionReady()).resolves.toBe('ready')

    expect(deps.waitForClientReady).toHaveBeenCalledWith({ timeoutMs: 1234 })
    expect(s.state.value).toBe('ready')
    expect(s.pending.value).toBe(false)
  })

  it('非 Error 抛出物也会被归一化成 Error（日志可读）', async () => {
    const { deps } = makeDeps({
      hasAuthenticatedSession: vi.fn(async () => {
        throw 'boom' as unknown as Error
      })
    })
    const s = createWindowSessionReady(deps)

    await expect(s.ensureSessionReady()).resolves.toBe('error')
    expect(s.error.value).toBeInstanceOf(Error)
    expect(s.error.value?.message).toBe('boom')
  })
})

describe('createWindowSessionReady — 幂等与可重试', () => {
  it('并发调用复用同一 in-flight ⇒ ensureClientReady 只跑一次', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const ensureClientReady = vi.fn(async () => {
      await gate
    })
    const { deps, setClient } = makeDeps({ ensureClientReady })
    const s = createWindowSessionReady(deps)

    const first = s.ensureSessionReady()
    const second = s.ensureSessionReady()
    const third = s.ensureSessionReady()

    expect(s.pending.value).toBe(true)

    // 让 run() 走完 hasAuthenticatedSession 的微任务，确认恢复确实只被触发一次
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(ensureClientReady).toHaveBeenCalledTimes(1)

    setClient({ tag: 'client' })
    release()

    const results = await Promise.all([first, second, third])
    expect(results).toEqual(['ready', 'ready', 'ready'])
    expect(ensureClientReady).toHaveBeenCalledTimes(1)
    expect(s.pending.value).toBe(false)
  })

  it('已就绪后重复调用零成本（不再触发恢复）', async () => {
    const { deps } = makeDeps()
    const s = createWindowSessionReady(deps)

    await s.ensureSessionReady()
    await s.ensureSessionReady()

    expect(deps.ensureClientReady).toHaveBeenCalledTimes(1)
    expect(deps.waitForClientReady).toHaveBeenCalledTimes(1)
  })

  it('error 不落终态 ⇒ 下一次调用会真正重试', async () => {
    const { deps, setClient } = makeDeps()
    const ensureClientReady = vi
      .fn<(deps?: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new Error('first failure'))
      .mockImplementationOnce(async () => {
        setClient({ tag: 'client' })
      })
    deps.ensureClientReady = ensureClientReady
    const s = createWindowSessionReady(deps)

    await expect(s.ensureSessionReady()).resolves.toBe('error')
    expect(s.state.value).toBe('error')

    await expect(s.ensureSessionReady()).resolves.toBe('ready')
    expect(s.state.value).toBe('ready')
    expect(ensureClientReady).toHaveBeenCalledTimes(2)
    expect(s.error.value).toBeNull()
  })

  it('no-session 不落终态 ⇒ 用户随后登录，下一次调用能恢复', async () => {
    let hasSession = false
    const { deps } = makeDeps({ hasAuthenticatedSession: vi.fn(async () => hasSession) })
    const s = createWindowSessionReady(deps)

    await expect(s.ensureSessionReady()).resolves.toBe('no-session')

    hasSession = true
    await expect(s.ensureSessionReady()).resolves.toBe('ready')
    expect(deps.ensureClientReady).toHaveBeenCalledTimes(1)
  })
})
