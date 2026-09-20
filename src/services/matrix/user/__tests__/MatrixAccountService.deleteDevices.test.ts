import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/utils/Logger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() })
}))

const deviceManager = vi.hoisted(() => ({
  deleteDevices: vi.fn(),
  deleteDevice: vi.fn(),
  getDevices: vi.fn(),
  getDevice: vi.fn(),
  renameDevice: vi.fn()
}))

const clientMock = vi.hoisted(() => ({
  getDeviceManager: vi.fn(() => deviceManager)
}))

vi.mock('../../MatrixClientService', () => ({
  default: { getClient: () => clientMock, getClientOrNull: () => clientMock },
  matrixClientService: { getClient: () => clientMock, getClientOrNull: () => clientMock }
}))

import { matrixAccountService } from '../MatrixAccountService'

/**
 * 契约回归：批量删除设备必须把 UIA auth 传给 SDK。
 *
 * 历史缺陷：调用 `deviceManager.deleteDevices(deviceIds, authData)`，但真实 SDK 的
 * `deleteDevices(request: string[] | IDeviceDeleteRequest)` **只接受一个参数**，
 * 运行时（lib/device/index.js）只在 request 是对象时才读取 request.auth，
 * 因此 authData 被静默丢弃——UIA 保护的批量删设备永远无法用 auth 重试，
 * 调用方却在 catch 里专门处理 401/M_FORBIDDEN，说明该症状实际出现过。
 */

describe('matrixAccountService.deleteDevices UIA auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deviceManager.deleteDevices.mockResolvedValue(undefined)
  })

  it('携带 auth 时以 { devices, auth } 调用 SDK', async () => {
    const auth = { type: 'm.login.password', session: 'sess-1', password: 'pw' }

    await matrixAccountService.deleteDevices(['D1', 'D2'], auth)

    expect(deviceManager.deleteDevices).toHaveBeenCalledTimes(1)
    expect(deviceManager.deleteDevices).toHaveBeenCalledWith({ devices: ['D1', 'D2'], auth })
  })

  it('无 auth 时也应使用对象形式（保持一致形状，避免 SDK 分支差异）', async () => {
    await matrixAccountService.deleteDevices(['D1'])

    expect(deviceManager.deleteDevices).toHaveBeenCalledWith({ devices: ['D1'] })
  })

  it('绝不把 auth 作为第二个位置参数传入（SDK 不读取第二个参数）', async () => {
    const auth = { type: 'm.login.password', session: 's' }

    await matrixAccountService.deleteDevices(['D1'], auth)

    const callArgs = deviceManager.deleteDevices.mock.calls[0]
    expect(callArgs).toHaveLength(1)
  })
})
