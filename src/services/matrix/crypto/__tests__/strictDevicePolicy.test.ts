import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cryptoState, getRoomMock } = vi.hoisted(() => ({
  cryptoState: { value: null as { globalBlacklistUnverifiedDevices: boolean } | null },
  getRoomMock: vi.fn()
}))

vi.mock('../CryptoSDKAdapter', () => ({
  cryptoSDKAdapter: {
    getCrypto: () => cryptoState.value,
    getClient: () => ({ getRoom: getRoomMock })
  }
}))

import {
  applyGlobalStrict,
  applyRoomStrict,
  readGlobalStrict,
  readRoomStrict,
  reapplyRoomStrict
} from '../strictDevicePolicy'

/** 造一个假房间：`setBlacklistUnverifiedDevices` 只写内存字段，与 SDK 同语义。 */
function makeRoom(initial: boolean | null = null) {
  // undefined = 未设置（SDK 的 getter 对 undefined 返回 null）；显式 null 也返回 null
  const state: { value: boolean | null | undefined } = { value: initial === null ? undefined : initial }
  return {
    setBlacklistUnverifiedDevices: vi.fn((value: boolean | null) => {
      state.value = value
    }),
    getBlacklistUnverifiedDevices: vi.fn(() => (state.value === undefined ? null : state.value))
  }
}

describe('strictDevicePolicy（R-1）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cryptoState.value = { globalBlacklistUnverifiedDevices: false }
  })

  describe('全局开关', () => {
    it('applyGlobalStrict 写可写属性并返回 true', () => {
      expect(applyGlobalStrict(true)).toBe(true)
      expect(cryptoState.value?.globalBlacklistUnverifiedDevices).toBe(true)
    })

    it('readGlobalStrict 反映真实值（false 不得被当成"未就绪"）', () => {
      expect(readGlobalStrict()).toBe(false)
      if (cryptoState.value) cryptoState.value.globalBlacklistUnverifiedDevices = true
      expect(readGlobalStrict()).toBe(true)
    })

    it('crypto 未就绪时 apply 返回 false、read 返回 null（不得伪造成 false）', () => {
      cryptoState.value = null
      expect(applyGlobalStrict(true)).toBe(false)
      // null 表示"未知"，与"明确关闭"必须区分：否则启动重放会误判为已一致
      expect(readGlobalStrict()).toBeNull()
    })
  })

  describe('房间级覆盖', () => {
    it('applyRoomStrict(true) 写入覆盖并可读回', () => {
      const room = makeRoom()
      getRoomMock.mockReturnValue(room)
      expect(applyRoomStrict('!r:e', true)).toBe(true)
      expect(room.setBlacklistUnverifiedDevices).toHaveBeenCalledWith(true)
      expect(readRoomStrict('!r:e')).toBe(true)
    })

    it('applyRoomStrict(null) 传 null 表达"跟随全局"（d.ts 只声明 boolean）', () => {
      const room = makeRoom(true)
      getRoomMock.mockReturnValue(room)
      expect(applyRoomStrict('!r:e', null)).toBe(true)
      expect(room.setBlacklistUnverifiedDevices).toHaveBeenCalledWith(null)
      expect(readRoomStrict('!r:e')).toBeNull()
    })

    it('房间不在本地 store 时返回 false（不得静默成功）', () => {
      getRoomMock.mockReturnValue(undefined)
      expect(applyRoomStrict('!missing:e', true)).toBe(false)
      expect(readRoomStrict('!missing:e')).toBeNull()
    })
  })

  describe('reapplyRoomStrict（冷启动重放）', () => {
    it('统计 applied / skipped，且跳过缺房间而不是抛错', () => {
      getRoomMock.mockImplementation((roomId: string) => (roomId === '!a:e' ? makeRoom() : undefined))
      expect(reapplyRoomStrict(['!a:e', '!b:e'])).toEqual({ applied: 1, skipped: 1 })
    })

    it('空列表不发任何写入', () => {
      expect(reapplyRoomStrict([])).toEqual({ applied: 0, skipped: 0 })
      expect(getRoomMock).not.toHaveBeenCalled()
    })
  })
})
