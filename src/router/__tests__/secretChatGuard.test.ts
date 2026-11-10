import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSecretChatGuard, extractRoomId } from '../secretChatGuard'

const createRoute = (path: string, name: string | null, params: Record<string, unknown> = {}, fullPath = path) =>
  ({
    path,
    name,
    params,
    fullPath,
    matched: [{ meta: {} }],
    meta: {}
  }) as any

const PRIVATE_ROOM = '!private:example.com'
const NORMAL_ROOM = '!normal:example.com'

interface Harness {
  guard: ReturnType<typeof createSecretChatGuard>
  isConfigured: ReturnType<typeof vi.fn>
  isUnlocked: ReturnType<typeof vi.fn>
  ensureRegistryReady: ReturnType<typeof vi.fn>
  openUnlock: ReturnType<typeof vi.fn>
  warnNotConfigured: ReturnType<typeof vi.fn>
  warn: ReturnType<typeof vi.fn>
}

const createHarness = (privateRoomId: string = PRIVATE_ROOM, fallbackPath = '/message'): Harness => {
  const isConfigured = vi.fn(async () => true)
  const isUnlocked = vi.fn(async () => true)
  const ensureRegistryReady = vi.fn(async () => {})
  const openUnlock = vi.fn(async () => {})
  const warnNotConfigured = vi.fn(async () => {})
  const warn = vi.fn()
  const guard = createSecretChatGuard({
    logger: { warn },
    fallbackPath,
    isConfigured,
    isUnlocked,
    isPrivateRoom: async (roomId: string) => roomId === privateRoomId,
    ensureRegistryReady,
    openUnlock,
    warnNotConfigured
  })
  return { guard, isConfigured, isUnlocked, ensureRegistryReady, openUnlock, warnNotConfigured, warn }
}

describe('extractRoomId', () => {
  it('从 message / windowChat 路由取 roomId', () => {
    expect(extractRoomId(createRoute('/message/!a:b', 'message', { roomId: '!a:b' }))).toBe('!a:b')
    expect(extractRoomId(createRoute('/window/chat/!a:b', 'windowChat', { roomId: '!a:b' }))).toBe('!a:b')
  })

  it('数组参数取首个元素', () => {
    expect(extractRoomId(createRoute('/message/!a:b', 'message', { roomId: ['!a:b'] }))).toBe('!a:b')
  })

  it('非房间路由不返回 roomId（避免误拦房间目录等页面）', () => {
    // /room/:roomId 是房间目录详情，不是聊天房间
    expect(extractRoomId(createRoute('/room/!a:b', 'room-details', { roomId: '!a:b' }))).toBeNull()
    expect(extractRoomId(createRoute('/message', 'message', {}))).toBeNull()
    expect(extractRoomId(createRoute('/message/', 'message', { roomId: '' }))).toBeNull()
  })
})

describe('secretChatGuard — /secretChat 列表页', () => {
  let h: Harness
  beforeEach(() => {
    h = createHarness()
  })

  it('未配置密码时挡回并提示', async () => {
    h.isConfigured.mockResolvedValue(false)
    const result = await h.guard(createRoute('/secretChat', 'secretChat'))
    expect(result).toBe('/message')
    expect(h.warnNotConfigured).toHaveBeenCalledTimes(1)
    expect(h.openUnlock).not.toHaveBeenCalled()
  })

  it('已配置未解锁时弹解锁框并挡回，且记录完整路径', async () => {
    h.isUnlocked.mockResolvedValue(false)
    const result = await h.guard(createRoute('/secretChat', 'secretChat', {}, '/secretChat?x=1'))
    expect(result).toBe('/message')
    expect(h.openUnlock).toHaveBeenCalledWith('/secretChat?x=1')
  })

  it('已配置已解锁放行', async () => {
    const result = await h.guard(createRoute('/secretChat', 'secretChat'))
    expect(result).toBe(true)
    expect(h.openUnlock).not.toHaveBeenCalled()
  })
})

describe('secretChatGuard — 移动端 /mobile/secretChat 列表页', () => {
  it('未解锁时弹解锁框并记录移动端完整路径，挡回移动端消息列表', async () => {
    const h = createHarness(PRIVATE_ROOM, '/mobile/message')
    h.isUnlocked.mockResolvedValue(false)
    const result = await h.guard(createRoute('/mobile/secretChat', 'mobileSecretChat'))
    expect(result).toBe('/mobile/message')
    expect(h.openUnlock).toHaveBeenCalledWith('/mobile/secretChat')
  })

  it('已配置已解锁放行', async () => {
    const h = createHarness(PRIVATE_ROOM, '/mobile/message')
    const result = await h.guard(createRoute('/mobile/secretChat', 'mobileSecretChat'))
    expect(result).toBe(true)
    expect(h.openUnlock).not.toHaveBeenCalled()
  })
})

describe('secretChatGuard — 具体房间（兜底）', () => {
  let h: Harness
  beforeEach(() => {
    h = createHarness()
  })

  it('普通房间不触发登记表加载之外的任何门禁动作', async () => {
    const result = await h.guard(createRoute(`/message/${NORMAL_ROOM}`, 'message', { roomId: NORMAL_ROOM }))
    expect(result).toBe(true)
    expect(h.openUnlock).not.toHaveBeenCalled()
    expect(h.isUnlocked).not.toHaveBeenCalled()
  })

  it('私密房间未解锁时弹解锁框并挡回（即使绕过列表页直达）', async () => {
    h.isUnlocked.mockResolvedValue(false)
    const path = `/message/${PRIVATE_ROOM}`
    const result = await h.guard(createRoute(path, 'message', { roomId: PRIVATE_ROOM }, path))
    expect(result).toBe('/message')
    expect(h.ensureRegistryReady).toHaveBeenCalledTimes(1)
    expect(h.openUnlock).toHaveBeenCalledWith(path)
  })

  it('私密房间已解锁时放行', async () => {
    const result = await h.guard(createRoute(`/message/${PRIVATE_ROOM}`, 'message', { roomId: PRIVATE_ROOM }))
    expect(result).toBe(true)
  })

  it('独立聊天窗口同样受门禁约束', async () => {
    h.isUnlocked.mockResolvedValue(false)
    const result = await h.guard(createRoute(`/window/chat/${PRIVATE_ROOM}`, 'windowChat', { roomId: PRIVATE_ROOM }))
    expect(result).toBe('/message')
    expect(h.openUnlock).toHaveBeenCalledTimes(1)
  })

  it('私密房间但当前账号无密码配置时不放行（避免退化成普通房）', async () => {
    h.isConfigured.mockResolvedValue(false)
    const result = await h.guard(createRoute(`/message/${PRIVATE_ROOM}`, 'message', { roomId: PRIVATE_ROOM }))
    expect(result).toBe('/message')
    expect(h.warnNotConfigured).toHaveBeenCalledTimes(1)
  })

  it('非房间路由不触发登记表加载', async () => {
    const result = await h.guard(createRoute('/settings', 'settings'))
    expect(result).toBe(true)
    expect(h.ensureRegistryReady).not.toHaveBeenCalled()
  })
})
