import { describe, expect, it } from 'vitest'
import type { BeaconBody } from '@/services/types'
import { formatBeaconRemainingTime, isBeaconActive } from '@/utils/beacon'

const liveBody: BeaconBody = {
  description: '一起走',
  timeout: 3600000,
  isLive: true,
  lastUpdateTs: 1700000000000
}

describe('isBeaconActive', () => {
  it('isLive 为 false 时恒为未共享', () => {
    expect(isBeaconActive({ ...liveBody, isLive: false }, 1700000000000)).toBe(false)
  })

  it('在 timeout 窗口内为共享中', () => {
    expect(isBeaconActive(liveBody, 1700000000000 + 3599000)).toBe(true)
  })

  it('超过 timeout 窗口后为已结束', () => {
    expect(isBeaconActive(liveBody, 1700000000000 + 3600000)).toBe(false)
  })

  it('无 body 时为未共享', () => {
    expect(isBeaconActive(undefined, Date.now())).toBe(false)
  })
})

describe('formatBeaconRemainingTime', () => {
  it('不足 1 小时格式化为 MM:SS', () => {
    const body: BeaconBody = { ...liveBody, timeout: 3599000 }
    expect(formatBeaconRemainingTime(body, 1700000000000)).toBe('59:59')
  })

  it('超过 1 小时格式化为 HH:MM:SS', () => {
    const body: BeaconBody = { ...liveBody, timeout: 7200000 }
    expect(formatBeaconRemainingTime(body, 1700000000000)).toBe('02:00:00')
  })

  it('已结束返回 00:00', () => {
    expect(formatBeaconRemainingTime(liveBody, 1700000000000 + 3600000)).toBe('00:00')
  })

  it('无 body 返回 00:00', () => {
    expect(formatBeaconRemainingTime(undefined, Date.now())).toBe('00:00')
  })
})
