import { describe, expect, it, vi } from 'vitest'

/**
 * `contextMenuHelpers.requireDesktop` 的判据（§19.24）。
 *
 * 这条守卫的行为很窄但很容易写错方向：移动端**要给提示并中断**，桌面端**直接放行**。
 * 平台事实现在由 deps 注入（`usePlatform.isDesktop()`），所以这里能直接驱动两端，
 * 不需要 mock `PlatformConstants`。
 */
const { showFeedbackMock } = vi.hoisted(() => ({ showFeedbackMock: vi.fn() }))

vi.mock('@/composables/common/useMitt', () => ({ useMitt: { emit: vi.fn() } }))

import { createContextMenuHelpers } from '../contextMenuHelpers'

const makeHelpers = (isDesktop: boolean) =>
  createContextMenuHelpers({
    isDesktop,
    t: ((key: string) => key) as never,
    showFeedback: showFeedbackMock as never,
    chatStore: {
      getMessage: vi.fn(),
      clearMsgCheck: vi.fn(),
      setMsgMultiChoose: vi.fn()
    } as never,
    contactStore: { contactsList: [] } as never,
    userStore: { userInfo: { uid: '@me:hs' } } as never
  })

describe('contextMenuHelpers.requireDesktop', () => {
  it('桌面端放行且不弹提示', () => {
    showFeedbackMock.mockClear()
    const helpers = makeHelpers(true)

    expect(helpers.requireDesktop()).toBe(true)
    expect(showFeedbackMock).not.toHaveBeenCalled()
  })

  it('移动端返回 false 并提示「敬请期待」', () => {
    showFeedbackMock.mockClear()
    const helpers = makeHelpers(false)

    expect(helpers.requireDesktop()).toBe(false)
    expect(showFeedbackMock).toHaveBeenCalledWith('home.chat_main.feature.coming_soon', 'warning')
  })

  it('好友关系判定：friend 只认好友，all 含自己', () => {
    const helpers = makeHelpers(true)

    // 自己的 uid 不算「好友」但算「好友或自己」
    expect(helpers.checkFriendRelation('@me:hs', 'friend')).toBe(false)
    expect(helpers.checkFriendRelation('@me:hs', 'all')).toBe(true)
    expect(helpers.checkFriendRelation('@stranger:hs', 'all')).toBe(false)
  })
})
