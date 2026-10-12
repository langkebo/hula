import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

const { getUnverifiedMock, applyGlobalStrictMock, applyRoomStrictMock } = vi.hoisted(() => ({
  getUnverifiedMock: vi.fn(),
  applyGlobalStrictMock: vi.fn(() => true),
  applyRoomStrictMock: vi.fn(() => true)
}))

vi.mock('@/composables/encryption/useEncryption', () => ({
  useEncryption: () => ({ getUnverifiedDevicesInRoom: getUnverifiedMock })
}))

vi.mock('@/services/matrix/crypto/strictDevicePolicy', () => ({
  applyGlobalStrict: applyGlobalStrictMock,
  applyRoomStrict: applyRoomStrictMock
}))

import { useRoomStrictness } from '@/composables/encryption/useRoomStrictness'
import { useSettingStore } from '@/stores/domains/settings/setting'

describe('useRoomStrictness（R-1）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    applyGlobalStrictMock.mockReturnValue(true)
    applyRoomStrictMock.mockReturnValue(true)
  })

  it('用权威查询得出未验证设备台数', async () => {
    getUnverifiedMock.mockResolvedValue(['A', 'B'])
    const { unverifiedCount, status } = useRoomStrictness(() => '!r:e')
    await vi.waitFor(() => expect(status.value).toBe('ready'))
    expect(unverifiedCount.value).toBe(2)
    expect(getUnverifiedMock).toHaveBeenCalledWith('!r:e')
  })

  it('查询失败时不得退化为 0（必须区分"未知"与"都已验证"）', async () => {
    getUnverifiedMock.mockRejectedValue(new Error('房间不在本地 store'))
    const { unverifiedCount, status } = useRoomStrictness(() => '!r:e')
    await vi.waitFor(() => expect(status.value).toBe('failed'))
    expect(unverifiedCount.value).toBeNull()
  })

  it('roomId 为 null 时不做查询且状态为 idle', () => {
    const { status, unverifiedCount } = useRoomStrictness(() => null)
    expect(status.value).toBe('idle')
    expect(unverifiedCount.value).toBeNull()
    expect(getUnverifiedMock).not.toHaveBeenCalled()
  })

  it('默认不启用严格模式（互操作默认）', async () => {
    getUnverifiedMock.mockResolvedValue([])
    const { strictActive, roomOverride, globalStrict } = useRoomStrictness(() => '!r:e')
    await nextTick()
    expect(strictActive.value).toBe(false)
    expect(roomOverride.value).toBeNull()
    expect(globalStrict.value).toBe(false)
  })

  it('setRoomStrict(true) 既持久化又施加到 SDK', async () => {
    getUnverifiedMock.mockResolvedValue(['A'])
    const store = useSettingStore()
    const { setRoomStrict, strictActive } = useRoomStrictness(() => '!r:e')
    await nextTick()

    setRoomStrict(true)

    expect(store.strictUnverifiedRooms).toEqual(['!r:e'])
    expect(applyRoomStrictMock).toHaveBeenCalledWith('!r:e', true)
    expect(strictActive.value).toBe(true)
  })

  it('setRoomStrict(false) 传 null（= 跟随全局）并从持久化列表移除', async () => {
    getUnverifiedMock.mockResolvedValue(['A'])
    const store = useSettingStore()
    store.setRoomStrictUnverified('!r:e', true)
    const { setRoomStrict, strictActive } = useRoomStrictness(() => '!r:e')
    await nextTick()
    expect(strictActive.value).toBe(true)

    setRoomStrict(false)

    expect(store.strictUnverifiedRooms).toEqual([])
    expect(applyRoomStrictMock).toHaveBeenLastCalledWith('!r:e', null)
    expect(strictActive.value).toBe(false)
  })

  it('全局严格模式开启时，任何房间都视为严格模式', async () => {
    getUnverifiedMock.mockResolvedValue([])
    const store = useSettingStore()
    const { strictActive, setGlobalStrict, globalStrict } = useRoomStrictness(() => '!r:e')
    await nextTick()

    setGlobalStrict(true)

    expect(store.blockUnverifiedDevicesEnabled).toBe(true)
    expect(applyGlobalStrictMock).toHaveBeenCalledWith(true)
    expect(globalStrict.value).toBe(true)
    expect(strictActive.value).toBe(true)
  })

  it('切换房间会重新做权威查询', async () => {
    getUnverifiedMock.mockResolvedValue(['A'])
    const roomId = ref<string | null>('!a:e')
    const { unverifiedCount } = useRoomStrictness(roomId)
    await vi.waitFor(() => expect(unverifiedCount.value).toBe(1))

    getUnverifiedMock.mockResolvedValue(['A', 'B', 'C'])
    roomId.value = '!b:e'
    await vi.waitFor(() => expect(unverifiedCount.value).toBe(3))
    expect(getUnverifiedMock).toHaveBeenLastCalledWith('!b:e')
  })

  it('进入房间时会把已持久化的房间覆盖重新施加到 SDK', async () => {
    getUnverifiedMock.mockResolvedValue(['A'])
    const store = useSettingStore()
    store.setRoomStrictUnverified('!r:e', true)
    useRoomStrictness(() => '!r:e')
    await nextTick()
    expect(applyRoomStrictMock).toHaveBeenCalledWith('!r:e', true)
  })
})
