import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `clearAllData` 的判据（§19.14 已知边界 3 的收口）。
 *
 * 这条容易写成「清数据就完事」，但 `membersMap` 与 `memberLoadErrors` 是**两套映射**：
 * 只清前者会留下「幽灵 partial」—— 同 roomId 下次进入直接读到旧错误，横幅一直挂到
 * 有一次成功加载把它覆盖掉。所以这里同时断言「数据清空」与「错误映射清空」两件事。
 */
const { clearMembersLoadErrorsMock } = vi.hoisted(() => ({ clearMembersLoadErrorsMock: vi.fn() }))

vi.mock('@/services/matrix/room/RoomFacade', () => ({
  matrixRoomActionFacade: {
    inviteUser: vi.fn(),
    kickUser: vi.fn(),
    banUser: vi.fn(),
    leaveRoom: vi.fn(),
    forgetRoom: vi.fn()
  }
}))

vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSessionRoomId: '' })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

import { createGroupLifecycle } from '../lifecycle'

const makeCtx = () => ({
  membersMap: { '!a:hs': [{ userId: '@u:hs' }] } as Record<string, Array<{ userId: string }>>,
  groupInfoMap: { '!a:hs': { roomId: '!a:hs' } } as Record<string, unknown>,
  loadRoomMembers: vi.fn(),
  loadGroupInfo: vi.fn(),
  clearMembersLoadErrors: clearMembersLoadErrorsMock
})

describe('GroupLifecycle.clearAllData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('清空成员与群信息缓存，同时清空成员加载错误映射', () => {
    const ctx = makeCtx()
    const lifecycle = createGroupLifecycle(ctx as never)

    lifecycle.clearAllData()

    expect(Object.keys(ctx.membersMap)).toHaveLength(0)
    expect(Object.keys(ctx.groupInfoMap)).toHaveLength(0)
    // 关键：错误映射必须一起清，否则换会话/换账号后同 roomId 会读到旧错误
    expect(clearMembersLoadErrorsMock).toHaveBeenCalledTimes(1)
  })
})
