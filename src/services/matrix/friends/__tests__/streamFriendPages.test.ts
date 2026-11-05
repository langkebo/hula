import { describe, expect, it, vi } from 'vitest'
import { streamFriendPages } from '../friendUtils'

const page = (ids: string[], nextBatch: string | null = null) => ({
  friends: ids.map((id, i) => ({ user_id: id, since: i + 1 })),
  nextBatch
})

/**
 * F-6：好友列表流式分页的逐页产出器。
 *
 * 后端游标分页是**串行**的（第 N 页要等第 N-1 页的 `nextBatch`），「并行预取」不成立；
 * 能优化的只有「别让首屏等完所有页」—— 本函数就是那个逐页产出器。
 */
describe('streamFriendPages', () => {
  it('逐页 yield，并把游标正确传给下一次请求', async () => {
    const load = vi.fn()
    load.mockResolvedValueOnce(page(['@a:hs', '@b:hs'], 'c2'))
    load.mockResolvedValueOnce(page(['@c:hs'], null))

    const pages: string[][] = []
    for await (const p of streamFriendPages(load)) {
      pages.push(p.friends.map((f) => f.user_id))
    }

    expect(pages).toEqual([['@a:hs', '@b:hs'], ['@c:hs']])
    expect(load.mock.calls[0][0]).toBeUndefined() // 首页不带游标
    expect(load.mock.calls[1][0]).toBe('c2')
  })

  it('末页（nextBatch=null）即结束，不再多发请求', async () => {
    const load = vi.fn().mockResolvedValueOnce(page(['@a:hs'], null))

    const pages: unknown[] = []
    for await (const p of streamFriendPages(load)) pages.push(p)

    expect(pages).toHaveLength(1)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('游标永不到头时按上限收敛（不无限循环）', async () => {
    const load = vi.fn().mockResolvedValue(page(['@a:hs'], 'always-more'))

    let count = 0
    for await (const _ of streamFriendPages(load)) count++

    expect(count).toBe(10)
    expect(load).toHaveBeenCalledTimes(10)
  })

  it('失败向上抛出，且不产出空页（避免把失败渲染成「没有好友」）', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('HTTP 503'))

    const pages: unknown[] = []
    const consume = async () => {
      for await (const p of streamFriendPages(load)) pages.push(p)
    }

    await expect(consume()).rejects.toThrow('503')
    expect(pages).toHaveLength(0)
  })
})
