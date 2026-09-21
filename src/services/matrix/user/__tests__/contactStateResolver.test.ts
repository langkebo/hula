import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type ContactState, createContactStateResolver } from '../contactStateResolver'

/**
 * 联系人状态的解析与缓存。
 *
 * 为什么需要三态：`MatrixFriendService.isFriend()` 在查询失败时**返回 false**，
 * 与"确认不是好友"不可区分。若把 false 直接当陌生人，后端抖动一次就会把
 * 所有好友的邀请拒掉。所以失败必须是 `unknown`，并且 `unknown` 不参与拒邀。
 */

describe('createContactStateResolver', () => {
  let isFriend: ReturnType<typeof vi.fn<(userId: string) => Promise<boolean>>>

  beforeEach(() => {
    isFriend = vi.fn()
  })

  it('reports contact when the lookup confirms friendship', async () => {
    isFriend.mockResolvedValue(true)
    const resolver = createContactStateResolver({ isFriend })
    await expect(resolver.resolve('@a:b')).resolves.toBe('contact')
  })

  it('reports stranger when the lookup denies friendship', async () => {
    isFriend.mockResolvedValue(false)
    const resolver = createContactStateResolver({ isFriend })
    await expect(resolver.resolve('@a:b')).resolves.toBe('stranger')
  })

  it('reports unknown when the lookup throws', async () => {
    isFriend.mockRejectedValue(new Error('offline'))
    const resolver = createContactStateResolver({ isFriend })
    await expect(resolver.resolve('@a:b')).resolves.toBe('unknown')
  })

  it('reports unknown for a blank user id without calling the lookup', async () => {
    const resolver = createContactStateResolver({ isFriend })
    await expect(resolver.resolve('   ')).resolves.toBe('unknown')
    expect(isFriend).not.toHaveBeenCalled()
  })

  it('reports unknown for non-string input', async () => {
    const resolver = createContactStateResolver({ isFriend })
    await expect(resolver.resolve(undefined as never)).resolves.toBe('unknown')
    expect(isFriend).not.toHaveBeenCalled()
  })

  it('caches a confirmed result and does not re-query', async () => {
    isFriend.mockResolvedValue(true)
    const resolver = createContactStateResolver({ isFriend })
    await resolver.resolve('@a:b')
    await resolver.resolve('@a:b')
    expect(isFriend).toHaveBeenCalledTimes(1)
  })

  it('caches a negative result too', async () => {
    isFriend.mockResolvedValue(false)
    const resolver = createContactStateResolver({ isFriend })
    await resolver.resolve('@a:b')
    await resolver.resolve('@a:b')
    expect(isFriend).toHaveBeenCalledTimes(1)
  })

  it('does not cache unknown, so a later success can still confirm', async () => {
    isFriend.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(true)
    const resolver = createContactStateResolver({ isFriend })
    await expect(resolver.resolve('@a:b')).resolves.toBe('unknown')
    await expect(resolver.resolve('@a:b')).resolves.toBe('contact')
    expect(isFriend).toHaveBeenCalledTimes(2)
  })

  it('dedupes concurrent lookups for the same user', async () => {
    let release: ((v: boolean) => void) | undefined
    isFriend.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          release = resolve
        })
    )
    const resolver = createContactStateResolver({ isFriend })
    const first = resolver.resolve('@a:b')
    const second = resolver.resolve('@a:b')
    release?.(true)
    await expect(Promise.all([first, second])).resolves.toEqual(['contact', 'contact'])
    expect(isFriend).toHaveBeenCalledTimes(1)
  })

  it('expires cached entries after the ttl', async () => {
    isFriend.mockResolvedValue(true)
    let now = 1_000
    const resolver = createContactStateResolver({ isFriend, ttlMs: 100, now: () => now })
    await resolver.resolve('@a:b')
    now = 1_050
    await resolver.resolve('@a:b')
    expect(isFriend).toHaveBeenCalledTimes(1)
    now = 1_200
    await resolver.resolve('@a:b')
    expect(isFriend).toHaveBeenCalledTimes(2)
  })

  it('seed() preloads confirmed contacts without querying', async () => {
    const resolver = createContactStateResolver({ isFriend })
    resolver.seed(['@friend:server'])
    await expect(resolver.resolve('@friend:server')).resolves.toBe('contact')
    expect(isFriend).not.toHaveBeenCalled()
  })

  it('seed() normalizes whitespace and ignores blanks', async () => {
    const resolver = createContactStateResolver({ isFriend })
    resolver.seed(['  @friend:server ', '', '   '])
    await expect(resolver.resolve('@friend:server')).resolves.toBe('contact')
  })

  it('exposes a clear() for logout', async () => {
    isFriend.mockResolvedValue(true)
    const resolver = createContactStateResolver({ isFriend })
    await resolver.resolve('@a:b')
    resolver.clear()
    await resolver.resolve('@a:b')
    expect(isFriend).toHaveBeenCalledTimes(2)
  })

  it('the returned states are exactly the three documented values', () => {
    const states: ContactState[] = ['contact', 'stranger', 'unknown']
    expect(states).toHaveLength(3)
  })
})
