import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const getThreadMock = vi.fn()

vi.mock('@/services/matrix/messaging/MatrixThreadService', () => ({
  matrixThreadService: {
    getThread: (...args: unknown[]) => getThreadMock(...args)
  }
}))

const { useThreadIndicator } = await import('@/composables/messaging/useThreadIndicator')

describe('useThreadIndicator', () => {
  beforeEach(() => {
    getThreadMock.mockReset()
  })

  it('读取线程回复数并派生 hasReplies', () => {
    getThreadMock.mockReturnValue({ replyCount: 3 })
    const { replyCount, hasReplies, loadThreadInfo } = useThreadIndicator(
      () => '!room:test',
      () => '$event:test'
    )

    loadThreadInfo()

    expect(getThreadMock).toHaveBeenCalledWith('!room:test', '$event:test')
    expect(replyCount.value).toBe(3)
    expect(hasReplies.value).toBe(true)
  })

  it('线程不存在时保持 0 且 hasReplies 为 false', () => {
    getThreadMock.mockReturnValue(null)
    const { replyCount, hasReplies, loadThreadInfo } = useThreadIndicator(
      () => '!room:test',
      () => '$event:test'
    )

    loadThreadInfo()

    expect(replyCount.value).toBe(0)
    expect(hasReplies.value).toBe(false)
  })

  it('响应式 roomId/eventId 变化后按最新值读取', () => {
    const roomId = ref('!a:test')
    const eventId = ref('$a:test')
    getThreadMock.mockReturnValue({ replyCount: 1 })
    const { loadThreadInfo } = useThreadIndicator(roomId, eventId)

    loadThreadInfo()
    expect(getThreadMock).toHaveBeenLastCalledWith('!a:test', '$a:test')

    roomId.value = '!b:test'
    eventId.value = '$b:test'
    loadThreadInfo()
    expect(getThreadMock).toHaveBeenLastCalledWith('!b:test', '$b:test')
  })
})
