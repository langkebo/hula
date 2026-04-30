import { describe, expect, it } from 'vitest'
import { AppException } from '@/common/exception'
import { MsgEnum } from '@/enums'
import { BeaconMessageStrategyImpl } from '../beacon'
import { LocationMessageStrategyImpl } from '../location'

describe('LocationMessageStrategyImpl', () => {
  const strategy = new LocationMessageStrategyImpl()

  it('uses MsgEnum.LOCATION as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.LOCATION)
  })

  it('parses valid location JSON and applies defaults', () => {
    const input = JSON.stringify({
      latitude: 39.9042,
      longitude: 116.4074,
      address: '北京市'
    })
    const msg = strategy.getMsg(input, null) as Record<string, unknown>
    expect(msg.type).toBe(MsgEnum.LOCATION)
    expect(msg.latitude).toBe(39.9042)
    expect(msg.longitude).toBe(116.4074)
    expect(msg.address).toBe('北京市')
    expect(msg.precision).toBe('高精度')
    expect(typeof msg.timestamp).toBe('number')
    expect(msg.reply).toBeUndefined()
  })

  it('honors explicit precision and timestamp', () => {
    const input = JSON.stringify({
      latitude: 1,
      longitude: 2,
      address: 'X',
      precision: '低精度',
      timestamp: 12345
    })
    const msg = strategy.getMsg(input, null) as Record<string, unknown>
    expect(msg.precision).toBe('低精度')
    expect(msg.timestamp).toBe(12345)
  })

  it('throws on invalid JSON', () => {
    expect(() => strategy.getMsg('not-json', null)).toThrow(AppException)
    expect(() => strategy.getMsg('not-json', null)).toThrow('位置数据格式错误，必须是有效的JSON')
  })

  it('throws when required fields missing', () => {
    expect(() => strategy.getMsg(JSON.stringify({ latitude: 1 }), null)).toThrow('无效的位置数据，缺少必要字段')
  })

  it('buildMessageBody encodes precision into geo_uri (10 for high)', () => {
    const body = strategy.buildMessageBody(
      { type: MsgEnum.LOCATION, latitude: 1, longitude: 2, address: 'X', precision: '高精度', timestamp: 0 },
      null
    )
    expect(body.geo_uri).toBe('geo:1,2;u=10')
    expect(body.msgtype).toBe('m.location')
    expect(body.body).toBe('位置: X')
  })

  it('buildMessageBody uses 100 precision for non-high', () => {
    const body = strategy.buildMessageBody(
      { type: MsgEnum.LOCATION, latitude: 1, longitude: 2, address: 'X', precision: '低精度', timestamp: 0 },
      null
    )
    expect(body.geo_uri).toBe('geo:1,2;u=100')
  })
})

describe('BeaconMessageStrategyImpl', () => {
  const strategy = new BeaconMessageStrategyImpl()

  it('uses MsgEnum.BEACON as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.BEACON)
  })

  it('parses valid beacon JSON', () => {
    const input = JSON.stringify({ description: 'meet', timeout: 600, isLive: true })
    const msg = strategy.getMsg(input, null) as Record<string, unknown>
    expect(msg.type).toBe(MsgEnum.BEACON)
    expect(msg.description).toBe('meet')
    expect(msg.timeout).toBe(600)
    expect(msg.isLive).toBe(true)
  })

  it('throws on invalid JSON', () => {
    expect(() => strategy.getMsg('bad', null)).toThrow('信标数据格式错误，必须是有效的JSON')
  })

  it('throws when required fields missing', () => {
    expect(() => strategy.getMsg(JSON.stringify({ description: 'x' }), null)).toThrow('无效的信标数据，缺少必要字段')
  })

  it('buildMessageBody includes Matrix MSC3488 fields', () => {
    const body = strategy.buildMessageBody(
      { type: MsgEnum.BEACON, description: 'meet', timeout: 600, isLive: true },
      null
    )
    expect(body.msgtype).toBe('m.beacon_info')
    expect(body.description).toBe('meet')
    expect(body.timeout).toBe(600)
    expect(body.live).toBe(true)
    expect(body.body).toContain('开启了位置共享')
    expect((body['org.matrix.msc3488.asset'] as Record<string, unknown>)?.type).toBe('m.self')
    expect(typeof body['org.matrix.msc3488.ts']).toBe('number')
  })
})
