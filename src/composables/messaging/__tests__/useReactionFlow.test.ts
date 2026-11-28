import { beforeEach, describe, expect, it, vi } from 'vitest'

const toggleReactionMock = vi.hoisted(() => vi.fn())
const addReactionMock = vi.hoisted(() => vi.fn())
const getReactionsForEventMock = vi.hoisted(() => vi.fn((): unknown[] => []))
const refreshReactionsMock = vi.hoisted(() => vi.fn(async () => []))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/composables/common/useActionFeedback', () => ({
  useActionFeedback: () => ({ showFeedback: vi.fn() })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })
}))

vi.mock('@/services/matrix/messaging/MatrixReactionService', () => ({
  matrixReactionService: {
    toggleReaction: toggleReactionMock,
    addReaction: addReactionMock,
    getReactionsForEvent: getReactionsForEventMock,
    refreshReactions: refreshReactionsMock,
    removeReaction: vi.fn(),
    findUserReaction: vi.fn()
  }
}))

import { useReactionFlow } from '../useReactionFlow'

describe('useReactionFlow', () => {
  beforeEach(() => {
    toggleReactionMock.mockReset()
    addReactionMock.mockReset()
    getReactionsForEventMock.mockReset()
    getReactionsForEventMock.mockReturnValue([])
    refreshReactionsMock.mockReset()
    refreshReactionsMock.mockResolvedValue([])
  })

  it('forceRefresh 时忽略本地陈旧聚合，直接以服务端结果为准', async () => {
    // 本地关系容器仍留着已撤回反应的副本（计数 1），服务端已无有效回应。
    getReactionsForEventMock.mockReturnValue([{ key: '1', count: 1, me: true, users: ['@me:x'] }])
    const flow = useReactionFlow({ roomId: () => '!r:s', eventId: () => '$e' })

    await flow.getReactions({ forceRefresh: true })

    expect(refreshReactionsMock).toHaveBeenCalledWith('!r:s', '$e')
    expect(flow.reactions.value).toEqual([])
  })

  it('非强制刷新时优先读本地聚合（避免每条消息发请求）', async () => {
    getReactionsForEventMock.mockReturnValue([{ key: '👍', count: 1, me: false, users: ['@a:x'] }])
    const flow = useReactionFlow({ roomId: () => '!r:s', eventId: () => '$e' })

    await flow.getReactions()

    expect(refreshReactionsMock).not.toHaveBeenCalled()
    expect(flow.reactions.value).toHaveLength(1)
  })

  it('忽略同一 emoji 在提交中的重复点击（toggleReaction）', async () => {
    let resolveToggle: () => void = () => {}
    toggleReactionMock.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveToggle = resolve
      })
    )
    const flow = useReactionFlow({ roomId: () => '!r:s', eventId: () => '$e' })

    const first = flow.toggleReaction('👍')
    await flow.toggleReaction('👍')

    expect(toggleReactionMock).toHaveBeenCalledTimes(1)

    resolveToggle()
    await first
  })

  it('忽略同一 emoji 在提交中的重复点击（addReaction）', async () => {
    let resolveAdd: (value: string) => void = () => {}
    addReactionMock.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveAdd = resolve
      })
    )
    const flow = useReactionFlow({ roomId: () => '!r:s', eventId: () => '$e' })

    const first = flow.addReaction('❤️')
    const second = await flow.addReaction('❤️')

    expect(second).toBe(false)
    expect(addReactionMock).toHaveBeenCalledTimes(1)

    resolveAdd('$reaction')
    await expect(first).resolves.toBe(true)
  })
})
