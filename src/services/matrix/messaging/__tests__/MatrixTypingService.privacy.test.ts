import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { matrixTypingService } from '../MatrixTypingService'

const { startTypingMock, stopTypingMock } = vi.hoisted(() => ({
  startTypingMock: vi.fn().mockResolvedValue(undefined),
  stopTypingMock: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/services/matrix/MatrixClientService', () => ({
  default: {
    getClient: () => ({
      getTypingManager: () => ({ startTyping: startTypingMock, stopTyping: stopTypingMock })
    })
  }
}))

describe('MatrixTypingService 尊重「发送输入中提示」偏好', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('关闭偏好后不再发送 typing=true', async () => {
    useSettingStore().setSendTypingNotificationsEnabled(false)
    await matrixTypingService.sendTypingNotification('!r:x', true)
    expect(startTypingMock).not.toHaveBeenCalled()
  })

  it('关闭偏好时仍必须发送停止信号，避免对方界面卡在"正在输入"', async () => {
    useSettingStore().setSendTypingNotificationsEnabled(false)
    await matrixTypingService.sendTypingNotification('!r:x', false)
    expect(stopTypingMock).toHaveBeenCalledWith('!r:x')
  })

  it('偏好开启时正常发送', async () => {
    useSettingStore().setSendTypingNotificationsEnabled(true)
    await matrixTypingService.sendTypingNotification('!r:x', true)
    expect(startTypingMock).toHaveBeenCalled()
  })

  it('关闭偏好后 startTyping 走的是同一个守卫，不发送也不做 cleanup 记账', async () => {
    useSettingStore().setSendTypingNotificationsEnabled(false)
    matrixTypingService.startTyping('!r:y', 30000)
    await Promise.resolve()
    expect(startTypingMock).not.toHaveBeenCalled()
  })
})
