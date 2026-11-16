import { describe, expect, it, vi } from 'vitest'
import { createMessageSessionReset } from '../messageSessionReset'

/**
 * `clearAllMessages` 的判据（§19.20）。
 *
 * 关键在于它是**跨房间、跨结构**的清理：消息表、排序键、分页选项、回复映射、
 * 未读计数、撤回态六套状态必须一起丢。漏掉任何一套，换账号后都会读到上一个账号的残留
 * （比如「未读角标还在」「回复引用还指着别人的消息」）。
 */
const makeDeps = () => ({
  messageMap: { '!a:hs': { m1: {} }, '!b:hs': { m2: {} } } as Record<string, Record<string, unknown>>,
  sortedMessageKeys: { '!a:hs': ['m1'], '!b:hs': ['m2'] } as Record<string, string[]>,
  messageOptions: {
    '!a:hs': { isLast: false, isLoading: false, cursor: 'c1', hasLoadedOnce: true },
    '!b:hs': { isLast: true, isLoading: false, cursor: '', hasLoadedOnce: true }
  } as Record<string, unknown>,
  replyMapping: { '!a:hs': { m1: ['r1'] } } as Record<string, Record<string, string[]>>,
  newMsgCount: { '!a:hs': { count: 3, isStart: false } } as Record<string, { count: number; isStart: boolean }>,
  currentMsgReply: { value: { message: { id: 'm1' } } } as { value: Record<string, unknown> },
  recallMgr: { clearAllExpirationTimers: vi.fn() }
})

describe('createMessageSessionReset', () => {
  it('一次清空六套状态：消息表 / 排序键 / 分页选项 / 回复映射 / 未读计数 / 撤回态', () => {
    const deps = makeDeps()
    const { clearAllMessages } = createMessageSessionReset(deps as never)

    clearAllMessages()

    expect(Object.keys(deps.messageMap)).toHaveLength(0)
    expect(Object.keys(deps.sortedMessageKeys)).toHaveLength(0)
    expect(Object.keys(deps.messageOptions)).toHaveLength(0)
    expect(Object.keys(deps.replyMapping)).toHaveLength(0)
    expect(Object.keys(deps.newMsgCount)).toHaveLength(0)
    expect(deps.currentMsgReply.value).toEqual({})
    expect(deps.recallMgr.clearAllExpirationTimers).toHaveBeenCalledTimes(1)
  })

  it('重复调用是幂等的（登出 + 账号重置会连着触发两次）', () => {
    const deps = makeDeps()
    const { clearAllMessages } = createMessageSessionReset(deps as never)

    clearAllMessages()
    expect(() => clearAllMessages()).not.toThrow()
    expect(Object.keys(deps.messageMap)).toHaveLength(0)
  })

  it('空 store 上调用不报错（未登录状态直接登出）', () => {
    const deps = makeDeps()
    deps.messageMap = {}
    deps.sortedMessageKeys = {}
    deps.messageOptions = {}
    deps.replyMapping = {}
    deps.newMsgCount = {}

    const { clearAllMessages } = createMessageSessionReset(deps as never)

    expect(() => clearAllMessages()).not.toThrow()
    expect(deps.recallMgr.clearAllExpirationTimers).toHaveBeenCalledTimes(1)
  })
})
