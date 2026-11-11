import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registerPrivacyPreferenceHooks } from '@/services/matrix/privacyPreferences'
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

/** 服务层不再直接读 store，偏好通过注入点提供 */
const setTypingPreference = (enabled: boolean) => {
  registerPrivacyPreferenceHooks({
    isSendTypingNotificationsEnabled: () => enabled,
    isShowOnlineStatusEnabled: () => true
  })
}

describe('MatrixTypingService 尊重「发送输入中提示」偏好', () => {
  beforeEach(() => {
    setTypingPreference(true)
    vi.clearAllMocks()
  })

  it('关闭偏好后不再发送 typing=true', async () => {
    setTypingPreference(false)
    await matrixTypingService.sendTypingNotification('!r:x', true)
    expect(startTypingMock).not.toHaveBeenCalled()
  })

  it('关闭偏好时仍必须发送停止信号，避免对方界面卡在"正在输入"', async () => {
    setTypingPreference(false)
    await matrixTypingService.sendTypingNotification('!r:x', false)
    expect(stopTypingMock).toHaveBeenCalledWith('!r:x')
  })

  it('偏好开启时正常发送', async () => {
    setTypingPreference(true)
    await matrixTypingService.sendTypingNotification('!r:x', true)
    expect(startTypingMock).toHaveBeenCalled()
  })

  it('关闭偏好后 startTyping 走的是同一个守卫，不发送也不做 cleanup 记账', async () => {
    setTypingPreference(false)
    matrixTypingService.startTyping('!r:y', 30000)
    await Promise.resolve()
    expect(startTypingMock).not.toHaveBeenCalled()
  })
})
