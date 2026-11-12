import { beforeEach, describe, expect, it, vi } from 'vitest'

const { applyGlobalStrictMock, applyRoomStrictMock, readGlobalStrictMock } = vi.hoisted(() => ({
  applyGlobalStrictMock: vi.fn((_value: boolean) => true),
  applyRoomStrictMock: vi.fn((_roomId: string, _strict: boolean | null) => true),
  readGlobalStrictMock: vi.fn<() => boolean | null>(() => false)
}))

vi.mock('@/services/matrix/crypto/strictDevicePolicy', () => ({
  applyGlobalStrict: applyGlobalStrictMock,
  applyRoomStrict: applyRoomStrictMock,
  readGlobalStrict: readGlobalStrictMock
}))

import {
  reapplyPersistedStrictness,
  registerStrictDevicePolicyPreferences
} from '@/services/matrix/crypto/strictDevicePolicyBootstrap'

let globalStrict = false
let roomOverrides: readonly string[] = []
let ensureLoadedMock: () => void

describe('reapplyPersistedStrictness（R-1 启动重放）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyGlobalStrictMock.mockReturnValue(true)
    applyRoomStrictMock.mockReturnValue(true)
    readGlobalStrictMock.mockReturnValue(false)

    // 偏好由应用入口注入（S7：service 不再 import store），测试直接注入读取器
    globalStrict = false
    roomOverrides = []
    ensureLoadedMock = vi.fn()
    registerStrictDevicePolicyPreferences({
      ensureLoaded: ensureLoadedMock,
      isBlockUnverifiedDevicesEnabled: () => globalStrict,
      listRoomOverrides: () => roomOverrides
    })
  })

  it('默认（未开启严格模式）时不改写 SDK 的全局值', () => {
    const result = reapplyPersistedStrictness()
    // SDK 默认即为 false；"已一致"就不该写入，避免把 SDK 默认误记成用户的决定
    expect(ensureLoadedMock).toHaveBeenCalledTimes(1)
    expect(readGlobalStrictMock).toHaveBeenCalled()
    expect(applyGlobalStrictMock).not.toHaveBeenCalled()
    expect(result.globalApplied).toBe(true)
    expect(result.globalDesired).toBe(false)
  })

  it('用户开启过全局严格模式时把它写回 SDK', () => {
    globalStrict = true
    readGlobalStrictMock.mockReturnValue(false)
    const result = reapplyPersistedStrictness()
    expect(applyGlobalStrictMock).toHaveBeenCalledWith(true)
    expect(result.globalDesired).toBe(true)
  })

  it('已一致时不再写全局（幂等）', () => {
    globalStrict = true
    readGlobalStrictMock.mockReturnValue(true)
    reapplyPersistedStrictness()
    expect(applyGlobalStrictMock).not.toHaveBeenCalled()
  })

  it('重放房间覆盖列表并统计跳过项', () => {
    roomOverrides = ['!a:e', '!b:e']
    applyRoomStrictMock.mockImplementation((roomId: string) => roomId === '!a:e')
    const result = reapplyPersistedStrictness()
    expect(result.rooms).toEqual({ applied: 1, skipped: 1 })
  })

  it('crypto 未就绪（readGlobalStrict 返回 null）时如实报告"暂不可应用"', () => {
    globalStrict = true
    readGlobalStrictMock.mockReturnValue(null)
    applyGlobalStrictMock.mockReturnValue(false)
    const result = reapplyPersistedStrictness()
    expect(result.globalApplied).toBe(false)
  })
})
