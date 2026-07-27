import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGuestMode } from '@/composables/app/useGuestMode'

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn()
}))

function createGuestServiceMock() {
  return {
    loginGuest: vi.fn().mockResolvedValue({
      access_token: 'guest-token',
      user_id: '@guest:server',
      device_id: 'GUEST_DEVICE'
    }),
    upgradeGuestAccount: vi.fn().mockResolvedValue(undefined),
    isGuest: vi.fn().mockResolvedValue(true),
    getGuestInfo: vi.fn().mockReturnValue(null)
  }
}

describe('useGuestMode — 访客模式 (§8.6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('初始状态为非访客模式', () => {
    const { isGuestMode } = useGuestMode(createGuestServiceMock() as never)
    expect(isGuestMode.value).toBe(false)
  })

  it('loginAsGuest 调用 guest service 并进入访客模式', async () => {
    const service = createGuestServiceMock()
    const { isGuestMode, loginAsGuest } = useGuestMode(service as never)

    await loginAsGuest()
    expect(service.loginGuest).toHaveBeenCalledTimes(1)
    expect(isGuestMode.value).toBe(true)
  })

  it('upgradeToUser 调用升级接口并退出访客模式', async () => {
    const service = createGuestServiceMock()
    const { isGuestMode, loginAsGuest, upgradeToUser } = useGuestMode(service as never)

    await loginAsGuest()
    expect(isGuestMode.value).toBe(true)

    await upgradeToUser('new-password')
    expect(service.upgradeGuestAccount).toHaveBeenCalledWith('new-password', undefined)
    expect(isGuestMode.value).toBe(false)
  })

  it('exitGuestMode 退出访客模式不调用升级', async () => {
    const service = createGuestServiceMock()
    const { isGuestMode, loginAsGuest, exitGuestMode } = useGuestMode(service as never)

    await loginAsGuest()
    expect(isGuestMode.value).toBe(true)

    exitGuestMode()
    expect(isGuestMode.value).toBe(false)
    expect(service.upgradeGuestAccount).not.toHaveBeenCalled()
  })

  it('loginAsGuest 失败时不进入访客模式', async () => {
    const service = createGuestServiceMock()
    service.loginGuest.mockRejectedValueOnce(new Error('server disabled guest'))
    const { isGuestMode, loginAsGuest } = useGuestMode(service as never)

    await expect(loginAsGuest()).rejects.toThrow('server disabled guest')
    expect(isGuestMode.value).toBe(false)
  })
})
