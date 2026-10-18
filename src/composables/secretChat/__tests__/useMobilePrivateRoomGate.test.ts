import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 移动端私密房门禁。
 *
 * 背景：移动端房间路由参数是**对端 uid**，桌面那个按 `:roomId` 取号的守卫覆盖不到，
 * 于是「通知点击直达私密房」可以完全绕过门禁。本用例锁住四条判据：
 * 普通房放行 / 私密房未解锁拦下 / 私密房已解锁放行 / 登记表加载失败时**不放行**。
 */

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  ensureReady: vi.fn(),
  isPrivate: vi.fn(),
  isUnlocked: vi.fn(),
  isConfigured: vi.fn(),
  openUnlock: vi.fn(),
  showFeedback: vi.fn(),
  currentSessionRoomId: '',
  sessionList: [] as Array<{ roomId: string; detailId?: string; account?: string }>
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock('@/services/i18n', () => ({ useI18nGlobal: () => ({ t: (k: string) => k }) }))
vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: mocks.showFeedback })
}))
vi.mock('@/composables/secretChat/useSecretChatGate', () => ({ openSecretChatUnlock: mocks.openUnlock }))
vi.mock('@/services/matrix/privateChat/privateRoomRegistry', () => ({
  ensurePrivateRoomRegistryReady: mocks.ensureReady,
  isPrivateRoom: mocks.isPrivate
}))
vi.mock('@/stores/domains/chat/chat/session', () => ({
  useSessionStore: () => ({ sessionList: mocks.sessionList })
}))
vi.mock('@/stores/domains/settings/setting', () => ({
  useSettingStore: () => ({ isSecretChatConfigured: mocks.isConfigured })
}))
vi.mock('@/stores/domains/settings/secretChatSession', () => ({
  isSecretChatUnlocked: mocks.isUnlocked
}))
vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: mocks.currentSessionRoomId })
}))
vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

import { useMobilePrivateRoomGate } from '../useMobilePrivateRoomGate'

const PRIVATE_ROOM = '!private:server'
const NORMAL_ROOM = '!normal:server'

describe('useMobilePrivateRoomGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.currentSessionRoomId = NORMAL_ROOM
    mocks.sessionList = [
      { roomId: PRIVATE_ROOM, detailId: '@peer:server' },
      { roomId: NORMAL_ROOM, detailId: '@other:server' }
    ]
    mocks.isPrivate.mockImplementation((roomId: string) => roomId === PRIVATE_ROOM)
    mocks.isUnlocked.mockReturnValue(false)
    mocks.isConfigured.mockReturnValue(true)
    mocks.ensureReady.mockResolvedValue(undefined)
    mocks.replace.mockResolvedValue(undefined)
  })

  it('普通房间直接放行，不请求解锁', async () => {
    const gate = useMobilePrivateRoomGate()
    await expect(gate.assertAccess('@other:server')).resolves.toBe(true)
    expect(mocks.openUnlock).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('私密房未解锁：拦下并请求解锁（通知点击直达的路径）', async () => {
    mocks.currentSessionRoomId = '' // 冷启动深链：靠 uid 反查
    const gate = useMobilePrivateRoomGate()

    await expect(gate.assertAccess('@peer:server')).resolves.toBe(false)
    expect(mocks.openUnlock).toHaveBeenCalledWith('/mobile/message')
    expect(mocks.replace).toHaveBeenCalledWith('/mobile/message')
  })

  it('私密房已解锁：放行', async () => {
    // 必须让第一个候选为空，否则会走「非私密房提前放行」而**测不到解锁分支**
    mocks.currentSessionRoomId = ''
    mocks.isUnlocked.mockReturnValue(true)
    const gate = useMobilePrivateRoomGate()

    await expect(gate.assertAccess('@peer:server')).resolves.toBe(true)
    expect(mocks.openUnlock).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it('私密房存在但没配密码：拦下并提示，不退化成普通房', async () => {
    mocks.isConfigured.mockReturnValue(false)
    const gate = useMobilePrivateRoomGate()

    await expect(gate.assertAccess('@peer:server')).resolves.toBe(false)
    expect(mocks.showFeedback).toHaveBeenCalledWith('home.secret_chat.no_password', 'warning')
    expect(mocks.replace).toHaveBeenCalledWith('/mobile/message')
  })

  it('登记表加载失败时不放行（宁可拦错也不漏）', async () => {
    mocks.ensureReady.mockRejectedValue(new Error('account data unavailable'))
    const gate = useMobilePrivateRoomGate()

    await expect(gate.assertAccess('@peer:server')).resolves.toBe(false)
    expect(mocks.replace).toHaveBeenCalledWith('/mobile/message')
    expect(mocks.showFeedback).toHaveBeenCalledWith('home.secret_chat.registry_unavailable', 'warning')
  })

  it('resolveRoomIdByPeer 只按 detailId/account 匹配，匹配不到返回 null', () => {
    const gate = useMobilePrivateRoomGate()
    expect(gate.resolveRoomIdByPeer('@peer:server')).toBe(PRIVATE_ROOM)
    expect(gate.resolveRoomIdByPeer('@nobody:server')).toBeNull()
    expect(gate.resolveRoomIdByPeer(undefined)).toBeNull()
  })
})
