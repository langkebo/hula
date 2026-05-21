import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('useAriaLive', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.resetModules()
  })

  it('announce: 添加消息到 messages', async () => {
    const { useAriaLive } = await import('../useAriaLive')
    const { messages, announce } = useAriaLive()

    announce('测试消息')

    expect(messages.value).toHaveLength(1)
    expect(messages.value[0].text).toBe('测试消息')
  })

  it('announce: 默认 politeness 为 polite', async () => {
    const { useAriaLive } = await import('../useAriaLive')
    const { messages, announce } = useAriaLive()

    announce('默认消息')

    expect(messages.value[0].politeness).toBe('polite')
  })

  it('announce: 自定义 politeness 为 assertive', async () => {
    const { useAriaLive } = await import('../useAriaLive')
    const { messages, announce } = useAriaLive()

    announce('紧急消息', 'assertive')

    expect(messages.value[0].politeness).toBe('assertive')
  })

  it('announce: 消息在 1000ms 后自动清除', async () => {
    const { useAriaLive } = await import('../useAriaLive')
    const { messages, announce } = useAriaLive()

    announce('临时消息')

    expect(messages.value).toHaveLength(1)

    vi.advanceTimersByTime(999)
    expect(messages.value).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(messages.value).toHaveLength(0)
  })

  it('clearAnnouncements: 清除所有消息', async () => {
    const { useAriaLive } = await import('../useAriaLive')
    const { messages, announce, clearAnnouncements } = useAriaLive()

    announce('消息1')
    announce('消息2')
    announce('消息3')

    expect(messages.value).toHaveLength(3)

    clearAnnouncements()

    expect(messages.value).toHaveLength(0)
  })

  it('多次 announce 递增 id', async () => {
    const { useAriaLive } = await import('../useAriaLive')
    const { messages, announce } = useAriaLive()

    announce('第一条')
    announce('第二条')
    announce('第三条')

    const ids = messages.value.map((m) => m.id)
    expect(ids[1]).toBeGreaterThan(ids[0])
    expect(ids[2]).toBeGreaterThan(ids[1])
  })
})
