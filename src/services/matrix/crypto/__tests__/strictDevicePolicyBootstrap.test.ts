import { createPinia, setActivePinia } from 'pinia'
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

import { reapplyPersistedStrictness } from '@/services/matrix/crypto/strictDevicePolicyBootstrap'
import { useSettingStore } from '@/stores/domains/settings/setting'

describe('reapplyPersistedStrictness（R-1 启动重放）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    applyGlobalStrictMock.mockReturnValue(true)
    applyRoomStrictMock.mockReturnValue(true)
    readGlobalStrictMock.mockReturnValue(false)
  })

  it('默认（未开启严格模式）时不改写 SDK 的全局值', () => {
    const result = reapplyPersistedStrictness()
    // SDK 默认即为 false；"已一致"就不该写入，避免把 SDK 默认误记成用户的决定
    expect(readGlobalStrictMock).toHaveBeenCalled()
    expect(applyGlobalStrictMock).not.toHaveBeenCalled()
    expect(result.globalApplied).toBe(true)
    expect(result.globalDesired).toBe(false)
  })

  it('用户开启过全局严格模式时把它写回 SDK', () => {
    const store = useSettingStore()
    store.setBlockUnverifiedDevicesEnabled(true)
    readGlobalStrictMock.mockReturnValue(false)
    const result = reapplyPersistedStrictness()
    expect(applyGlobalStrictMock).toHaveBeenCalledWith(true)
    expect(result.globalDesired).toBe(true)
  })

  it('已一致时不再写全局（幂等）', () => {
    const store = useSettingStore()
    store.setBlockUnverifiedDevicesEnabled(true)
    readGlobalStrictMock.mockReturnValue(true)
    reapplyPersistedStrictness()
    expect(applyGlobalStrictMock).not.toHaveBeenCalled()
  })

  it('重放房间覆盖列表并统计跳过项', () => {
    const store = useSettingStore()
    store.setRoomStrictUnverified('!a:e', true)
    store.setRoomStrictUnverified('!b:e', true)
    applyRoomStrictMock.mockImplementation((roomId: string) => roomId === '!a:e')
    const result = reapplyPersistedStrictness()
    expect(result.rooms).toEqual({ applied: 1, skipped: 1 })
  })

  it('crypto 未就绪（readGlobalStrict 返回 null）时如实报告"暂不可应用"', () => {
    const store = useSettingStore()
    store.setBlockUnverifiedDevicesEnabled(true)
    readGlobalStrictMock.mockReturnValue(null)
    applyGlobalStrictMock.mockReturnValue(false)
    const result = reapplyPersistedStrictness()
    expect(result.globalApplied).toBe(false)
  })
})
