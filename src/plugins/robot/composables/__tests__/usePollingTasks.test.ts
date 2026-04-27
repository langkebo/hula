import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePollingTasks } from '../usePollingTasks'

describe('usePollingTasks', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('register stores task metadata and marks task as active', () => {
    const tasks = usePollingTasks()

    tasks.register(101, 'chat-1', 9001)

    expect(tasks.has(101)).toBe(true)
    expect(tasks.get(101)).toMatchObject({
      timerId: 9001,
      conversationId: 'chat-1'
    })
    expect(typeof tasks.get(101)?.startedAt).toBe('number')
  })

  it('stop clears interval and removes task', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const tasks = usePollingTasks()

    tasks.register(102, 'chat-1', 9002)
    tasks.stop(102)

    expect(clearIntervalSpy).toHaveBeenCalledWith(9002)
    expect(tasks.has(102)).toBe(false)
  })

  it('stopAll clears every timer and empties the registry', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const tasks = usePollingTasks()

    tasks.register(201, 'chat-1', 9101)
    tasks.register(202, 'chat-2', 9102)

    tasks.stopAll()

    expect(clearIntervalSpy).toHaveBeenCalledWith(9101)
    expect(clearIntervalSpy).toHaveBeenCalledWith(9102)
    expect(tasks.has(201)).toBe(false)
    expect(tasks.has(202)).toBe(false)
  })

  it('stopByConversation only clears timers for the target conversation', () => {
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')
    const tasks = usePollingTasks()

    tasks.register(301, 'chat-1', 9201)
    tasks.register(302, 'chat-1', 9202)
    tasks.register(303, 'chat-2', 9203)

    tasks.stopByConversation('chat-1')

    expect(clearIntervalSpy).toHaveBeenCalledWith(9201)
    expect(clearIntervalSpy).toHaveBeenCalledWith(9202)
    expect(clearIntervalSpy).not.toHaveBeenCalledWith(9203)
    expect(tasks.has(301)).toBe(false)
    expect(tasks.has(302)).toBe(false)
    expect(tasks.has(303)).toBe(true)
  })
})
