import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const { getAntiScreenshotMock, setAntiScreenshotMock } = vi.hoisted(() => ({
  getAntiScreenshotMock: vi.fn(),
  setAntiScreenshotMock: vi.fn()
}))

vi.mock('@/services/matrix/room/AccountDataService', () => ({
  matrixRoomAccountDataService: {
    getAntiScreenshot: getAntiScreenshotMock,
    setAntiScreenshot: setAntiScreenshotMock
  }
}))

import { useRoomAntiScreenshot } from '../useRoomAntiScreenshot'

describe('useRoomAntiScreenshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refresh 读到 enabled=true 时置为 true', async () => {
    getAntiScreenshotMock.mockResolvedValue({ enabled: true })
    const roomId = ref<string | null>('!room:example.com')
    const { enabled, refresh } = useRoomAntiScreenshot(roomId)

    await refresh()

    expect(getAntiScreenshotMock).toHaveBeenCalledWith('!room:example.com')
    expect(enabled.value).toBe(true)
  })

  // 读失败时不显示水印：宁可"看起来没保护"，也不要谎称已在保护用户
  it('refresh 抛错时按未启用处理且记录 error', async () => {
    getAntiScreenshotMock.mockRejectedValue(new Error('boom'))
    const roomId = ref<string | null>('!room:example.com')
    const { enabled, error, refresh } = useRoomAntiScreenshot(roomId)

    await refresh()

    expect(enabled.value).toBe(false)
    expect(error.value).toBeInstanceOf(Error)
  })

  it('roomId 为空时不发请求并复位', async () => {
    getAntiScreenshotMock.mockResolvedValue({ enabled: true })
    const roomId = ref<string | null>('!room:example.com')
    const { enabled, refresh } = useRoomAntiScreenshot(roomId)
    await refresh()
    expect(enabled.value).toBe(true)

    roomId.value = null
    await nextTick()

    expect(enabled.value).toBe(false)
  })

  it('roomId 变化会重新读取（切换会话不必手动调 refresh）', async () => {
    getAntiScreenshotMock.mockResolvedValue({ enabled: false })
    const roomId = ref<string | null>('!a:example.com')
    useRoomAntiScreenshot(roomId)

    roomId.value = '!b:example.com'
    await nextTick()
    await Promise.resolve()

    expect(getAntiScreenshotMock).toHaveBeenCalledWith('!b:example.com')
  })

  it('setEnabled 乐观更新，成功后保留新值', async () => {
    setAntiScreenshotMock.mockResolvedValue(undefined)
    const roomId = ref<string | null>('!room:example.com')
    const { enabled, setEnabled } = useRoomAntiScreenshot(roomId)

    const promise = setEnabled(true)
    // 乐观：调用未完成时 UI 已经切到新状态
    expect(enabled.value).toBe(true)
    await expect(promise).resolves.toBe(true)

    expect(setAntiScreenshotMock).toHaveBeenCalledWith('!room:example.com', true)
  })

  // 关键：不能让 UI 显示一个服务端没接受的设置
  it('setEnabled 失败时回滚到原值并返回 false', async () => {
    setAntiScreenshotMock.mockRejectedValue(new Error('403'))
    const roomId = ref<string | null>('!room:example.com')
    const { enabled, setEnabled, error } = useRoomAntiScreenshot(roomId)

    await expect(setEnabled(true)).resolves.toBe(false)

    expect(enabled.value).toBe(false)
    expect(error.value).toBeInstanceOf(Error)
  })

  it('roomId 为空时 setEnabled 直接返回 false 且不发请求', async () => {
    const roomId = ref<string | null>(null)
    const { setEnabled } = useRoomAntiScreenshot(roomId)

    await expect(setEnabled(true)).resolves.toBe(false)

    expect(setAntiScreenshotMock).not.toHaveBeenCalled()
  })
})
