import { beforeEach, describe, expect, it, vi } from 'vitest'

const { setFocusMock, getByLabelMock, sendWindowPayloadMock } = vi.hoisted(() => {
  const setFocus = vi.fn(async () => undefined)
  return {
    setFocusMock: setFocus,
    getByLabelMock: vi.fn(async () => ({ setFocus })),
    sendWindowPayloadMock: vi.fn(async () => undefined)
  }
})

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: { getByLabel: getByLabelMock }
}))

vi.mock('@/composables/common/useWindow', () => ({
  useWindow: () => ({ sendWindowPayload: sendWindowPayloadMock })
}))

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })
}))

import { CallTypeEnum } from '@/enums'
import { mobileSessionEventStrategy } from '@/mobile/platform/sessionEventStrategy'
import { desktopSessionEventStrategy } from '@/platform/desktop/sessionEventStrategy'
import { getSessionEventStrategy, registerSessionEventStrategy } from '@/platform/sessionEventStrategy'

describe('session event strategy registry', () => {
  beforeEach(() => {
    registerSessionEventStrategy(desktopSessionEventStrategy)
    vi.clearAllMocks()
  })

  it('defaults to the desktop implementation', () => {
    expect(getSessionEventStrategy()).toBe(desktopSessionEventStrategy)
  })

  it('switches to the mobile implementation after registration', () => {
    registerSessionEventStrategy(mobileSessionEventStrategy)
    expect(getSessionEventStrategy()).toBe(mobileSessionEventStrategy)
  })

  it('restores the desktop implementation when registered as non-mobile', () => {
    registerSessionEventStrategy(mobileSessionEventStrategy)
    registerSessionEventStrategy(desktopSessionEventStrategy)
    expect(getSessionEventStrategy()).toBe(desktopSessionEventStrategy)
  })
})

describe('desktop session event strategy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards legacy video calls with the resolved call type', () => {
    const handler = { handleVideoCall: vi.fn() }

    desktopSessionEventStrategy.handleLegacyVideoCall({ callerUid: 'user-1', isVideo: true }, handler)
    desktopSessionEventStrategy.handleLegacyVideoCall({ callerUid: 'user-2', isVideo: false }, handler)

    expect(handler.handleVideoCall).toHaveBeenNthCalledWith(1, 'user-1', CallTypeEnum.VIDEO)
    expect(handler.handleVideoCall).toHaveBeenNthCalledWith(2, 'user-2', CallTypeEnum.AUDIO)
  })

  it('focuses the home window and forwards the remote login payload', async () => {
    const logout = vi.fn(async () => undefined)

    await desktopSessionEventStrategy.handleRemoteLoginExpired({ remoteIp: '1.2.3.4', logout, onLoggedOut: vi.fn() })

    expect(getByLabelMock).toHaveBeenCalledWith('home')
    expect(setFocusMock).toHaveBeenCalled()
    expect(sendWindowPayloadMock).toHaveBeenCalledWith('login', {
      remoteLogin: { ip: '1.2.3.4', timestamp: expect.any(Number) }
    })
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it('falls back to a placeholder ip when the payload has none', async () => {
    await desktopSessionEventStrategy.handleRemoteLoginExpired({
      logout: vi.fn(async () => undefined),
      onLoggedOut: vi.fn()
    })

    expect(sendWindowPayloadMock).toHaveBeenCalledWith('login', {
      remoteLogin: { ip: '未知IP', timestamp: expect.any(Number) }
    })
  })
})
