import { describe, expect, it, vi } from 'vitest'

/**
 * `contextMenuHelpers` 的判据。
 *
 * 平台守卫已从 helpers 上移到菜单列表（`visible: () => isDesktop`），
 * 所以这里只覆盖仍留在 helpers 里的好友关系判定。
 */
const { showFeedbackMock } = vi.hoisted(() => ({ showFeedbackMock: vi.fn() }))

vi.mock('@/composables/common/useMitt', () => ({ useMitt: { emit: vi.fn() } }))

import { createContextMenuHelpers } from '../contextMenuHelpers'

const makeHelpers = () =>
  createContextMenuHelpers({
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

describe('contextMenuHelpers 好友关系', () => {
  it('好友关系判定：friend 只认好友，all 含自己', () => {
    const helpers = makeHelpers()

    // 自己的 uid 不算「好友」但算「好友或自己」
    expect(helpers.checkFriendRelation('@me:hs', 'friend')).toBe(false)
    expect(helpers.checkFriendRelation('@me:hs', 'all')).toBe(true)
    expect(helpers.checkFriendRelation('@stranger:hs', 'all')).toBe(false)
  })
})
