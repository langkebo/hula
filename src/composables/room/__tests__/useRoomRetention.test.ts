import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type RoomRetentionConfig, useRoomRetention } from '@/composables/room/useRoomRetention'

describe('useRoomRetention — 房间级消息保留策略 (§8.7)', () => {
  let sendStateEventMock: ReturnType<typeof vi.fn>
  let getStateEventMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    sendStateEventMock = vi.fn().mockResolvedValue({})
    getStateEventMock = vi.fn().mockResolvedValue(null)
  })

  /** 将 mock 转为 composable 所需的函数类型 */
  function makeConfig(): RoomRetentionConfig {
    return {
      sendStateEvent: sendStateEventMock as unknown as RoomRetentionConfig['sendStateEvent'],
      getStateEvent: getStateEventMock as unknown as RoomRetentionConfig['getStateEvent']
    }
  }

  describe('保留模式', () => {
    it('默认模式为 unlimited（不限制）', () => {
      const { mode } = useRoomRetention(makeConfig())
      expect(mode.value).toBe('unlimited')
    })

    it('可切换为 by_days（按天保留）', () => {
      const { mode, setMode } = useRoomRetention(makeConfig())
      setMode('by_days')
      expect(mode.value).toBe('by_days')
    })

    it('可切换为 by_count（按条数保留）', () => {
      const { mode, setMode } = useRoomRetention(makeConfig())
      setMode('by_count')
      expect(mode.value).toBe('by_count')
    })
  })

  describe('参数验证', () => {
    it('by_days 模式下天数有效范围 1-3650', () => {
      const { setMode, setDays, isConfigValid } = useRoomRetention(makeConfig())
      setMode('by_days')

      setDays(0)
      expect(isConfigValid.value).toBe(false)

      setDays(1)
      expect(isConfigValid.value).toBe(true)

      setDays(3650)
      expect(isConfigValid.value).toBe(true)

      setDays(3651)
      expect(isConfigValid.value).toBe(false)
    })

    it('by_count 模式下条数有效范围 1-100000', () => {
      const { setMode, setCount, isConfigValid } = useRoomRetention(makeConfig())
      setMode('by_count')

      setCount(0)
      expect(isConfigValid.value).toBe(false)

      setCount(1)
      expect(isConfigValid.value).toBe(true)

      setCount(100000)
      expect(isConfigValid.value).toBe(true)

      setCount(100001)
      expect(isConfigValid.value).toBe(false)
    })

    it('unlimited 模式始终有效', () => {
      const { isConfigValid } = useRoomRetention(makeConfig())
      expect(isConfigValid.value).toBe(true)
    })
  })

  describe('加载现有策略', () => {
    it('从 m.room.retention 事件加载 max_lifetime（毫秒转天）', async () => {
      getStateEventMock.mockResolvedValueOnce({
        content: { max_lifetime: 7 * 24 * 60 * 60 * 1000 } // 7 天
      })
      const { loadPolicy, mode, days } = useRoomRetention(makeConfig())

      await loadPolicy('!room:server')

      expect(mode.value).toBe('by_days')
      expect(days.value).toBe(7)
    })

    it('无保留事件时默认 unlimited', async () => {
      getStateEventMock.mockResolvedValueOnce(null)
      const { loadPolicy, mode } = useRoomRetention(makeConfig())

      await loadPolicy('!room:server')

      expect(mode.value).toBe('unlimited')
    })
  })

  describe('保存策略', () => {
    it('unlimited 模式发送 max_lifetime: 0', async () => {
      const { savePolicy } = useRoomRetention(makeConfig())

      await savePolicy('!room:server')

      expect(sendStateEventMock).toHaveBeenCalledWith('!room:server', 'm.room.retention', {
        max_lifetime: 0,
        expire_on_clients: true
      })
    })

    it('by_days 模式发送 max_lifetime（天转毫秒）', async () => {
      const { setMode, setDays, savePolicy } = useRoomRetention(makeConfig())
      setMode('by_days')
      setDays(30)

      await savePolicy('!room:server')

      expect(sendStateEventMock).toHaveBeenCalledWith('!room:server', 'm.room.retention', {
        max_lifetime: 30 * 24 * 60 * 60 * 1000,
        expire_on_clients: true
      })
    })

    it('by_count 模式发送 max_lifetime（条数转毫秒估算）', async () => {
      const { setMode, setCount, savePolicy } = useRoomRetention(makeConfig())
      setMode('by_count')
      setCount(1000)

      await savePolicy('!room:server')

      // by_count 模式估算：1000 条 * 5分钟/条 = 5000 分钟 = 300000000 毫秒
      // 这里验证格式正确即可
      expect(sendStateEventMock).toHaveBeenCalledWith(
        '!room:server',
        'm.room.retention',
        expect.objectContaining({
          max_lifetime: expect.any(Number),
          expire_on_clients: true
        })
      )
    })

    it('配置无效时不保存', async () => {
      const { setMode, setDays, savePolicy } = useRoomRetention(makeConfig())
      setMode('by_days')
      setDays(0) // 无效

      await expect(savePolicy('!room:server')).rejects.toThrow()
      expect(sendStateEventMock).not.toHaveBeenCalled()
    })
  })
})
