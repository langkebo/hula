import { beforeEach, describe, expect, it, vi } from 'vitest'

const { replaceMock, showDialogMock, loggerErrorMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(async () => undefined),
  showDialogMock: vi.fn(),
  loggerErrorMock: vi.fn()
}))

vi.mock('@/router', () => ({
  default: { replace: replaceMock }
}))

vi.mock('vant', () => ({
  showDialog: showDialogMock
}))

vi.mock('vant/es/dialog/style', () => ({}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: loggerErrorMock, debug: vi.fn() })
}))

import { mobileSessionEventStrategy } from '@/mobile/platform/sessionEventStrategy'

describe('mobile session event strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    replaceMock.mockResolvedValue(undefined)
  })

  it('ignores legacy video calls because Matrix Call.incoming owns the flow', () => {
    const handler = { handleVideoCall: vi.fn() }

    mobileSessionEventStrategy.handleLegacyVideoCall({ callerUid: 'user-1', isVideo: true }, handler)

    expect(handler.handleVideoCall).not.toHaveBeenCalled()
  })

  it('logs out, notifies the caller and returns to the mobile login page', async () => {
    const logout = vi.fn(async () => undefined)
    const onLoggedOut = vi.fn()

    await mobileSessionEventStrategy.handleRemoteLoginExpired({ logout, onLoggedOut })

    expect(logout).toHaveBeenCalledTimes(1)
    expect(onLoggedOut).toHaveBeenCalledTimes(1)
    expect(replaceMock).toHaveBeenCalledWith('/mobile/login')
    expect(showDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '登录失效',
        message: '您的账号已在其他设备登录，请重新登录'
      })
    )
  })

  it('swallows logout failures and reports them without showing the dialog', async () => {
    const logout = vi.fn(async () => {
      throw new Error('logout failed')
    })

    await mobileSessionEventStrategy.handleRemoteLoginExpired({ logout, onLoggedOut: vi.fn() })

    expect(loggerErrorMock).toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
    expect(showDialogMock).not.toHaveBeenCalled()
  })
})
